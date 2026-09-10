# Analysis 1 — Variant B: Cross-Layer Expert Prefetch (engineering design)

> **STATUS: HISTORICAL DESIGN, DO NOT IMPLEMENT.** Step0 rejected the premise
> required by this proposal: adjacent tokens share too few experts for the
> previous-token prefetch to recover enough physical traffic. See
> [`evidence-8-step0-locality-2026-09-09.md`](../../sessions/2026-09-08-upstream-merge/evidence-8-step0-locality-2026-09-09.md)
> §4 and §6. Keep this file as the design that was tested. Reopen it only after
> a new predictor demonstrates useful byte recall on a real routing trace.

Grounded in the actual ik_llama.cpp fork at `O:\user files\Projects\ik_llama.cpp`. Companion to `docs/superpowers/specs/2025-moe-ssd-inference-speedup.md` (Variant B). Target: MiniMax M2.7, 230B/~10B active, 62 layers, 256 experts top-8, **no shared experts**, sigmoid routing + learnable bias. ~115 GB quant on a 96 GB box → the model **cannot** fully reside in RAM.

## 0. Governing reality: this is a demand-paging problem, not a copy problem
- Quant ≈ 115 GB, RAM = 96 GB → **~25–35 GB of the model (almost all expert weights) is never resident** once KV/compute working set is subtracted.
- ~4.9–5 GB/token is the estimated **logical** active-weight stream. It cannot
  all be physical SSD traffic at 1.5–2 t/s on a 3.5 GB/s device: `4.9/3.5 =
  1.4 s/token = 0.71 t/s`. The physical miss volume and whether SSD page faults
  dominate are hypotheses until Step0 measures them.
- **Verified load path:** `llama_model_loader::load_all_data` (`src/llama-model-loader.cpp:1054`) has a zero-copy branch where, for host buffers under mmap, `tensor->data` is pointed *directly at the mmap base* (`:1149`, the `ggml_backend_buffer_is_host(cur->buffer)` path). `init_mappings` (`:983`, `:990-993`) creates the `llama_mmap` and optionally mlocks it. So expert tensors live in the OS page cache backed by the file and are demand-paged on first touch inside `ggml_mul_mat_id`.
- Therefore the task's "fallback if the load path is pure-mmap" **is the main
  case, not a fallback.** Variant B is worth implementing only if Step0 and trace
  show enough physical misses and predictable locality.

## 1. Statistics logging hook — building the hot-expert map
- **Where selection exists:** `llm_build_moe_ffn` (`src/llama-build-context.cpp`): `logits = llm_build_lora_mm(gate_inp,cur)` (`:1040`) → `ggml_sigmoid` (`:1058`) → `+ exp_probs_b` bias → `selection_probs` (`:1073`) → `selected_experts = ggml_top_k(ctx, selection_probs, n_expert_used)` (`:1091`), tagged `cb(selected_experts,"ffn_moe_topk",il)` (`:1093`).
- `selected_experts` is computed. Without an eval callback/output split it is
  readable only after the whole graph; a mid-graph callback exposes it after its
  segment but forces backend synchronization (§4). Experimental trace v1 uses
  `ggml_backend_sched_set_eval_callback` as this observation interface and reads
  the router nodes there. That is valid for instrumentation, but it is not a
  cheap production trigger: making the nodes observable creates scheduler
  splits/synchronization boundaries. The trace run's timing and I/O counters are
  therefore invalid as baseline performance measurements.
- **On-disk:** preserve ordered per-token records, not only aggregates:
  `(token, layer, rank, expert_id, biased_selection_score,
  contribution_weight)`. MiniMax selects using biased `selection_probs`, but
  mixes experts with the gathered unbiased probability; SER simulation needs
  both. Byte ranges are **not** duplicated in this dynamic trace: a separate,
  validated GGUF expert-layout manifest resolves `(layer, expert)` into exact
  shard-local ranges. Aggregated counts/hotmaps can be derived from the joined
  trace+manifest artifacts; the reverse is impossible.
- Effort **~1.5 d**, low risk (read-only, gated).

### 1.1 Routing trace + offline cache simulator

The simulator is a **prioritization tool**, not a post-intervention oracle.
Experimental v1 is implemented in `tools/moe_cache_sim/` (schema/commands and
limitations: `tools/moe_cache_sim/README.md`): versioned target-decode trace,
GGUF expert-layout manifest, LRU/LFU/static cache policies, none/previous-token/
oracle scenarios, logical/page/chunk bytes, predictor recall and prefetch waste.
A mechanical end-to-end smoke passed on Qwen3-Coder-30B-A3B; its hit rates must
not be transferred to MiniMax.

