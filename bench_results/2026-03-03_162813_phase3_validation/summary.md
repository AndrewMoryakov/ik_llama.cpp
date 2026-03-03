# Phase 3 Validation (no MiniMax)

| case | config | scenario | bench_test | rtr | avg_ts | elapsed_s | ok | log |
|---|---|---|---|---|---:|---:|---|---|
| gptoss120b_prompt_packed | baseline | pg512,128 | pp512 | auto | 149.989209 | 492.6 | True | `gptoss120b_prompt_packed_pg512_128_baseline.log` |
| gptoss120b_prompt_packed | baseline | pg512,128 | pp512+tg128 | auto | 56.995574 | 492.6 | True | `gptoss120b_prompt_packed_pg512_128_baseline.log` |
| gptoss120b_prompt_packed | baseline | pg512,128 | tg128 | auto | 16.121140 | 492.6 | True | `gptoss120b_prompt_packed_pg512_128_baseline.log` |
| gptoss120b_prompt_packed | prompt_packed_back_half | pg512,128 | pp512 | auto | 161.300053 | 482.6 | True | `gptoss120b_prompt_packed_pg512_128_backhalf.log` |
| gptoss120b_prompt_packed | prompt_packed_back_half | pg512,128 | pp512+tg128 | auto | 58.590794 | 482.6 | True | `gptoss120b_prompt_packed_pg512_128_backhalf.log` |
| gptoss120b_prompt_packed | prompt_packed_back_half | pg512,128 | tg128 | auto | 16.516430 | 482.6 | True | `gptoss120b_prompt_packed_pg512_128_backhalf.log` |
| gptoss120b_prompt_packed | baseline | pp512 | pp512 | auto | 150.405577 | 472.9 | True | `gptoss120b_prompt_packed_pp512_baseline.log` |
| gptoss120b_prompt_packed | prompt_packed_back_half | pp512 | pp512 | auto | 161.931084 | 462.6 | True | `gptoss120b_prompt_packed_pp512_backhalf.log` |
| gptoss20b_hot_experts | baseline | pg128,32 | pp128+tg32 | auto | 79.594862 | 22 | True | `gptoss20b_hot_experts_pg128_32_baseline.log` |
| gptoss20b_hot_experts | baseline | pg128,32 | pp512 | auto | 271.372230 | 22 | True | `gptoss20b_hot_experts_pg128_32_baseline.log` |
| gptoss20b_hot_experts | baseline | pg128,32 | tg128 | auto | 21.942375 | 22 | True | `gptoss20b_hot_experts_pg128_32_baseline.log` |
| gptoss20b_hot_experts | full_prompt | pg128,32 | pp128+tg32 | auto | 79.246333 | 22 | True | `gptoss20b_hot_experts_pg128_32_full.log` |
| gptoss20b_hot_experts | full_prompt | pg128,32 | pp512 | auto | 269.375069 | 22 | True | `gptoss20b_hot_experts_pg128_32_full.log` |
| gptoss20b_hot_experts | full_prompt | pg128,32 | tg128 | auto | 21.990312 | 22 | True | `gptoss20b_hot_experts_pg128_32_full.log` |
| gptoss20b_hot_experts | tail_window_16 | pg128,32 | pp128+tg32 | auto | 80.978128 | 21.5 | True | `gptoss20b_hot_experts_pg128_32_tail16.log` |
| gptoss20b_hot_experts | tail_window_16 | pg128,32 | pp512 | auto | 274.218749 | 21.5 | True | `gptoss20b_hot_experts_pg128_32_tail16.log` |
| gptoss20b_hot_experts | tail_window_16 | pg128,32 | tg128 | auto | 22.013617 | 21.5 | True | `gptoss20b_hot_experts_pg128_32_tail16.log` |
| gptoss20b_prompt_packed | baseline | pg512,128 | pp512 | auto | 274.508638 | 46.4 | True | `gptoss20b_prompt_packed_pg512_128_baseline.log` |
| gptoss20b_prompt_packed | baseline | pg512,128 | pp512+tg128 | auto | 87.285178 | 46.4 | True | `gptoss20b_prompt_packed_pg512_128_baseline.log` |
| gptoss20b_prompt_packed | baseline | pg512,128 | tg128 | auto | 23.066187 | 46.4 | True | `gptoss20b_prompt_packed_pg512_128_baseline.log` |
| gptoss20b_prompt_packed | prompt_packed_back_half | pg512,128 | pp512 | auto | 285.863285 | 46.7 | True | `gptoss20b_prompt_packed_pg512_128_backhalf.log` |
| gptoss20b_prompt_packed | prompt_packed_back_half | pg512,128 | pp512+tg128 | auto | 86.838406 | 46.7 | True | `gptoss20b_prompt_packed_pg512_128_backhalf.log` |
| gptoss20b_prompt_packed | prompt_packed_back_half | pg512,128 | tg128 | auto | 23.008943 | 46.7 | True | `gptoss20b_prompt_packed_pg512_128_backhalf.log` |
| gptoss20b_prompt_packed | baseline | pp512 | pp512 | auto | 272.100196 | 7.6 | True | `gptoss20b_prompt_packed_pp512_baseline.log` |
| gptoss20b_prompt_packed | prompt_packed_back_half | pp512 | pp512 | auto | 284.094653 | 7.9 | True | `gptoss20b_prompt_packed_pp512_backhalf.log` |
| qwen30ba3b_prompt_packed | baseline | pg512,128 | pp512 | auto | 308.740658 | 41.2 | True | `qwen30ba3b_prompt_packed_pg512_128_baseline.log` |
| qwen30ba3b_prompt_packed | baseline | pg512,128 | pp512+tg128 | auto | 101.874129 | 41.2 | True | `qwen30ba3b_prompt_packed_pg512_128_baseline.log` |
| qwen30ba3b_prompt_packed | baseline | pg512,128 | tg128 | auto | 28.617646 | 41.2 | True | `qwen30ba3b_prompt_packed_pg512_128_baseline.log` |
| qwen30ba3b_prompt_packed | prompt_packed_front_half | pg512,128 | pp512 | auto | 308.966937 | 41.7 | True | `qwen30ba3b_prompt_packed_pg512_128_fronthalf.log` |
| qwen30ba3b_prompt_packed | prompt_packed_front_half | pg512,128 | pp512+tg128 | auto | 102.146926 | 41.7 | True | `qwen30ba3b_prompt_packed_pg512_128_fronthalf.log` |
| qwen30ba3b_prompt_packed | prompt_packed_front_half | pg512,128 | tg128 | auto | 28.485746 | 41.7 | True | `qwen30ba3b_prompt_packed_pg512_128_fronthalf.log` |
| qwen30ba3b_prompt_packed | baseline | pp512 | pp512 | auto | 284.994612 | 161.6 | True | `qwen30ba3b_prompt_packed_pp512_baseline.log` |
| qwen30ba3b_prompt_packed | prompt_packed_front_half | pp512 | pp512 | auto | 311.178162 | 9.3 | True | `qwen30ba3b_prompt_packed_pp512_fronthalf.log` |
