# Release-Facing Claims

This document defines what can be stated publicly today without overclaiming.

## Public-Safe Claims

1. The fork is focused on CPU-only MoE inference, especially large models that do not fit into RAM fully.
2. The fork already has benchmark-backed runtime-policy improvements for Zen4-class hosts.
3. `Qwen3MoE` and `gpt-oss` are in the active validation loop.
4. `rtr=auto` is already a credible starting policy for validated `Qwen3MoE` and `gpt-oss` cases.
5. `flash_attn` matters materially for mixed-path (`pg`) performance on the validated Zen4 host.
6. `pg` must not be inferred from `tg` alone.
7. `MiniMax M2.5` is a primary huge-model research line for the fork, not a side case.
8. The codebase already includes real huge-model work: `rtr auto`, benchmark infrastructure, MiniMax runtime work, dashboard, scripts, and technical docs.
9. `gpt-oss-120b` currently has a benchmark-backed `Prompt Packed QKV back-half` branch with moderate practical value on the validated host.

## Claims That Are Not Public-Safe Yet

1. A stable architecture-specific fast path for `Qwen3MoE`.
2. A stable architecture-specific fast path for `gpt-oss-20b`.
3. A finalized huge-model optimization package for `gpt-oss-120b`.
4. A finalized huge-model optimization package for `MiniMax M2.5`.
5. New custom quantization performance claims.
6. Any claim that `MiniMax hot-expert budget > 16` is now a better default.
7. Any claim that current experimental prompt packed-QKV paths are stable user-facing wins across all compatible model families.
8. Any claim that `Prompt Packed QKV` is already a family-wide default for all `gpt-oss`.

## How To Describe The Fork Today

Use formulations like:

- engineering milestone
- technical preview
- benchmark-backed optimization snapshot
- private experimental lab moving toward a cleaner public release

Avoid formulations like:

- polished stable release
- universally faster than upstream on all supported models
- finalized architecture-specific optimization system

## Citation Rule

If a claim depends on measurements, cite one of:

- `VALIDATED_SCOPE_2026-02-28.md`
- `SUPPORTED_VALIDATED_MATRIX_2026-03-01.md`
- family-specific current-status notes in `../benchmarks/current/`

If a claim depends on a hypothesis or partially checked path, cite:

- `EXPERIMENTAL_MATRIX_2026-03-01.md`
- `KNOWN_LIMITS_AND_OPEN_QUESTIONS_2026-03-01.md`
