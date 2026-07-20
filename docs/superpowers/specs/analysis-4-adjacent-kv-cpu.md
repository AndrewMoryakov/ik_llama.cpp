# Direction #4 ("Adjacent") — KV Cache at Long Context & CPU Generation Levers on AMD AM5

Scope: MiniMax M2.7 (`LLM_ARCH_MINIMAX_M2`), 230B total / ~10B active, 62 layers, hidden 3072, 256 experts top-8, no shared experts, SwiGLU, GQA 48 query heads / 8 KV heads, RoPE + QK-RMSNorm, 200K context. Fork: `O:\user files\Projects\ik_llama.cpp`. Hardware: AMD AM5, 96 GB RAM, Samsung 970 NVMe Gen3, CPU-only. Baseline: 1.5–2 t/s decode.

## PART A — KV cache at long context (up to 200K)

### A.1 Architecture check: GQA, not MLA

Confirmed directly from the graph-builder source, `src/graphs/build_minimaxm2.cpp` (dispatched from `src/llama-build-context.cpp:2441-2443`, `case LLM_ARCH_MINIMAX_M2: result = llm.build_minimaxm2();`):

- Standard per-layer K/V projections (`wk`, `wv`) into a plain `kv_self` cache — view/copy calls on the KV cache buffer, followed by a conventional QK^T softmax / flash-attn path.
- QK-RMSNorm is applied to `Qcur`/`Kcur` before RoPE (`Qcur_normed`, `Kcur_normed`, `LLM_NORM_RMS`), consistent with the architecture description.
- No absorption matrices, no `wk_b`/`wv_b`, no latent-vector cache, no rank-reduced projection — none of the MLA-specific machinery is present.

MLA in this fork is DeepSeek-specific. The cited PRs are all scoped to DeepSeek:
- `github-data/pull_requests/235 - Option to use MLA without a transposed cache.md`
- `github-data/pull_requests/259 - Prepare wk_b tensors of DeepSeek models on the fly.md`
- `github-data/pull_requests/260 - FlashMLA-2_ reduce compute buffer size _CUDA and CPU_.md`
- `github-data/pull_requests/386 - FlashMLA-3 for DeepSeek models on CUDA.md`
- `github-data/pull_requests/394 - Handle incompatible DeepSeek GGUFs.md`
- `github-data/pull_requests/400 - Fix CUDA DeepSeek FlashMLA-3 with quantized KV cache.md`

**Conclusion: M2.7 gets none of the MLA/FlashMLA memory or compute wins. Its KV cache is plain multi-head GQA**, sized by `n_head_kv` and `head_dim`, with no latent compression. This is architecturally fixed for M2.7 without new, model-specific work (out of scope for a quick win).

### A.2 KV cache size formula and head_dim

From `src/llama-hparams.h`, per-layer KV size is `n_head_kv(il) * n_embd_head_k(il)` (and same for V). Given the task's hyperparameters (hidden=3072, n_head=48, n_head_kv=8):

```
head_dim = hidden / n_head = 3072 / 48 = 64
KV_bytes = 2(K+V) × n_head_kv × head_dim × n_layers × seq_len × bytes_per_element
         = 2 × 8 × 64 × 62 × seq_len × bytes_per_element
         = 63,488 × seq_len × bytes_per_element
```

Note: `n_head=48`/`n_head_kv=8`/`hidden=3072` are taken as given from the task prompt; not independently verified against the actual GGUF metadata in this session (no `gguf-dump` inspection). Rescale linearly if the real checkpoint differs.

### A.3 Sizes at 8K / 32K / 128K / 200K

Per-token bytes by cache dtype (`-ctk`/`-ctv`, see A.4):

| dtype | bytes/element | bytes/token (×63,488) |
|---|---|---|
| f16 | 2.0 | 126,976 |
| q8_0 (block32, 34B/32) | 1.0625 | 67,456 |
| q4_0 (block32, 18B/32) | 0.5625 | 35,712 |

