# Matrix + Mixed Benchmark Summary

- Date: 2026-02-26_2130
- Commit: 1ee50255a
- CPU: AMD Ryzen 9 7950X 16-Core Processor
- RAM: 95.1 GB
- Rows: 24
- Success: 18, Failed: 0, Skipped: 0

## Aggregate (Median avg_ts)

| class | scenario | rtr | rows | median t/s | mean t/s |
|---|---|---|---:|---:|---:|
| in_ram | pg:512:128 | auto | 2 | 169.536 | 169.536 |
| in_ram | pg:512:128 | off | 2 | 108.797 | 108.797 |
| in_ram | pg:512:128 | on | 2 | 169.385 | 169.385 |
| in_ram | tg:128 | auto | 1 | 29.039 | 29.039 |
| in_ram | tg:128 | off | 1 | 23.887 | 23.887 |
| in_ram | tg:128 | on | 1 | 28.645 | 28.645 |
| swap_bound | pg:512:128 | auto | 2 | 85.34 | 85.34 |
| swap_bound | pg:512:128 | off | 2 | 67.254 | 67.254 |
| swap_bound | pg:512:128 | on | 2 | 82.838 | 82.838 |
| swap_bound | tg:128 | auto | 1 | 16.104 | 16.104 |
| swap_bound | tg:128 | off | 1 | 13.738 | 13.738 |
| swap_bound | tg:128 | on | 1 | 15.916 | 15.916 |

## Best rtr by class+scenario

| class | scenario | best rtr | median t/s |
|---|---|---|---:|
| in_ram | pg:512:128 | auto | 169.536 |
| in_ram | tg:128 | auto | 29.039 |
| swap_bound | pg:512:128 | auto | 85.34 |
| swap_bound | tg:128 | auto | 16.104 |

## Load Probe (wall_seconds)

| class | model | rtr | runs | median sec |
|---|---|---|---:|---:|
| in_ram | Qwen3-30B-A3B-Q4_K_M | auto | 1 | 4.018 |
| in_ram | Qwen3-30B-A3B-Q4_K_M | off | 1 | 117.035 |
| in_ram | Qwen3-30B-A3B-Q4_K_M | on | 1 | 3.943 |
| swap_bound | gpt-oss-120b-MXFP4-00001-of-00002 | auto | 1 | 457.502 |
| swap_bound | gpt-oss-120b-MXFP4-00001-of-00002 | off | 1 | 252.672 |
| swap_bound | gpt-oss-120b-MXFP4-00001-of-00002 | on | 1 | 457.009 |

## Run Stats

- Total elapsed: 61.33 min
- Timeout per test: 45 min


