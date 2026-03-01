# Zen4 CPU-Only MoE Speed Backlog (ik_llama.cpp)

This folder (`ik_llama_rework`) is a scratchpad for turning optimization ideas into an actionable, measurable backlog.

Target hardware: AMD Ryzen 9 7950X (Zen 4, 2 CCD), 96 GB DDR5.
Target usage: CPU-only inference, mostly MoE, mostly IQ4/6/8 quantizations.

Primary models you mentioned:
- `gpt-oss` (modified GGUFs in IQ4/6/8)
- `qwen3moe` 30B-A3B (IQ4/6/8)
- `qwen3next` 80B-A3B (IQ4/6/8) or `qwen3next` 30B-A3B

---

## Upstream Sync Log

### 2026-02-21: Updated main to `bd387a279` (from `33308908d`)

Safety branch: `safety/pre-update-2026-02-21` (commit `c9b85ae5a`)
Contains: full snapshot of all local changes before sync (Qwen3-Next port, docs, -muge fix, n_swa_pattern fix).

Upstream gained (53 commits):
- **Qwen3-Next full support** (#1266, #1276, #1277, #1283, #1286) — replaces our local port
- **Qwen3.5-MoE** (#1288) — 397B model, 2x CPU speedup
- **Self-speculative decoding** (#1261) — ngram-based, no draft model needed
- **Step-3.5-Flash, Seed-OSS, Kimi 2.5 Vision** — new models
- CPU op optimizations (concat, dup, SiLU fast paths)

Re-applied local fixes (3 files):
- `src/llama-hparams.h`: `n_swa_pattern` bug fix (`return false` → `return true` in `operator!=`)
- `common/common.cpp`: `-muge` aliases (`--merge-up-gate-exps`, `--merge-up-gate-experts`)
- `examples/llama-bench/llama-bench.cpp`: `-muge` aliases

Discarded: Qwen3-Next port (~810 lines, 11 files) — superseded by upstream.

---

## Ground Truth (Current ik_llama.cpp @ commit bd387a279)

This section exists to keep "ideas" anchored to real code paths.

- MoE graph build: `Z:\files\projects\ik_llama.cpp\src\llama-build-context.cpp`
  - Builds MoE FFN via `ggml_mul_mat_id()`
  - Can fuse up+gate via `ggml_moe_up_gate*()` when enabled and tensors allow it
- CPU compute for MoE:
  - `Z:\files\projects\ik_llama.cpp\ggml\src\ggml.c:16302` (`ggml_compute_forward_mul_mat_id`)
  - `Z:\files\projects\ik_llama.cpp\ggml\src\ggml.c:16563` (`ggml_compute_forward_mul_mat_id_up_gate`)
- IQK fast path(s) used by MoE:
  - `Z:\files\projects\ik_llama.cpp\ggml\src\iqk\iqk_mul_mat.cpp:667` (`iqk_mul_mat_moe`)
  - `Z:\files\projects\ik_llama.cpp\ggml\src\iqk\iqk_mul_mat.cpp` (`iqk_moe_fused_up_gate`)
- Loader/layout knobs:
  - `merge_up_gate_exps` (aka `-muge`) merges `ffn_up_exps` + `ffn_gate_exps` into contiguous layout (helps locality/fusion)
  - `fused_moe_up_gate` is enabled by default in `Z:\files\projects\ik_llama.cpp\src\llama.cpp` (still worth verifying in benchmarks)
- OS / memory mapping:
  - mmap prefetch + `PrefetchVirtualMemory` on Windows: `Z:\files\projects\ik_llama.cpp\src\llama-mmap.cpp`
  - `mlock` / `VirtualLock` infrastructure exists, but don't expect it to "solve" MoE TG (weights are too large to lock wholesale)
- NUMA / CCD:
  - ggml NUMA strategies are Linux-only today: `Z:\files\projects\ik_llama.cpp\ggml\src\ggml.c` has "no NUMA support outside of Linux".
  - On Windows this means: you can still do *external* affinity experiments, but in-tree `--numa` won't help.

Important repo divergence:
- Upstream `llama.cpp` currently has `qwen3next` model code (`src/models/qwen3next.cpp`), but **this ik_llama.cpp snapshot does not**.
  - If you are running `qwen3next` today, you're either on upstream, or on a different fork/branch, or on a GGUF that maps to a supported arch.

---

## How We Measure (No Exceptions)

If we can't measure it cleanly, we don't merge it.

### Primary metrics
- `TG t/s` (token generation): `llama-bench -p 0 -n <N>`
- `PP t/s` (prompt processing): `llama-bench -n 0 -p <N>` plus batch sweeps
- Optional: `PG` mixed tests via `-pg <pp,tg>`

### Baseline matrix (minimum)
For each model/quant you care about, run at least:
- threads: `8,16,32` (Zen4 dual-CCD often has a TG sweet spot at 8 or 16)
- `-fa 0/1` (flash-attn can shift hotspots)
- KV cache types: default + at least one "smaller traffic" variant if supported (`-ctk/-ctv`)
- MoE knobs:
  - `-muge 0/1` (merge up+gate experts; affects locality/fusion)
  - `fused_moe` toggles if exposed in the bench build (ik exposes several knobs via bench "fields")
- memory knobs:
  - `-thp 0/1` (transparent huge pages)
  - `-mmp 0/1` (mmap on/off), and `--mlock` for "no paging" experiments

### Repro output
Always store:
- model filename, exact quant preset, command line, commit hash, OS, CPU info
- raw samples (not only averages)

`llama-bench` already outputs JSON/CSV with commit/CPU metadata; use `-o json` or `-o csv`.

### Profiling (keep both Windows + Linux in scope)
- Linux:
  - `perf stat` (instructions/cycles/LLC misses) to identify "memory latency bound" vs "compute bound"
  - `perf record` for hot symbols (IQK kernels, ggml ops, memory functions)
- Windows:
  - ETW (WPR/WPA) or AMD uProf
  - Goal is the same: identify *where* time is spent and whether we're stalled on memory

---

## Backlog (1 PR = 1 Hypothesis)

Each item below should be implemented behind a feature flag (default off), with a crisp A/B benchmark and rollback.

### PR00 (DONE): Fix `-muge` flag name drift
Problem: different binaries/documentation accepted different spellings (`--merge-up-gate-exps`, `--merge-up-gate-experts`, and even a typo).
Status: patched in-tree:
- `Z:\files\projects\ik_llama.cpp\common\common.cpp`
- `Z:\files\projects\ik_llama.cpp\examples\llama-bench\llama-bench.cpp`

Acceptance:
- `llama-cli` / `llama-server` accept `--merge-up-gate-exps` and `--merge-up-gate-experts` (and keep the old typo alias)
- `llama-bench` accepts the same

### PR01: Repro bench scripts (Windows + Linux)
Goal: one command to run your standard matrix and drop JSON/CSV into a timestamped folder.
Change:
- Add `scripts/bench-moe.ps1` (Windows) and `scripts/bench-moe.sh` (Linux)
- Inputs: model paths + a small JSON/YAML config listing which tests to run
Acceptance:
- Produces results folder containing:
  - `llama-bench` JSON/CSV
  - a `run.json` with the exact parameters used
  - commit hash + CPU/OS metadata

### PR02: "Am I on the fast path?" runtime telemetry
Goal: avoid optimizing the wrong branch (common in MoE: fused path silently disabled).
Change:
- Add one-time startup logs (or a `--verbose-perf` flag) that prints:
  - `fused_moe_up_gate` enabled?
  - `merge_up_gate_exps` enabled?
  - `GGML_USE_IQK_MULMAT` compiled in?
  - whether we actually executed the IQK MoE kernel for this run (a cheap counter is enough)
Acceptance:
- Zero overhead when disabled; negligible overhead when enabled

### PR03: Expert prefetch v1 (safe, measurable, default off)
Hypothesis: we're latency-stalled on expert-weight reads; software prefetch can overlap some of that with compute.
Change ideas (pick 1 for v1, keep it minimal):
- Add prefetch in `ggml_compute_forward_mul_mat_id()` around the `cur_a` loop, prefetching the *next* expert's first pages/cache lines.
- Add prefetch inside `iqk_mul_mat_moe()` for the next block of weights as the kernel walks the matrix.
Acceptance:
- Output identical (bitwise for logits is ideal; at least token stream unchanged under fixed seed)
- `llama-bench` shows TG win on at least one of:
  - `gpt-oss` IQ4
  - `qwen3moe` IQ4
- No regression on a non-MoE model baseline

### PR04: Prefetch tuning (distance/stride/hints)
Goal: avoid "prefetch makes it slower" by making it tunable and discoverable.
Change:
- Add a small set of presets, e.g.:
  - hint: `T0` vs `T1`
  - stride: 256/512/1024 bytes
  - bytes per expert to prefetch: cap (e.g. 64 KiB, 256 KiB)
- Optionally add an "auto" mode that tries 2-3 presets in warmup and selects best.
Acceptance:
- "auto" never worse than "off" by more than noise on TG

### PR05: Hot expert tracking (Linux-first)
Hypothesis: expert selection has temporal locality; we can keep hot experts resident (or at least warm).
Change:
- Implement a low-overhead heatmap (avoid per-token `partial_sort` across 512 experts)
- For Linux:
  - `madvise(MADV_WILLNEED)` hot expert regions
  - optional `mlock` for a *small* hot set if RLIMIT allows
Acceptance:
- TG improvement on MoE with a stable hot-set
- Overhead bounded and measurable

### PR06: NUMA/CCD-aware placement (Linux)
Hypothesis: cross-CCD accesses add latency; making expert weights "local-ish" helps.
Change:
- Use existing ggml NUMA infrastructure where possible (keep it upstream-aligned).
- Add a MoE-specific mode:
  - distribute experts by id across nodes
  - pin compute threads accordingly
Acceptance:
- Measured TG win on Linux (native or WSL2-with-real-numa, if applicable)
Notes:
- Windows needs a different API path (`VirtualAllocExNuma`, thread group affinity); treat as separate PR after Linux proof.

### PR07: Qwen3-Next support strategy (decide + spike)
Problem: `qwen3next` is implemented upstream in a refactored model system (`src/models/qwen3next.cpp`), but is absent here.
Two viable tracks:
- Track A (ik-first): port `qwen3next` into ik's older `llama-build-context.cpp` architecture (high risk)
- Track B (upstream-first): start from upstream `llama.cpp` (has `qwen3next`) and port IK/IQK performance patches (high risk, but may be cleaner long-term)
Spike acceptance:
- A build that runs `qwen3next` end-to-end on CPU with correct outputs (speed second)

### PR08: MTP / speculative decoding (if your models support it)
This is the only category that can produce "big" effective t/s jumps on bandwidth-bound setups.
Approach options:
- generic speculative decoding (draft model + verify)
- model-native MTP (if Qwen3-Next exposes it in GGUF and the runtime supports it)
Acceptance:
- Effective t/s improvement while preserving output correctness constraints

### PR09: IQK kernel audit + Zen4 micro-optimizations (compute-bound cases)
When TG is bandwidth-bound, microkernels won't move the needle much. But PP (and sometimes TG on certain quants) can be compute-bound.
Goal: confirm we're using the best Zen4 paths for your dominant quant types (IQ4/6/8).
Change ideas:
- Audit hot kernels in `ggml/src/iqk/iqk_mul_mat.cpp` and confirm VNNI/AVX-512 paths are actually hit for your quants.
- Tune tiling/blocking for Zen4 cache hierarchy (L1D 32K, L2 1M/core, L3 32M/CCD).
- Keep everything behind flags or auto-detect (avoid regressing other CPUs).
Acceptance:
- PP improvement on at least one of your models, without TG regression beyond noise.

### PR10: Batched / parallel expert execution (MoE dispatcher experiments)
Hypothesis: reduce per-expert overhead by batching or scheduling experts differently.
Change ideas:
- Server-style micro-batching: compute multiple requests/tokens per expert invocation (helps PP and high-QPS server mode).
- Parallelize across experts (top-k) by partitioning threads per expert (only if profiling shows CPU underutilization).
Acceptance:
- Measurable win in a realistic workload (not only synthetic).

### PR11: Expert weight reordering / packing (load-time transform)
Hypothesis: if expert IDs have strong locality/hotness, putting hot experts in a tighter memory layout can reduce cache/TLB misses.
Change ideas:
- Collect expert activation frequency (low-overhead sampling).
- Re-pack expert tensors so hot experts occupy fewer pages and are contiguous.
Acceptance:
- TG improvement on MoE with stable hot-set; no correctness changes.

### PR12: GPT-OSS-specific attention specialization (if profiling points there)
Only worth it if `gpt-oss` runs show significant time outside MoE matmuls.
Change ideas:
- Banded/sparse attention kernels tuned for CPU (blocked sparse layout, reduced gathers).
Acceptance:
- PP/TG improvement on `gpt-oss` without regressions elsewhere.

### PR13: Qwen3-Next DeltaNet optimization (post-PR07)
This depends on having a working `qwen3next` runtime first.
Change ideas:
- Optimize DeltaNet chunking/autoregressive state updates (vectorize, reduce memory traffic).
Acceptance:
- PP improvement on `qwen3next` at medium/long context.

---

## Non-Code Experiments (worth doing early)

These often give as much as a week of C++ work:
- Threads:
  - compare `-t 8` vs `-t 16` vs `-t 32` for TG (MoE often prefers fewer threads)
  - compare SMT on/off (BIOS) for TG
- Affinity:
  - "one CCD only" vs "both CCD" for TG
- Memory:
  - THP on/off
  - `--mlock` on/off
- Build:
  - `-march=znver4 -O3 -flto` (Linux/clang/gcc)
  - PGO for TG vs PP separately (separate profiles)

---

## Agent Prompt Template (copy/paste)

Use this for each PR to keep agents honest:

```
Goal: <one sentence>
Constraint: do not change model math; only perf/memory scheduling; behind a flag default off.

Repo: Z:\files\projects\ik_llama.cpp (commit <hash>)
Hot code area: <file:line or function names>
Benchmark command(s): <exact llama-bench commands + output format>
Acceptance: <measurable A/B target + "no regression" case>

Deliverable:
- minimal patch
- flag plumbing (common.cpp + help)
- bench results (json/csv) and a short summary of delta
```
