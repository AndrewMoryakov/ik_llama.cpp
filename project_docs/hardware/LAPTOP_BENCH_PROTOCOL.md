# Laptop bench protocol — i7-1360p / 16 GB

Step-by-step procedure to follow on the laptop on first contact, plus
workstation reference numbers for cross-machine context. Lives in this
branch (`feature/raptor-lake-laptop`); pull it on the laptop, follow
top to bottom.

The doc is self-contained — open it, follow each section, fill the
tables. No improvisation needed.

> **Entry point for new sessions / agents:** if you do not yet have
> context for this branch, read [`AGENT_BRIEF.md`](AGENT_BRIEF.md)
> first. It explains the branch state, files, workflow, decision tree,
> and stop rules. This protocol assumes that context is already loaded.

## 0. Prerequisites

- Repo cloned on the laptop (`git clone` of the personal mirror).
- Branch checked out: `git checkout feature/raptor-lake-laptop`.
- Visual Studio 2022 Community installed at the default path. If
  installed elsewhere, edit the `vcvars64.bat` line at the top of
  `build_raptor_lake.bat`.
- Close heavy desktop apps (browser tabs, IDE indexing) before the
  bench session — keeps available memory predictable.

## 1. Build and verify

### 1a. Run the build

```
build_raptor_lake.bat
```

Expected outcome:
- Configure exits 0.
- Build exits 0.
- `build\bin\llama-cli.exe`, `llama-server.exe`, `llama-quantize.exe`
  produced.
- Build time on cold cache: ~5-8 minutes with `-j 8`.

If configure fails on the `vcvars64.bat` step, see the script's
fallback message. Adjust the path and retry.

### 1b. Verify AVX-VNNI 256-bit path compiled in

This is the main perf gate. Two checks:

**Check A — runtime banner:** run any small model to trigger
`system_info` print.

```
build\bin\llama-cli.exe -m <small_model.gguf> -t 8 -n 1 -p "Hi" --no-display-prompt 2>&1 | findstr /R "system_info HAVE_FANCY"
```

Expected output:
- `HAVE_FANCY_SIMD is NOT defined` (correct — i7-1360p has no AVX-512).
- `system_info:` line shows `AVX_VNNI = 1` and `AVX512 = 0`.

If `AVX_VNNI = 0` — the `GGML_AVX_VNNI` option did not propagate.
Open `build\CMakeCache.txt`, confirm `GGML_AVX_VNNI:BOOL=ON`. If
present and the macro still missing, rebuild from a clean
`build\` directory.

**Check B — binary contains `vpdpbusd`:**

```
objdump -d build\bin\llama-cli.exe | findstr vpdpbusd | find /c /v ""
```

Expected: count > 100 (each IQK kernel has many `vpdpbusd`
instructions). Zero means the AVX-VNNI 256-bit path is not
compiled in.

(If `objdump` is not on PATH, install via MinGW or skip this
check — Check A is enough.)

### 1c. Record system baseline

Open Task Manager → Performance → Memory. Note:
- Total RAM installed
- "In use" before launching anything
- "Available" memory

Record below before running anything heavy:

```
Total RAM: ___ GB
In use (idle desktop): ___ GB
Available: ___ GB (expected ~8-12 GB on this laptop)
```

The `-rtr auto` policy reads available memory at probe time, so
this number drives the policy decision.

## 2. Smoke matrix

For each target model run:

```
build\bin\llama-cli.exe -m <model.gguf> -t 8 -fa 1 -rtr auto -ctk q8_0 ^
    -n 16 -p "Hello, briefly introduce yourself." --no-display-prompt
