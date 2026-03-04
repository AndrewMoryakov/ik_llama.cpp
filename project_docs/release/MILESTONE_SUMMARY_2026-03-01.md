# Milestone Summary

## What This Milestone Is

This milestone is the current private experimental lab snapshot of the fork.

It already includes:

1. benchmark-backed runtime-policy work
2. a maintained huge-model line centered on `MiniMax M2.5`
3. a validated `Qwen3MoE` / `gpt-oss` loop
4. a dashboard and tutorial layer
5. scripts, raw benchmark artifacts, and handoff docs

## What It Is Not

It is not yet:

1. a final public release
2. a fully stabilized architecture-specific optimization suite
3. a finished huge-model story for every important model family

## Main Technical State

1. `Qwen3MoE` and `gpt-oss` have active benchmark-backed guidance.
2. `MiniMax M2.5` is treated as a main huge swap-bound target.
3. `rtr auto` exists as a real runtime-policy feature.
4. mixed-path (`pg`) benchmarking and reasoning are already first-class in the fork narrative.
5. research-only paths remain in-tree but are not promoted as stable defaults.
6. `gpt-oss-120b` now has a confirmed-useful, medium-confidence `Prompt Packed QKV back-half` branch.

## Main Practical State

1. The code is usable now.
2. The docs are sufficient to continue work without rediscovering the project from scratch.
3. The repo is suitable as a private engineering base.
4. Public release claims still need a stricter freeze.

## Recommended Public Position

If this milestone is described externally, the safe framing is:

- private optimization lab snapshot
- engineering milestone
- technical preview of a larger MoE-focused fork direction
