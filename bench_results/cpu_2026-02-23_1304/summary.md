> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# CPU Topology Benchmark Results

- **Date:** cpu_2026-02-23_1304
- **Commit:** bd387a279
- **CPU:** AMD Ryzen 9 7950X 16-Core Processor
- **RAM:** 95.1 GB
- **Reps:** 2
- **Total time:** 14 min

## Scenario: ccd-affinity

| Description | avg t/s | stddev |
|-------------|---------|--------|
| gpt-oss-20b t=16 no-pin pp512 | 268.7 | 37.16 |
| gpt-oss-20b t=16 no-pin tg128 | 23.3 | 1.38 |
| gpt-oss-20b t=16 ccd0 pp512 | 247.3 | 36.36 |
| gpt-oss-20b t=16 ccd0 tg128 | 20.8 | 1.15 |
| gpt-oss-20b t=16 ccd1 pp512 | 260.5 | 47.84 |
| gpt-oss-20b t=16 ccd1 tg128 | 23.4 | 1.21 |
| Qwen3-30B-A3B t=16 no-pin pp512 | 307.5 | 0.59 |
| Qwen3-30B-A3B t=16 no-pin tg128 | 29.3 | 0.00 |
| Qwen3-30B-A3B t=16 ccd0 pp512 | 289.3 | 0.64 |
| Qwen3-30B-A3B t=16 ccd0 tg128 | 28.4 | 0.13 |
| Qwen3-30B-A3B t=16 ccd1 pp512 | 306.8 | 0.14 |
| Qwen3-30B-A3B t=16 ccd1 tg128 | 29.3 | 0.01 |
| Llama-3.1-8B t=16 no-pin pp512 | 165.4 | 6.37 |
| Llama-3.1-8B t=16 no-pin tg128 | 8.2 | 0.10 |
| Llama-3.1-8B t=16 ccd0 pp512 | 156.7 | 2.38 |
| Llama-3.1-8B t=16 ccd0 tg128 | 7.7 | 0.02 |
| Llama-3.1-8B t=16 ccd1 pp512 | 165.6 | 5.41 |
| Llama-3.1-8B t=16 ccd1 tg128 | 8.4 | 0.08 |

## Scenario: prompt-length

| Description | avg t/s | stddev |
|-------------|---------|--------|
| gpt-oss-20b t=16 pp128 | 178.3 | 71.13 |
| gpt-oss-20b t=16 pp256 | 217.0 | 67.84 |
| gpt-oss-20b t=16 pp512 | 257.2 | 53.51 |
| gpt-oss-20b t=16 pp1024 | 268.7 | 25.33 |
| gpt-oss-20b t=16 pp2048 | 264.8 | 12.43 |
| gpt-oss-20b t=16 pp4096 | 248.4 | 5.08 |
| Qwen3-30B-A3B t=16 pp128 | 287.1 | 8.56 |
| Qwen3-30B-A3B t=16 pp256 | 310.1 | 1.80 |
| Qwen3-30B-A3B t=16 pp512 | 306.9 | 1.52 |
| Qwen3-30B-A3B t=16 pp1024 | 284.7 | 0.09 |
| Qwen3-30B-A3B t=16 pp2048 | 246.9 | 0.51 |
| Qwen3-30B-A3B t=16 pp4096 | 194.6 | 0.34 |
| Llama-3.1-8B t=16 pp128 | 152.6 | 21.06 |
| Llama-3.1-8B t=16 pp256 | 163.2 | 8.94 |
| Llama-3.1-8B t=16 pp512 | 166.3 | 3.72 |
| Llama-3.1-8B t=16 pp1024 | 163.0 | 1.30 |
| Llama-3.1-8B t=16 pp2048 | 154.0 | 0.71 |
| Llama-3.1-8B t=16 pp4096 | 138.9 | 0.17 |

## Scenario: smt

| Description | avg t/s | stddev |
|-------------|---------|--------|
| gpt-oss-20b t=8 nosmt pp512 | 78.8 | 14.56 |
| gpt-oss-20b t=8 nosmt tg128 | 7.5 | 0.10 |
| gpt-oss-20b t=16 smt pp512 | 260.8 | 32.99 |
| gpt-oss-20b t=16 smt tg128 | 21.5 | 0.82 |
| Qwen3-30B-A3B t=8 nosmt pp512 | 106.2 | 2.68 |
| Qwen3-30B-A3B t=8 nosmt tg128 | 20.0 | 0.06 |
| Qwen3-30B-A3B t=16 smt pp512 | 288.6 | 9.31 |
| Qwen3-30B-A3B t=16 smt tg128 | 28.3 | 0.11 |
| Llama-3.1-8B t=8 nosmt pp512 | 43.4 | 0.58 |
| Llama-3.1-8B t=8 nosmt tg128 | 6.8 | 0.08 |
| Llama-3.1-8B t=16 smt pp512 | 160.6 | 5.65 |
| Llama-3.1-8B t=16 smt tg128 | 7.7 | 0.01 |





