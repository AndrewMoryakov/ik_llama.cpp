# MiniMax Hot Expert Budget Quick Check - 2026-02-28

## Purpose

This note records a cheap, short MiniMax experiment after two runtime fixes:

1. `rtr=auto` now disables repack for huge `MiniMax M2` on this host
2. `hot expert` lock budget can now be overridden without changing default behavior

The goal was not to prove a final public recommendation.

The goal was narrower:

- find out whether the current `hot expert` mechanism reacts to budget changes
- identify 1-2 budgets worth a full long MiniMax run

## Important Update After The First Long Run

This quick note is still useful, but it is no longer the current decision layer by itself.

The follow-up long controlled run is now recorded in:

- `MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`

That follow-up matters because it contradicted the practical takeaway from this tiny workload:

- the short `pg8,1` filter made `24/32` look promising
- the first longer controlled `rtr=off` run did **not** confirm promoting MiniMax above the legacy `16` budget

So this document should now be read only as:

- proof that the knob is responsive
- proof that short exploratory traces can surface candidates

and **not** as the current recommendation for MiniMax defaults.

## Host

- AMD Ryzen 9 7950X
- Zen4
- 96 GB RAM
- Windows

## Model

- `D:\ggufs\un\minimax2.5-m2\MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005.gguf`

## Workload

Short exploratory workload:

- `pg8,1`
- `t16`
- `fa1`
- `rtr=auto`
- `muge0`
- `r=1`

This workload is intentionally tiny and noisy.

It is useful only as a directional filter before expensive long runs.

## What Was Verified First

`rtr=auto` now resolves correctly for this MiniMax case.

The log now reports:

- `--run-time-repack auto: disabled (MiniMax M2 model 150.7 GiB > 90% of RAM 95.1 GiB)`

`llama-bench` metadata was also fixed to report the effective runtime state correctly:

- `repack: false`
- `repack_auto: true`

## Quick Matrix

| Budget | Locked Share At Last Decode Trace | `avg_ts` (`pp8+tg1`) | Notes |
| --- | ---: | ---: | --- |
| `8` | `0.2%` | `0.843186` | too small in this quick check |
| `16` | `0.4%` | `0.855840` | current default-equivalent budget |
| `24` | `0.7%` | `1.093096` | strongest quick result |
| `32` | `0.9%` | `1.091305` | essentially tied with `24` |
| `default` | `0.4%` | `0.906353` | legacy default, same nominal budget as `16` |

Artifacts:

- `ik_llama.cpp/bench_results/2026-02-28_minimax_hot_budget_matrix/pg8_1_budget_8.log`
- `ik_llama.cpp/bench_results/2026-02-28_minimax_hot_budget_matrix/pg8_1_budget_16.log`
- `ik_llama.cpp/bench_results/2026-02-28_minimax_hot_budget_matrix/pg8_1_budget_24.log`
- `ik_llama.cpp/bench_results/2026-02-28_minimax_hot_budget_matrix/pg8_1_budget_32.log`
- `ik_llama.cpp/bench_results/2026-02-28_minimax_hot_budget_matrix/pg8_1_budget_default.log`

## Interpretation

What this quick check supports:

1. The `hot expert` mechanism is responsive to budget changes.
2. Larger budgets increase the share of decode work that hits locked experts.
3. On this tiny workload, `24` and `32` look clearly more promising than `8` or `16`.

What this quick check does **not** prove:

1. That `24` or `32` is the final best MiniMax budget.
2. That the same ranking will hold on `pg512,128` or `tg128`.
3. That the gain survives longer runs with less noise.

The difference between `default` and explicit `16` should be treated as run-to-run noise unless reproduced in a larger controlled pass.

## What This Means Now

This quick pass was still useful because it found a testable hypothesis.

But after the first longer controlled run, the practical conclusion changed:

1. short exploratory MiniMax workloads are too weak to justify a new default by themselves
2. the current public-safe answer is back to:
- leave `IK_LLAMA_HOT_EXPERT_BUDGET` unset
- treat larger budgets as research-only
3. use `MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md` plus `MINIMAX_CURRENT_STATUS_2026-02-28.md` as the current interpretation layer
