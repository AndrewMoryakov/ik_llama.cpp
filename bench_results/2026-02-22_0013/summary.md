> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# MoE Benchmark Results

- **Date:** 2026-02-22_0013
- **Commit:** bd387a279
- **CPU:** AMD Ryzen 9 7950X 16-Core Processor
- **RAM:** 95.1 GB
- **Repetitions:** 1
- **Total time:** 50.4 min

## Prompt Processing (pp512)

| Model | Threads | muge | rtr | avg t/s | stddev |
|-------|---------|------|-----|---------|--------|
| gpt-oss-120b-MXFP4-00001-of-00002 | 8 | False | False | 92.3 | 0.00 |
| gpt-oss-120b-MXFP4-00001-of-00002 | 8 | False | True | 138.3 | 0.00 |

## Token Generation (tg128)

| Model | Threads | muge | rtr | avg t/s | stddev |
|-------|---------|------|-----|---------|--------|
| gpt-oss-120b-MXFP4-00001-of-00002 | 8 | False | False | 13.1 | 0.00 |
| gpt-oss-120b-MXFP4-00001-of-00002 | 8 | False | True | 14.8 | 0.00 |

## Best Configurations

### gpt-oss-120b-MXFP4-00001-of-00002
- **pp512 best:** 138.3 t/s (t=8, muge=False, rtr=True)
- **tg128 best:** 14.8 t/s (t=8, muge=False, rtr=True)





