## Prompt Tail Rewrite

## Positioning

This is a secondary research line for expert selection.

It is not the mainline runtime path.

The mainline path is still:

- better hot-expert selection inside the existing runtime

This line asks a different question:

- can a small auxiliary model reshape the end of the prompt so that early decode expert locality becomes easier to predict?

## Core idea

Use a small model, roughly `1B-4B`, not to answer the user, but to transform the prompt tail into a more locality-friendly form.

Safer variants:

1. append a short structured tail summary
2. compress the last user turn
3. rewrite only the tail, not the full prompt

Unsafe variant:

- rewrite the whole prompt freely

That unsafe variant should not be treated as the default research direction.

## Why this might help

Current hot-expert logic assumes:

- later prompt tokens may predict early decode better than the full prompt

If that is true, then a small model could try to make the tail:

1. denser in task-relevant signal
2. less polluted by earlier irrelevant context
3. easier for hot-expert prediction to use

## Why this is risky

### 1. Semantics risk

The auxiliary model can:

- remove important context
- change emphasis
- alter the intended instruction

### 2. Reproducibility risk

Prompt rewriting adds another model and another inference step.

That means:

- less reproducible runs
- more moving parts
- harder benchmarking

### 3. Cost risk

The extra small-model pass may cost more than the locality gain.

## Safe MVP

The safest first version is:

- keep the original prompt intact
- append a short controlled tail summary

The summary should obey rules:

1. do not change facts
2. do not remove safety/system instructions
3. do not invent missing constraints
4. only compress or restate the latest actionable request

## What to measure

1. overlap between selected hot experts and early decode experts
2. locked-share usefulness
3. `PG` delta on short mixed runs
4. answer-quality regressions on simple sanity prompts

## Success criteria

Minimal success:

1. better prompt -> decode expert overlap
2. no obvious semantic corruption
3. measurable locality or `PG` improvement

Failure:

1. locality signal improves but overall latency gets worse
2. prompt meaning shifts
3. quality/reproducibility becomes too unstable

## Current recommendation

Keep this line in:

- `research/*`

Do not move it into mainline runtime optimization until it proves that:

1. it helps locality in a measurable way
2. it preserves prompt intent
3. its overhead is justified
