# MiniMax Off vs Auto Closeout - 2026-03-02

## Purpose

This note closes the previously open `MiniMax M2.5` runtime-policy question on the fixed tree:

- does `rtr=auto` become viable after the MiniMax-specific policy fix
- or should `rtr=off` remain the only practical answer

This is a narrow closeout pass, not a broad matrix.

## Workload

Model:

- `D:\ggufs\un\minimax2.5-m2\MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005.gguf`

Fixed parameters:

- `t=16`
- `fa=1`
- `muge=0`
- runtime default hot-expert budget
- `r=1`

Scenarios:

1. `tg32`
2. `pg32,4`

Compared modes:

1. `rtr=off`
2. `rtr=auto`

## Raw Artifacts

- `ik_llama.cpp/bench_results/2026-03-01_221624_minimax_hot_budget_long`
- `ik_llama.cpp/bench_results/2026-03-01_223439_minimax_hot_budget_long`
- `ik_llama.cpp/bench_results/2026-03-01_224347_minimax_policy_closeout`

## Results

### `tg32`

- `off`: `0.618850 tok/s`
- `auto`: `0.553629 tok/s`

Implication:

- on `TG-only`, the current MiniMax baseline still favors `off`

### `pg32,4`

`pp32+tg4`:

- `off`: `1.277317`
- `auto`: `1.316512`

Supporting rows:

`pp512`

- `off`: `6.607347`
- `auto`: `7.925032`

`tg128`

- `off`: `1.178502`
- `auto`: `1.167166`

Implication:

- on the mixed row used in this closeout, `auto` is better than `off`
- the gain is small but real: about `+3.1%` on `pp32+tg4`

## Interpretation

This closes the earlier binary framing of MiniMax runtime policy.

The current picture is now:

1. `rtr=off` remains the safer and stronger `TG-only` baseline
2. `rtr=auto` is no longer disqualified by the old broken-policy result
3. after the fix, `auto` is now a viable mixed-path branch for MiniMax

This does **not** mean:

- `auto` is now the universal MiniMax default
- `off` should be dropped
- `on` suddenly matters again

It means:

- MiniMax guidance must now distinguish `TG-only` from mixed use

## Practical Recommendation

If the user needs a practical answer on the current tree:

1. for `TG-only`, start with `rtr=off`
2. for mixed prompt+generation, compare `rtr=off` and `rtr=auto`
3. treat `auto` as a valid mixed-path candidate, not as a broken mode
4. keep `IK_LLAMA_HOT_EXPERT_BUDGET` unset in normal use

## What Stays Open

This closeout does **not** answer:

1. whether `auto` remains better on longer and heavier mixed workloads
2. whether any tuned hot-expert budget improves the `auto` branch
3. how much performance is still available in expert locality and paging behavior

Those remain the next MiniMax-specific optimization questions.
