# Matrix + Mixed Benchmark Summary

- Date: 2026-02-27_1856
- Commit: 1ee50255a
- CPU: AMD Ryzen 9 7950X 16-Core Processor
- RAM: 95.1 GB
- Rows: 21
- Success: 15, Failed: 0, Skipped: 0

## Aggregate (Median avg_ts)

| class | scenario | rtr | rows | median t/s | mean t/s |
|---|---|---|---:|---:|---:|
| swap_bound | pg:512:128 | auto | 4 | 55.266 | 67.549 |
| swap_bound | pg:512:128 | off | 4 | 46.973 | 57.03 |
| swap_bound | pg:512:128 | on | 4 | 54.758 | 69.286 |
| swap_bound | tg:128 | auto | 2 | 14.842 | 14.842 |
| swap_bound | tg:128 | off | 2 | 9.429 | 9.429 |
| swap_bound | tg:128 | on | 2 | 14.807 | 14.807 |

## Best rtr by class+scenario

| class | scenario | best rtr | median t/s |
|---|---|---|---:|
| swap_bound | pg:512:128 | auto | 55.266 |
| swap_bound | tg:128 | auto | 14.842 |

## Load Probe (wall_seconds)

| class | model | rtr | runs | median sec |
|---|---|---|---:|---:|
| swap_bound | gpt-oss-120b-MXFP4-00001-of-00002 | auto | 1 | 457.696 |
| swap_bound | gpt-oss-120b-MXFP4-00001-of-00002 | off | 1 | 242.695 |
| swap_bound | gpt-oss-120b-MXFP4-00001-of-00002 | on | 1 | 452.469 |

## Run Stats

- Total elapsed: 94.41 min
- Timeout per test: 60 min