Total KV cache (both K+V, all 62 layers, single sequence):

| seq_len | f16 | q8_0 | q4_0 |
|---|---|---|---|
| 8,192 | ≈0.99 GiB | ≈0.53 GiB | ≈0.28 GiB |
| 32,768 | ≈3.87 GiB | ≈2.06 GiB | ≈1.09 GiB |
| 131,072 | ≈15.5 GiB | ≈8.23 GiB | ≈4.36 GiB |
| 200,000 | ≈23.65 GiB | ≈12.56 GiB | ≈6.65 GiB |

At 200K in f16 the KV cache alone is ~24 GiB — a large slice of the 96 GB budget once the model's own weights (~120-140 GB at typical 4-bit-class quant for a 230B model, mostly mmap-resident) are also in play. Full 200K with f16 KV plus a large model quant likely won't comfortably coexist in 96 GB without heavy NVMe-mmap reliance, which competes with the same bandwidth budget used for weight streaming.

### A.4 ik_llama KV cache options available

Confirmed in `common/common.cpp`:
- `-ctk, --cache-type-k TYPE` / `-ctv, --cache-type-v TYPE` (`common/common.cpp:1309-1316`, help text `common/common.cpp:2675-2676`); env override `LLAMA_ARG_CACHE_TYPE_K`/`_V` (`common/common.cpp:510-511`).
- Fork-specific split typing: `-ctk-first/--cache-type-k-first TYPE,N` and `-ctk-last/--cache-type-k-last TYPE,N` (+ V equivalents) — lets you keep the first N layers higher precision and quantize the rest, not present upstream.
- `kv_cache_type_from_str()` (`common/common.cpp:3522+`) supports at least: `f32`, `f16`, `bf16`, `q8_0`, `q4_0`, `q4_1`, `iq4_nl`, `q5_0`, `q5_1`, `q6_0` (list continued past what was grepped).
- `-nkvo, --no-kv-offload` (irrelevant here, CPU-only), `-dkvc, --dump-kv-cache` for inspection.

**Recommendation:** `-ctk q8_0 -ctv q8_0` as a safe default (~halves KV memory vs f16, minimal quality risk, the most commonly validated combo across llama.cpp-family forks). `q4_0` is more aggressive with more accuracy risk (especially for K); test output quality directly rather than assume safety. The split first/last-layer options allow an easy A/B without recompiling.

### A.5 KV bandwidth vs weight-read cost — when KV starts to matter

Two DRAM/NVMe-bandwidth-bound components per decode step:
1. **Logical weight stream**: ~10B active params/token; at ~4.5 bits/weight
   effective mixed quant ⇒ ~5.6 GB/token logically touched, every token,
   independent of context length. This is **not** the physical SSD traffic:
   resident pages are served from RAM. The exact 4.9-vs-5.6 value depends on the
   real mixed recipe and must be computed from GGUF.
2. **KV read**: one pass over the whole KV cache so far per decode step — the full-cache sizes from A.3.

Crossover (KV bytes ≈ weight bytes, assuming ~5.6 GB/token weight read):

```
126,976 × seq_len ≈ 5.6×10^9
  ⇒ seq_len ≈ 44,100 tokens (f16 KV)
  ⇒ seq_len ≈ 83,000 tokens (q8_0 KV)
  ⇒ seq_len ≈ 157,000 tokens (q4_0 KV)
```

**Interpretation:** past ~40-45K tokens with f16 KV, KV reads become comparable to/larger than the MoE weight-read cost per step, and decode degrades further with context (no cross-token amortization at decode time). q8_0 KV roughly doubles that threshold to ~80K; q4_0 pushes it near the top of the 200K window (~157K). **KV quantization is therefore not just a memory optimization here — beyond ~40-80K tokens it directly protects decode throughput.** Below ~20-30K tokens, KV reads are a minor fraction of cost and not worth trading against quality.

