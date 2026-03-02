## Next Ideas for Expert Selection

## Purpose

This document captures the next most plausible research ideas around:

- hot experts
- expert locality
- prompt -> decode prediction
- speculative-style expert guidance

The goal is not to claim that all of them are good.

The goal is to preserve:

1. what looks cheap and worth testing
2. what looks medium-cost and promising
3. what looks ambitious and should stay secondary

## Tier 1: Cheap and high-value

These are the best next candidates because they do not require a second model and do not fundamentally change the runtime architecture.

### 1. Weighted Hot Experts

Instead of:

- full prompt
- or hard tail cutoff

use weighted prompt contribution:

- newer tokens get more weight
- older tokens get less
- different prompt segments may have different weights

Why this is strong:

1. cheaper than a second model
2. softer than a hard `tail-window`
3. more likely to generalize across MoE families

Main hypothesis:

- a weighted prompt signal may predict early decode experts better than both full-prompt and hard tail-window.

### 2. Prompt Tail + Early Decode Feedback

Current logic mostly decides hot experts before decode starts.

New idea:

1. build initial hot set from prompt
2. let the first few decode steps refine it
3. do this without dynamic lock/unlock storms

Why this is strong:

- early decode is exactly where prompt prediction must prove itself
- this directly tests the true value of the hot set

Main hypothesis:

- a small amount of early-decode correction improves useful hot-set quality more than prompt-only selection.

### 3. Layer-Aware Hot Experts

Current hot-set thinking is mostly global.

New idea:

- experts may matter differently by layer
- a useful hot set may need some layer awareness

Why this is strong:

- layer telemetry already exists
- this may improve locality without simply raising the total budget

Main hypothesis:

- a layer-aware hot set beats a single global top-N under the same memory budget.

## Tier 2: Medium-cost and promising

These ideas are still realistic, but they are more complex than the three above.

### 4. Expert Stability Score

Before deciding how aggressively to lock or prefetch, estimate how stable the expert path is.

Possible states:

1. stable
2. mixed
3. volatile

Then use that to choose policy.

Why this is useful:

- avoids treating every prompt as equally predictable
- reduces the chance of warming the wrong experts

Main hypothesis:

- adaptive policy based on stability is better than one fixed hot-expert strategy for all prompts.

### 5. Group-Based Experts

Instead of predicting exact experts directly:

1. predict expert groups or clusters
2. refine inside the chosen group

Why this is useful:

- cheaper than exact prediction
- may fit naturally into a coarse-to-fine runtime strategy

Main hypothesis:

- expert-group prediction is cheaper and more robust than direct exact-expert prediction.

## Tier 3: Ambitious secondary research

These are good research lines, but they are not the best first step.

### 6. Decode-Only Auxiliary Predictor

Use a lightweight predictor only for:

- first decode
- early decode

Not for the whole prompt path.

Why this is interesting:

- lower overhead than a full prompt-side auxiliary model
- better alignment with the actual mixed-path bottleneck

Main hypothesis:

- a predictor focused only on early decode can improve locality enough to justify its cost.

### 7. Retrieval-Style Expert Memory

Store patterns such as:

- prompt-tail shape
- task type
- expert activity shape in early decode

Then use them as priors for future runs.

Why this is interesting:

- repeated workloads may benefit from prior expert patterns
- it could become a cache-like companion to hot-expert logic

Main hypothesis:

- some workloads repeat enough structure that expert priors are reusable across sessions.

## Prioritized recommendation

If choosing the next concrete research steps, the order should be:

1. `Weighted Hot Experts`
2. `Prompt Tail + Early Decode Feedback`
3. `Layer-Aware Hot Experts`
4. `Expert Stability Score`
5. only then deeper auxiliary-predictor variants

## Why this order is correct

Because the first three:

1. stay close to the existing runtime
2. do not require a second model
3. are easier to benchmark honestly
4. are less likely to harm answer quality

The auxiliary-predictor line remains very interesting, but it should not outrank cheaper heuristic improvements before those are tested.

## Practical next-step recommendation

The best next research move in this family is:

- `Weighted Hot Experts`

followed by:

- `Prompt Tail + Early Decode Feedback`

That gives the highest chance of finding a measurable `MiniMax` locality improvement without introducing a second model too early.
