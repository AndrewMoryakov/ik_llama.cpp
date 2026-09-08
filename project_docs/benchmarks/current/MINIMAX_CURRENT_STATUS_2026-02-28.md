# MiniMax Current Status - 2026-02-28

## Purpose

This is the current source of truth for `MiniMax M2.5` benchmark status on the active tree.

Use this document first if the question is any of the following:

- where the latest MiniMax data is
- which MiniMax findings are already confirmed
- which MiniMax findings are still only directional
- what MiniMax currently means for fork development priorities

## Why MiniMax Matters

`MiniMax M2.5` is not just another supported model.

For this fork it is one of the main stress-case targets because it represents the exact scenario the fork is trying to handle better:

- huge MoE
- CPU-only
- model does not fit into RAM fully
- runtime is dominated not only by math, but also by paging, locality, and expert access behavior

That means MiniMax results should be interpreted primarily as:

- huge-model runtime evidence
- swap-bound policy evidence
- MoE memory-behavior evidence

not as a generic in-RAM throughput story.

## Current Raw Data Locations

Latest relevant raw artifacts:

1. Partial current-tree refresh:
- `ik_llama.cpp/bench_results/2026-02-28_minimax_refresh`

2. Focused `TG-only` rerun that exposed the old `rtr auto` policy problem:
- `ik_llama.cpp/bench_results/2026-02-28_minimax_tg_recheck`

3. Quick verification after fixing MiniMax-specific `rtr auto` behavior:
- `ik_llama.cpp/bench_results/2026-02-28_minimax_quick_verify`

4. Short `hot expert budget` matrix:
- `ik_llama.cpp/bench_results/2026-02-28_minimax_hot_budget_matrix`

5. First longer controlled `hot expert budget` run:
- `ik_llama.cpp/bench_results/2026-02-28_225841_minimax_hot_budget_long`

6. `off vs auto` closeout on the fixed tree:
- `ik_llama.cpp/bench_results/2026-03-01_221624_minimax_hot_budget_long`
- `ik_llama.cpp/bench_results/2026-03-01_223439_minimax_hot_budget_long`
- `ik_llama.cpp/bench_results/2026-03-01_224347_minimax_policy_closeout`

7. Locality confirm run on realistic workloads:
- `ik_llama.cpp/bench_results/2026-03-03_001015_minimax_locality_confirm`

Supporting narrative documents:

- `MINIMAX_REFRESH_2026-02-28.md`
- `MINIMAX_HOT_EXPERT_BUDGET_QUICKCHECK_2026-02-28.md`
- `MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`
- `MINIMAX_OFF_VS_AUTO_CLOSEOUT_2026-03-02.md`
- `MINIMAX_LOCALITY_TAIL_WINDOW_2026-03-02.md`
- `../../models/MINIMAX_M2_5_RUNTIME.md`

## What Is Confirmed Right Now

The statements below are the current validated MiniMax findings on this tree.

### 1. MiniMax remains strongly swap-bound on the target host

This is still the main practical fact.

Implication:

- MiniMax results are highly sensitive to RAM pressure and machine memory state
- a single lucky run is not enough for strong public claims

### 2. `rtr=off` remains the clean current baseline

On the clean focused `TG-only` rerun with explicit `-p 0`:

- `rtr=off`: `1.2638 t/s`
- `rtr=on`: `1.2369 t/s`

Implication:

- `off` is still the safest current reference point
- `on` is not catastrophically bad, but it is not currently the best confirmed mode either

### 3. The earlier bad `rtr=auto` result was a real policy bug, not a stable MiniMax conclusion

Earlier focused rerun showed:

- `rtr=auto`: `0.8525 t/s`

That older result is still important, but it now has a different meaning:

- it exposed that `auto` was leaving repack enabled for a huge MiniMax case where it should not have

This is now fixed in the current tree.

### 4. MiniMax-specific `rtr auto` now disables repack in the huge-model case

Quick verification on the current tree confirms:

- runtime log reports `--run-time-repack auto: disabled (...)`
- `llama-bench` metadata now correctly reports:
  - `repack: false`
  - `repack_auto: true`

Implication:

- MiniMax should no longer be judged using the older broken-policy `auto` result alone

### 5. `rtr=off` vs `rtr=auto` is now closed on the fixed tree

Fresh closeout results:

`tg32`

- `off`: `0.618850 tok/s`
- `auto`: `0.553629 tok/s`

`pg32,4`

- `off`: `1.277317`
- `auto`: `1.316512`