These are back-of-envelope **logical bandwidth** ratios, not measured t/s or
physical disk-miss estimates. Treat the ~40K/~80K/~157K crossovers as
order-of-magnitude guidance; they also depend on flash-attention implementation,
KV dequant cost and the actual mixed quant recipe.

## PART B — CPU generation levers on AMD AM5

### B.1 AMX is Intel-only — N/A on AM5

AMX (Advanced Matrix Extensions) is Intel-only, introduced with Sapphire Rapids (4th-gen Xeon Scalable) and later Xeon/Core Ultra parts. AMD Zen 4/Zen 5 (all AM5 desktop CPUs, 7000/9000-series) do not implement AMX — different vendor silicon, not a fork gap.

`github-data/issues/437 - Feature Request_ support intel amx for further accelerate.md`:
- Benchmarks reference a **Xeon 8480** (Intel, AMX-capable) and link kTransformers' AMX doc plus a **Ryzen 9 7950X** cpubenchmark.net page — confirming the discussion is Intel-server-specific, with the AMD chip used only as a raw-compute reference, not an AMX target.
- Commenters (`ikawrakow`, `zhaoyukoonx`) discuss AMX mainly moving the needle on **prefill/PP**, not single-token decode, which stays bandwidth-bound regardless of ISA.
- No AMD-side equivalent instruction exists.

**Conclusion: AMX is not applicable on AM5, full stop** — and even on Intel it mainly helps batched prefill, not the decode-bound single-stream workload here.

### B.2 What AM5 offers: AVX-512, VNNI, and the fork's IQK kernels

AM5 Zen 4 (7000-series) and Zen 5 (9000-series) both implement AVX-512 (Zen 4: double-pumped 256-bit; Zen 5: native 512-bit) including AVX512-VNNI and AVX512-BF16 on most SKUs. This fork's premise is CPU-optimized GEMM/GEMV kernels — IQK quant types with dedicated AVX2/AVX-512/Zen4/NEON kernels:
- `README.md:106`: Zen4/AVX2/NEON kernels named for `IQ5_KS_R4` (PR 426), `IQ5_KS` (PR 422), `IQ4_KS_R4` (PR 150), `IQ5_K_R4` (PR 149), `IQ2_K_R4` (PR 146), `IQ3_K_R4` (PR 145), `IQ4_K_R4` (PR 138), `IQ4_KSS` (PR 89), `IQ2_KS` (PR 85), `IQ4_KS` (PR 83), `IQ6_K` (PR 14), `IQ2_K/IQ3_K/IQ5_K` (PR 7), `IQ4_K` (PR 6).
- `README.md:137`: "Zen4: Faster PP for `IQ2_KS, IQ4_KS, IQ5_KS`" (PR 428) — Zen4-specific tuning already exists.
- `README.md:208`: AVX2 correctness fix for `IQ4_K, IQ4_KS, IQ5_K, IQ6_K` (PR 427).

The `_R4` ("row-interleaved ×4") variants are purpose-built for CPU GEMV
throughput. However, runtime `-rtr` sets loader mmap off. For a ~110 GB model on
96 GB RAM that can force full allocation/copy and lead to OOM or swap. CPU-only
removes the CUDA-layout compatibility risk, **not** this memory risk.

**Recommendation:** create/use an **offline `_R4` GGUF** (`IQ4_KS_R4`,
`IQ5_KS_R4`, `IQ4_K_R4`, `IQ3_K_R4`, `IQ2_K_R4`, etc.) and load it through mmap
**without runtime `-rtr`**. Likewise, do not use runtime `-muge`: it materializes
the merged tensor and also disables mmap; use an offline fused
`ffn_gate_up_exps` GGUF when available. Benchmark `_R4` against the non-R4
counterpart on this 7950X; kernel fit is not a measured win yet.

### B.3 Threading: single-socket AM5, but CCD/CCX topology matters

