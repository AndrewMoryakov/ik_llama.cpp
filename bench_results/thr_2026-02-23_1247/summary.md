> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# Thread Scaling Benchmark Results

- **Date:** thr_2026-02-23_1247
- **Commit:** bd387a279
- **CPU:** AMD Ryzen 9 7950X 16-Core Processor
- **RAM:** 95.1 GB
- **Reps:** 2
- **Total time:** 10.4 min
- **Thread counts:** 8, 16, 32, 42, 52, 64, 96

## gpt-oss-20b

### Prompt Processing (PP512)

| Threads | avg t/s | stddev |
|---------|---------|--------|
| 8 | 173.7 | 4.60 |
| 16 | 258.8 | 49.58 |
| 32 | 298.1 | 132.40 |
| 42 | 280.2 | 101.60 |
| 52 | 288.4 | 135.51 |
| 64 | 281.1 | 133.90 |
| 96 | 298.4 | 143.07 |

### Token Generation (TG128)

| Threads | avg t/s | stddev |
|---------|---------|--------|
| 8 | 19.2 | 0.15 |
| 16 | 23.2 | 1.49 |
| 32 | 21.5 | 1.89 |
| 42 | 20.6 | 1.49 |
| 52 | 21.5 | 1.91 |
| 64 | 21.8 | 2.43 |
| 96 | 20.7 | 1.05 |

## Qwen3-30B-A3B

### Prompt Processing (PP512)

| Threads | avg t/s | stddev |
|---------|---------|--------|
| 8 | 181.9 | 2.08 |
| 16 | 293.5 | 16.21 |
| 32 | 311.5 | 10.95 |
| 42 | 284.3 | 0.05 |
| 52 | 328.5 | 31.86 |
| 64 | 328.6 | 47.38 |
| 96 | 322.0 | 43.01 |

### Token Generation (TG128)

| Threads | avg t/s | stddev |
|---------|---------|--------|
| 8 | 27.8 | 0.06 |
| 16 | 28.9 | 0.37 |
| 32 | 28.0 | 0.67 |
| 42 | 25.7 | 0.28 |
| 52 | 25.8 | 0.50 |
| 64 | 25.6 | 1.12 |
| 96 | 25.3 | 0.27 |

## Llama-3.1-8B

### Prompt Processing (PP512)

| Threads | avg t/s | stddev |
|---------|---------|--------|
| 8 | 99.3 | 3.83 |
| 16 | 164.2 | 7.84 |
| 32 | 193.3 | 44.51 |
| 42 | 178.2 | 34.72 |
| 52 | 193.4 | 30.14 |
| 64 | 192.2 | 45.41 |
| 96 | 198.4 | 53.34 |

### Token Generation (TG128)

| Threads | avg t/s | stddev |
|---------|---------|--------|
| 8 | 7.5 | 0.05 |
| 16 | 8.2 | 0.06 |
| 32 | 8.4 | 0.04 |
| 42 | 8.4 | 0.04 |
| 52 | 8.3 | 0.01 |
| 64 | 8.3 | 0.07 |
| 96 | 8.3 | 0.10 |





