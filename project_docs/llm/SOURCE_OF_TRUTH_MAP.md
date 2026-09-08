# Source Of Truth Map

Use this map to jump to the right document without reopening the whole tree.

## If You Need One Consolidated State Transfer First

- `PROJECT_STATE_FOR_AGENTS_2026-03-06.md` ← **CURRENT** (supersedes 2026-03-04)

## If You Need Strategic Direction

- `../strategy/FORK_GOAL_AND_SCOPE_2026-02-28.md`
- `../strategy/ROADMAP_2026-02-28.md`
- `../strategy/CURRENT_HANDOFF_2026-03-01.md`

## If You Need Overall Publishable Status

- `../release/CURRENT_STATUS_2026-02-28.md`
- `../release/VALIDATED_SCOPE_2026-02-28.md`
- `../release/STABLE_VS_EXPERIMENTAL_2026-02-28.md`

## If You Need Current Benchmark Truth By Family

- `../benchmarks/current/BASELINE_2026-03-06.md` ← **CURRENT BASELINE** (Large Pages ON)
- `../benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/PHASE3_GENERALIZED_VALIDATION_2026-03-03.md`
- `../benchmarks/current/GPT_OSS120B_PROMPT_PACKED_CONFIRM_2026-03-04.md`

## If You Need Parameter-Generalization / Evidence-Layer Truth

- `../strategy/PARAMETER_GENERALIZATION_PRINCIPLES_2026-03-03.md`
- `../strategy/EXPERIMENTAL_KNOB_MATRIX_2026-03-02.md`
- `../strategy/DATA_DRIVEN_EVIDENCE_LAYER_2026-03-03.md`
- `../strategy/PHASE2_KNOB_BACKLOG_2026-03-03.md`
- `../strategy/PHASE3_VALIDATION_PLAN_2026-03-03.md`

## If You Need MiniMax-Specific Details

- `../benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`
- `../benchmarks/current/MINIMAX_HOT_EXPERT_BUDGET_QUICKCHECK_2026-02-28.md`
- `../models/MINIMAX_M2_5_RUNTIME.md`

## If You Need Raw Benchmark Artifacts

- `../../ik_llama.cpp/bench_results/`

Prefer run-specific narrative notes in `../benchmarks/current/` before quoting raw logs.

## If You Need Dashboard Knowledge Layer

- `../../dashboard/evidence-layer.js` ← canonical data source (knobs, presets, profiles, badges)
- `../../dashboard/dashboard.js` ← main UI (2604 lines, reads from modules)
- `../../dashboard/dashboard-rules.js` ← RULES, PARAM_APPLICABILITY, helper functions
- `../../dashboard/dashboard-command.js` ← buildArgsArray, buildCommandString
- `../../dashboard/dashboard-autoconfig.js` ← computeOptimalParams
- `../dashboard/PRODUCT_GUIDE.md` ← dashboard architecture docs (updated 2026-03-06)
- `../dashboard/ROADMAP_2026-02-28.md`

Dashboard modular refactoring complete (2026-03-06): 115 tests, 6 modules, run `npm test`.

## If You Need Future Family Preset Backlog

- `../strategy/ROADMAP_2026-02-28.md`
- `../dashboard/ROADMAP_2026-02-28.md`

Current family-preset backlog includes:

1. `DeepSeek MLA family`
2. `Qwen dense / Qwen3 dense`
3. `Qwen3-Next / qwen3next`
4. `Mixtral / Mistral-family MoE`
5. `GLM4-MoE`
6. `Granite MoE`
7. `Kimi / Kimi 2.5 / Kimi-K2 family`
8. dense baselines: `Llama`, `Gemma`, `Phi`, `Mistral`
