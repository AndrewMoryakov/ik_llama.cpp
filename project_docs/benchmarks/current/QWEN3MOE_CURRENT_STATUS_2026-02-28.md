# Qwen3MoE Current Status - 2026-02-28

## Purpose

This is the current source of truth for `Qwen3MoE` benchmark status on the active tree.

Use this document first if the question is:

- what is already validated for `Qwen3MoE`
- which current `Qwen3MoE` conclusions are benchmark-backed
- which `Qwen3MoE` ideas are still experimental
- what `Qwen3MoE` currently means for the fork roadmap

## Why Qwen3MoE Matters

`Qwen3MoE` is the main in-RAM MoE reference family in the current validation loop.

It is useful because it gives a cleaner view of:

- prompt path behavior
- mixed-path behavior
- CPU-side attention cost
- runtime-policy effects without the same level of huge-model paging noise as `MiniMax`

That makes it one of the best families for proving whether an optimization really improves compute-path behavior.

## Current Raw Data Locations

Latest relevant raw artifacts:

1. Main current validation matrix:
- `ik_llama.cpp/bench_results/2026-02-27_1831`

2. Mixed-path and attention traces:
- `ik_llama.cpp/bench_results/pg_trace_qwen3_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_qwen3_fa0_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_qwen3_step4_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_qwen3_step4b_2026-02-28.log`

3. Prompt packed-QKV experiment artifacts:
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv_arena`
- `ik_llama.cpp/bench_results/2026-02-28_pg_window_trace`

4. Phase 3 generalized-runtime validation:
- `ik_llama.cpp/bench_results/2026-03-03_162813_phase3_validation`

Supporting narrative documents:

- `SUMMARY_CURRENT_2026-02-27.md`
- `../../development/MIXED_PATH_STEP3_ATTENTION_TRACE_2026-02-28.md`
- `../../development/MIXED_PATH_STEP6_PROMPT_PACKED_QKV_2026-02-28.md`
- `../../development/MIXED_PATH_STEP13_PG_DECODE_WINDOW_TRACE_2026-02-28.md`

## What Is Confirmed Right Now

### 1. `Qwen3MoE` is a validated in-RAM MoE baseline on this host

Validated representative:

- `Qwen3-30B-A3B-Q4_K_M`

This is part of the current serious benchmark loop, not only historical notes.

### 2. `rtr=auto` is a strong current default for `Qwen3MoE`

In the current matrix:

- `pp512`: `auto` best
- `pg512,128`: `auto` best
- `tg128`: `auto` effectively tied with `on`

Implication:

- `auto` is the correct current default starting point for `Qwen3MoE` on this host
- `off` is no longer the right baseline if the goal is throughput

### 3. `pg` must be treated separately from `tg`

This is already validated at the family level.

Implication:

- `Qwen3MoE` tuning must not be based on `tg128` alone
- mixed-path claims need direct `pg` evidence

### 4. `-fa 1` materially matters for `Qwen3MoE` mixed path

Measured current result:

- `pg512,128`: about `94.27 -> 103.38 t/s` with `-fa 0 -> 1`

Implication:

- `flash attention` is part of the default `Qwen3MoE` mixed-path profile on this host
- it is not a minor toggle

### 5. Current mixed-path bottleneck is not prompt-to-decode transition overhead

Trace work already showed:

- `build/alloc/reset/input` costs are small relative to compute
- the prompt-to-first-decode boundary is not the main loss point

Implication:

- scheduler-boundary rewrites are not the first rational target
- compute-side path matters more

## What Is Directional But Not Public-Final

### 1. Prompt packed-QKV remains structurally real but not yet a public fast path

What is already true:

- prompt graph work drops materially
- prompt-side and small mixed-path gains are measurable

Phase 3 confirms the same pattern on the current tree:

- `pp512`: `284.994612 -> 311.178162` (`baseline -> front-half`)
- `pg512,128` mixed: `101.874129 -> 102.146926`

That is useful engineering evidence, but not a strong public headline result yet.

### 2. Partial prompt packing looks better than full packing

Current best `Qwen3MoE` result in the experimental line:

- front half (`0:24`) slightly beats full packing on `pg512,128`

This is useful for further research.

It is not yet a public stable recommendation.

### 3. Decode-side work is the next likely profitable direction

This is now the best engineering interpretation.

But it is still a roadmap conclusion, not a closed improvement result.

## What Is Not Settled Yet

These questions remain open:

1. final architecture-specific `Qwen3MoE` fast path
2. whether prompt-side packed-QKV can be turned into a stronger end-to-end `pg` gain
3. whether the next real `Qwen3MoE` win will come from decode-side attention work or another compute-side path

## What This Means For Development Priority

`Qwen3MoE` currently means:

1. the fork has a clean validated in-RAM MoE baseline
2. `rtr auto` and `-fa 1` are already benchmark-backed for real use
3. cheap prompt-graph reductions alone are not enough for a strong public win

So the next `Qwen3MoE` work should be:

- decode-side mixed-path investigation
- or a larger architecture-specific attention-side improvement

not more blind prompt-only tuning.

## Current Practical Recommendation

If someone needs a practical `Qwen3MoE` answer right now:

1. use `-t 16`
2. use `-fa 1`
3. use `-rtr auto`
4. benchmark `pg512,128`, not only `tg128`

Do not present prompt packed-QKV as a stable default.

## Related Documents

- `SUMMARY_CURRENT_2026-02-27.md`
- `../../runbooks/MOE_RUNTIME_PROFILES.md`
- `../../development/ARCHITECTURE_EXECUTION_MAPS_2026-02-28.md`
