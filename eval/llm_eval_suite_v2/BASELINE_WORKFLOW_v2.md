# Baseline workflow for v2

This file describes the intended operating procedure for the suite.

## 1. Create a baseline deliberately

Do not pick a baseline casually.

A baseline should be:

- a quant you already trust
- run under stable runtime conditions
- run with `temperature=0.0`
- run with the same backend and prompt mode you plan to use for comparisons

Example:

```bash
EVAL_MODEL_NAME=MiniMax-M2.5 \
EVAL_QUANT_NAME=baseline_q4xl \
EVAL_TEMPERATURE=0.0 \
python run_fast_qc.py
```

Save the resulting run directory path.

## 2. Use the same baseline for a candidate batch

If you are testing several candidates in one session or one experimental branch, compare all of them against the same baseline.

Do not rotate baselines every two runs unless you have a clear reason.

## 3. Run Fast QC first

Example:

```bash
EVAL_MODEL_NAME=MiniMax-M2.5 \
EVAL_QUANT_NAME=iq4_xs_candidate \
EVAL_BASELINE_RUN_DIR=bench_results/fast_qc_v2/<baseline_run_id> \
python run_fast_qc.py
```

Interpretation:

- `PASS` — candidate is acceptable for further consideration
- `BORDERLINE` — candidate is not rejected, but should not be promoted blindly
- `FAIL` — candidate is operationally worse in a meaningful way

## 4. Only promote Fast QC survivors to Deep Eval

Deep Eval is for finalists, not for every experimental quant.

Run it only after Fast QC has already filtered the obvious losers.

Example:

```bash
EVAL_MODEL_NAME=MiniMax-M2.5 \
EVAL_QUANT_NAME=iq4_xs_candidate \
EVAL_BASELINE_RUN_DIR=bench_results/deep_eval_v2/<deep_baseline_run_id> \
python run_deep_eval.py
```

## 5. Use compare_runs.py for close calls

When the difference is small, stop staring at headline percentages and inspect deltas per test.

```bash
python compare_runs.py \
  --baseline bench_results/fast_qc_v2/<baseline_run_id> \
  --current bench_results/fast_qc_v2/<current_run_id>
```

Look first at:

- top regressions
- code-related tests
- extraction / JSON-related tests
- honesty / ambiguity handling for finalists

## 6. Build leaderboards periodically

Once you have many runs, memory becomes unreliable. Use `build_leaderboard.py` to keep an external view of the field.

## 7. Common mistakes to avoid

### Mistake: changing backend settings mid-comparison
This contaminates the benchmark.

### Mistake: over-trusting one total score
Look at section or dimension deltas.

### Mistake: promoting BORDERLINE runs too quickly
A borderline quant may still be useful, but it should be adopted consciously.

### Mistake: comparing different prompt modes as if they were identical
`chat` and `completion` can materially change outputs.

### Mistake: using a weak baseline
A weak baseline makes later conclusions meaningless.

## 8. Practical rule of thumb

Use Fast QC to answer:

> “Did this quant degrade in a way that matters operationally?”

Use Deep Eval to answer:

> “Among the acceptable candidates, which one is actually the strongest finalist?”
