# Mixed Path Step 4: Generic Attention Path Confirmation

Date: 2026-02-28

## Goal

After confirming that mixed-path sensitivity is attention-side rather than MoE-side, determine which concrete attention path is actually used by the current validated MoE models.

The main question for this step:

- are the current prompt-heavy `pg` runs using special fast paths or fused QKV layouts?
- or are they going through the generic attention builder with separate `wq/wk/wv` projections?

This matters because the next optimization patch depends on the answer.

## What was added

Additional branch-summary tracing was added in:

- `ik_llama.cpp/src/llama-build-context.cpp`

New prompt-path logs now summarize, per build call:

1. number of attention layers
2. whether flash attention is used in all layers
3. whether the split fast path is used
4. whether output row selection is used only on the last layer
5. whether the model uses:
   - fused `wqkv`
   - fused `wqk`
   - separate `wq/wk/wv`

## Artifacts

- `ik_llama.cpp/bench_results/pg_trace_qwen3_step4b_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_step4b_2026-02-28.log`

## Results

### Qwen3-30B-A3B-Q4_K_M

Relevant lines:

- `ik_llama.cpp/bench_results/pg_trace_qwen3_step4b_2026-02-28.log:177`

Observed summary:

- `arch=qwen3moe`
- `tokens=512`
- `layers=48`
- `flash_layers=48`
- `split_fast_layers=0`
- `out_ids_layers=1`
- `fused_qkv_layers=0`
- `fused_qk_layers=0`
- `split_qkv_layers=48`

Interpretation:

- all prompt attention layers use flash attention
- no split fast path is used
- all 48 layers use separate `wq/wk/wv`
- output row filtering is only used on the last layer

### gpt-oss-20b-MXFP4

Relevant lines:

- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_step4b_2026-02-28.log:169`

Observed summary:

- `arch=gpt-oss`
- `tokens=512`
- `layers=24`
- `flash_layers=24`
- `swa_layers=12`
- `split_fast_layers=0`
- `out_ids_layers=1`
- `fused_qkv_layers=0`
- `fused_qk_layers=0`
- `split_qkv_layers=24`

Interpretation:

- all prompt attention layers use flash attention
- 12 of 24 layers use sliding-window attention
- no split fast path is used
- all 24 layers use separate `wq/wk/wv`
- output row filtering is only used on the last layer

## Main conclusion

For the currently validated Zen4 mixed-path targets:

1. prompt attention does **not** use the split fast path
2. prompt attention does **not** use fused `wqkv`
3. prompt attention is running through the generic path:
   - `build_std_attention(...)`
   - `llm_build_kv(...)`
   - `llm_build_kqv(...)`
4. Q/K/V projections are fully separate on every attention layer in both tested models

This is a strong narrowing of the hot path.

## Why this matters

This changes the ranking of candidate engine optimizations.

The first serious candidates are now:

1. prompt-side optimization of generic flash-attention path in `llm_build_kqv(...)`
2. reducing cost of separate `wq/wk/wv` projections for prompt-heavy runs
3. exploring runtime-packed or repacked prompt QKV layout for split-projection models

What drops in priority:

1. MoE routing changes as the first mixed-path patch
2. scheduler reset redesign
3. split fast path work for current validated models

## Important practical note

Current runtime/configuration implication:

- there is no currently validated runtime flag that “turns on” a hidden fast path for these two models on this host
- the confirmed high-impact runtime lever remains `-fa 1`
- mixed-path improvements for these models are more likely to require engine work than additional CLI tuning

## Next recommended step

Move one level deeper into the generic attention path:

1. inspect `ik_llama.cpp/src/llama-build-context.cpp:1439`
   - `llm_build_kqv(...)`
2. inspect `ik_llama.cpp/src/llama-build-context.cpp:1662`
   - `llm_build_kv(...)`
3. evaluate whether the first optimization patch should be:
   - prompt-specific packed QKV strategy
   - reduced projection overhead for separate `wq/wk/wv`
   - flash-attn input/output path simplification in the generic branch

## Status

The mixed-path target is now localized more precisely:

- not “generic MoE problem”
- not “prompt->decode boundary problem”
- not “special fast path not enabled”
- but specifically:
  - generic prompt attention path
  - separate Q/K/V projections
  - flash-attn execution on top of that path
