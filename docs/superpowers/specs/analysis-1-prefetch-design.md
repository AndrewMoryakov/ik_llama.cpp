# Analysis 1 — Variant B: Cross-Layer Expert Prefetch (engineering design)

Grounded in the actual ik_llama.cpp fork at `O:\user files\Projects\ik_llama.cpp`. Companion to `docs/superpowers/specs/2025-moe-ssd-inference-speedup.md` (Variant B). Target: MiniMax M2.7, 230B/~10B active, 62 layers, 256 experts top-8, **no shared experts**, sigmoid routing + learnable bias. ~115 GB quant on a 96 GB box → the model **cannot** fully reside in RAM.

## 0. Governing reality: this is a demand-paging problem, not a copy problem
- Quant ≈ 115 GB, RAM = 96 GB → **~25–35 GB of the model (almost all expert weights) is never resident** once KV/compute working set is subtracted.
- ~5 GB expert bytes read/token × 62 layers; at 1.5–2 t/s that is ~7.5–10 GB/s, most faulting from the Samsung 970 (Gen3, ~3.5 GB/s seq, far less at 4K random). **The SSD page-fault path is the bottleneck**, not GEMV compute.
- **Verified load path:** `llama_model_loader::load_all_data` (`src/llama-model-loader.cpp:1054`) has a zero-copy branch where, for host buffers under mmap, `tensor->data` is pointed *directly at the mmap base* (`:1149`, the `ggml_backend_buffer_is_host(cur->buffer)` path). `init_mappings` (`:983`, `:990-993`) creates the `llama_mmap` and optionally mlocks it. So expert tensors live in the OS page cache backed by the file and are demand-paged on first touch inside `ggml_mul_mat_id`.
- Therefore the task's "fallback if the load path is pure-mmap" **is the main case, not a fallback.** The whole of Variant B is about making that page cache behave: pin hot experts, prefetch cold ones before the GEMV faults.

## 1. Statistics logging hook — building the hot-expert map
- **Where selection exists:** `llm_build_moe_ffn` (`src/llama-build-context.cpp`): `logits = llm_build_lora_mm(gate_inp,cur)` (`:1040`) → `ggml_sigmoid` (`:1058`) → `+ exp_probs_b` bias → `selection_probs` (`:1073`) → `selected_experts = ggml_top_k(ctx, selection_probs, n_expert_used)` (`:1091`), tagged `cb(selected_experts,"ffn_moe_topk",il)` (`:1093`).
- `selected_experts` is a *computed* int32 tensor → readable only after `ggml_backend_sched_graph_compute`. **Hook:** under env flag `LLAMA_MOE_STATS=1`, `ggml_set_output(selected_experts)` at build, stash `(il, tensor*)` on `llama_context`, and after compute in `llama_decode_internal` (`src/llama.cpp`) `ggml_backend_tensor_get` the `[n_expert_used, n_tokens]` ids into an accumulator.
- **On-disk:** (1) `moe_stats.bin` = `uint32 count[62][256]` (~63 KB), atomic at exit; (2) `moe_hotmap.json` = per-layer experts sorted by count + cumulative-mass cutoff (e.g. 80%). Optional co-occurrence pair counts — **UNVERIFIED** whether they beat marginal frequency for M2.7.
- Effort **~1.5 d**, low risk (read-only, gated).

## 2. Pinning map — hot experts → `-ot` + mlock, mmap interaction
- **Verified `-ot`:** `--override-tensor` builds `{std::regex, buffer_type}` list; `llama_rtr_auto_compile_overrides` compiles regexes (`src/llama.cpp:3678-3701`); `:2888` force-assigns experts to CPU buffers; `:3793` pins CPU buffers unless `GGML_CUDA_NO_PINNED`.
- On CPU-only we can't move experts to another device; we want them **locked resident**. `mlock_mmaps` (`:990-993`) is whole-mapping (would try to lock 115 GB → fails). Need **per-fragment lock**.
- **Design:** new CLI `--pin-experts moe_hotmap.json[:budget_gb]`. After `load_all_data` sets `tensor->data` to mmap offsets, resolve each hot expert's `[addr,size)` and POSIX `mlock`+`posix_madvise(WILLNEED)`, or Windows `VirtualLock` after enabling `SeLockMemoryPrivilege`. Fill by descending count until budget (~20 GB) spent.
- **mmap interaction (critical):** because tensors alias the shared mapping (`:1149`), locking the file page is exactly right. Ensure pinned ranges never fall in an `unmap_fragment`/`MADV_DONTNEED` region (`src/llama-mmap.cpp:383`). Routing experts into a *copied* HOST buffer via `-ot` defeats pin-by-mmap → `--pin-experts` must operate on the mmap path and be mutually exclusive with copy-out `-ot` for the same tensors.
- Effort **~2 d**, medium risk (Windows privilege dance; falls back to prefetch-only).