V1 intentionally models previous-token as route-JIT locality and has no timed
I/O queue. Its prefetch fills are idealized as immediately available at the
route boundary: this measures prediction/locality and pollution, not usable
lead, completion, overlap, physical bytes, or speedup. Token-boundary scheduling,
cross-layer/speculative-union predictors and **true peak inflight bytes** remain
part of the production-prefetch stage, not claims made by this cache-locality
simulator. The old ~1.5-day estimate covered only the minimal hook, not this
simulator or backend-overhead tests.

The implemented demand contract is the explicit `cpu-ggml-phase-v1`
approximation. It models logical CPU phases (`gate_up`→`down` for a fused
manifest; `up`→`gate`→`down` for separate/unfused; approximate interleaved
`up_gate`→`down` for separate/fused), with ascending expert IDs and per-phase
deduplication. A requested fused runtime mode falls back per layer to unfused
when gate/up GGML types differ, as graph construction does, and reports a mixed
execution mode when applicable. It does not claim exact kernel row/block/thread order, exact
page-fault order, OS read-ahead, or GPU/RPC/offload behaviour. Results record
this access contract, effective chunk-rounded cache size, the layout fingerprint
and SHA-256 provenance for evaluated trace (and static calibration trace).
Static calibration must be a genuinely separate, byte-distinct run, not the
same trace under another path/hardlink/copy.

Counterfactual limit: a baseline trace is locally exact only while hidden state
is unchanged. Top-k/SER change the first affected MoE output, then later routes
and autoregressive tokens diverge; pruning can additionally force same-router
replacement. Baseline trace is acceptable for open-loop/first-order ranking,
but every top-k/SER/pruned runtime needs a fresh real trace before claims about
physical I/O or quality. Mechanics may be developed on Qwen3-Coder, but its hit
rates must not be transferred to MiniMax.

## 2. Selective pinning map — новая mmap-резиденция, не `-ot`/whole-map mlock
- **Verified `-ot`:** `--override-tensor` builds `{std::regex, buffer_type}` list; `llama_rtr_auto_compile_overrides` compiles regexes (`src/llama.cpp:3678-3701`); `:2888` force-assigns experts to CPU buffers; `:3793` pins CPU buffers unless `GGML_CUDA_NO_PINNED`.
- On CPU-only we can't move experts to another device; we want them **locked resident**. `mlock_mmaps` (`:990-993`) is whole-mapping (would try to lock 115 GB → fails). Need **per-fragment lock**.
- **Design:** new CLI `--pin-experts moe_hotmap.json[:budget_gb]`. After
  `load_all_data` resolves mmap offsets, map each hot expert to `[addr,size)`.
  POSIX uses `mlock`/`WILLNEED`; Windows ordinary mmap `VirtualLock` is primarily
  constrained by process working-set quota and does **not** require/produce
  large pages. Fill only within a measured safe budget.
- Existing `--defer-experts`/`expert_tensor_index` does **not** supply these
  ranges: today it indexes whole expert tensors, not `(layer, expert)` slabs, and
  the residency path is Linux-only. A real implementation needs
  `weight.offs + expert*nb[2]`, page alignment, shard handling and an index whose
  lifetime reaches decode.
- **mmap interaction (critical):** because tensors alias the shared mapping (`:1149`), locking the file page is exactly right. Ensure pinned ranges never fall in an `unmap_fragment`/`MADV_DONTNEED` region (`src/llama-mmap.cpp:383`). Routing experts into a *copied* HOST buffer via `-ot` defeats pin-by-mmap → `--pin-experts` must operate on the mmap path and be mutually exclusive with copy-out `-ot` for the same tensors.
- Effort **~2 d**, medium risk (Windows privilege dance; falls back to prefetch-only).

## 3. Predictor order

### 3.1 Previous-token predictor — first production prototype

All per-layer expert IDs from token `t-1` are known before decode of token `t`,
so this mode avoids mid-graph readback. Issue requests in layer order and cap
inflight bytes. Lead is non-uniform: almost zero for the earliest layers and
approaches most of a forward pass for late layers. Gate implementation on
adjacent-token Jaccard/byte recall, captured routing mass, useful prefetched
bytes and wasted-prefetch bytes. The current offline `previous-token` scenario
is only idealized route-JIT; it does not yet implement this token-boundary queue
or prove that fills complete within the available per-layer lead.

