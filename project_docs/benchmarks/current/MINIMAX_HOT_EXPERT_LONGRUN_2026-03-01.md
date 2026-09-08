# MiniMax Hot Expert Long Run - 2026-03-01

## Purpose

This note records the first longer controlled MiniMax `hot expert budget` run after:

1. fixing MiniMax-specific `rtr=auto`
2. adding runtime budget override for `hot experts`
3. seeing a short exploratory signal that suggested larger budgets might help

The goal of this run was simple:

- test whether that short signal survives a meaningfully longer `MiniMax` workload

## Important Context

At the time of this run, the working tree temporarily changed the MiniMax runtime default hot-expert budget from the legacy `16` to an experimental `24`.

That means:

- `budget=default` in this run should be read as `experimental default ~= 24`
- **not** as the current runtime default on the active tree

After the results below were reviewed, that temporary change was reverted and the code was rebuilt back to the legacy `16` default.

## Host

- AMD Ryzen 9 7950X
- Zen4
- 96 GB RAM
- Windows

## Model

- `D:\ggufs\un\minimax2.5-m2\MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005.gguf`

## Benchmark Settings

- `t16`
- `fa1`
- `muge0`
- `rtr=off`
- `r=1`
- `ngl=0`

Scenarios:

1. `tg32`
2. `pg32,4`

## Raw Artifacts

Run directory:

- `ik_llama.cpp/bench_results/2026-02-28_225841_minimax_hot_budget_long`

Important logs:

- `tg32_off_budget_default.log`
- `tg32_off_budget_16.log`
- `tg32_off_budget_32.log`
- `pg32_4_off_budget_default.log`
- `pg32_4_off_budget_16.log`
- `pg32_4_off_budget_32.log`

## Reporting Note

The original `summary.md` and `results.csv` generated inside this run directory came from an older version of the runner that incorrectly averaged all `-pg` JSON records together.

For this run:

- raw `.log` files are the real source of truth
- this document is the corrected interpretation layer

## Results

### TG-only (`tg32`)

| Budget | Meaning In This Run | `avg_ts` |
| --- | --- | ---: |
| `default` | temporary experimental default (`~24`) | `0.010970` |
| `16` | explicit legacy budget | `0.011009` |
| `32` | explicit large budget | `0.012370` |

Interpretation:

- `32` is best on this small standalone decode workload
- `default (~24)` is not better than explicit `16`

### Mixed Micro-Workload (`pg32,4`)

`llama-bench -pg` emits several records. They must be read separately.

#### `pp512`

| Budget | Meaning In This Run | `avg_ts` |
| --- | --- | ---: |
| `default` | temporary experimental default (`~24`) | `5.216895` |
| `16` | explicit legacy budget | `5.653088` |
| `32` | explicit large budget | `5.009826` |

#### `tg128`

| Budget | Meaning In This Run | `avg_ts` |
| --- | --- | ---: |
| `default` | temporary experimental default (`~24`) | `0.014282` |
| `16` | explicit legacy budget | `0.015390` |
| `32` | explicit large budget | `0.014790` |

#### `pp32+tg4`

This is the most meaningful row for the configured mixed micro-workload.

| Budget | Meaning In This Run | `avg_ts` |
| --- | --- | ---: |
| `default` | temporary experimental default (`~24`) | `0.112444` |
| `16` | explicit legacy budget | `0.127987` |
| `32` | explicit large budget | `0.116957` |

## Main Conclusion

The first longer controlled `rtr=off` run did **not** confirm the idea that MiniMax should move above the legacy `16` hot-expert budget.

What was actually shown:

1. `16` beat both the temporary experimental default (`~24`) and `32` on the meaningful mixed row `pp32+tg4`
2. `16` also won on the companion `pp512` and `tg128` records emitted by the same `pg32,4` run
3. `32` looked best only on the standalone `tg32` run

That is not enough to justify a new MiniMax default.

## What Was Rejected

The following experimental step is now rejected on the current evidence:

- raising the MiniMax default hot-expert budget from the legacy `16` to `24`

Reason:

- it did not survive the first longer controlled mixed-path run

## What Remains Open

This run does **not** prove that larger budgets are useless in every possible MiniMax regime.

Still open:

1. whether a larger budget interacts differently with `rtr=auto`
2. whether a more decode-heavy or prompt-richer workload changes the ranking
3. whether `24` specifically behaves differently from `32` on a future long rerun

But none of those are grounds for changing the default now.

## Current Practical Recommendation

For MiniMax on the current tree:

1. leave `IK_LLAMA_HOT_EXPERT_BUDGET` unset in normal use
2. interpret that as the restored legacy runtime default (`16`)
3. treat larger budgets as research-only, not as user-facing recommendations

## Why This Matters For Fork Development

This is a useful result even though it is not a speed win.

It shows:

1. short exploratory huge-model signals can be misleading
2. MiniMax decisions still need long controlled runs
3. the fork should keep preferring stable swap-bound policy over premature knob promotion
