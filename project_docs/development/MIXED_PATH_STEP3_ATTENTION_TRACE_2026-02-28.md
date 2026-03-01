# Mixed Path Step 3: Attention-Side Confirmation

Date: 2026-02-28

## Goal

Confirm whether the next `pg` optimization pass should target:

1. MoE runtime / expert path
2. prompt-side attention path
3. scheduler / graph reuse boundary

Step 1 and Step 2 already showed that `graph build/reset` is small and `compute` dominates.
This step checks whether the dominant difference is more likely attention-side or MoE-side.

## What was measured

### 1. Graph-shape trace for `pg512,128` with `-fa 1`

Environment:

- CPU: AMD Ryzen 9 7950X
- Threads: `-t 16`
- `-rtr auto`
- `-muge 0`
- `IK_LLAMA_PG_TRACE=1`

Models:

1. `Qwen3-30B-A3B-Q4_K_M`
2. `gpt-oss-20b-MXFP4`

Artifacts:

- `ik_llama.cpp/bench_results/pg_trace_qwen3_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_2026-02-28.log`

Key lines:

- `ik_llama.cpp/bench_results/pg_trace_qwen3_2026-02-28.log:372`
- `ik_llama.cpp/bench_results/pg_trace_qwen3_2026-02-28.log:374`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_2026-02-28.log:364`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_2026-02-28.log:366`

Observed graph summaries:

### Qwen3, `-fa 1`

- prompt:
  - `nodes=1781`
  - `flash_attn=48`
  - `mul_mat=241`
  - `get_rows=51`
  - `cpy=96`
  - `moe_fused_up_gate=48`
- first decode after prompt:
  - `nodes=1779`
  - `flash_attn=48`
  - `mul_mat=241`
  - `get_rows=49`
  - `cpy=96`
  - `moe_fused_up_gate=48`

### gpt-oss-20b, `-fa 1`

- prompt:
  - `nodes=941`
  - `flash_attn=24`
  - `mul_mat=121`
  - `get_rows=27`
  - `cpy=48`
  - `moe_fused_up_gate=24`
- first decode after prompt:
  - `nodes=939`
  - `flash_attn=24`
  - `mul_mat=121`
  - `get_rows=25`
  - `cpy=48`
  - `moe_fused_up_gate=24`

## Main result from `-fa 1`

The prompt graph and first-decode graph are structurally very close.

Important point:

- MoE node counts do not materially change between prompt and first decode.
- The graph boundary still exists, but it is not a structural MoE explosion.
- This weakens the hypothesis that `pg` is primarily limited by prompt->decode MoE transition overhead.

## 2. A/B benchmark for `-fa 0/1` on `pg512,128`

Command shape:

```powershell
llama-bench.exe -m <model.gguf> -t 16 -fa <0|1> -rtr auto -muge 0 -pg 512,128 -r 1 -w 1 -o json
```

Results:

| Model | `-fa 0` | `-fa 1` | Delta |
|---|---:|---:|---:|
| Qwen3-30B-A3B-Q4_K_M | 94.27 t/s | 103.38 t/s | +9.7% |
| gpt-oss-20b-MXFP4 | 84.40 t/s | 88.89 t/s | +5.3% |

Interpretation:

- `pg` is materially sensitive to `flash_attn`.
- The size of the gain is too large to ignore.
- This supports attention-side work as the next optimization target.

## 3. Graph-shape trace for `pg512,128` with `-fa 0`

Artifacts:

- `ik_llama.cpp/bench_results/pg_trace_qwen3_fa0_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_fa0_2026-02-28.log`

Key lines:

- `ik_llama.cpp/bench_results/pg_trace_qwen3_fa0_2026-02-28.log:372`
- `ik_llama.cpp/bench_results/pg_trace_qwen3_fa0_2026-02-28.log:374`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_fa0_2026-02-28.log:364`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_fa0_2026-02-28.log:366`

Observed graph summaries:

### Qwen3, `-fa 0`

- prompt:
  - `nodes=1973`
  - `flash_attn=0`
  - `mul_mat=337`
  - `get_rows=51`
  - `cpy=96`
  - `moe_fused_up_gate=48`
- first decode after prompt:
  - `nodes=1971`
  - `flash_attn=0`
  - `mul_mat=337`
  - `get_rows=49`
  - `cpy=96`
  - `moe_fused_up_gate=48`

### gpt-oss-20b, `-fa 0`

- prompt:
  - `nodes=1037`
  - `flash_attn=0`
  - `mul_mat=169`
  - `get_rows=27`
  - `cpy=48`
  - `moe_fused_up_gate=24`
- first decode after prompt:
  - `nodes=1035`
  - `flash_attn=0`
  - `mul_mat=169`
  - `get_rows=25`
  - `cpy=48`
  - `moe_fused_up_gate=24`

## Main result from `-fa 0`

Turning flash attention off changes the attention side of the graph, not the MoE side:

- Qwen3:
  - `mul_mat`: `241 -> 337`
  - `moe_fused_up_gate`: unchanged at `48`
- gpt-oss-20b:
  - `mul_mat`: `121 -> 169`
  - `moe_fused_up_gate`: unchanged at `24`

This is the strongest signal so far:

- the large `pg` loss when `-fa` is disabled correlates with a larger attention-side graph
- the MoE graph footprint stays effectively constant

## Source-level confirmation

Relevant builder code:

- `ik_llama.cpp/src/llama-build-context.cpp:6860`
  - `bool pp_opt = n_tokens >= 128;`
- `ik_llama.cpp/src/llama-build-context.cpp:7013`
  - prompt-specific `flash_attn` branch for `mla_attn > 1`
- `ik_llama.cpp/src/llama-build-context.cpp:7161`
  - non-flash attention fallback with extra `mul_mat`, `soft_max`, `permute` work

This matches the measurements:

- prompt processing enters a dedicated `pp_opt` path
- flash attention materially changes the prompt-side attention workload
- the strongest next candidate is not MoE routing structure, but prompt attention execution

## Conclusion

At this point the next optimization phase should target:

1. prompt-side attention path
2. `pp_opt` branch behavior
3. prompt-specific graph/operator mix around `flash_attn`

It should **not** start with:

1. scheduler reset redesign
2. graph reuse redesign for mixed-path
3. MoE fused-up-gate rewrites

Those may still matter later, but they are not the best first target based on current data.

## Recommended next step

Add one more focused layer of instrumentation around the prompt attention builder path:

1. log which prompt attention branch is selected per architecture
2. log whether `pp_opt` is active and for how many layers
3. log the prompt path chosen for:
   - `flash_attn`
   - non-`flash_attn`
   - MLA-specific prompt path
4. then choose one small optimization candidate inside that path

Current best candidate area:

- `ik_llama.cpp/src/llama-build-context.cpp:7013`
- `ik_llama.cpp/src/llama-build-context.cpp:7161`

## Status

Mixed-path direction is now sufficiently confirmed:

- dominant issue is not scheduler overhead
- dominant issue does not currently look like structural MoE overhead
- attention/prompt path is the correct next focus
