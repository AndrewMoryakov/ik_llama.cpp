# LLM Eval Suite v2

Practical evaluation harness for local/API-hosted LLMs with three layers:

- `run_fast_qc.py` — quick post-quantization degradation gate (8 tests, 100 pts)
- `run_deep_eval.py` — deeper finalist comparison suite (9 tests, 100 pts)
- `run_extended_eval.py` — coverage gaps: state tracking, tricks, domain breadth, system design (6 tests, 60 pts)
- `compare_runs.py` — explicit baseline vs current comparison report
- `build_leaderboard.py` — aggregate leaderboard from saved runs
- `eval_common.py` — shared API client, parsers, safe code execution, summary helpers

v2 keeps the core v1/v1.2 prompt logic, then adds:

- baseline comparison
- fail gates for Fast QC
- section and dimension deltas
- extended eval for areas not covered by fast_qc/deep_eval
- reusable comparison artifacts
- leaderboard generation across many runs

## Why v2 exists

v1 was already useful as a working eval suite. v2 moves it closer to a real harness.

The main gap in v1 was not the prompts themselves. The gap was what happened **after** a run:

- how to compare a new quant against a known-good baseline
- how to make pass / borderline / fail decisions automatically
- how to aggregate many runs without manually opening `summary.json`
- how to inspect regressions per test instead of relying on one total score

v2 addresses those operational problems.

## Historical docs

These files are kept because they explain the evolution from your original QC/V4 benchmark sets:

- `BENCHMARK_EVOLUTION_v1_2.md`
- `META_USAGE_GUIDE_v1_2.md`

New v2 docs:

- `V2_FEATURES.md`
- `BASELINE_WORKFLOW_v2.md`

## Files

- `run_fast_qc.py` — 8 tests, mostly auto-scored, 100-point suite, now with gates and baseline deltas
- `run_deep_eval.py` — 9 tests, mixed auto/rubric scoring, 100-point suite, now with baseline deltas
- `compare_runs.py` — build a Markdown and JSON comparison between two runs
- `build_leaderboard.py` — build CSV and Markdown leaderboards from all stored runs
- `eval_common.py` — shared helpers and baseline/summary utilities

## Environment variables

Core runtime:

- `EVAL_API_BASE` — default `http://127.0.0.1:8080`
- `EVAL_OUT` — default `bench_results`
- `EVAL_TIMEOUT` — default `900`
- `EVAL_MAX_TOKENS` — default `3000`
- `EVAL_USE_COMPLETION` — `1` for `/completion`, otherwise `/v1/chat/completions`
- `EVAL_TEMPERATURE` — default `0.0`
- `EVAL_SEED` — optional; passed if supported by backend
- `EVAL_MODEL_NAME`
- `EVAL_QUANT_NAME`
- `EVAL_BACKEND_NAME`
- `EVAL_BACKEND_VERSION`
- `EVAL_RUN_ID` — optional; default is timestamp

Baseline comparison:

- `EVAL_BASELINE_SUMMARY` — path to baseline `summary.json`
- `EVAL_BASELINE_RUN_DIR` — path to baseline run directory (the script resolves `summary.json` automatically)

Fast QC fail gates:

- `EVAL_FAIL_TOTAL_THRESHOLD` — default `78`
- `EVAL_BORDERLINE_TOTAL_THRESHOLD` — default `85`
- `EVAL_FAIL_TOTAL_DROP` — default `5`
- `EVAL_FAIL_CODE_JSON_DROP` — default `8`
- `EVAL_CRITICAL_MIN_PCT` — default `0.6`
- `EVAL_FAIL_ON_GATE` — if `1`, `run_fast_qc.py` exits with code `2` on `FAIL`

## Quick start

### 1. Establish a Fast QC baseline

```bash
EVAL_MODEL_NAME=MiniMax-M2.5 \
EVAL_QUANT_NAME=baseline_q4xl \
python run_fast_qc.py
```

This creates a run directory like:

```text
bench_results/fast_qc_v2/<run_id>/summary.json
```

### 2. Compare a new quant against that baseline automatically

```bash
EVAL_MODEL_NAME=MiniMax-M2.5 \
EVAL_QUANT_NAME=test_iq4xs \
EVAL_BASELINE_RUN_DIR=bench_results/fast_qc_v2/<baseline_run_id> \
python run_fast_qc.py
```

### 3. For finalists, run Deep Eval against a deep baseline too

```bash
EVAL_MODEL_NAME=MiniMax-M2.5 \
EVAL_QUANT_NAME=test_iq4xs \
EVAL_BASELINE_RUN_DIR=bench_results/deep_eval_v2/<deep_baseline_run_id> \
python run_deep_eval.py
```

### 4. Build a direct comparison report

```bash
python compare_runs.py \
  --baseline bench_results/fast_qc_v2/<baseline_run_id> \
  --current bench_results/fast_qc_v2/<current_run_id>
```

### 5. Build a leaderboard across runs

```bash
python build_leaderboard.py --root bench_results --suite fast_qc_v2
python build_leaderboard.py --root bench_results --suite deep_eval_v2
```

## Recommended workflow

1. Pick one reference quant and run `run_fast_qc.py`. This becomes the operational baseline.
2. Run `run_fast_qc.py` on every new quant with `EVAL_BASELINE_RUN_DIR` pointing to that baseline.
3. Use the gate output to reject obvious degradations.
4. Only after that, run `run_deep_eval.py` on the top candidates.
5. For close calls, use `compare_runs.py` and inspect the largest regressions, not just the headline total.
6. Periodically build leaderboards to keep a history of candidate performance.

## Output layout

Each run gets its own directory:

```text
bench_results/
  fast_qc_v2/
    <run_id>/
      metadata.json
      results.jsonl
      summary.json
      summary.txt
  deep_eval_v2/
    <run_id>/
      metadata.json
      results.jsonl
      summary.json
      summary.txt
  leaderboards/
    leaderboard_fast_qc_v2.csv
    leaderboard_fast_qc_v2.md
    leaderboard_deep_eval_v2.csv
    leaderboard_deep_eval_v2.md
```

## Operational notes

- Keep `temperature=0.0` and prompt mode constant when comparing quants.
- Do not compare runs across different backends, templates, or decoding modes as if the scores were directly interchangeable.
- Fast QC gates are designed to be conservative. A `BORDERLINE` run is not necessarily bad; it means “do not auto-promote this quant without looking closer.”
- Deep Eval remains partly heuristic. Treat it as structured ranking support, not as an oracle.
- Code-generation tests still execute model-produced Python in a restricted environment. Use the suite in a controlled environment.
