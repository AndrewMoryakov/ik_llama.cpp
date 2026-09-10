# Raptor Lake mobile laptop profile (i7-1360p, 16 GB)

> **HISTORICAL PROFILE NOTES (2026-05).** Branch and build instructions below
> are superseded. The current branch is `exp/raptor-runtime`, and the current
> upstream option is `GGML_AVXVNNI`. Start with
> [`FORK_WORKFLOW.md`](../../FORK_WORKFLOW.md).

Hardware profile and tuning notes for a CPU-only laptop build of
`ik_llama.cpp`. Captures what is different from the main 7950X / 96 GiB
workstation profile and where the actual numbers from the laptop will go
once they are measured.

> **Entry point for new sessions / agents:** read
> [`AGENT_BRIEF.md`](AGENT_BRIEF.md) first. It is the single bootstrap
> doc for this branch — state, files, workflow, decision tree, stop
> rules. This file is the hardware-specific reference it points at.

## Hardware

- **CPU**: Intel Core i7-1360p (13th gen, Raptor Lake mobile)
  - 4 P-cores with HT (8 logical threads on P-cores)
  - 8 E-cores (no HT, 8 logical threads on E-cores)
  - 12 cores / 16 threads total
- **SIMD**: AVX, AVX2, AVX-VNNI, F16C, FMA. NO AVX-512.
  - Intel removed AVX-512 from consumer chips since Alder Lake.
  - The IQK GEMM hot path uses the `HAVE_VNNI256` code path
    (`vpdpbusd` on 256-bit registers), gated by `__AVXVNNI__`.
  - `HAVE_FANCY_SIMD` (AVX-512 quantized GEMM) is NOT active on this
    chip. Performance will be lower than on the 7950X by a fixed
    factor.
- **RAM**: 16 GiB DDR5 (single-rank, mobile speeds)
- **No discrete GPU.** CPU-only inference.

## Build

Use `build_raptor_lake.bat` at the repo root. It sets:

- `GGML_NATIVE=ON` so the compiler picks up F16C and other extensions.
- `GGML_AVX2=ON` explicitly.
- `GGML_AVX_VNNI=ON` — option declared on this branch in
  `ggml/CMakeLists.txt:93`, wired in `ggml/src/CMakeLists.txt`.
  On MSVC builds where `/arch:AVX2` does not autodefine
  `__AVXVNNI__`, the option forces the macro via
  `add_compile_definitions(__AVXVNNI__)`. The IQK GEMM kernels in
  `ggml/src/iqk/iqk_config.h:52` then activate the `HAVE_VNNI256`
  fast path (`vpdpbusd` on 256-bit registers), which is the main
  perf benefit on this CPU class. On GCC/Clang the option appends
  `-mavxvnni` to ARCH_FLAGS.
- `GGML_CUDA=OFF`.
- `CMAKE_BUILD_TYPE=Release`.

`-j 8` is passed to `cmake --build` to parallelize compilation across
the P-cores (with HT). Build time on a cold cache is roughly 5-8
minutes on this chip.

Paths in the script are resolved via `%~dp0` (script location), so it
works regardless of where the repo is cloned on the laptop.

## What fits in 16 GiB

Available memory at typical workstation use (browser + IDE + a few
background services) on a 16 GiB laptop is roughly **8-12 GiB**. The
auto policy in `-rtr auto` will query this via `MEMORYSTATUSEX::
ullAvailPhys` at probe time and decide based on that, not on installed
RAM.

| Model                                       | Disk size  | Status              | Notes                                                 |
|---------------------------------------------|------------|---------------------|-------------------------------------------------------|
| Generic 7B Q4_K_M                           | ~4 GiB     | Comfortable in-RAM  | Best fit for the box; KEEP repack expected            |
| Generic 13B Q4_K_M                          | ~7-8 GiB   | Comfortable in-RAM  | KEEP expected, snug at high-context                   |
| Gemma-4-E4B                                 | TBD        | Likely comfortable  | Dense small model; populate after bench               |
| Gemma-4-26B-A4B (MoE 26B, 4B active)        | ~14-15 GiB | Borderline          | Likely DISABLE via secondary total-bytes gate         |
| Qwen3.6-35B-A3B (MoE 35B, 3B active)        | ~20 GiB    | Swap-bound          | `-rtr auto` DISABLE expected; load via mmap streaming |
| GLM-4.7-Flash                               | TBD        | Depends on quant    | Populate after bench                                  |
| gpt-oss-20b MXFP4 (reference, not primary)  | ~11 GiB    | Borderline          | If used, expect KEEP with small repackable bytes      |

The `gpt-oss-20b MXFP4` line is included for cross-reference with the
main 7950X workstation profile, not as a primary laptop target.

## Recommended starting flags

Default starting point for any model:

```
llama-cli -m <model.gguf> -t 4 -fa 1 -rtr auto -ctk q8_0
```

Rationale:

