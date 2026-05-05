# v2 features

v2 is not a new prompt set for the sake of novelty. It is a more operational version of the same evaluation system.

## What changed from v1 / v1.2

### 1. Fast QC now has explicit gates

Fast QC is no longer only a score emitter. It now produces a gate decision:

- `PASS`
- `BORDERLINE`
- `FAIL`

The decision is based on:

- absolute total score threshold
- critical-test minimum percentages
- total regression versus baseline
- combined `code + extraction` regression versus baseline

This matters because post-quantization evaluation is often a filtering problem, not a ranking problem.

### 2. Baseline comparison is built into both suites

Both suites can now load a baseline via:

- `EVAL_BASELINE_SUMMARY`
- `EVAL_BASELINE_RUN_DIR`

The resulting summary includes:

- total score delta
- percent delta
- per-test deltas
- top regressions
- top improvements
- section deltas for Fast QC
- dimension deltas for Deep Eval

This matters because raw scores alone are too easy to misread.

### 3. Fast QC now reports section totals

Fast QC is now split into explicit sections:

- exactness
- extraction
- instruction following
- code
- diagnosis

This helps answer a more useful question than “did the score go down?” It answers “where exactly did it go down?”

### 4. Deep Eval now supports direct finalist-to-baseline comparison

Deep Eval still remains partly rubric-driven, but now it produces deltas against a known reference finalist. That makes it more useful when two quants are close overall but diverge in honesty, correctness, or structure.

### 5. New comparison tool

`compare_runs.py` builds a reusable comparison artifact:

- `comparison.json`
- `comparison.md`

This is useful when you want a stable report instead of manually diffing two `summary.json` files.

### 6. New leaderboard tool

`build_leaderboard.py` scans stored runs and produces:

- CSV leaderboard
- Markdown leaderboard

This matters once you stop comparing two quants and start comparing ten.

## Why these changes were necessary

The original benchmark work had strong prompts, but weak *post-run ergonomics*.

In practice, the pain points were:

- too much manual reading
- too much reliance on headline totals
- no automatic fail gates
- no convenient baseline diff
- no portfolio-level view across many runs

v2 addresses those pain points directly.

## What v2 still does not pretend to solve

v2 is stronger than v1, but it is still not magic.

- Deep Eval is still partly heuristic.
- A single score still cannot perfectly summarize open-ended model quality.
- Cross-backend comparisons are still risky if templates or decoding differ.
- The suite still benefits from targeted manual review for close finalists.

That is acceptable. The goal is not theoretical purity. The goal is a more trustworthy engineering workflow.
