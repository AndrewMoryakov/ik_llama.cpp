# Session Bootstrap

## Objective

Bring a new LLM agent to useful project context fast, with minimal re-reading.

## Minimal Bootstrap Sequence

1. Read `PROJECT_STATE_FOR_AGENTS_2026-03-06.md` ← **START HERE (supersedes 2026-03-04)**
2. Read `../strategy/CURRENT_HANDOFF_2026-03-01.md`
3. Read `../release/CURRENT_STATUS_2026-02-28.md`
4. Read the relevant family current-status note:
- `../benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
5. If working on MiniMax, also read:
- `../benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`
- `../models/MINIMAX_M2_5_RUNTIME.md`

## Current Project Priorities (2026-03-06)

Priority order right now:

1. productize the confirmed `gpt-oss-120b prompt-packed` branch in `evidence-layer.js`
2. move `gpt-oss-20b` to decode-side optimization
3. keep MiniMax on hold unless there is a new locality hypothesis or a dedicated benchmark window
4. keep dashboard/docs aligned with benchmark-backed evidence

## Recent Completions (2026-03-06)

- Dashboard modular refactoring: COMPLETE (Phase A tests + Phase B split)
  - 115/115 tests pass; 6 modules extracted; dashboard.js 4959 → 2604 lines
- Upstream sync: merged fused delta-net AVX512, Qwen3.5, SER (ikawrakow PR #239)
- New benchmark baseline: 2026-03-06 with Large Pages ON
  - see `../benchmarks/current/BASELINE_2026-03-06.md`
- muge crash: diagnosed as pre-existing (all commits); use muge=0 always for gpt-oss-20b

## Current Best-Known Defaults

### Qwen3MoE / gpt-oss

- start from `rtr=auto`
- `flash_attn=on`
- do not infer `pg` from `tg`

### MiniMax

- start from `rtr=off`
- leave `IK_LLAMA_HOT_EXPERT_BUDGET` unset
- treat larger hot-expert budgets as research-only

## Already Rejected Or Downgraded

Do not restart these as if they were open wins:

1. MiniMax hot-expert default `24/32`
2. treating old bad MiniMax `auto` result as final truth
3. using short quick checks as sufficient evidence for user-facing defaults

## Highest-ROI Next Benchmark

If there is time budget for one expensive benchmark with immediate ROI:

1. confirm/productize `gpt-oss-120b prompt-packed back-half`

If specifically resuming MiniMax policy on a changed tree:

1. `tg32`: `off` vs `auto`
2. `pg32,4`: `off` vs `auto`
3. runtime default budget
4. `t16 fa1 muge0 ngl0 r=1`

Reason:

- MiniMax policy revalidation is now conditional, not the global next step

## Stop Conditions

Stop and record instead of expanding the matrix if:

1. `auto` is clearly worse than `off`
2. `auto` is clearly viable and the next question becomes about locality/paging, not repack policy
3. the run becomes too expensive relative to the information gained