AM5 is single-socket, no classic multi-socket NUMA. But:
- Multi-CCD parts (12/16-core Ryzen 9, e.g. 7900X/7950X/9900X/9950X) have two CCDs, each with its own L3, sharing one memory controller (IOD) via Infinity Fabric. Not OS-visible NUMA by default, but cross-CCD coherency traffic/L3-locality can hurt if threads bounce across CCDs — pinning to one CCD or capping thread count to one CCD's physical cores is a known lever, especially for bandwidth-bound decode.
- SMT and CCD placement require A/B. For resident bandwidth-bound GEMV, SMT may
  add contention; for page-fault/I/O-bound execution it can instead raise useful
  queue depth. Sweep one CCD (8 physical), 10/12/14/16 physical cores and selected
  SMT variants rather than disabling SMT by rule.

Flags exposed (`common/common.cpp`):
- `-t, --threads N` (`common/common.cpp:605`) — generation thread count.
- `-tb, --threads-batch N` (`common/common.cpp:613`) — prefill/batch thread count (PP parallelizes better than TG).
- `--numa TYPE` (`common/common.cpp:1734-1739`) — `distribute`/`isolate`/`numactl`. On a genuinely single-NUMA-node AM5 box this mostly won't help unless BIOS exposes the two CCDs as separate NUMA nodes (more common on EPYC/Threadripper) — worth checking BIOS, general platform knowledge only.

No explicit CPU-affinity/pinning flag was found in the grepped `common.cpp` sections (`-t`, `-tb`, `--numa` only); CCD pinning would need OS-level affinity. Double-check with a broader grep (`cpu-mask`, `cpu-range`, `priority`) before relying on it — that grep was not done in this pass.

### B.4 Concrete target: Ryzen 9 7950X

The target is now known: **Zen 4, 16 cores / 32 threads, two 8-core CCDs**. The
remaining platform inputs are DIMM topology/rank, DDR5 MT/s and measured RAM BW.
For context, AM5 spans:
- **Zen 4** (Ryzen 7000: 7950X/7900X/7700X/7600X): AVX-512 via double-pumped 256-bit units, up to 16 cores/2 CCDs (7950X/7900X) or 1 CCD (7700X/7600X), dual-channel DDR5 (~5200-6000 MT/s typical).
- **Zen 5** (Ryzen 9000: 9950X/9900X/9700X/9600X): native full-width AVX-512, higher IPC and DDR5 support speeds.
- **X3D vs non-X3D**: working set is much larger than L3, so extra cache is
  unlikely to dominate; actual SSD/RAM/compute split still requires Step0.

Implications for this target:
- **Core count** → sets the practical `-t`/`-tb` ceiling and whether CCD-pinning is even a decision.
- **Zen 4 AVX-512** → benchmark resident/control phases; it may matter more for
  compute-heavy prefill than single-token decode, but the latter's bottleneck is
  not yet proven.
- **DDR5 speed/rank/channel config** → caps the RAM-resident phase. Confirm
  *achieved* bandwidth (AIDA64/`mbw`, not rated MT/s) before deriving a roofline.

**Need: DDR5 speed/kit (MT/s, single vs dual rank, 2x vs 4x DIMMs) and measured
RAM bandwidth** to finalize the sweep.

## Summary of concrete, actionable items

1. M2.7 is confirmed plain GQA (`build_minimaxm2.cpp`) — no MLA/FlashMLA benefit available; hard architectural ceiling, not a missed flag.
2. Use `-ctk q8_0 -ctv q8_0` (or tested `q4_0`) for KV cache — saves ~4.4-17 GiB at 128-200K context, and past an estimated ~40-80K-token crossover directly protects decode t/s since KV reads start rivaling the active-weight read per token.
3. AMX is Intel-only (confirmed via issue #437) and irrelevant to AM5; don't chase it.
4. Prefer offline `_R4` IQK GGUF + mmap **without `-rtr`**; avoid runtime
   `-muge`. Sweep thread counts, SMT and CCD placement instead of assuming one
   universal optimum.
5. CPU is Ryzen 9 7950X; the missing inputs are DIMM topology and real (not
   rated) DDR5 bandwidth.
