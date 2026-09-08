# LLM Eval Suite v1.2

Practical evaluation suite for local/API-hosted LLMs with two layers:

- `run_fast_qc.py` — quick post-quantization degradation gate
- `run_deep_eval.py` — deeper finalist comparison suite
- `eval_common.py` — shared API client, parsing helpers, and restricted Python execution helpers

v1.2 keeps the code path from v1 intact and adds the missing meta-layer:

- why the original benchmarks were changed
- how the new suites map to the original tests
- how to use the system without misreading noisy results

## Why this exists

Your original benchmark sets mixed several different jobs into one pile:

1. smoke testing after every quantization
2. deep comparison of finalists
3. demonstration prompts for manually reading answers

Those jobs conflict with each other. A test that is good for manual inspection is often too long, too subjective, or too noisy for frequent regression checks. A test that is good for fast regression gating is usually narrower and more structured.

This suite splits those jobs deliberately.

## What changed from the original sets

Read these two documents first:

- `BENCHMARK_EVOLUTION_v1_2.md` — why each original test was kept, rewritten, demoted, or removed
- `META_USAGE_GUIDE_v1_2.md` — how to run the suites, how to interpret results, and how not to fool yourself

## Files

- `eval_common.py` — shared API client, parsing helpers, safe code execution helpers
- `run_fast_qc.py` — 8 tests, mostly auto-scored, 100-point suite
- `run_deep_eval.py` — 9 tests, mixed auto/rubric scoring, 100-point suite
- `BENCHMARK_EVOLUTION_v1_2.md` — rationale for the redesign
- `META_USAGE_GUIDE_v1_2.md` — practical operator guide

## Defaults

The scripts read these environment variables:

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
- `EVAL_RUN_ID` — optional; default is current UTC-ish timestamp

## Quick start

### Fast QC

```bash
python run_fast_qc.py
```

```bash
EVAL_API_BASE=http://127.0.0.1:8080 \
EVAL_OUT=bench_results \
EVAL_MODEL_NAME=MiniMax-M2.5 \
EVAL_QUANT_NAME=Q4_K_XL \
python run_fast_qc.py
```

### Deep Eval

```bash
python run_deep_eval.py
```

```bash
EVAL_USE_COMPLETION=1 \
EVAL_MODEL_NAME=MiniMax-M2.5 \
EVAL_QUANT_NAME=Q4_K_XL \
python run_deep_eval.py
```

## Recommended workflow

1. Pick one reference quant and run `run_fast_qc.py`. Treat that score profile as the operational baseline.
2. Run `run_fast_qc.py` on every new quant. Reject obvious degradations early.
3. Only after that, run `run_deep_eval.py` on the top candidates.
4. For close calls, inspect section-level differences and a few raw answers instead of trusting only the total score.

## Output layout

Each run gets its own directory:

```text
bench_results/
  fast_qc_v1/
    <run_id>/
      metadata.json
      results.jsonl
      summary.json
      summary.txt
  deep_eval_v1/
    <run_id>/
      metadata.json
      results.jsonl
      summary.json
      summary.txt
```

## Operational notes

- Use `temperature=0.0` for comparison runs.
- Keep prompt mode consistent across quant comparisons.
- `run_deep_eval.py` includes heuristic rubric scoring. It is useful for ranking finalists, not for pretending that open-ended quality has been reduced to pure mathematics.
- Code-generation tests execute model-produced Python in a restricted environment. This is safer than raw `exec`, but still run the suite in a controlled environment.
- Do not compare results across different backends, prompt templates, or decoding modes as if they were directly equivalent.
