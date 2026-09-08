# Project Docs Hub

This directory is the canonical location for project-specific documentation.

## Sections
- `strategy/` - goals, scope, quantization direction
- `llm/` - machine-oriented bootstrap and source-of-truth navigation for future LLM agents
- `release/` - current publishable status, validated scope, release checklist
- `benchmarks/` - benchmark index, current baseline, historical reports, plans
- `tutorial/` - human learning track: start here, mini tutorial, parameter guide, recipes
- `dashboard/` - dashboard-specific docs and roadmap
- `runbooks/` - practical execution guides for this host
- `development/` - engineering plans for next code changes
- `models/` - model compatibility and recommendations
- `archive/` - legacy notes and previous rework documents

## Start Here
- `../docs/PROJECT_ANALYSIS.md` — полный технический анализ форка: что даёт ikawrakow (база) и что добавлено нами (swap-aware memory management, hot experts, dashboard)
- `START_HERE_BY_GOAL.md`
- `strategy/FORK_GOAL_AND_SCOPE_2026-02-28.md`
- `strategy/CURRENT_HANDOFF_2026-03-01.md`
- `strategy/PARAMETER_GENERALIZATION_PRINCIPLES_2026-03-03.md`
- `strategy/EXPERIMENTAL_KNOB_MATRIX_2026-03-02.md`
- `strategy/DATA_DRIVEN_EVIDENCE_LAYER_2026-03-03.md`
- `strategy/PHASE2_KNOB_BACKLOG_2026-03-03.md`
- `strategy/PHASE3_VALIDATION_PLAN_2026-03-03.md`
- `strategy/RESEARCH_PROMPT_TAIL_REWRITE_2026-03-02.md`
- `research/expert-selection/README.md`
- `llm/README.md`
- `llm/SESSION_BOOTSTRAP.md`
- `llm/SOURCE_OF_TRUTH_MAP.md`
- `release/README.md`
- `release/MILESTONE_SUMMARY_2026-03-01.md`
- `release/RELEASE_FACING_CLAIMS_2026-03-01.md`
- `release/SUPPORTED_VALIDATED_MATRIX_2026-03-01.md`
- `release/EXPERIMENTAL_MATRIX_2026-03-01.md`
- `release/KNOWN_LIMITS_AND_OPEN_QUESTIONS_2026-03-01.md`
- `release/GIT_BRANCHING_MODEL_2026-03-02.md`
- `release/CURRENT_STATUS_2026-02-28.md`
- `release/CODEBASE_HEALTH_2026-03-01.md`
- `release/VALIDATED_SCOPE_2026-02-28.md`
- `release/STABLE_VS_EXPERIMENTAL_2026-02-28.md`
- `strategy/TASK.md`
- `strategy/EXECUTION_PLAN_ZEN4_MOE_2026-02-27.md`
- `tutorial/README.md`
- `tutorial/START_HERE.md`
- `tutorial/MINI_TUTORIAL.md`
- `tutorial/PARAMETER_REFERENCE.md`
- `tutorial/RECIPES_AND_ANTI_PATTERNS.md`
- `dashboard/README.md`
- `dashboard/PRODUCT_GUIDE.md`
- `dashboard/ROADMAP_2026-02-28.md`
- `runbooks/MOE_RUNTIME_PROFILES.md`
- `benchmarks/RTR_POLICY.md`
- `benchmarks/current/SUMMARY_CURRENT_2026-02-27.md`
- `benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- `benchmarks/current/MINIMAX_OFF_VS_AUTO_CLOSEOUT_2026-03-02.md`
- `benchmarks/current/MINIMAX_REFRESH_2026-02-28.md`
- `benchmarks/INDEX.md`
- `models/MINIMAX_M2_5_RUNTIME.md`
- `development/MIXED_PATH_OPT_PLAN.md`
- `development/ARCHITECTURE_EXECUTION_MAPS_2026-02-28.md`
- `development/RESEARCH_LAYER_MAP_2026-03-01.md`
- `benchmarks/SUMMARY_ALL.md`
- `benchmarks/CUSTOM_QUANT_BENCH_PLAN.md`

## Storage Policy
- Narrative docs live in `project_docs/`.
- Raw benchmark outputs stay in `ik_llama.cpp/bench_results/` (JSON/log artifacts).
- Old document paths were removed in clean mode.
- Internal snapshot-planning docs live in `project_docs/archive/release_snapshot/`.

## Recommended Entry Points
- Humans: `START_HERE_BY_GOAL.md`
- LLM agents: `llm/README.md`

## Migration Map
- Old paths were removed in clean mode; use canonical paths in this hub only.
