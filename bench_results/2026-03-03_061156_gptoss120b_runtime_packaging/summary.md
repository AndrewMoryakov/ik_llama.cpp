# gptoss120b_runtime_packaging

Model: Z:\files\gguf\lmstudio-community\gpt-oss-120b-GGUF\gpt-oss-120b-MXFP4-00001-of-00002.gguf

| scenario | bench_test | rtr | avg_ts | elapsed_s | ok | log |
|---|---|---|---:|---:|---|---|
| pg512,128 | pp512 | auto | 147.881111 | 488.8 | True | `pg512_128_auto.log` |
| pg512,128 | tg128 | auto | 17.469667 | 488.8 | True | `pg512_128_auto.log` |
| pg512,128 | pp512+tg128 | auto | 60.177522 | 488.8 | True | `pg512_128_auto.log` |
| pg512,128 | pp512+tg128 | off | 59.089030 | 283.4 | True | `pg512_128_off.log` |
| pg512,128 | pp512 | off | 118.331030 | 283.4 | True | `pg512_128_off.log` |
| pg512,128 | tg128 | off | 16.773810 | 283.4 | True | `pg512_128_off.log` |
| tg128 | tg128 | auto | 16.657064 | 465.3 | True | `tg128_auto.log` |
| tg128 | tg128 | off | 14.134468 | 427.1 | True | `tg128_off.log` |
