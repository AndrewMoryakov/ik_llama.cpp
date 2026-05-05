# LLM Eval Suite v1.3

Builds on v1.2 by adding an Extended Eval layer that covers gaps in the original suites.

## Three layers

| Script | Tests | Points | Focus | When to run |
|--------|-------|--------|-------|-------------|
| `run_fast_qc.py` | 8 | 100 | Post-quant degradation gate | After every new quant |
| `run_deep_eval.py` | 9 | 100 | Finalist comparison | Top 2-3 candidates |
| `run_extended_eval.py` | 6 | 60 | Coverage gaps | Alongside deep eval |

## What Extended Eval adds

v1.2 (fast_qc + deep_eval) is strong on strict JSON output, code execution, and structured reasoning. But it does not cover:

| Gap | Extended test |
|-----|--------------|
| Multi-step state tracking | EXT-01: CPU simulation (16 instructions, stack, registers, conditional jump) |
| Adversarial trick questions | EXT-02: 7 trick questions (survivors burial, True vs 1kg, etc.) |
| Nuanced multi-factor analysis | EXT-03: Team metrics — no single correct answer, hidden insights |
| Resistance to logical fallacies | EXT-04: 6 fallacy statements to identify and name |
| Non-tech domain breadth | EXT-05: Medicine + history + ethics in one prompt |
| System design under constraints | EXT-06: 10M DAU news caching, $5K budget, 3 regions, personalization |

## Extended Eval scoring

Same dimension system as deep_eval: **correctness**, **reasoning**, **discipline**, **honesty**.

Scoring is keyword-based (not strict JSON) because these tests evaluate reasoning quality, not format compliance. A model that reasons well but formats poorly still gets credit.

## Quick start

```bash
# Layer 1 — fast gate
python run_fast_qc.py

# Layer 2 — deep comparison
python run_deep_eval.py

# Layer 3 — coverage gaps
python run_extended_eval.py

# For thinking models
EVAL_USE_COMPLETION=1 EVAL_MAX_TOKENS=4000 python run_extended_eval.py
```

## Recommended workflow

1. Run `run_fast_qc.py` on every new quant. Reject obvious degradations.
2. Run `run_deep_eval.py` + `run_extended_eval.py` on top candidates.
3. Compare dimension profiles, not just totals.

## Files

```
eval/llm_eval_suite_v1_3/
├── eval_common.py           — shared client, helpers, safe exec (from v1.2)
├── run_fast_qc.py           — 8 tests, 100 pts, auto-scored (from v1.2)
├── run_deep_eval.py          — 9 tests, 100 pts, mixed scoring (from v1.2)
├── run_extended_eval.py      — 5 tests, 50 pts, keyword scoring (NEW)
└── README.md
```