- `-t 4` — **P-cores only, no HT.** Thread sweep on 2026-05-21
  (GLM-Z1-9B Q4_K_M, r=3) showed monotonic degradation as threads
  increase: t4 wins on both PP and TG. HT already hurts at t=8 (PP
  -15%, TG -24%); adding E-cores makes it worse. Root cause: OpenMP
  synchronization overhead dominates over bandwidth parallelism for
  9B-class GEMM blocks on this chip. Use `-t 4` as the default; sweep
  again if a significantly larger model (e.g. 30B+ with large active
  expert blocks) is used regularly.
- `-fa 1` — flash attention, always on (settled fact across all
  profiles).
- `-rtr auto` — let the v3 policy decide. On in-RAM models it will
  KEEP repack and gain AVX-VNNI 256-bit speedup. On swap-bound models
  (Qwen3.6-35B-A3B, Gemma-4-26B-A4B if it does not fit) it will
  DISABLE and preserve mmap streaming.
- `-ctk q8_0` — Q8_0 KV cache is settled-fact neutral on perf and
  saves ~50% K-cache memory vs F16. On a 16 GiB box, KV savings
  matter for long contexts.

For swap-bound models that the auto policy DISABLEs, the load will
work via mmap but TG will be limited by disk read bandwidth (~50-100
MB/s on SATA SSD, ~3-7 GB/s on NVMe). Expect TG in the 1-5 tok/s
range on swap-bound MoE.

## Thread count sweep

Measured 2026-05-21, GLM-Z1-9B Q4_K_M (5.73 GiB), rtr=2, fa=1, r=3.

| -t | Description     | PP512 tok/s      | TG32 tok/s      |
|----|-----------------|------------------|-----------------|
| 4  | P-cores only    | **20.78 ± 1.02** | **4.63 ± 0.25** |
| 8  | P-cores + HT    | 17.57 ± 0.26     | 3.53 ± 0.23     |
| 12 | P-cores+HT+4E   | 8.34 ± 0.75      | 2.01 ± 0.08     |
| 16 | All threads     | 8.62 ± 0.45      | 1.53 ± 0.39     |

**Winner: `-t 4`** (P-cores only). Performance degrades monotonically
as threads increase. HT already hurts at t=8; adding E-cores causes
a further large drop. This is atypical: for DRAM-bound TG the usual
expectation is plateau, not degradation. Most likely cause: OpenMP
barrier overhead per GEMM kernel dominates for 9B-class block sizes
on this chip. The winning value is pinned in `dashboard/evidence-layer.js`
`laptop_raptor_lake_16gb.values.threads = 4`.

## Bandwidth / compute regime diagnostic

Measured 2026-05-21, t=4, fa=1, rtr=2 (or auto for swap-bound), r=1
(single rep after warmup to avoid thermal throttling). DDR5 ceiling
50-70 GB/s effective on mobile.

| Model | Disk size | TG32 tok/s | Eff. BW (GB/s) | Regime |
|-------|-----------|------------|----------------|--------|
| GLM-Z1-9B Q4_K_M | 5.73 GiB | 4.87 | ~28 | DRAM-bound |
| phi-4 Q4_K_M (phi3 14B) | 8.43 GiB | 1.59 | ~13 | Below expected* |
| Qwen3-Coder-30B-A3B (mmap, rtr=0) | 17.35 GiB | 1.70 | ~3 (disk) | Disk-bound |

Notes:
- GLM-9B effective BW = 28 GB/s = ~40-55% of DDR ceiling. Consistent
  with DRAM-bound at t=4 not fully saturating the bus.
- phi-4 expected TG (pure size-ratio from GLM) = 4.87 × 5.73/8.43 = 3.3
  tok/s, but measured 1.59. Possible causes: phi3 architecture has a
  large FFN intermediate size adding compute overhead, or residual
  thermal stress even after 30s cooldown.
- Qwen3-30B via mmap: rtr=auto correctly DISABLE (17.35 GB > 10.1 GB
  available). MoE active ~3B params per token → actual bytes/token
  ≈ 1.7 GiB. 1.70 tok/s implies ~3 GB/s disk read — consistent with
  NVMe sequential read.
- **Thermal throttling warning**: with -r 3, phi-4 averaged 0.70 tok/s
  (2.3× slower than 1.59 at r=1). The i7-1360p throttles sharply under
  sustained inference load. Always use -r 1 (or at most -r 2) for
  meaningful single-model benchmarks on this chip; -r 3 with heavy models
  reflects worst-case thermal state, not steady-state.

## Bench baseline (TBD)

