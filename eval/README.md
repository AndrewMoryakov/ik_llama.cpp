# Eval — Model Quality Testing Suite

Benchmarks for evaluating LLM quantization quality and comparing models.

## Structure

```
eval/
├── scripts/           — Test runner scripts (all prompts in English)
│   ├── run_qc.py              — Quality Control (9 tests, 3 auto-scored)
│   ├── run_eval_suite.py      — V1: 13 basic tests
│   ├── run_eval_suite_v2.py   — V2: 10 advanced tests
│   ├── run_eval_v2_plus.py    — V2 subset + V2-11 (5 key tests)
│   ├── run_eval_v2_thinking.py — V2 for thinking models (/completion endpoint)
│   ├── run_eval_v3_discriminator.py — V3: 5 discriminator tests (228B vs 42B)
│   └── run_eval_v4_deep.py    — V4: 7 deep tests (code, logic, research)
├── docs/              — Test descriptions and scoring rubrics
│   ├── EVAL_SUITE.md          — V1 test descriptions
│   └── EVAL_SUITE_V2.md       — V2 test descriptions
└── results/           — Test run results
    ├── eval_v*_minimax/       — MiniMax M2.5 results
    ├── eval_v*_qwen3_42b/     — Qwen3-42B results
    └── eval_v*_comparison.md  — Cross-model comparisons
```

## Quick Start

```bash
# Start llama-server first, then:

# Quality Control after new quantization (recommended)
python eval/scripts/run_qc.py

# Full eval suite
python eval/scripts/run_eval_v4_deep.py

# For thinking models (Qwen3, etc.)
EVAL_USE_COMPLETION=1 EVAL_MAX_TOKENS=5000 python eval/scripts/run_eval_v4_deep.py
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EVAL_API` | `http://127.0.0.1:8080/v1/chat/completions` | Chat API endpoint |
| `EVAL_API_BASE` | `http://127.0.0.1:8080` | Base URL (for /completion) |
| `EVAL_OUT` | `bench_results/eval_*` | Output directory |
| `EVAL_TIMEOUT` | `900` | Request timeout (seconds) |
| `EVAL_MAX_TOKENS` | `3000` | Max tokens per response |
| `EVAL_USE_COMPLETION` | `0` | Use /completion endpoint (for thinking models) |

## Test Suites

| Suite | Tests | Focus | Best For |
|-------|-------|-------|----------|
| **QC** | 9 | Quantization quality control | After each new quant |
| V1 | 13 | Basic capabilities | Initial smoke test |
| V2 | 10 | Advanced tasks | Model comparison |
| V3 | 5 | Large vs small model discrimination | 228B vs 42B |
| V4 | 7 | Deep expertise, code, logic | Research-grade comparison |

## Baseline Scores (MiniMax M2.5 Deep-Taper v4, 114 GiB)

| Suite | Score | Notes |
|-------|-------|-------|
| QC (auto) | 30/30 | 3 auto-scored tests |
| V1 | 72/130 | 3 empty responses |
| V2 | 70/100 | 1 empty response |
| V3 | 43/50 | |
| V4 | 46/70 | 2 timeouts |
