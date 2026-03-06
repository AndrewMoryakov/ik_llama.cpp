## Auxiliary Expert Predictor

## Positioning

This is a secondary research line around expert selection.

The idea is conceptually close to speculative systems:

- speculative decoding uses a small model to guess tokens
- this line would use a lightweight predictor to guess experts

But the target is different:

- not token verification
- expert locality, prefetch, and hot-set quality

## Correct framing

This should not be described as:

- "the router searches the whole model and we make that search cheaper"

That framing is misleading.

The more accurate framing is:

- "a lightweight predictor helps the runtime guess which experts are worth keeping hot or prefetched before the expensive memory path happens"

## Why this idea is plausible

For huge swap-bound MoE, the expensive part is often:

1. reaching expert weights
2. page-in behavior
3. working-set instability

If a cheap helper can predict a useful shortlist of experts early enough, it may improve:

1. prefetch quality
2. hot-expert locking quality
3. early decode locality

## Three variants

### A. Heuristic predictor

No second model.

Examples:

- prompt-tail weighting
- recency weighting
- early-decode feedback

This is the lowest-risk path and should remain the first mainline direction.

### B. Auxiliary lightweight predictor

A small model or small learned head predicts:

- candidate experts
- or a shortlist of likely hot experts

The main runtime uses that only as a hint for:

- prefetch
- hot set
- shortlist guidance

This is the most plausible speculative-style research direction.

### C. Two-stage routing

1. cheap coarse expert predictor
2. full router refines only the shortlist

This is the most ambitious variant and also the riskiest.

## Where the predictor should be allowed to act

The safest scope is:

1. prefetch hints
2. hot-expert guidance
3. early decode locality hints

The predictor should **not** initially be allowed to:

1. replace the final router decision
2. change model outputs directly

That would create quality and correctness risks too early.

## Proposed first research hypothesis

A lightweight predictor can improve the usefulness of the hot-expert set better than:

- full-prompt counting alone
- tail-window counting alone

while adding less cost than a large-model locality miss costs.

## Minimal experimental protocol

### Stage 1. Offline / shadow mode

The predictor does not change runtime behavior yet.

It only logs:

1. predicted shortlist
2. actual early decode expert usage
3. overlap metrics

### Stage 2. Hint-only mode

Use predictor output only for:

- prefetch
- candidate hot set

Do not replace the final router.

### Stage 3. Cost accounting

Measure:

1. predictor latency
2. locality gain
3. `PG` change
4. stability change

## Risks

1. predictor overhead may be larger than the gain
2. wrong shortlist may warm the wrong experts
3. complexity may rise faster than benefit

## Why this line still matters

If basic hot-expert heuristics stop improving, this line may become the next serious path for:

- huge-MoE locality
- `MiniMax`
- later other swap-bound MoE families

## Current recommendation

Keep this line as:

- `research/*`

after:

1. heuristic hot-expert improvements
2. tail-window generalization

It should not block mainline runtime work, but it is a credible next-generation idea.
