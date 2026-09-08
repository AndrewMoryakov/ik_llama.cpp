# Post-Merge Baseline — 2026-05-02

Полный r=3 baseline после merge'а 190 upstream-коммитов (`afaa7e04d`).

## Build / Host
- Build: `e8444f2ad` (build 177), MSVC 2022, AVX-512 VBMI/VNNI/BF16/native
- CPU: AMD Ryzen 9 7950X (Zen4, 16C/32T)
- RAM: 96 GB DDR5 (Large Pages active)
- OS: Windows 11
- Threads: 16, Flash Attention: ON, RTR: 1, Reps: 3

## Results

### Qwen3-30B-A3B Q4_K_M (17.35 GiB, in-RAM)

| Test | Result | Pre-merge baseline (r=3, 2026-03-06) | Δ |
|------|--------|--------------------------------------|---|
| pp512 | **491.12 ± 6.23** | 316.8 | **+55.0%** |
| tg32  | **32.51 ± 0.33** | ~30 (TG128: 30.10) | +8% |

### gpt-oss-20b MXFP4 (11.27 GiB, in-RAM)

| Test | Result | Pre-merge baseline (r=3, 2026-03-06) | Δ |
|------|--------|--------------------------------------|---|
| pp512 | **435.15 ± 39.75** | 281.2 | **+54.7%** |
| tg32  | **25.94 ± 0.04** | ~24 (TG128: 23.85) | +9% |

## Comparison with smoke (r=1, no warmup)

| Model | Test | Smoke (r=1) | Baseline (r=3) | Reason for delta |
|-------|------|-------------|----------------|------------------|
| Qwen3-30B | pp512 | 365.56 | 491.12 ± 6.23 | r=3 includes warmup — caches/branch-predictors stabilized |
| Qwen3-30B | tg32  | 30.69 | 32.51 ± 0.33 | same |
| gpt-oss-20b | pp512 | 447.88 | 435.15 ± 39.75 | r=1 hit upper tail; r=3 mean is more representative |
| gpt-oss-20b | tg32  | 25.13 | 25.94 ± 0.04 | same |

## Notes

- gpt-oss-20b PP shows ±39.75 stddev (~9%) — high variance, likely OS scheduling
  on dual-CCD; mean still firmly above pre-merge baseline.
- Qwen3-30B numbers are tight (stddev 1-2%) — stable.
- TG previously believed to be near-neutral after merge (smoke +2-5%) — actually
  +8-9% with proper averaging. TG perf is partially compute-bound for these
  in-RAM MoE sizes; upstream `#1707 Faster small batch inference for MoE` and
  `#1456 Better barrier` plausibly help here too.

## Attribution

PP gains (+55%) attributed primarily to (in order of estimated impact):
1. `#1578` AVX-512 mul_mat_q8_1_r8_q8_2 for Q4_K (Qwen3 directly hit)
2. `#1707` Faster small batch MoE inference
3. `#1456` Better barrier (spin-wait for batch > 32)
4. AVX-VNNI 256-bit for intermediate Q8_K/Q8_1/Q8_0 R8 buffers (gpt-oss MXFP4 dequant path)
5. `#1627` Fused fused_rms_norm + add

Per-commit attribution would require bisect (cherry-pick groups + bench at each).
Not done in this run; numbers above are post-merge integrated effect.

## Build flags (Zen4 specific)

Set in `build_zen4.bat` / `build_now.bat`:
```
-DGGML_AVX512=ON -DGGML_AVX512_VBMI=ON -DGGML_AVX512_VNNI=ON
-DGGML_AVX512_BF16=ON -DGGML_NATIVE=ON
```

Without these, all upstream AVX-512 kernels fall through to AVX2/scalar paths
and the gains above would not be visible. See `docs/PERF_ATTRIBUTION_2026-05-02.md`
for the layered analysis.
