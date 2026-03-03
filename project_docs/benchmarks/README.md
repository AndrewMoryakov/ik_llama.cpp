# Benchmarks Docs Index

Canonical benchmark documentation for this project is here.

## Documents
- `SUMMARY_ALL.md` - one-place current objective benchmark summary (latest numbers, reference runs, practical conclusions)
- `INDEX.md` - run inventory and status classification
- `current/SUMMARY_CURRENT_2026-02-27.md` - latest validated matrix snapshot (`rtr off/on/auto`, `pp/tg/pg`)
- `current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md` - current Qwen3MoE source of truth
- `current/GPT_OSS_CURRENT_STATUS_2026-02-28.md` - current gpt-oss source of truth (`20b` and `120b`)
- `current/MINIMAX_CURRENT_STATUS_2026-02-28.md` - current MiniMax source of truth: latest status, validated findings, open questions
- `current/MINIMAX_OFF_VS_AUTO_CLOSEOUT_2026-03-02.md` - narrow fixed-tree closeout: `TG-only` still favors `off`, mixed path now shows a real `auto` branch
- `current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md` - first longer controlled MiniMax hot-expert run; rejected raising default above legacy `16`
- `current/SUMMARY_CURRENT_2026-02-26.md` - latest validated snapshot
- `CUSTOM_QUANT_BENCH_PLAN.md` - benchmark scenario for custom quant variants
- `RESULTS_2026-02-23.md` - historical report (archival)

## Main runner script
- `../../ik_llama.cpp/scripts/bench-matrix-mixed.ps1` - unified matrix runner for `pp/tg/pg`, `rtr off/on/auto`, and load probe.

## Raw data location
- `../../ik_llama.cpp/bench_results/`
