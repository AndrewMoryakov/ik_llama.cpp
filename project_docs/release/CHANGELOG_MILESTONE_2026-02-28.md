# Milestone Changelog

## Purpose

This is the release-facing summary of what the fork can already claim as part of the current milestone.

It is intentionally narrower than the full engineering history.

## Current Milestone Summary

### 1. Runtime repack auto-policy

Added:

- `--run-time-repack auto`
- alias support in CLI
- `llama-bench` support

Why it matters:

- gives the fork a benchmark-backed runtime policy improvement for MoE

### 2. Mixed-path benchmark discipline

Added and used:

- repeatable `pp / tg / pg` benchmark matrix
- explicit separation of mixed-path from TG-only tuning

Why it matters:

- the fork is now optimizing the workload users actually care about, not only isolated TG numbers

### 3. Zen4-focused runtime guidance

Current practical direction:

- `-fa 1`
- `--run-time-repack auto`
- `t=16` starting point on the validated host

Why it matters:

- this gives a concrete performance story for the primary validation target

### 4. Architecture-specific engineering groundwork

The fork now has real evidence that:

- `Qwen3MoE` and `gpt-oss` differ in runtime behavior
- `gpt-oss-20b` and `gpt-oss-120b` must not be treated as the same performance regime

Why it matters:

- this is the foundation for the next real performance wins

### 5. Internal profiling and research infrastructure

Added:

- mixed-path tracing
- prompt/decode window tracing
- layer scoring
- execution-layer profiling
- locality tracing

Why it matters:

- the fork is not optimizing blindly

## What Is Not Yet Claimed In This Milestone

The current milestone does not yet claim:

1. a final architecture-specific fast path
2. a final new custom quantization result
3. a finished public default for prompt packed-QKV paths

These remain part of ongoing engineering work.
