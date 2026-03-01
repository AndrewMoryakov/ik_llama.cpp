# Session Bootstrap

## Objective

Bring a new LLM agent to useful project context fast, with minimal re-reading.

## Minimal Bootstrap Sequence

1. Read `../strategy/CURRENT_HANDOFF_2026-03-01.md`
2. Read `../release/CURRENT_STATUS_2026-02-28.md`
3. Read the relevant family current-status note:
- `../benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
4. If working on MiniMax, also read:
- `../benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`
- `../models/MINIMAX_M2_5_RUNTIME.md`

## Current Project Priorities

Priority order right now:

1. huge swap-bound MoE behavior
2. MiniMax correctness of runtime policy
3. release-quality stabilization of current findings
4. architecture-specific optimization only where evidence supports it

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

Only if there is time budget for one expensive MiniMax pass:

1. `tg32`: `off` vs `auto`
2. `pg32,4`: `off` vs `auto`
3. runtime default budget
4. `t16 fa1 muge0 ngl0 r=1`

Reason:

- this closes the highest-value remaining MiniMax policy question

## Stop Conditions

Stop and record instead of expanding the matrix if:

1. `auto` is clearly worse than `off`
2. `auto` is clearly viable and the next question becomes about locality/paging, not repack policy
3. the run becomes too expensive relative to the information gained
