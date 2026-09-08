# Matrix + Mixed Benchmark Summary

- Date: 2026-02-27_1831
- Commit: 1ee50255a
- CPU: AMD Ryzen 9 7950X 16-Core Processor
- RAM: 95.1 GB
- Rows: 102
- Success: 78, Failed: 0, Skipped: 0

## Aggregate (Median avg_ts)

| class | scenario | rtr | rows | median t/s | mean t/s |
|---|---|---|---:|---:|---:|
| in_ram | pg:512:128 | auto | 16 | 101.894 | 163.735 |
| in_ram | pg:512:128 | off | 16 | 85.258 | 143.032 |
| in_ram | pg:512:128 | on | 16 | 100.186 | 162.852 |
| in_ram | pp:512 | auto | 8 | 328.144 | 300.349 |
| in_ram | pp:512 | off | 8 | 278.65 | 262.185 |
| in_ram | pp:512 | on | 8 | 323.981 | 299.329 |
| in_ram | tg:128 | auto | 8 | 25.621 | 25.436 |
| in_ram | tg:128 | off | 8 | 23.525 | 23.371 |
| in_ram | tg:128 | on | 8 | 25.641 | 25.481 |

## Best rtr by class+scenario

| class | scenario | best rtr | median t/s |
|---|---|---|---:|
| in_ram | pg:512:128 | auto | 101.894 |
| in_ram | pp:512 | auto | 328.144 |
| in_ram | tg:128 | on | 25.641 |

## Load Probe (wall_seconds)

| class | model | rtr | runs | median sec |
|---|---|---|---:|---:|
| in_ram | gpt-oss-20b-MXFP4 | auto | 1 | 2.111 |
| in_ram | gpt-oss-20b-MXFP4 | off | 1 | 1.799 |
| in_ram | gpt-oss-20b-MXFP4 | on | 1 | 1.904 |
| in_ram | Qwen3-30B-A3B-Q4_K_M | auto | 1 | 3.959 |
| in_ram | Qwen3-30B-A3B-Q4_K_M | off | 1 | 1.749 |
| in_ram | Qwen3-30B-A3B-Q4_K_M | on | 1 | 3.766 |

## Run Stats

- Total elapsed: 24.12 min
- Timeout per test: 30 min


