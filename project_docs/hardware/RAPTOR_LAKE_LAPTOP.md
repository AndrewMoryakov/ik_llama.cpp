# Raptor Lake mobile laptop profile (i7-1360p, 16 GB)

Hardware profile and tuning notes for a CPU-only laptop build of
`ik_llama.cpp`. Captures what is different from the main 7950X / 96 GiB
workstation profile and where the actual numbers from the laptop will go
once they are measured.

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
llama-cli -m <model.gguf> -t 8 -fa 1 -rtr auto -ctk q8_0
```

Rationale:

- `-t 8` — start with P-cores + HT only (4 P-cores * 2). E-cores are
  often slower on AVX-VNNI workloads and may hurt perf when mixed.
  Sweep `-t 4`, `-t 8`, `-t 12`, `-t 16` to find the actual sweet spot
  on this chip; OS scheduler may or may not handle the P/E placement
  cleanly.
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

## Thread count sweep (TBD)

The right `-t` value on a P+E hybrid is non-trivial. Plan a small
sweep on the first model that fits, then reuse the winning value.

| Model           | -t 4 (P only)  | -t 8 (P+HT)    | -t 12 (P+HT+E) | -t 16 (all)  |
|-----------------|----------------|----------------|----------------|--------------|
| Gemma-4-E4B PP  | TBD            | TBD            | TBD            | TBD          |
| Gemma-4-E4B TG  | TBD            | TBD            | TBD            | TBD          |

Populate after first laptop bench session. Pin the winning thread count
in the dashboard preset.

## Bench baseline (TBD)

Empty placeholder until the laptop has had a first build + smoke run.

| Model                           | Build commit | Config            | PP512  | TG32   |
|---------------------------------|--------------|-------------------|--------|--------|
| Gemma-4-E4B                     | TBD          | t=8 fa=1 rtr=auto | TBD    | TBD    |
| Generic 7B Q4_K_M               | TBD          | t=8 fa=1 rtr=auto | TBD    | TBD    |
| Generic 13B Q4_K_M              | TBD          | t=8 fa=1 rtr=auto | TBD    | TBD    |
| Gemma-4-26B-A4B                 | TBD          | t=8 fa=1 rtr=auto | TBD    | TBD    |
| Qwen3.6-35B-A3B (swap-bound)    | TBD          | t=8 fa=1 rtr=auto | TBD    | TBD    |
| GLM-4.7-Flash                   | TBD          | t=8 fa=1 rtr=auto | TBD    | TBD    |

## Expected `-rtr auto` decisions

The v3 policy in `src/llama.cpp` will see roughly:

- **Gemma-4-E4B / 7B / 13B Q4_K_M**: KEEP. CPU-resident repackable
  bytes well under 90% of available memory; AVX-VNNI repack helps
  perf.
- **Gemma-4-26B-A4B**: borderline. If primary repackable gate fits
  but secondary total gate trips, DISABLE.
- **Qwen3.6-35B-A3B**: DISABLE. Disk size already over half of
  available memory; either primary or secondary gate fires.
- **GLM-4.7-Flash**: depends on size and quant; will be visible in
  log.

The auto log line will show the exact bytes used for the decision:

```
--run-time-repack auto: CPU-resident repackable X GiB, total CPU-resident Y GiB, available Z GiB
--run-time-repack auto: keeping repack enabled
```

or

```
--run-time-repack auto: disabled (CPU-resident repackable X GiB > 90% of available memory Z GiB)
--run-time-repack auto: disabled (CPU-resident tensors Y GiB > 90% of available memory Z GiB)
```

Capture both numbers from the log when first booting a model on the
laptop; populate the bench tables above.

## Notes

- This profile is **local-only**, not for upstream contribution. The
  IQK kernels auto-adapt via macros; no core code changes are needed
  on the laptop side.
- The `dashboard/evidence-layer.js` STANDARD_PRESET_EVIDENCE entry
  for this hardware is `laptop_raptor_lake_16gb`. Update its
  description and validated thread count after the bench sweep.
- The `bench_results/` directory on the laptop should hold actual
  raw outputs; this doc captures the summary view.
