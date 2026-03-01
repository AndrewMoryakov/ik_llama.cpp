# Matrix + Mixed Benchmark Summary

- Date: 2026-02-26_2119
- Commit: 1ee50255a
- CPU: AMD Ryzen 9 7950X 16-Core Processor
- RAM: 95.1 GB
- Rows: 18
- Success: 18, Failed: 6, Skipped: 0

## Aggregate (Median avg_ts)

| class | scenario | rtr | rows | median t/s | mean t/s |
|---|---|---|---:|---:|---:|
| in_ram | pp:512 | auto | 1 | 309.129 | 309.129 |
| in_ram | pp:512 | off | 1 | 190.307 | 190.307 |
| in_ram | pp:512 | on | 1 | 308.387 | 308.387 |
| in_ram | tg:128 | auto | 1 | 28.626 | 28.626 |
| in_ram | tg:128 | off | 1 | 23.992 | 23.992 |
| in_ram | tg:128 | on | 1 | 29.182 | 29.182 |
| swap_bound | pp:512 | auto | 1 | 247.386 | 247.386 |
| swap_bound | pp:512 | off | 1 | 235.208 | 235.208 |
| swap_bound | pp:512 | on | 1 | 240.166 | 240.166 |
| swap_bound | tg:128 | auto | 1 | 21.915 | 21.915 |
| swap_bound | tg:128 | off | 1 | 20.819 | 20.819 |
| swap_bound | tg:128 | on | 1 | 22.245 | 22.245 |

## Best rtr by class+scenario

| class | scenario | best rtr | median t/s |
|---|---|---|---:|
| in_ram | pp:512 | auto | 309.129 |
| in_ram | tg:128 | on | 29.182 |
| swap_bound | pp:512 | auto | 247.386 |
| swap_bound | tg:128 | on | 22.245 |

## Load Probe (wall_seconds)

| class | model | rtr | runs | median sec |
|---|---|---|---:|---:|
| in_ram | Qwen3-30B-A3B-Q4_K_M | auto | 1 | 3.974 |
| in_ram | Qwen3-30B-A3B-Q4_K_M | off | 1 | 1.773 |
| in_ram | Qwen3-30B-A3B-Q4_K_M | on | 1 | 3.74 |
| swap_bound | gpt-oss-20b-MXFP4 | auto | 1 | 2.154 |
| swap_bound | gpt-oss-20b-MXFP4 | off | 1 | 1.803 |
| swap_bound | gpt-oss-20b-MXFP4 | on | 1 | 1.912 |

## Run Stats

- Total elapsed: 5.72 min
- Timeout per test: 20 min