| Model                           | Build commit | Config            | PP512  | TG32   |
|---------------------------------|--------------|-------------------|--------|--------|
| Gemma-4-E4B                     | TBD          | t=4 fa=1 rtr=auto | TBD    | TBD    |
| Generic 7B Q4_K_M               | TBD          | t=4 fa=1 rtr=auto | TBD    | TBD    |
| GLM-Z1-9B Q4_K_M                | bfff3fb7     | t=4 fa=1 rtr=2    | 20.78  | 4.63   |
| phi-4 Q4_K_M (14B dense)        | bfff3fb7     | t=4 fa=1 rtr=2    | 10.36  | 1.59   |
| Qwen3-Coder-30B-A3B (mmap)      | bfff3fb7     | t=4 fa=1 rtr=auto | crash† | 1.70   |
| Generic 13B Q4_K_M              | TBD          | t=4 fa=1 rtr=auto | TBD    | TBD    |
| Gemma-4-26B-A4B                 | TBD          | t=4 fa=1 rtr=auto | TBD    | TBD    |
| Qwen3.6-35B-A3B (swap-bound)    | TBD          | t=4 fa=1 rtr=auto | TBD    | TBD    |

†PP512 for Qwen3-30B crashes with access violation when MoE virtual-memory
prefetch is enabled (`ggml_set_moe_vm_prefetch`). Unrelated to AVX-VNNI
changes; occurs because the prefetch walks a 17 GiB mmap region that
exceeds available physical memory at the point of touch.

## VNNI gain isolation (2026-05-21)

GLM-Z1-9B Q4_K_M, `-t 4 -fa 1`, r=2, measured after extended bench session
(thermally suppressed — compare relative, not absolute values).

| Config | PP512 tok/s | TG32 tok/s |
|---|---|---|
| rtr=0 (no repack, standard AVX2) | 14.28 ± 0.38 | 2.14 ± 0.10 |
| rtr=2 (VNNI repack active) | 14.97 ± 0.68 | 3.26 ± 0.20 |
| **Gain** | **+5%** (within noise) | **+52%** |

TG benefit is large and clearly significant (error bars do not overlap).
PP benefit is negligible — PP batches reuse weights across tokens,
shifting the bottleneck toward compute rather than weight-read bandwidth,
which diminishes the VNNI load/multiply advantage.

Absolute TG values here are ~30% below the thread-sweep baseline (4.63 tok/s)
due to thermal state after a multi-hour bench session. The relative gain is
unaffected.

## Smoke matrix (2026-05-21)

Run with `-t 4 -fa 1 -rtr auto -c 2048 -n 16`, build `bfff3fb7`.
No `-ctk q8_0` — causes "failed to create context" in CPU-only builds.

| Model | rtr auto | Load (s) | PP tok/s | TG tok/s | Notes |
|---|---|---|---|---|---|
| GLM-Z1-9B-0414 Q4_K_M | KEEP | 5.55 | 17.79 | 5.28 | |
| phi-4 Q4_K_M (14B dense) | KEEP | 9.22 | 7.15 | N/A | EOS on first token; raw prompt, no chat template |
| Qwen3-Coder-30B-A3B Q4_K_M | DISABLE | 10.96 | 1.55 | 4.28† | †page cache warm; cold NVMe TG ~1.7 tok/s |
| Qwen3-42B-A3B MXFP4_MOE | DISABLE | 16.25 | 0.96 | 2.63 | |
| ERNIE-4.5-21B Q8_K_XL | DISABLE | 27.12 | 0.57 | 1.18 | |

All three DISABLE cases fired on the **MoE total-size gate**:
`disabled (MoE model X GiB > 90% of RAM 15.7 GiB)`.
The threshold is ~14.1 GiB (90% of 15.7 GiB total installed).

## Expected `-rtr auto` decisions

The v3 policy has two distinct code paths based on model type:

**Dense models (non-MoE):**
- KEEP/DISABLE is based on repackable bytes vs available memory.
- Log line: `--run-time-repack auto: keeping repack enabled`
- **GLM-Z1-9B, phi-4**: KEEP confirmed.

**MoE models:**
- DISABLE fires when `total_model_size > 90% of total_installed_RAM`.
- "Total installed RAM" is 15.7 GiB (OS-reported; ~300 MB BIOS-reserved).
- Effective threshold: ~14.1 GiB. Any MoE file larger than this is disabled.
- Log line: `--run-time-repack auto: disabled (MoE model X GiB > 90% of RAM 15.7 GiB)`
- **Qwen3-Coder-30B (17.3G), Qwen3-42B (22.0G), ERNIE-21B (24.8G)**: all DISABLE confirmed.
- **Gemma-4-26B-A4B**: borderline if its file is near 14 GiB; actual decision TBD.
- **Qwen3.6-35B-A3B**: DISABLE expected (file > 14 GiB).
- **GLM-4.7-Flash**: depends on quant size; will be visible in log.

## Notes

- This profile is **local-only**, not for upstream contribution. The
  IQK kernels auto-adapt via macros; no core code changes are needed
  on the laptop side.
- The `dashboard/evidence-layer.js` STANDARD_PRESET_EVIDENCE entry
  for this hardware is `laptop_raptor_lake_16gb`. Update its
  description and validated thread count after the bench sweep.
- The `bench_results/` directory on the laptop should hold actual
  raw outputs; this doc captures the summary view.
