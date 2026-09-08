> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# Thread Scaling Analysis (commit bd387a279)

- **Date:** 2026-02-23
- **CPU:** AMD Ryzen 9 7950X 16-Core (Zen 4, 2 CCD × 8 cores, 96 GB DDR5)
- **OS:** Windows 11 Pro
- **Build:** MSVC 2022, AVX-512, Release
- **Reps:** 2
- **Total time:** 10.4 min
- **Tests:** 42 (3 models × 7 thread counts × PP/TG)
- **Thread counts:** 8, 16, 32, 42, 52, 64, 96

---

## Configs (best per model from baseline)

| Model | fa | muge | rtr |
|-------|----|------|-----|
| gpt-oss-20b MXFP4 | 1 | 1 | 1 |
| Qwen3-30B-A3B Q4_K_M | 1 | 0 | 1 |
| Llama-3.1-8B Q8_0 | 1 | 0 | 1 |

---

## PP512 Scaling

| Threads | gpt-oss-20b | σ | Qwen3-30B-A3B | σ | Llama-3.1-8B | σ |
|---------|-------------|---|---------------|---|--------------|---|
| 8 | 173.7 | 4.6 | 181.9 | 2.1 | 99.3 | 3.8 |
| 16 | 258.8 | 49.6 | 293.5 | 16.2 | 164.2 | 7.8 |
| 32 | 298.1 | 132.4 | 311.5 | 11.0 | 193.3 | 44.5 |
| 42 | 280.2 | 101.6 | 284.3 | 0.1 | 178.2 | 34.7 |
| 52 | 288.4 | 135.5 | 328.5 | 31.9 | 193.4 | 30.1 |
| 64 | 281.1 | 133.9 | 328.6 | 47.4 | 192.2 | 45.4 |
| 96 | 298.4 | 143.1 | 322.0 | 43.0 | 198.4 | 53.3 |

### PP Scaling Factor (vs t=8)

| Threads | gpt-oss | Qwen3 | Llama |
|---------|---------|-------|-------|
| 8 | 1.00x | 1.00x | 1.00x |
| 16 | 1.49x | 1.61x | 1.65x |
| 32 | 1.72x | 1.71x | 1.95x |
| 42 | 1.61x | 1.56x | 1.79x |
| 52 | 1.66x | 1.81x | 1.95x |
| 64 | 1.62x | 1.81x | 1.94x |
| 96 | 1.72x | 1.77x | 2.00x |

### PP Observations

1. **8→16 (+49-65%):** Best scaling step. Both CCDs engaged, threads fit within CCD boundaries.
2. **16→32 (+6-18%):** Diminishing returns. stddev explodes (gpt-oss 4.6→132.4).
3. **t=42 REGRESSION:** All models dip. 42 threads = uneven CCD distribution (21+21 with SMT imbalance), likely causes scheduling inefficiency.
4. **t=52-96 plateau:** Qwen3 reaches peak ~328 at t=52-64, others flat around t=32 level.
5. **Dense (Llama) scales best:** 2.0x at t=96 vs 1.72x for MoE models. Dense GEMM parallelizes better than expert routing.
6. **stddev pattern:** Low at t=8 (single CCD), moderate at t=16, very high at t>=32 (cross-CCD scheduling noise).

---

## TG128 Scaling

| Threads | gpt-oss-20b | σ | Qwen3-30B-A3B | σ | Llama-3.1-8B | σ |
|---------|-------------|---|---------------|---|--------------|---|
| 8 | 19.2 | 0.15 | 27.8 | 0.06 | 7.5 | 0.05 |
| 16 | 23.2 | 1.49 | 28.9 | 0.37 | 8.2 | 0.06 |
| 32 | 21.5 | 1.89 | 28.0 | 0.67 | 8.4 | 0.04 |
| 42 | 20.6 | 1.49 | 25.7 | 0.28 | 8.4 | 0.04 |
| 52 | 21.5 | 1.91 | 25.8 | 0.50 | 8.3 | 0.01 |
| 64 | 21.8 | 2.43 | 25.6 | 1.12 | 8.3 | 0.07 |
| 96 | 20.7 | 1.05 | 25.3 | 0.27 | 8.3 | 0.10 |

### TG Observations

1. **Peak at t=16 for MoE models:** gpt-oss 23.2, Qwen3 28.9.
2. **t>16 HURTS MoE TG:** gpt-oss drops -7 to -11%, Qwen3 drops -3 to -12%.
   - Reason: TG is memory-bandwidth-bound. Extra threads cause cache contention and cross-CCD traffic without useful parallelism (only one token generated at a time).
3. **Dense Llama TG flat at t>=16:** 8.2-8.4 t/s regardless of threads. Pure bandwidth limit (8 GB model / 67 GB/s ≈ 8.4 t/s theoretical max).
4. **t=42+ catastrophic for Qwen3 TG:** drops from 28.9 to 25.3 (-12%). Extra threads worsen expert selection overhead.

---

## Zen4 CCD Topology Effects

The Ryzen 9 7950X has 2 CCDs × 8 cores (16 threads per CCD with SMT):

| Threads | CCD0 | CCD1 | Expected behavior |
|---------|------|------|-------------------|
| 8 | 8 | 0 | Single CCD, low latency, low stddev |
| 16 | 8-16 | 0-8 | May span CCDs, moderate stddev |
| 32 | 16 | 16 | Both CCDs saturated, high stddev |
| 42+ | >16 | >16 | SMT fully engaged, diminishing returns |

**Key issue:** Windows thread scheduler doesn't guarantee CCD-local allocation. At t=32+, threads bounce between CCDs with 3.2x latency penalty for cross-CCD L3 access.

**Mitigation:** NUMA-aware thread pinning (BACKLOG PR06) could:
- Pin threads to single CCD for TG (maximize locality)
- Pin threads across both CCDs with explicit split for PP (maximize throughput, minimize contention)

---

## Recommendations

### Optimal Thread Counts

| Use Case | Recommended t | Rationale |
|----------|---------------|-----------|
| **Interactive (TG priority)** | **t=16** | Best TG for all models |
| **Batch PP only** | **t=32** | Best PP/stddev tradeoff |
| **Mixed workload** | **t=16** | Best balance: near-peak PP, peak TG |

### Per-Model Summary

| Model | PP peak | PP optimal | TG peak | TG optimal |
|-------|---------|-----------|---------|-----------|
| gpt-oss-20b | 298 (t=32/96) | t=16 (259, low σ) | 23.2 (t=16) | **t=16** |
| Qwen3-30B-A3B | 329 (t=52/64) | t=16 (294, low σ) | 28.9 (t=16) | **t=16** |
| Llama-3.1-8B | 198 (t=96) | t=16-32 (164-193) | 8.4 (t=32-42) | **t=16-32** |

### Final Recommendation

**Use t=16 as default.** The marginal PP gains from more threads (10-20%) are offset by:
- TG regression (-7 to -12%)
- Massive stddev increase (unreliable results)
- Higher power consumption
- No practical benefit for interactive use

For batch processing where only PP matters, t=32 gives best results with acceptable stability.

---

## Next Steps

1. **NUMA pinning (PR06):** Could stabilize t=32+ and eliminate cross-CCD penalty.
2. **Retest with pinning:** After PR06, rerun this matrix to see if t=32 becomes viable for TG.
3. **SMT analysis:** Test with SMT disabled (t=8/16 physical cores only) to isolate HT effects.



