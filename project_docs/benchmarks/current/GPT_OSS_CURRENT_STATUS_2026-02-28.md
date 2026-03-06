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

0. **Current baseline (2026-03-06, Large Pages ON):**
- `ik_llama.cpp/bench_results/2026-03-06_baseline/`
- gpt-oss-20b: PP 281.2, TG 23.85 (fa=1, rtr=auto, ctk=q8_0, t=16, muge=0)
- gpt-oss-120b: PP 160.8, TG 17.07 (same flags)
- NOTE: `-muge` flag crashes on gpt-oss-20b (pre-existing, all commits)

1. Main current validation matrix:
- `ik_llama.cpp/bench_results/2026-02-27_1831`
- `ik_llama.cpp/bench_results/2026-02-27_1856`

2. Fresh runtime refresh on current tree:
- `ik_llama.cpp/bench_results/2026-03-03_060928_gptoss20b_runtime_baseline`
- `ik_llama.cpp/bench_results/2026-03-03_061156_gptoss120b_runtime_packaging`

3. Phase 3 generalized-runtime validation:
- `ik_llama.cpp/bench_results/2026-03-03_162813_phase3_validation`

4. Dedicated `gpt-oss-120b` prompt-packed confirm:
- `ik_llama.cpp/bench_results/2026-03-04_061657_gptoss120b_prompt_packed_confirm`

5. Mixed-path and attention traces for `20b`:
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_fa0_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_step4_2026-02-28.log`
- `ik_llama.cpp/bench_results/pg_trace_gptoss20b_step4b_2026-02-28.log`

5. Prompt packed-QKV experiment artifacts:
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

- `gpt-oss-20b`: `auto` remains a strong baseline on the current tree
- `gpt-oss-120b`: fresh runtime packaging confirms `auto` is stronger than `off` in both `TG128` and `PG512,128`

Implication:

- `auto` is the current throughput-first default
- `off` still matters for startup-sensitive huge-model cases, but not as the throughput-first mode

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
- fresh current-tree runtime packaging:
  - `TG128`: `14.134468 -> 16.657064` with `off -> auto`
  - `PG512,128 mixed`: `59.089030 -> 60.177522` with `off -> auto`
- older load/startup evidence still says `off` can have shorter startup wall time

Implication:

- for huge `gpt-oss`, the correct question is not only "which mode has the highest t/s"
- startup and memory-pressure behavior are part of the real runtime story

### 6. Fresh `gpt-oss-20b` baseline is now available on the current tree

Fresh current-tree numbers:

- `TG128`: `23.707807`
- `PG512,128`:
  - `pp512`: `272.749618`
  - `tg128`: `24.075077`
  - `pp512+tg128`: `90.283185`

Implication:

- the next decode-side `gpt-oss-20b` line now has a fresh baseline
- this removes the need to compare future decode-path work against older February-only numbers

### 7. Phase 3 confirms different practical value for generalized knobs inside the family

#### `Hot Expert Selection / Tail Window` on `gpt-oss-20b`

Short Phase 3 sanity on `pg128,32`:

- baseline `pp128+tg32`: `79.594862`
- `full-prompt`: `79.246333`
- `tail-window=16`: `80.978128`

And on `tg128`:

- baseline: `21.942375`
- `tail-window=16`: `22.013617`

Implication:

- generalized `tail-window=16` is not empty outside `MiniMax`
- but the signal on `gpt-oss-20b` is still small and should remain `partial / promising`, not a default

#### `Prompt Packed QKV` on `gpt-oss-20b`

Phase 3 results:

- `pp512`: `272.100196 -> 284.094653` (`baseline -> back-half`)
- `pg512,128` mixed: `87.285178 -> 86.838406`

Implication:

- prompt-side gain is real
- practical mixed-path value on `20b` is still neutral or slightly negative
- this is not a family-wide public fast path yet

#### `Prompt Packed QKV` on `gpt-oss-120b`

Phase 3 results:

- `pp512`: `150.405577 -> 161.931084`
- `tg128`: `16.121140 -> 16.516430`
- `pg512,128` mixed: `56.995574 -> 58.590794`

Implication:

- the first Phase 3 pass was strong enough to justify a dedicated confirm run
- the dedicated confirm stayed positive but more moderate:
  - `pp512`: `161.103907 -> 165.294421`
  - `pg512,128` mixed: `60.379250 -> 60.740783`
- current honest status:
  - confirmed useful
  - medium confidence
  - still not a family-wide default

## What Is Directional But Not Public-Final

### 1. `gpt-oss-20b` decode-side mixed path is the most promising next engine target

This is now the strongest engineering hypothesis.

Reason:

- prompt-side experiments gave only small end-to-end gains
- mixed-path evidence points beyond prompt-only work

But this is still not a closed result yet.

### 2. Prompt packed-QKV is not one single `gpt-oss` story

Current Phase 3 interpretation must be split by regime:

1. `gpt-oss-20b`
- prompt-side signal only
- mixed-path practical value still weak

2. `gpt-oss-120b`
- prompt-side gain confirmed
- mixed-path gain also confirmed, but at moderate strength on dedicated confirm

So the knob should not be described as either:

- "family-wide winner"
- or "not useful for gpt-oss at all"

The honest current statement is:

- `Prompt Packed QKV` now has a real positive branch on `gpt-oss-120b`
- but remains partial/neutral on `gpt-oss-20b`

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
3. whether `Prompt Packed QKV` should become an explicit `gpt-oss-120b` productized branch in dashboard guidance/presets
4. whether the next real `gpt-oss` engine win comes from decode-side attention work, sliding-window handling, or another runtime path

## What This Means For Development Priority

`gpt-oss` currently means:

1. the fork already has a validated throughput story for both `20b` and `120b`
2. the next meaningful engine win is more likely to come from `20b` decode-side work than from more prompt-only experiments
3. the public huge-model story for `120b` still needs cleaner final packaging

So the next priorities are:

1. `gpt-oss-20b` decode-side mixed-path work
2. `gpt-oss-120b` productize `Prompt Packed QKV` as a huge-model branch
3. `gpt-oss-120b` runtime-policy / startup / throughput packaging

## Current Practical Recommendation

If someone needs a practical `gpt-oss` answer right now:

### For `gpt-oss-20b`

1. use `-t 16 -fa 1 -rtr auto -ctk q8_0`
2. do NOT use `-muge` (crashes — pre-existing issue on all commits)
3. evaluate `pg512,128`, not only `tg128`
4. Current baseline (2026-03-06, Large Pages ON): PP 281.2, TG 23.85

Treat `Prompt Packed QKV` as experimental only; it is not yet a practical default for `20b`.

### For `gpt-oss-120b`

1. use `-t 16 -fa 1 -rtr auto -ctk q8_0`
2. compare against `-rtr off` if startup wall time or memory-pressure behavior matters more
3. do not treat `off` as the current throughput-first choice on this tree
4. Current baseline (2026-03-06, Large Pages ON): PP 160.8, TG 17.07

`Prompt Packed QKV` with `back-half` should now be treated as a confirmed-useful but medium-confidence huge-model branch for `120b`, not as a family-wide default.
Productization in `evidence-layer.js`: pending.

## Related Documents

- `SUMMARY_CURRENT_2026-02-27.md`
- `GPT_OSS120B_PROMPT_PACKED_CONFIRM_2026-03-04.md`
- `../../runbooks/MOE_RUNTIME_PROFILES.md`
- `../../development/ARCHITECTURE_EXECUTION_MAPS_2026-02-28.md`
