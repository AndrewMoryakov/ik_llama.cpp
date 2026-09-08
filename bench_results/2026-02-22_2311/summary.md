> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# MoE Benchmark Results

- **Date:** 2026-02-22_2311
- **Commit:** bd387a279
- **CPU:** AMD Ryzen 9 7950X 16-Core Processor
- **RAM:** 95.1 GB
- **Repetitions:** 2
- **Total time:** 12.5 min

## Prompt Processing (pp512)

| Model | Threads | muge | rtr | fa | avg t/s | stddev |
|-------|---------|------|-----|----|---------|--------|
| gpt-oss-20b-MXFP4 | 8 | False | False | False | 150.6 | 2.64 |
| gpt-oss-20b-MXFP4 | 8 | False | False | True | 173.4 | 3.90 |
| gpt-oss-20b-MXFP4 | 8 | False | True | True | 174.4 | 1.87 |
| gpt-oss-20b-MXFP4 | 8 | True | False | True | 172.4 | 3.02 |
| gpt-oss-20b-MXFP4 | 8 | True | True | True | 175.8 | 2.64 |
| gpt-oss-20b-MXFP4 | 16 | False | False | True | 278.0 | 28.29 |
| gpt-oss-20b-MXFP4 | 16 | False | True | True | 273.0 | 35.88 |
| gpt-oss-20b-MXFP4 | 16 | True | False | True | 286.6 | 8.39 |
| gpt-oss-20b-MXFP4 | 16 | True | True | True | 289.5 | 4.22 |
| Qwen3-30B-A3B-Q4_K_M | 8 | False | False | True | 138.8 | 7.51 |
| Qwen3-30B-A3B-Q4_K_M | 8 | False | True | True | 172.2 | 1.83 |
| Qwen3-30B-A3B-Q4_K_M | 8 | True | False | True | 143.7 | 1.50 |
| Qwen3-30B-A3B-Q4_K_M | 16 | False | False | True | 234.7 | 33.74 |
| Qwen3-30B-A3B-Q4_K_M | 16 | False | True | True | 306.2 | 0.70 |
| Qwen3-30B-A3B-Q4_K_M | 16 | True | False | True | 244.9 | 21.71 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | False | False | True | 93.3 | 2.03 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | False | True | True | 98.8 | 1.76 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | True | False | True | 96.4 | 1.66 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | True | True | True | 96.0 | 2.10 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | False | False | True | 163.1 | 3.70 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | False | True | True | 165.5 | 2.53 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | True | False | True | 162.5 | 5.18 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | True | True | True | 165.7 | 3.44 |
| gpt-oss-20b-MXFP4 | 8 | False | True | False | 146.9 | 2.25 |
| gpt-oss-20b-MXFP4 | 8 | True | False | False | 144.5 | 2.69 |
| gpt-oss-20b-MXFP4 | 8 | True | True | False | 146.5 | 3.19 |
| gpt-oss-20b-MXFP4 | 16 | False | False | False | 232.2 | 40.82 |
| gpt-oss-20b-MXFP4 | 16 | False | True | False | 232.0 | 41.90 |
| gpt-oss-20b-MXFP4 | 16 | True | False | False | 225.5 | 49.21 |
| gpt-oss-20b-MXFP4 | 16 | True | True | False | 233.3 | 38.23 |
| Qwen3-30B-A3B-Q4_K_M | 8 | False | False | False | 117.9 | 6.08 |
| Qwen3-30B-A3B-Q4_K_M | 8 | False | True | False | 146.2 | 4.75 |
| Qwen3-30B-A3B-Q4_K_M | 8 | True | False | False | 121.7 | 3.30 |
| Qwen3-30B-A3B-Q4_K_M | 16 | False | False | False | 194.2 | 35.21 |
| Qwen3-30B-A3B-Q4_K_M | 16 | False | True | False | 259.7 | 0.09 |
| Qwen3-30B-A3B-Q4_K_M | 16 | True | False | False | 202.0 | 29.05 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | False | False | False | 85.5 | 0.39 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | False | True | False | 85.8 | 0.39 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | True | False | False | 86.5 | 1.41 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | True | True | False | 86.8 | 2.04 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | False | False | False | 152.3 | 4.51 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | False | True | False | 153.2 | 5.93 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | True | False | False | 156.7 | 0.89 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | True | True | False | 152.5 | 6.59 |

## Token Generation (tg128)

