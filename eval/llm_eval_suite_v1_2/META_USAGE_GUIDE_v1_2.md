# Meta usage guide for v1.2

This document explains how to use the suite correctly. The key risk is not technical failure; it is interpretive failure. A benchmark can look precise while still being misused.

## What the two suites are for

## Fast QC

Use `run_fast_qc.py` when the question is:

> Did this quantization degrade the model in a way that matters operationally?

Typical use cases:

- after each new quantization recipe
- after changing prompt template
- after switching backend or runtime flags
- after changing completion/chat mode

### What Fast QC is not for
It is not the right tool for declaring one finalist “globally smarter” based on a 2-point difference.

## Deep Eval

Use `run_deep_eval.py` when the question is:

> Among the candidates that already passed QC, which one is stronger for real work?

Typical use cases:

- comparing top 2 to top 5 candidates
- final selection
- inspecting specific strengths and weaknesses

### What Deep Eval is not for
It is not the right tool for every intermediate quant. That wastes time and introduces interpretive noise.

## Recommended operating procedure

## Step 1 — lock down the environment

Before comparing quants, keep these fixed:

- same backend
- same prompt mode
- same temperature
- same seed if supported
- same max token budget
- same API formatting template

If those change, you are no longer measuring only the quant.

## Step 2 — establish a baseline

Choose one reference quant and run both suites once.

Use that run as the practical reference. The benchmark does not need a mythically perfect baseline. It needs a stable one.

## Step 3 — run Fast QC on every new quant

This is the primary gate.

### Suggested interpretation

- **92–100**: strong pass
- **85–91**: acceptable
- **78–84**: borderline, inspect a few raw answers
- **<78**: reject unless you have a special reason

### Hard rejection signals

Reject quickly if any of these happen:

- strict JSON extraction collapses
- code generation or bugfix tests drop sharply
- multi-constraint formatting fails badly
- the total score drops by around 5 or more points from your normal baseline

Do not rationalize these away with “maybe the model is just more concise.” Exactness and structure are exactly what quantization often damages.

## Step 4 — only then run Deep Eval

Run the deep suite on the surviving finalists.

### How to read Deep Eval results

Do not over-trust the total score alone. Look at the profile:

- correctness
- reasoning quality
- instruction discipline
- honesty / anti-hallucination

A model can win overall while still being worse for your real use case.

Example:

- Quant A may be stronger in code and extraction
- Quant B may write smoother RFCs
- Quant C may be more honest under ambiguity

The right choice depends on your target workload.

## How not to fool yourself

## Mistake 1 — treating all score differences as meaningful

A 1-point difference in a mixed benchmark is often noise. A 6-point drop concentrated in code and JSON usually is not.

## Mistake 2 — reading style as intelligence

Longer, smoother, more confident prose is not automatically better. Sometimes it is just better camouflage for weak grounding.

This is why strict JSON, executable code, and constrained formatting were emphasized in the redesign.

## Mistake 3 — comparing across changed runtime conditions

If you switch:

- backend
- prompt template
- completion vs chat mode
- token budget
- temperature

then the benchmark result is not directly comparable. Do not attribute every difference to the quant.

## Mistake 4 — using deep open-ended tests as smoke tests

That burns time and gives you narrative output instead of crisp gating information.

## Mistake 5 — ignoring category failures because the overall score looks decent

A quant that is still fluent but has visibly degraded in code or exact structure can be dangerous in practice.

## What to inspect manually when scores are close

When two finalists are close, inspect a few raw outputs for:

- whether the model invents details under ambiguity
- whether fixes are concrete or generic
- whether code is minimal and correct or bloated and fragile
- whether RFC language is precise or vague
- whether structured outputs contain subtle schema drift

The benchmark narrows the field. It does not remove the need for judgment.

## How to adapt the suite to your own workload

This suite is a solid default, not a sacred object.

You should adapt it if your real workload is very different. For example:

- If you care mostly about coding agents, expand code repair and execution tests.
- If you care mostly about extraction and schema fidelity, add more strict-JSON tasks.
- If you care about long-context synthesis, add more contradiction and evidence-separation tasks.
- If you care about CLI agent behavior, add short tool-use planning tasks with explicit success criteria.

The right benchmark is not the most philosophically elegant one. It is the one that predicts your real failure modes.

## What results are actually decision-useful

The most useful outputs are:

1. a baseline run
2. repeated Fast QC on new quants
3. a shortlist of finalists
4. one Deep Eval comparison across those finalists
5. a small manual review for close calls

That is enough to make strong engineering decisions without drowning in benchmark theater.