### 3.2 Cross-layer predictor — secondary experiment
- **Core coupling:** `selected_experts` at layer *l* is known only when eval reaches `ggml_top_k` (`:1091`) — too late to prefetch *l*'s own experts. Prefetch only pays if IDs are known *ahead* of the compute front. That lead time is exactly what the predictor produces.
- **Cost — cheap & confirmed:** each router is a `[256×3072]` GEMV (`:1040`) + sigmoid + bias + top_k (~0.8M MACs) ×3 layers, trivial vs 62×8 expert GEMVs. Router weights `blk.*.ffn_gate_inp.weight` (~0.75 MB fp16) are tiny — add them to §2's pin set unconditionally.
- **Hidden state IS available early:** the residual `cur` entering the MoE block exists in-graph; feeding it into a later layer's `gate_inp` is legal.
- **⚠ Accuracy UNVERIFIED — the crux:** the true input to layer l+k's router is the residual *after* layers l..l+k-1, which mutates. Depth-1 likely useful, depth-2/3 speculative; ExpertFlow/PowerInfer report decaying hit-rate — **not measured for M2.7 sigmoid+bias routing.** §1 harness must log predicted-vs-actual top-8 overlap per horizon before trusting it.
- **Integration:** in-graph speculative routers can build
  `gate_inp[l+1..l+3]` on `cur`, depth-1 first. This remains secondary until it
  beats the much simpler previous-token baseline after accounting for readback
  and synchronization.
- Effort **~3 d**, medium-high accuracy risk, low cost.

## 4. Async prefetch thread
- **Trigger:** predictor emits future-layer expert ids → resolve to mmap `[addr,size)` → hand to worker.
- **Mechanism (all primitives already in `src/llama-mmap.cpp`):** Windows `PrefetchVirtualMemory` via `pPrefetchVirtualMemory`/`GetProcAddress(hKernel32,"PrefetchVirtualMemory")` (`:457-472`) — reuse verbatim, build `WIN32_MEMORY_RANGE_ENTRY[]` for predicted ranges, call on the worker with live `addr`. POSIX `posix_madvise(WILLNEED)` (`:319`); evict via `madvise(MADV_DONTNEED)` (`:383`).
- **Where/trigger gap:** `ggml_backend_sched_set_eval_callback` and
  `lctx.cparams.cb_eval` provide observation, but making router nodes observable
  creates scheduler split/synchronization boundaries. At 62 routers/token this
  can erase the prefetch gain. Use callbacks only for measurement/prototype and
  never reuse trace-run timing as the A/B baseline. Previous-token mode is the
  no-mid-graph-readback default; production cross-layer prefetch still lacks a
  cheap trigger and may need a custom node/kernel hook with clear lifetime,
  cancellation and queue semantics.
- **Cache/eviction:** soft resident budget (RAM − KV − compute − pinned).
  POSIX `DONTNEED` may hint cold ranges. Windows `VirtualUnlock` only unlocks a
  range previously locked; it is **not** eviction for prefetch-only pages.
  Therefore the initial Windows prototype must leave eviction OS-managed; a
  deterministic policy needs an explicit slab cache rather than mmap hints.
- Effort **~3–4 d**, medium risk (over-prefetch can evict useful pages → must be measured, env kill-switch).

## 5. Risks, effort, fallback
| Piece | Effort | Main risk |
|---|---|---|
| §1 stats hook | ~1.5 d | low (read-only) |
| §2 pinning | conditional | Windows working-set quota; must not copy out of mmap |
| §3 predictor | conditional | overlap, usable lead and trigger cost unverified |
| §4 prefetch | ~3–4 d | over-prefetch evicts hot pages |
| **Total** | **not fixed before trace/trigger prototype** | measurement/integration dominates |

**Top risks:** (1) predictor hit-rate/lead too low → wasted SSD bandwidth;
(2) callback synchronization costs more than hidden I/O; (3) prefetch-induced
thrash on a RAM-tight box; (4) regime may not be SSD-throughput-bound. Measure
each before moving from previous-token prototype to cross-layer production code.

**Fallback for pure-mmap** (the primary path, per §0): if selective `mlock`/`VirtualLock` is denied, degrade to **prefetch-only** (`PrefetchVirtualMemory`/`WILLNEED`, no pinning). If the predictor proves inaccurate, fall back to **static prefetch**: at layer *l*, `WILLNEED` the §1 top-K hottest experts of l+1..l+3 (frequency prior, zero predictor risk).

**Explicitly unverified:** page-fault vs RAM-BW split at M2.7 scale; adjacent
token and cross-layer overlap for sigmoid+bias routing; callback/readback cost;
whether `ggml_top_k` can be forced to a graph output without perturbing fused
`moe_up_gate`; Windows working-set limits and practical selective-lock budget.
