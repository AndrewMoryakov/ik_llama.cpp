# gptoss20b_runtime_baseline

Model: Z:\files\gguf\lmstudio-community\gpt-oss-20b-GGUF\gpt-oss-20b-MXFP4.gguf

| scenario | bench_test | rtr | avg_ts | elapsed_s | ok | log |
|---|---|---|---:|---:|---|---|
| pg512,128 | tg128 | auto | 24.075077 | 45.5 | True | `pg512_128_auto.log` |
| pg512,128 | pp512+tg128 | auto | 90.283185 | 45.5 | True | `pg512_128_auto.log` |
| pg512,128 | pp512 | auto | 272.749618 | 45.5 | True | `pg512_128_auto.log` |
| tg128 | tg128 | auto | 23.707807 | 102.4 | True | `tg128_auto.log` |
