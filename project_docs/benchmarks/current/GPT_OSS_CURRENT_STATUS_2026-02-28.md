# gpt-oss Current Status - 2026-02-28

## Purpose

This is the current source of truth for `gpt-oss` benchmark status on the active tree.

Use this document first if the question is:

- what is currently validated for `gpt-oss`
- how `gpt-oss-20b` and `gpt-oss-120b` should be interpreted
- which findings are already confirmed
- which `gpt-oss` conclusions are still directional

## Why gpt-oss Matters

`gpt-oss` is currently represented by two different but equally important regimes:

1. `gpt-oss-20b`
- compute-oriented, mostly in-RAM
- the main iteration target for architecture-specific engine work

2. `gpt-oss-120b`
- huge-model, memory-pressure subset
- the main `gpt-oss` stress case for runtime-policy and load/startup tradeoffs

That means `gpt-oss` should never be reduced to one single number or one single profile.

## Current Raw Data Locations

Latest relevant raw artifacts:

1. Main current validation matrix:
- `ik_llama.cpp/bench_results/2026-02-27_1831`
- `ik_llama.cpp/bench_results/2026-02-27_1856`

2. Mixed-path and attention traces for `20b`:
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_fa0_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_step4_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_step4b_2026-02-28.log`

3. Prompt packed-QKV experiment artifacts:
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv_arena`
- `ik_llama.cpp/bench_results/2026-02-28_pg_window_trace`

Supporting narrative documents:

- `SUMMARY_CURRENT_2026-02-27.md`
- `../../development/MIXED_PATH_STEP3_ATTENTION_TRACE_2026-02-28.md`
- `../../development/ARCHITECTURE_EXECUTION_MAPS_2026-02-28.md`

## What Is Confirmed Right Now

### 1. `gpt-oss-20b` and `gpt-oss-120b` must be treated as different performance regimes

This is already a validated interpretation.

They are one family architecturally, but not one runtime story:

- `20b` is mainly compute-oriented
- `120b` is mainly memory-pressure oriented

### 2. `rtr=auto` is a strong current default for the family, but with regime-dependent tradeoffs

Current matrix supports:

- `gpt-oss-20b`: `auto` or `on` stronger than `off`
- `gpt-oss-120b`: `auto` strongest in throughput, but with large load-time cost

Implication:

- `auto` is the current throughput-first default
- `off` still matters for startup-sensitive huge-model cases

### 3. `-fa 1` materially matters for `gpt-oss-20b` mixed path

Measured current result:

- `pg512,128`: about `84.40 -> 88.89 t/s` with `-fa 0 -> 1`

Implication:

- `flash attention` should remain in the standard `gpt-oss-20b` mixed-path profile on this host

### 4. `gpt-oss-20b` does not react the same way as `Qwen3MoE`

This is already supported by:

- mixed-path traces
- prompt packed-QKV behavior
- architecture execution mapping

Implication:

- it is not correct to copy `Qwen3MoE` optimization conclusions directly onto `gpt-oss`

### 5. `gpt-oss-120b` confirms that huge-model policy must account for load/startup cost

Current swap-bound matrix shows:

- throughput: `auto` best
- load probe: `off` much shorter startup wall time

Implication:

- for huge `gpt-oss`, the correct question is not only "which mode has the highest t/s"
- startup and memory-pressure behavior are part of the real runtime story

## What Is Directional But Not Public-Final

### 1. `gpt-oss-20b` decode-side mixed path is the most promising next engine target

This is now the strongest engineering hypothesis.

Reason:

- prompt-side experiments gave only small end-to-end gains
- mixed-path evidence points beyond prompt-only work

But this is still not a closed result yet.

### 2. Prompt packed-QKV is not a stable public `gpt-oss` fast path

Current stable effect on `gpt-oss-20b` is small:

- `pg512,128`: about `+0.53%`

So the idea is technically interesting, but not ready for public positioning as a meaningful family-level win.

### 3. The best future huge-model package for `gpt-oss-120b` is still open

Current evidence already says:

- throughput and startup trade off against each other

But the final public package for:

- `rtr`
- startup-sensitive mode
- throughput-first mode

is still not fully closed.

## What Is Not Settled Yet

These questions remain open:

1. final architecture-specific fast path for `gpt-oss-20b`
2. final public huge-model runtime package for `gpt-oss-120b`
3. whether the next real `gpt-oss` engine win comes from decode-side attention work, sliding-window handling, or another runtime path

## What This Means For Development Priority

`gpt-oss` currently means:

1. the fork already has a validated throughput story for both `20b` and `120b`
2. the next meaningful engine win is more likely to come from `20b` decode-side work than from more prompt-only experiments
3. the public huge-model story for `120b` still needs cleaner final packaging

So the next priorities are:

1. `gpt-oss-20b` decode-side mixed-path work
2. `gpt-oss-120b` runtime-policy / startup / throughput packaging

## Current Practical Recommendation

If someone needs a practical `gpt-oss` answer right now:

### For `gpt-oss-20b`

1. use `-t 16`
2. use `-fa 1`
3. use `-rtr auto`
4. evaluate `pg512,128`, not only `tg128`

### For `gpt-oss-120b`

1. use `-fa 1`
2. start with `-rtr auto` if steady-state throughput matters more than startup
3. compare against `-rtr off` if startup wall time or memory-pressure behavior matters more

Do not present prompt packed-QKV as a stable public optimization for `gpt-oss` yet.

## Related Documents

- `SUMMARY_CURRENT_2026-02-27.md`
- `../../runbooks/MOE_RUNTIME_PROFILES.md`
- `../../development/ARCHITECTURE_EXECUTION_MAPS_2026-02-28.md`
