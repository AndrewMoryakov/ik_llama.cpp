# Current Status

## Summary

The fork is no longer a raw working draft.

Current state is best described as:

- a strong engineering pre-release
- with real benchmark-backed findings
- but not yet the cleanest public milestone for broad community presentation

## What Is Already Strong

1. There is a clear project direction:
- MoE-focused CPU optimization
- Zen4-aware tuning
- emphasis on RAM efficiency and large-model usability
- explicit focus on huge models that do not fit into RAM fully
- practical optimization for swap-bound inference, not only in-RAM speed

2. There is real benchmark infrastructure:
- repeatable `pp / tg / pg` runs
- separate `in-RAM` and `swap-bound` regimes
- saved JSON/log artifacts

3. There are already confirmed practical findings:
- `flash_attn` matters materially for mixed path
- `rtr auto` is a valid runtime policy improvement
- `pg` must be tuned separately from `tg`
- `Qwen3MoE` and `gpt-oss` do not behave identically
- `MiniMax M2.5` has distinct swap-bound and attention-path considerations and remains in research scope
- `gpt-oss-120b` now has a confirmed-useful, medium-confidence `Prompt Packed QKV back-half` branch

Family-specific source-of-truth notes now exist for the three main lines:

- `../benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`

4. There are already real code changes behind the findings:
- `--run-time-repack auto`
- `llama-bench` support for `auto`
- mixed-path tracing
- experimental prompt packed-QKV path
- partial packing presets
- locality and execution profiling
- architecture-specific execution mapping work for `Qwen3MoE`, `gpt-oss`, and `MiniMax M2.5`

5. MiniMax is no longer only an old historical note:
- fresh partial rerun work exists on the current tree
- the first longer controlled MiniMax hot-expert run now also exists and it rejected raising the default budget above legacy `16`
- MiniMax is now treated as one of the main stress-case targets for the fork idea itself
- a MiniMax-specific current-status note now exists to separate confirmed findings from directional ones:
  - `../benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- the old `MiniMax off vs auto` question is now closed on the fixed tree:
  - `TG-only` still leans toward `off`
  - mixed path now has a real `auto` branch
- but MiniMax is still not in the tight public validated loop because the line remains research-heavy and no new generalized hot-expert baseline was promoted

## What Still Prevents A Clean Public Milestone

1. No broad, family-wide stable architecture-specific package is closed yet.
2. Experimental paths are useful for engineering, but not yet ready to present as stable features.
3. The release-facing story is still being assembled.
4. Minimal regression gates exist in practice, but are not yet formalized as a release process.

## Current Honest Public Position

If published today, the fork should be presented as:

- technical preview
- engineering milestone
- optimization research snapshot

It should not yet be presented as:

- broadly polished stable release

## What Must Happen Next

1. Close one strong architecture-specific optimization cycle.
2. Freeze the validated scope.
3. Separate stable and experimental features clearly.
4. Run the minimal release checklist.
5. Prepare a concise benchmark-backed release summary.