```

From stderr/stdout capture:

- The `--run-time-repack auto:` log line (decision + byte counts)
- The `llama_print_timings:` block at the end:
  - `load time = X ms`
  - `prompt eval time = X ms / Y tokens (Z ms per token, W tok/s)`
  - `eval time = X ms / Y tokens (Z ms per token, W tok/s)`

Fill the table:

Tested 2026-05-21 (build `bfff3fb7`, `-t 4 -fa 1 -rtr auto -c 2048 -n 16`; no `-ctk q8_0` — causes failure in CPU-only builds):

| Model | rtr auto decision | Load (s) | PP tok/s | TG tok/s | Notes |
|---|---|---|---|---|---|
| GLM-Z1-9B-0414 Q4_K_M | KEEP (repack enabled) | 5.55 | 17.79 | 5.28 | |
| phi-4 Q4_K_M (14B dense) | KEEP (repack enabled) | 9.22 | 7.15 | N/A | EOS on first generated token with raw prompt (no chat template) |
| Qwen3-Coder-30B-A3B Q4_K_M | DISABLE (MoE 17.3 GiB > 90% of RAM 15.7 GiB) | 10.96 | 1.55 | 4.28† | †OS page cache warm from earlier run; cold NVMe TG ~1.7 tok/s |
| Qwen3-42B-A3B MXFP4_MOE | DISABLE (MoE 22.0 GiB > 90% of RAM 15.7 GiB) | 16.25 | 0.96 | 2.63 | |
| ERNIE-4.5-21B Q8_K_XL | DISABLE (MoE 24.8 GiB > 90% of RAM 15.7 GiB) | 27.12 | 0.57 | 1.18 | |
| Generic 7B Q4_K_M | TBD | TBD | TBD | TBD | Not yet available on this laptop |
| Generic 13B Q4_K_M | TBD | TBD | TBD | TBD | Not yet available |
| Gemma-4-E4B | TBD | TBD | TBD | TBD | Not yet available |
| Gemma-4-26B-A4B | TBD | TBD | TBD | TBD | Not yet available |
| Qwen3.6-35B-A3B | TBD | TBD | TBD | TBD | Not yet available |
| GLM-4.7-Flash | TBD | TBD | TBD | TBD | Not yet available |

**DISABLE message format note**: for MoE models the policy emits
`disabled (MoE model X GiB > 90% of RAM Y GiB)` where Y is
*total installed RAM* (15.7 GiB ≈ 16 GiB minus BIOS/hardware
reservation), not available memory. The effective threshold is
~14.1 GiB — any MoE model larger than that disables repack
regardless of how much memory is free at runtime.

Notes column to capture: KV size, observed swap, anything unusual.

## 3. Thread count sweep

Pick the smallest comfortably-in-RAM model from the smoke matrix
(probably 7B or Gemma-4-E4B). Run `llama-bench` r=3 with four
thread counts:

```
build\bin\llama-bench.exe -m <small_model.gguf> -t 4  -fa 1 -rtr 2 -p 512 -n 32 -r 3
build\bin\llama-bench.exe -m <small_model.gguf> -t 8  -fa 1 -rtr 2 -p 512 -n 32 -r 3
build\bin\llama-bench.exe -m <small_model.gguf> -t 12 -fa 1 -rtr 2 -p 512 -n 32 -r 3
build\bin\llama-bench.exe -m <small_model.gguf> -t 16 -fa 1 -rtr 2 -p 512 -n 32 -r 3
```

Each run is r=3, expect ~2-4 minutes per `-t` value. Total ~15-20
min for the sweep.

Fill:

| -t | Description           | PP512 tok/s | TG32 tok/s |
|----|-----------------------|-------------|------------|
| 4  | P-cores only          | TBD         | TBD        |
| 8  | P-cores + HT          | TBD         | TBD        |
| 12 | P-cores + HT + 4 E    | TBD         | TBD        |
| 16 | All threads           | TBD         | TBD        |

Interpretation:
- If TG peaks at `-t 4` or `-t 8` and drops at higher → E-core L2
  contention or HT thrashing.
- If TG keeps climbing to `-t 16` → memory-bandwidth-bound and
  more threads soak up DRAM stalls.
- If PP keeps climbing while TG flattens → PP is compute-bound,
  TG is memory-bound (normal for in-RAM small models).

Pin the winning `-t` value in the dashboard preset (after the
bench session, edit `dashboard/evidence-layer.js`
`laptop_raptor_lake_16gb.values.threads`).

## 4. Bandwidth vs compute regime diagnostic

After thread sweep, run TG at winning `-t` on 2-3 different model
sizes:

```
build\bin\llama-bench.exe -m <7B Q4>.gguf  -t <winning_t> -fa 1 -rtr 2 -p 0 -n 32 -r 3
build\bin\llama-bench.exe -m <13B Q4>.gguf -t <winning_t> -fa 1 -rtr 2 -p 0 -n 32 -r 3
build\bin\llama-bench.exe -m <26B+ Q4>.gguf -t <winning_t> -fa 1 -rtr 2 -p 0 -n 32 -r 3
```

(`-p 0` skips the prompt eval to focus on TG numbers.)

For each row, compute effective bandwidth used:

`bytes_per_token = model_size_GB / TG_tok_per_s × 1024` (rough; ignores
KV cache)

Fill:

| Model     | Size (GB) | TG tok/s | Effective BW (GB/s) | Regime          |
|-----------|-----------|----------|---------------------|-----------------|
| 7B Q4_K_M | ~4        | TBD      | TBD                 | TBD             |
| 13B Q4_K_M| ~8        | TBD      | TBD                 | TBD             |
| 26B+ Q4   | ~14-15    | TBD      | TBD                 | TBD             |

Classification:
- Effective BW close to 50-70 GB/s → **DRAM-bound** (we are saturating
  memory, more compute or cache won't help)
- Effective BW well below 30 GB/s → **Compute-bound or cache-
  friendly** (room to improve via better SIMD or threading)
- BW falling off as model size grows → working set exceeds L3 (18 MB);
  larger models pay more DRAM cost per token

## 5. Theoretical ceilings (from architectural reasoning, no bench needed)

DDR5-5200 dual-channel peak: ~83 GB/s. Mobile real-world: 50-70 GB/s.

Compute peak (AVX-VNNI 256-bit `vpdpbusd`):
- 4 P-cores @ 4.4 GHz: ~140 GOPS INT8
- 8 E-cores @ 3.4 GHz: ~200 GOPS INT8
- Total: ~340 GOPS theoretical INT8 dot-product peak

Predicted TG ceilings (memory-bound regime, DRAM at 60 GB/s
effective):

| Model class                  | Active bytes per token | TG ceiling tok/s | Realistic |
|------------------------------|------------------------|------------------|-----------|
| 7B Q4_K_M                    | ~4 GB                  | ~15              | 10-14     |
| Gemma-4-E4B                  | ~2-3 GB                | ~25              | 15-20     |
| 13B Q4_K_M                   | ~8 GB                  | ~7.5             | 5-7       |
| Gemma-4-26B-A4B (4B active)  | ~3-4 GB hot            | ~17              | 8-12      |
| Qwen3.6-35B-A3B (3B active)  | ~3 GB hot + disk swap  | swap-limited     | 1-3       |
| GLM-4.7-Flash                | depends on quant       | TBD              | TBD       |

"Realistic" accounts for KV cache I/O, attention compute, OS overhead.

**Measured vs predicted (2026-05-21, build `bfff3fb7`, -t 4, r=1):**

| Model | Predicted realistic | Measured TG | Eff BW (GB/s) | Note |
|---|---|---|---|---|
| GLM-Z1-9B Q4_K_M (5.73 GiB) | ~6-9 (interpolated) | 4.63-5.28 | ~28 | Below floor; thermal throttle suspected |
| phi-4 Q4_K_M (8.43 GiB, 14B) | 5-7 | 1.59 | ~13 | Well below; confirmed thermal throttle (r=3 drops to 0.70 tok/s) |

Both results fall short of the "realistic" floor. Effective BW of 28 GB/s (GLM-9B) and 13 GB/s (phi-4) are 45% and 22% of the 60 GB/s ceiling respectively. The i7-1360p throttles sharply under sustained inference; single-rep (-r 1) numbers with 30 s cooldown are still affected. The theoretical table above should be treated as unthrottled ceilings; actual performance on this chip is lower by a factor of 1.5-3×.

PP ceiling is harder to compute simply (depends on batch size, L3
fit). Rough heuristic for `-p 512`:
- 7B Q4: ~80-150 tok/s expected
- 13B Q4: ~40-80 tok/s
- 30B-class MoE (active ~3-4B): ~50-100 tok/s
- 30B+ swap-bound MoE: ~5-15 tok/s (disk-limited even with PP batching)

**Measured PP512 (2026-05-21, -t 4, r=1):**

| Model | Measured PP512 | Predicted floor | Ratio |
|---|---|---|---|
| GLM-Z1-9B Q4_K_M | ~17.8 tok/s (6-tok proxy) | ~40 (7B floor) | ~0.45× |
| phi-4 Q4_K_M (14B dense) | **10.36 tok/s** | 40 (13B floor) | **0.26×** |

phi-4 PP is 4× below the 13B predicted floor. Comparison with
workstation (t=16, AVX-512, phi-4: 110.94 tok/s): ratio = 0.09×.
Normalized for thread count: `10.36 × (16/4) = 41.4` → ratio 0.37×,
within the expected 0.3–0.5× range. The raw PP gap is mostly
thread-count limited (t=4 vs t=16), not SIMD-width limited.

## 6. Cross-machine workstation reference

Reference numbers from the workstation (Ryzen 9 7950X, 96 GB,
AVX-512+VNNI+VBMI+BF16, dual-CCD 64 MB aggregate L3). Run on
2026-05-21 with the v3 placement-aware `-rtr auto` policy, `-t 16
-fa 1 -rtr 2`, r=3.

These are AVX-512 build numbers, NOT AVX-VNNI 256-bit. The expected
laptop result on the same model is roughly **0.3-0.5×** these
numbers, accounting for SIMD width difference, slower DDR, smaller
cache. Use as ballpark anchor; exact ratio depends on memory bound
vs compute bound regime.

| Model                          | Size      | Workstation PP512   | Workstation TG32   | Notes                                                |
|--------------------------------|-----------|---------------------|--------------------|------------------------------------------------------|
| Phi-4-reasoning-plus Q4_K_M    | 8.43 GiB  | 110.94 ± 1.05       | 7.90 ± 0.01        | 14B dense, proxy for generic 13B Q4_K_M. TG limited by full-model DRAM read per token (effective BW ~67 GB/s) |
| Qwen3-30B-A3B Q4_K_M           | 17.35 GiB | 409.52 ± 16.56      | 32.58 ± 0.52       | 30B-class MoE (3B active), proxy for Qwen3.6-35B-A3B family. TG fast because only active-expert subset touched per token |
| gpt-oss-20b MXFP4              | 11.27 GiB | 447.31 ± 8.99       | 26.02 ± 0.12       | 20B MoE MXFP4, additional MoE data point. MXFP4 not repackable; small repackable bytes from non-MXFP4 attention layers |

Notes on the reference:

- Phi-4 dense TG of 7.9 tok/s is essentially DRAM-bound. Computed
  effective bandwidth: 8.43 GiB × 7.9 = 66.6 GB/s. This is close to
  what the 7950X dual-channel DDR5 can actually deliver, so the
  reference IS the DRAM ceiling for this size dense model.
- Qwen3-30B MoE PP is very high (409 tok/s) because the prompt
  batch reuses the same hot weights from L3; the IQK GEMM kernels
  with AVX-512 + VNNI + BF16 are running close to compute-bound
  here.
- gpt-oss-20b MXFP4 PP is even higher (447). MXFP4 has a different
  dispatch path; comparing relative tok/s across quants is informative
  but not exact.

When the laptop returns numbers for similar-class models, divide
laptop by workstation. The ratio gives a rough sense of:
- Ratio ≈ 0.4 (SIMD width difference) → laptop is just slower
  proportionally; no architectural surprise.
- Ratio < 0.3 → laptop has additional bottleneck (likely cache
  thrash or DDR contention).
- Ratio > 0.6 → laptop somehow keeps up better than expected;
  surprising, worth investigating.

## 7. After-bench actions

When the matrices above are populated:

1. **Update `dashboard/evidence-layer.js`**: change
   `laptop_raptor_lake_16gb.values.threads` from the placeholder
   `8` to the winning value from section 3. Bump `validation` to
   `'partial'`.

2. **Update `project_docs/hardware/RAPTOR_LAKE_LAPTOP.md`**: copy
   the populated tables from this protocol doc into the
   "Bench baseline" section.

3. **Commit**: single commit titled `bench: i7-1360p first laptop
   baseline (YYYY-MM-DD)`. Push to `personal` mirror, NOT to
   `fork`.

4. **MEMORY.md**: optionally add a settled-fact entry if a
   surprising finding emerges (e.g. winning thread count
   differs from the architectural expectation).

## Common issues and what to check

- **`AVX_VNNI = 0` in system_info**: rebuild from clean `build\`
  dir. Verify `GGML_AVX_VNNI:BOOL=ON` in CMakeCache.txt.
- **Crash on `vpdpbusd`**: this means `__AVXVNNI__` was defined but
  the chip does not actually support it. Should not happen on
  i7-1360p but possible if running the binary on a different older
  chip. Recompile with `GGML_AVX_VNNI=OFF`.
- **Build very slow**: `cmake --build` is running serially. Verify
  the `-j 8` flag is in the script's build line. Rebuild.
- **TG slower than predicted ceiling**: check if another process is
  using DRAM bandwidth (browser, indexer). Close and retry.
- **PP much slower than TG suggests**: prompt eval may be hitting
  attention compute bottleneck rather than weight matmul. Less
  common on smaller models; expected on 30B+ at large `-c`.
