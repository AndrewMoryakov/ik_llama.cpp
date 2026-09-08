> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# MoE Benchmark Results

- **Date:** 2026-02-23_0030
- **Commit:** bd387a279
- **CPU:** AMD Ryzen 9 7950X 16-Core Processor
- **RAM:** 95.1 GB
- **Repetitions:** 1
- **Total time:** 223.3 min

## Prompt Processing (pp512)

| Model | Threads | muge | rtr | fa | avg t/s | stddev |
|-------|---------|------|-----|----|---------|--------|
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 8 | False | False | True | 6.2 | 0.00 |
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 8 | False | True | True | 9.1 | 0.00 |
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 8 | True | False | True | 7.1 | 0.00 |
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 16 | False | False | True | 8.7 | 0.00 |
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 16 | False | True | True | 11.2 | 0.00 |
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 16 | True | False | True | 10.9 | 0.00 |

## Token Generation (tg128)

| Model | Threads | muge | rtr | fa | avg t/s | stddev |
|-------|---------|------|-----|----|---------|--------|
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 8 | False | False | True | 1.3 | 0.00 |
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 8 | False | True | True | 0.7 | 0.00 |
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 8 | True | False | True | 0.7 | 0.00 |
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 16 | False | False | True | 1.5 | 0.00 |
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 16 | False | True | True | 0.6 | 0.00 |
| MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005 | 16 | True | False | True | 0.7 | 0.00 |

## Best Configurations

### MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005
- **pp512 best:** 11.2 t/s (t=16, muge=False, rtr=True, fa=True)
- **tg128 best:** 1.5 t/s (t=16, muge=False, rtr=False, fa=True)





