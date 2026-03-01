# AGENTS.md

## Purpose

Machine-oriented bootstrap for future LLM agents working in this repo.

This file is not a user tutorial.

Its job is to reduce re-discovery cost and point the agent at the current source-of-truth layer quickly.

## First Read Order

Read these first, in this order:

1. `project_docs/llm/SESSION_BOOTSTRAP.md`
2. `project_docs/strategy/CURRENT_HANDOFF_2026-03-01.md`
3. `project_docs/benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
4. `project_docs/release/CURRENT_STATUS_2026-02-28.md`

Then branch only as needed:

- `project_docs/benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `project_docs/benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `project_docs/models/MINIMAX_M2_5_RUNTIME.md`
- `project_docs/dashboard/ROADMAP_2026-02-28.md`

## Current Strategic Truth

The fork is currently optimized around:

1. large CPU-only MoE
2. swap-bound / out-of-RAM execution
3. Zen4-aware runtime policy
4. not just throughput, but memory behavior, locality, paging, and startup cost

Do not reduce the project goal to generic in-RAM speed.

## Current Main Families

Treat these as separate lines:

1. `Qwen3MoE`
2. `gpt-oss-20b`
3. `gpt-oss-120b`
4. `MiniMax M2.5`

Do not transfer conclusions mechanically between them.

## Current MiniMax Truth

MiniMax is a primary development line, not a side case.

Current practical baseline:

1. `rtr=off`
2. `IK_LLAMA_HOT_EXPERT_BUDGET` unset
3. larger hot-expert budgets are research-only

Important:

- old bad `rtr=auto` result was a policy bug
- that bug was fixed
- first longer controlled run rejected promoting MiniMax hot-expert default above legacy `16`

Read:

- `project_docs/benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`

## Do Not Re-Discover

These points are already settled enough to avoid repeating the same cycle blindly:

1. `pg` must not be inferred from `tg` alone
2. `flash_attn` matters materially for mixed path on validated Zen4 profiles
3. `rtr=auto` is already a strong start for `Qwen3MoE` and `gpt-oss`
4. MiniMax hot-expert `24/32` is not a new default candidate on current evidence

## Next Expensive Benchmark With Good ROI

If there is time for only one expensive MiniMax pass, run only:

1. `tg32`: `rtr=off` vs `rtr=auto`
2. `pg32,4`: `rtr=off` vs `rtr=auto`
3. runtime default hot-expert budget
4. `t16 fa1 muge0 ngl0 r=1`

Purpose:

- determine whether fixed `rtr=auto` is viable for huge MiniMax

Do not spend hours first on:

1. `rtr=on`
2. wide hot-expert budget matrices
3. `SER`
4. multi-knob experiments

## Raw Data Rule

Narrative truth lives in `project_docs/`.

Raw benchmark truth lives in:

- `ik_llama.cpp/bench_results/`

If a run directory contains an old broken summary, prefer:

1. raw `.log`
2. corrected current-status / long-run note in `project_docs/benchmarks/current/`

## Dashboard Rule

Dashboard knowledge layer must follow benchmark-backed current truth.

Do not let dashboard guidance drift ahead of evidence.

Main files:

- `ik_llama.cpp/dashboard.js`
- `ik_llama.cpp/dashboard.html`
- `project_docs/dashboard/`

## Canonical LLM Docs

See:

- `project_docs/llm/README.md`
- `project_docs/llm/SESSION_BOOTSTRAP.md`
- `project_docs/llm/SOURCE_OF_TRUTH_MAP.md`