| Model | Threads | muge | rtr | fa | avg t/s | stddev |
|-------|---------|------|-----|----|---------|--------|
| gpt-oss-20b-MXFP4 | 8 | False | False | False | 18.8 | 0.54 |
| gpt-oss-20b-MXFP4 | 8 | False | False | True | 18.9 | 0.24 |
| gpt-oss-20b-MXFP4 | 8 | False | True | True | 19.5 | 0.27 |
| gpt-oss-20b-MXFP4 | 8 | True | False | True | 19.2 | 0.32 |
| gpt-oss-20b-MXFP4 | 8 | True | True | True | 19.7 | 0.03 |
| gpt-oss-20b-MXFP4 | 16 | False | False | True | 23.1 | 1.60 |
| gpt-oss-20b-MXFP4 | 16 | False | True | True | 24.1 | 0.03 |
| gpt-oss-20b-MXFP4 | 16 | True | False | True | 23.1 | 1.54 |
| gpt-oss-20b-MXFP4 | 16 | True | True | True | 24.2 | 0.26 |
| Qwen3-30B-A3B-Q4_K_M | 8 | False | False | True | 25.4 | 1.38 |
| Qwen3-30B-A3B-Q4_K_M | 8 | False | True | True | 27.8 | 0.28 |
| Qwen3-30B-A3B-Q4_K_M | 8 | True | False | True | 26.7 | 0.06 |
| Qwen3-30B-A3B-Q4_K_M | 16 | False | False | True | 27.0 | 3.10 |
| Qwen3-30B-A3B-Q4_K_M | 16 | False | True | True | 29.9 | 0.12 |
| Qwen3-30B-A3B-Q4_K_M | 16 | True | False | True | 28.6 | 1.59 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | False | False | True | 7.4 | 0.01 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | False | True | True | 7.6 | 0.10 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | True | False | True | 7.5 | 0.03 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | True | True | True | 7.7 | 0.01 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | False | False | True | 8.1 | 0.04 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | False | True | True | 8.1 | 0.05 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | True | False | True | 8.1 | 0.01 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | True | True | True | 8.2 | 0.08 |
| gpt-oss-20b-MXFP4 | 8 | False | True | False | 19.6 | 0.10 |
| gpt-oss-20b-MXFP4 | 8 | True | False | False | 19.0 | 0.50 |
| gpt-oss-20b-MXFP4 | 8 | True | True | False | 19.3 | 0.33 |
| gpt-oss-20b-MXFP4 | 16 | False | False | False | 22.8 | 1.81 |
| gpt-oss-20b-MXFP4 | 16 | False | True | False | 23.5 | 1.46 |
| gpt-oss-20b-MXFP4 | 16 | True | False | False | 22.9 | 1.75 |
| gpt-oss-20b-MXFP4 | 16 | True | True | False | 23.0 | 1.94 |
| Qwen3-30B-A3B-Q4_K_M | 8 | False | False | False | 26.0 | 1.68 |
| Qwen3-30B-A3B-Q4_K_M | 8 | False | True | False | 28.9 | 0.00 |
| Qwen3-30B-A3B-Q4_K_M | 8 | True | False | False | 27.3 | 0.98 |
| Qwen3-30B-A3B-Q4_K_M | 16 | False | False | False | 27.2 | 2.41 |
| Qwen3-30B-A3B-Q4_K_M | 16 | False | True | False | 29.7 | 0.00 |
| Qwen3-30B-A3B-Q4_K_M | 16 | True | False | False | 28.1 | 2.35 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | False | False | False | 7.6 | 0.01 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | False | True | False | 7.7 | 0.00 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | True | False | False | 7.6 | 0.03 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 8 | True | True | False | 7.7 | 0.02 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | False | False | False | 8.1 | 0.07 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | False | True | False | 8.1 | 0.00 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | True | False | False | 8.1 | 0.06 |
| Meta-Llama-3.1-8B-Instruct-Q8_0 | 16 | True | True | False | 8.2 | 0.16 |

## Best Configurations

### gpt-oss-20b-MXFP4
- **pp512 best:** 289.5 t/s (t=16, muge=True, rtr=True, fa=True)
- **tg128 best:** 24.2 t/s (t=16, muge=True, rtr=True, fa=True)

### Qwen3-30B-A3B-Q4_K_M
- **pp512 best:** 306.2 t/s (t=16, muge=False, rtr=True, fa=True)
- **tg128 best:** 29.9 t/s (t=16, muge=False, rtr=True, fa=True)

### Meta-Llama-3.1-8B-Instruct-Q8_0
- **pp512 best:** 165.7 t/s (t=16, muge=True, rtr=True, fa=True)
- **tg128 best:** 8.2 t/s (t=16, muge=True, rtr=True, fa=False)