## 3. Cross-layer predictor — run routers of l+1..l+3 early
- **Core coupling:** `selected_experts` at layer *l* is known only when eval reaches `ggml_top_k` (`:1091`) — too late to prefetch *l*'s own experts. Prefetch only pays if IDs are known *ahead* of the compute front. That lead time is exactly what the predictor produces.
- **Cost — cheap & confirmed:** each router is a `[256×3072]` GEMV (`:1040`) + sigmoid + bias + top_k (~0.8M MACs) ×3 layers, trivial vs 62×8 expert GEMVs. Router weights `blk.*.ffn_gate_inp.weight` (~0.75 MB fp16) are tiny — add them to §2's pin set unconditionally.
- **Hidden state IS available early:** the residual `cur` entering the MoE block exists in-graph; feeding it into a later layer's `gate_inp` is legal.
- **⚠ Accuracy UNVERIFIED — the crux:** the true input to layer l+k's router is the residual *after* layers l..l+k-1, which mutates. Depth-1 likely useful, depth-2/3 speculative; ExpertFlow/PowerInfer report decaying hit-rate — **not measured for M2.7 sigmoid+bias routing.** §1 harness must log predicted-vs-actual top-8 overlap per horizon before trusting it.
- **Integration:** (A) in-graph speculative routers (build `gate_inp[l+1..l+3]` on `cur`, set top_k as outputs) — recommended, depth-1 first; (B) out-of-graph mini router-only graph on prior token's hidden — more lead, needs readback hook.
- Effort **~3 d**, medium-high accuracy risk, low cost.

## 4. Async prefetch thread
- **Trigger:** predictor emits future-layer expert ids → resolve to mmap `[addr,size)` → hand to worker.
- **Mechanism (all primitives already in `src/llama-mmap.cpp`):** Windows `PrefetchVirtualMemory` via `pPrefetchVirtualMemory`/`GetProcAddress(hKernel32,"PrefetchVirtualMemory")` (`:457-472`) — reuse verbatim, build `WIN32_MEMORY_RANGE_ENTRY[]` for predicted ranges, call on the worker with live `addr`. POSIX `posix_madvise(WILLNEED)` (`:319`); evict via `madvise(MADV_DONTNEED)` (`:383`).
- **Where:** in decode loop right after §3 router readback, before the scheduler reaches those FFN nodes; ggml executes node-by-node so a real window exists. Use one dedicated low-priority thread + SPSC ring/condvar queue; **do not** contend the compute threadpool.
- **Cache/eviction:** soft resident budget (RAM − KV − compute − pinned ≈ 40–50 GB). Pinned never evicted; prefetched tracked LFU (seeded by §1); budget-guarded `DONTNEED`/`VirtualUnlock` coldest. Caveat: OS page cache is already an uncontrolled LRU — our hints are advisory; keep the userspace layer to "avoid redundant prefetch + drop provably-cold."
- Effort **~3–4 d**, medium risk (over-prefetch can evict useful pages → must be measured, env kill-switch).

## 5. Risks, effort, fallback
| Piece | Effort | Main risk |
|---|---|---|
| §1 stats hook | ~1.5 d | low (read-only) |
| §2 pinning | ~2 d | Windows `SeLockMemoryPrivilege`; must not copy out of mmap |
| §3 predictor | ~3 d | **accuracy unverified for M2.7 sigmoid routing (crux)** |
| §4 prefetch | ~3–4 d | over-prefetch evicts hot pages |
| **Total** | **~10–11 d** | measurement/integration dominates |

**Top risks:** (1) predictor hit-rate too low → wasted SSD bandwidth (measure overlap in §1 first, ship depth-1 only if justified); (2) prefetch-induced thrash on a RAM-tight box (strict budget, protect pinned set, kill-switch); (3) **regime may be RAM-bandwidth-bound not SSD-bound** once hot experts are resident — if so, prefetch yields little and effort shifts to quant/`-ser` (Variant A) — **UNVERIFIED until §1 + a resident-set experiment run.**

**Fallback for pure-mmap** (the primary path, per §0): if selective `mlock`/`VirtualLock` is denied, degrade to **prefetch-only** (`PrefetchVirtualMemory`/`WILLNEED`, no pinning). If the predictor proves inaccurate, fall back to **static prefetch**: at layer *l*, `WILLNEED` the §1 top-K hottest experts of l+1..l+3 (frequency prior, zero predictor risk).

**Explicitly unverified:** page-fault vs RAM-BW split at M2.7 scale (no profiling done); cross-layer router hit-rate for sigmoid+bias routing; whether `ggml_top_k` (`:1091`) can be forced to a graph output without perturbing the fused `moe_up_gate` path (`:1149-1170`) — needs a build test; Windows `SeLockMemoryPrivilege` availability on target.
