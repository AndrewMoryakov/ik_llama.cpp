# Matrix + Mixed Benchmark Summary

- Date: 2026-02-26_2126
- Commit: 1ee50255a
- CPU: AMD Ryzen 9 7950X 16-Core Processor
- RAM: 95.1 GB
- Rows: 32
- Success: 24, Failed: 0, Skipped: 0

## Aggregate (Median avg_ts)

| class | scenario | rtr | rows | median t/s | mean t/s |
|---|---|---|---:|---:|---:|
| in_ram | pg:512:128 | auto | 2 | 169.059 | 169.059 |
| in_ram | pg:512:128 | off | 2 | 115.104 | 115.104 |
| in_ram | pg:512:128 | on | 4 | 170.22 | 170.228 |
| in_ram | pp:512 | auto | 1 | 311.174 | 311.174 |
| in_ram | pp:512 | off | 1 | 193.859 | 193.859 |
| in_ram | pp:512 | on | 1 | 311.829 | 311.829 |
| in_ram | tg:128 | auto | 1 | 29.022 | 29.022 |
| in_ram | tg:128 | off | 1 | 24.148 | 24.148 |
| in_ram | tg:128 | on | 1 | 29.151 | 29.151 |
| swap_bound | pg:512:128 | auto | 2 | 140.637 | 140.637 |
| swap_bound | pg:512:128 | off | 2 | 127.846 | 127.846 |
| swap_bound | pg:512:128 | on | 2 | 128.857 | 128.857 |
| swap_bound | pp:512 | auto | 1 | 245.737 | 245.737 |
| swap_bound | pp:512 | off | 1 | 225.299 | 225.299 |
| swap_bound | pp:512 | on | 1 | 253.197 | 253.197 |
| swap_bound | tg:128 | auto | 1 | 21.999 | 21.999 |
| swap_bound | tg:128 | off | 1 | 20.95 | 20.95 |
| swap_bound | tg:128 | on | 1 | 21.824 | 21.824 |

## Best rtr by class+scenario

| class | scenario | best rtr | median t/s |
|---|---|---|---:|
| in_ram | pg:512:128 | on | 170.22 |
| in_ram | pp:512 | on | 311.829 |
| in_ram | tg:128 | on | 29.151 |
| swap_bound | pg:512:128 | auto | 140.637 |
| swap_bound | pp:512 | on | 253.197 |
| swap_bound | tg:128 | auto | 21.999 |

## Load Probe (wall_seconds)

| class | model | rtr | runs | median sec |
|---|---|---|---:|---:|
| in_ram | Qwen3-30B-A3B-Q4_K_M | auto | 1 | 4.1 |
| in_ram | Qwen3-30B-A3B-Q4_K_M | off | 1 | 1.754 |
| in_ram | Qwen3-30B-A3B-Q4_K_M | on | 1 | 3.777 |
| swap_bound | gpt-oss-20b-MXFP4 | auto | 1 | 2.142 |
| swap_bound | gpt-oss-20b-MXFP4 | off | 1 | 1.805 |
| swap_bound | gpt-oss-20b-MXFP4 | on | 1 | 1.888 |

## Run Stats

- Total elapsed: 2.52 min
- Timeout per test: 20 min


