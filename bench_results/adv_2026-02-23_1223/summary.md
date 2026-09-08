> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# Advanced Benchmark Results

- **Date:** adv_2026-02-23_1223
- **Commit:** bd387a279
- **CPU:** AMD Ryzen 9 7950X 16-Core Processor
- **RAM:** 95.1 GB
- **Reps:** 2
- **Total time:** 17 min

## Scenario: kv-cache

| Description | avg t/s | stddev |
|-------------|---------|--------|
| gpt-oss-20b t=8 ctk=f16 pp512 | 176.0 | 2.70 |
| gpt-oss-20b t=8 ctk=f16 tg128 | 19.3 | 0.13 |
| gpt-oss-20b t=16 ctk=f16 pp512 | 265.0 | 43.27 |
| gpt-oss-20b t=16 ctk=f16 tg128 | 23.3 | 1.20 |
| gpt-oss-20b t=8 ctk=q8_0 pp512 | 170.7 | 3.34 |
| gpt-oss-20b t=8 ctk=q8_0 tg128 | 19.4 | 0.12 |
| gpt-oss-20b t=16 ctk=q8_0 pp512 | 298.1 | 0.63 |
| gpt-oss-20b t=16 ctk=q8_0 tg128 | 23.3 | 1.85 |
| Qwen3-30B-A3B t=8 ctk=f16 pp512 | 181.8 | 4.38 |
| Qwen3-30B-A3B t=8 ctk=f16 tg128 | 27.8 | 0.07 |
| Qwen3-30B-A3B t=16 ctk=f16 pp512 | 303.6 | 1.56 |
| Qwen3-30B-A3B t=16 ctk=f16 tg128 | 29.7 | 0.61 |
| Qwen3-30B-A3B t=8 ctk=q8_0 pp512 | 181.7 | 6.92 |
| Qwen3-30B-A3B t=8 ctk=q8_0 tg128 | 28.0 | 0.15 |
| Qwen3-30B-A3B t=16 ctk=q8_0 pp512 | 316.7 | 1.14 |
| Qwen3-30B-A3B t=16 ctk=q8_0 tg128 | 29.4 | 0.03 |
| Llama-3.1-8B t=8 ctk=f16 pp512 | 102.0 | 0.45 |
| Llama-3.1-8B t=8 ctk=f16 tg128 | 7.6 | 0.00 |
| Llama-3.1-8B t=16 ctk=f16 pp512 | 168.7 | 1.40 |
| Llama-3.1-8B t=16 ctk=f16 tg128 | 8.3 | 0.14 |
| Llama-3.1-8B t=8 ctk=q8_0 pp512 | 97.3 | 1.54 |
| Llama-3.1-8B t=8 ctk=q8_0 tg128 | 7.6 | 0.05 |
| Llama-3.1-8B t=16 ctk=q8_0 pp512 | 169.3 | 2.78 |
| Llama-3.1-8B t=16 ctk=q8_0 tg128 | 8.3 | 0.03 |

## Scenario: t32

| Description | avg t/s | stddev |
|-------------|---------|--------|
| gpt-oss-20b t=32 pp512 | 338.0 | 205.83 |
| gpt-oss-20b t=32 tg128 | 22.1 | 2.13 |
| Qwen3-30B-A3B t=32 pp512 | 309.9 | 46.56 |
| Qwen3-30B-A3B t=32 tg128 | 29.5 | 0.55 |
| Llama-3.1-8B t=32 pp512 | 223.1 | 73.42 |
| Llama-3.1-8B t=32 tg128 | 8.6 | 0.01 |