Implication:

- `off` remains the stronger `TG-only` baseline
- `auto` is now a validated mixed-path branch after the fix
- MiniMax guidance should no longer treat `auto` as automatically bad

### 6. `hot expert` budget is real, but the first long run rejected a higher default

Short exploratory `pg8,1` matrix showed that the knob is responsive.

That was useful, but the more important follow-up result is now this:

- the first longer controlled `rtr=off` run did **not** confirm promoting MiniMax above the legacy `16` budget

In that longer run:

- experimental `default (~24)` lost to explicit `16`
- `32` also lost to explicit `16` on the meaningful mixed row

Implication:

- the mechanism is real
- but larger budgets are **not** currently justified as a new default
- the practical current answer is back to legacy `16`

### 7. `tail-window=16` did not become a practical new MiniMax baseline

Longer confirm run on realistic workloads:

`TG128`

- baseline: `1.332637`
- `tail-window=16`: `1.282882`

`PG512,128`

- baseline mixed: `3.991484`
- `tail-window=16`: `4.030163`

Implication:

- `tail-window=16` keeps a small positive mixed-path signal
- but the gain is too small and comes with prompt-side and `TG128` regressions
- this remains a research-only locality idea, not a new baseline

## What Is Only Directional For Now

The statements below are useful, but they are not yet strong enough to publish as final public recommendations.

### 1. Larger MiniMax `hot expert` budgets may still matter in another regime

This remains possible, but the evidence is weaker than before because:

- the short `pg8,1` quick check suggested `24/32`
- the first longer controlled `rtr=off` run re-centered on legacy `16`

What this means now:

- larger budgets remain research-only

What it does not mean:

- they are a user-facing recommendation
- they are the next default for MiniMax

### 2. MiniMax-specific optimization should focus on memory behavior more than generic prompt tricks

This is already a strong engineering direction, but not yet a closed measured result.

It follows from:

- architecture-specific code paths
- swap-bound behavior
- existing evidence around expert locking and repack

## What Is Not Settled Yet

These questions remain open:

1. which smarter locality idea should replace plain `tail-window=16` as the next MiniMax runtime candidate
2. whether improved hot-expert selection can raise `prompt -> decode` overlap without hurting `TG`
3. how much of MiniMax performance is still left in expert locality and paging behavior

## What This Means For Development Priority

MiniMax results now support the following development interpretation.

### Already done

1. the fork now has a better runtime-policy baseline for huge MiniMax
2. reporting is less misleading because effective `repack` state is exposed correctly
3. there is now a cheap way to test `hot expert` budget ideas before hour-long runs
4. a first longer controlled run already rejected one tempting but unconfirmed MiniMax default change

### Next high-value step

The next expensive MiniMax validation pass should now move past pure policy closeout and into a narrower optimization question:

1. `rtr=off` and `rtr=auto` already form the practical MiniMax policy pair
2. further expensive runs should test locality-oriented hypotheses, not reopen the old broken-policy question
3. any larger hot-expert budget should remain research-only until it survives a more realistic mixed run
4. `tail-window=16` should not be promoted; the next locality step should be a smarter selection strategy

### Broader strategy meaning

MiniMax currently reinforces the main fork direction:

- optimizing huge swap-bound MoE is a different problem from optimizing in-RAM MoE
- runtime policy, locality, and expert behavior matter as much as raw kernel speed
- the fork should keep treating MiniMax as a primary development line, not an edge case

## Current Practical Recommendation

If someone needs a practical MiniMax answer **right now**:

1. treat `rtr=off` as the safest current baseline
2. for mixed prompt+generation, also test `rtr=auto`; it is now a valid mixed-path branch on the fixed tree
3. leave `IK_LLAMA_HOT_EXPERT_BUDGET` unset unless you are intentionally reproducing MiniMax-specific research
4. treat larger budgets as research-only, not as defaults
5. treat `tail-window=16` as research-only, not as a practical recommendation

## Related Documents

- `MINIMAX_REFRESH_2026-02-28.md`
- `MINIMAX_HOT_EXPERT_BUDGET_QUICKCHECK_2026-02-28.md`
- `MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`
- `MINIMAX_OFF_VS_AUTO_CLOSEOUT_2026-03-02.md`
- `MINIMAX_LOCALITY_TAIL_WINDOW_2026-03-02.md`
- `../../models/MINIMAX_M2_5_RUNTIME.md`
- `../../strategy/FORK_GOAL_AND_SCOPE_2026-02-28.md`
