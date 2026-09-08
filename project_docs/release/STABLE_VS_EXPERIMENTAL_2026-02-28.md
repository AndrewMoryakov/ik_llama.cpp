# Stable Vs Experimental

## Purpose

This document separates what is currently safe to present as part of the fork's practical usage story from what is still research-grade.

That separation is necessary so the fork does not look like a pile of ad hoc switches.

## Stable / Presentable

These are reasonable to mention as current practical capabilities.

### 1. Zen4 MoE runtime guidance

This includes:

- `t=16` as the current safe starting point on the validated host
- `-fa 1` as the preferred mixed-path setting
- `--run-time-repack auto` as a valid runtime option

### 2. `rtr auto`

This is now a real feature, not just a note:

- CLI support exists
- API support exists
- `llama-bench` support exists
- benchmark-backed reasoning exists

### 3. Mixed-path tuning as a first-class concern

This is now part of the fork's engineering story:

- `pg` is not treated as identical to `tg`

### 4. Benchmark framework and current benchmark corpus

The benchmark infrastructure itself is stable enough to present:

- benchmark scripts
- result corpus
- current benchmark summaries

## Experimental / Research

These should still be presented carefully.

### 1. Prompt packed-QKV path

Status:

- implemented
- benchmarked
- useful as an experimental optimization path

But:

- not ready as a default
- user-facing benefit is not strong enough yet

### 2. Packed-QKV presets

Status:

- useful for engineering
- architecture-aware

But:

- still heuristic
- not final runtime policy

### 3. Packed-QKV arena

Status:

- improves locality
- improves prompt-side traces

But:

- does not yet improve end-to-end `pg`
- therefore still research-grade

### 4. Deep profiling helpers

Examples:

- `IK_LLAMA_PG_TRACE`
- `IK_LLAMA_PG_TRACE_DECODE_WINDOW`
- `IK_LLAMA_LAYER_SCORE_TRACE`
- `IK_LLAMA_EXEC_LAYER_TRACE`
- `IK_LLAMA_LOCALITY_TRACE`

These are valuable internal engineering tools, not public user features.

## Release Rule

Anything in the experimental category must satisfy all of the following before being moved into the stable/presentable category:

1. Clear measurable user-facing benefit
2. Reproducible benchmark result
3. No obvious regression on validated targets
4. Clear usage guidance
