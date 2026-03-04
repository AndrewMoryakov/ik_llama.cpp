# gpt-oss-120b prompt-packed confirm

Model: Z:\files\gguf\lmstudio-community\gpt-oss-120b-GGUF\gpt-oss-120b-MXFP4-00001-of-00002.gguf

| case | bench_test | avg_ts | elapsed_s | ok | log |
|---|---|---:|---:|---|---|
| pg512_128_backhalf | pp512 | 164.162962 | 524.8 | True | `pg512_128_backhalf.log` |
| pg512_128_backhalf | pp512+tg128 | 60.740783 | 524.8 | True | `pg512_128_backhalf.log` |
| pg512_128_backhalf | tg128 | 17.240189 | 524.8 | True | `pg512_128_backhalf.log` |
| pg512_128_baseline | pp512 | 158.692960 | 522 | True | `pg512_128_baseline.log` |
| pg512_128_baseline | pp512+tg128 | 60.379250 | 522 | True | `pg512_128_baseline.log` |
| pg512_128_baseline | tg128 | 17.227059 | 522 | True | `pg512_128_baseline.log` |
| pp512_backhalf | pp512 | 165.294421 | 469.2 | True | `pp512_backhalf.log` |
| pp512_baseline | pp512 | 161.103907 | 469.7 | True | `pp512_baseline.log` |
