# Benchmark evolution in v1.2

This document explains why the original benchmark sets were reworked, how they were transformed, and what problem each change was meant to solve.

## Core diagnosis of the original sets

The original material contained two different things under the same label:

- **quality-control tasks** for detecting degradation after quantization
- **deep open-ended prompts** for inspecting whether the model feels strong, plausible, and mature

That mixture creates three concrete problems.

### Problem 1: one suite was doing incompatible jobs

A good smoke test after quantization should be:

- short
- repeatable
- cheap to run
- mostly auto-scored
- sensitive to degradation in structure, code, and exactness

A good deep finalist test can be:

- longer
- partially subjective
- richer in engineering judgment
- useful for manual review

Trying to force both jobs into one file leads to noise and wasted time.

### Problem 2: several original tests were underdetermined or too subjective

Some tasks looked intellectually strong, but did not actually have a stable ground truth. That makes them poor discriminators between close quants.

Examples:

- fallacy labeling tasks often allow several defensible labels
- essay prompts reward style as much as substance
- reverse-engineering from too few examples rewards confident guessing instead of disciplined uncertainty handling

### Problem 3: too much manual reading

If every new quant requires reading long essays and RFC-like answers, the benchmark stops being an operational tool. It becomes a pile of logs.

## Design decision: split the system into two layers

### Layer 1 — Fast QC

Purpose: detect degradation quickly after each quantization.

Therefore the suite was rebuilt around:

- strict JSON tasks
- exact symbolic transforms
- constraint-following tasks with parseable output
- executable code tasks
- compact incident diagnosis with rubric scoring

### Layer 2 — Deep Eval

Purpose: compare finalists after obvious losers are already filtered out.

Therefore this suite keeps some richer engineering tasks, but with more structure and explicit rubrics.

## How the original QC set changed

## Original QC-1: Self-verification

### Why it was changed
The arithmetic task itself was fine, but the original auto-scoring relied too much on loose keyword matching. That makes it too easy to score partial points for approximate or sloppy output.

### What it became
**FQC-01 — Arithmetic + self-check** with strict JSON schema.

### Motivation
The goal was to preserve the useful signal — arithmetic, self-checking, disciplined structure — while making scoring deterministic and machine-readable.

## Original QC-2: Caesar cipher

### Why it was kept
This is a strong exactness test. Quantization degradation often shows up in symbolic precision before it shows up in broad fluent prose.

### What it became
**FQC-02 — Exact symbolic transform** in strict JSON.

### Motivation
Keep the exactness signal, reduce parsing ambiguity.

## Original QC-3: Logical fallacies

### Why it was demoted
The task is interesting, but weak as a quant discriminator. Many statements allow multiple reasonable fallacy labels, and scoring becomes subjective.

### What happened to it
It was not kept in the fast layer. The underlying skill — analytical judgment — is represented more usefully in the deep layer through structured diagnosis and source-conflict synthesis.

### Motivation
Avoid spending benchmark budget on tasks that look rigorous but produce unstable scoring.

## Original QC-4: JSON extraction

### Why it was kept and strengthened
This was one of the strongest original tests. It checks structured extraction, formatting discipline, and resistance to extra chatter.

### What it became
**FQC-03 — Strict JSON extraction**, with tighter schema expectations.

### Motivation
Preserve one of the best practical signals and make failure more obvious.

## Original QC-5: 10 constraints email

### Why it was changed
The original version was good in spirit, but still too manual. Some constraints were easy to auto-check; others were ambiguous or stylistic.

### What it became
**FQC-05 — Multi-constraint formatting** with wrappers and parseable self-check JSON.

### Motivation
Keep instruction-following pressure while reducing human scoring burden.

## Original QC-6: Domain expertise

### Why it was moved
It is useful for finalist comparison, but too expensive and subjective for every quant.

### What it became
A compact form survived in **DE-06 — Multi-domain factual depth**.

### Motivation
Domain depth matters, but it belongs in the deep layer, not in the fast gate.

## Original QC-7: Debug distributed system

### Why it was split
This was one of the best tasks in the original benchmark, but it was serving two roles at once: short degradation canary and full engineering reasoning task.

### What it became
- **FQC-08 — Compact incident diagnosis** for the fast layer
- **DE-01 — Distributed incident diagnosis** for the deep layer

