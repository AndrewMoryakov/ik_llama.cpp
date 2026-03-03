# MiniMax Locality Confirm

Model: D:\ggufs\un\minimax2.5-m2\MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005.gguf

| config | scenario | bench_test | avg_ts | elapsed_s | ok | log |
|---|---|---|---:|---:|---|---|
| baseline_default | pg512,128 | pp512 | 8.557544 | 1296.5 | True | `pg512_128_baseline.log` |
| baseline_default | pg512,128 | pp512+tg128 | 3.991484 | 1296.5 | True | `pg512_128_baseline.log` |
| baseline_default | pg512,128 | tg128 | 1.260793 | 1296.5 | True | `pg512_128_baseline.log` |
| tail_window_16 | pg512,128 | pp512 | 8.162181 | 1308.1 | True | `pg512_128_tail16.log` |
| tail_window_16 | pg512,128 | pp512+tg128 | 4.030163 | 1308.1 | True | `pg512_128_tail16.log` |
| tail_window_16 | pg512,128 | tg128 | 1.246305 | 1308.1 | True | `pg512_128_tail16.log` |
| baseline_default | tg128 | tg128 | 1.332637 | 444.6 | True | `tg128_baseline.log` |
| tail_window_16 | tg128 | tg128 | 1.282882 | 445.6 | True | `tg128_tail16.log` |