### Motivation
Preserve the same engineering axis in two different cost/precision regimes.

## Original QC-8: Code edge cases

### Why it was strengthened
This was already strong, but it became much more useful once tied to executable tests.

### What it became
- **FQC-06 — Code generation with execution**
- plus **FQC-07 — Bugfix snippet** as a second practical coding discriminator

### Motivation
Generated code should be executed, not merely admired.

## Original QC-9: Team analysis

### Why it was removed from the core
It is a judgment task with many defensible rankings depending on what you optimize for: throughput, quality, retention, sustainability, or risk.

### What replaced it
Parts of the underlying skill are covered better by structured decision tasks in the deep layer.

### Motivation
Reduce subjectivity and improve signal quality.

## How the original V4 set changed

## Original V4-1: Domain expertise

### Why it was retained only in the deep layer
It measures broad factual and explanatory competence, but not cheaply or deterministically.

### What it became
**DE-06 — Multi-domain factual depth** with a more compact structure and a rubric.

## Original V4-2: Debug distributed system

### Why it was retained
This was genuinely useful and close to real engineering work.

### What it became
**DE-01 — Distributed incident diagnosis** with explicit sections and scoring dimensions.

## Original V4-3: Reverse engineer + prove

### Why it was rewritten completely
The original task was underdetermined. Multiple formulas can fit the given examples. That means an honest model could say “not uniquely determined” and look weaker than an overconfident guesser.

### What it became
**DE-05 — Ambiguity / underdetermination honesty test**.

### Motivation
The real capability worth testing was not formula guessing. It was disciplined handling of incomplete evidence.

## Original V4-4: Logical fallacies

### Why it was not preserved directly
Same issue as in QC: high subjectivity, unstable labels, low scoring reliability.

### What replaced it
Structured analytical tasks with more stable rubrics, especially diagnosis and contradiction synthesis.

## Original V4-5: Contradicting sources

### Why it was changed
The essay version was too style-sensitive and too open-ended.

### What it became
**DE-07 — Contradictory sources synthesis** in a structured JSON-like output shape.

### Motivation
Keep the synthesis skill, reduce prose noise.

## Original V4-6: Self-verification

### Why it was demoted
The useful part of this task already lives in fast QC. Duplicating it in a more open-ended deep suite adds little value.

### What happened
The self-verification axis is handled mainly by **FQC-01**.

## Original V4-7: Technical RFC

### Why it was retained, but constrained
This is valuable for finalist selection, but dangerous if left as a free-form writing contest.

### What it became
**DE-04 — Technical RFC** with required sections and rubric-based evaluation.

### Motivation
Preserve long-form engineering synthesis while containing fluff.

## New additions that did not exist explicitly in the originals

## FQC-04 — Distractor-aware extraction

### Why it was added
The original suite had JSON extraction, but not enough selective extraction from noisy context. Real production use often requires “extract only X, ignore tempting nearby noise.”

### Motivation
Quantization can degrade selectivity before it fully breaks output format.

## FQC-07 — Bugfix snippet

### Why it was added
Writing code from scratch and fixing broken code are related but not identical skills. Quantized models sometimes stay fluent in generation while becoming sloppier in local reasoning and repair.

### Motivation
Catch practical coding regressions that pure generation tasks may miss.

## DE-08 — Long-context extraction with contradictions

### Why it was added
Many real workflows require separating confirmed facts, conflicts, and unknowns from imperfect text. The original sets did not isolate this capability cleanly.

### Motivation
Test disciplined extraction under informational friction.

## DE-09 — Constraint-heavy professional memo

### Why it was added
The original constraint-writing task was useful, but one short email is not enough to represent professional formatting discipline.

### Motivation
Keep pressure on structure and exact compliance in the finalist layer too.

## Summary of the redesign logic

The redesign was driven by five principles.

1. **Separate frequent QC from deep finalist evaluation.**
2. **Prefer executable or parseable outputs whenever possible.**
3. **Demote tasks that reward style more than truth.**
4. **Replace underdetermined puzzles with uncertainty-aware tasks.**
5. **Keep real engineering pressure: code, incidents, extraction, structured writing, and ambiguity handling.**

That is the real reason v1.2 exists: not to make the benchmark look more sophisticated, but to make it more operational, more honest, and harder to game by fluent nonsense.
