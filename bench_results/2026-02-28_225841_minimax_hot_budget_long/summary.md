# MiniMax Hot Budget Long Run

Model: D:\ggufs\un\minimax2.5-m2\MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005.gguf

## Important Context

During this run, the working tree temporarily moved the MiniMax default hot-expert budget above the legacy `16` value.

Read the rows as:
- `default` = temporary experimental default from that run, not today's restored default
- `16` = explicit legacy MiniMax budget
- `32` = explicit large-budget experiment

After reviewing this run, the code was reverted back to the legacy `16` default.

## TG32

| budget | avg_ts | log |
|---|---:|---|
| default | 0.010970 | `tg32_off_budget_default.log` |
| 16 | 0.011009 | `tg32_off_budget_16.log` |
| 32 | 0.012370 | `tg32_off_budget_32.log` |

## PG32,4

`llama-bench -pg` emits multiple JSON records. They must be read separately.

### `pp512`

| budget | avg_ts | log |
|---|---:|---|
| default | 5.216895 | `pg32_4_off_budget_default.log` |
| 16 | 5.653088 | `pg32_4_off_budget_16.log` |
| 32 | 5.009826 | `pg32_4_off_budget_32.log` |

### `tg128`

| budget | avg_ts | log |
|---|---:|---|
| default | 0.014282 | `pg32_4_off_budget_default.log` |
| 16 | 0.015390 | `pg32_4_off_budget_16.log` |
| 32 | 0.014790 | `pg32_4_off_budget_32.log` |

### `pp32+tg4`

| budget | avg_ts | log |
|---|---:|---|
| default | 0.112444 | `pg32_4_off_budget_default.log` |
| 16 | 0.127987 | `pg32_4_off_budget_16.log` |
| 32 | 0.116957 | `pg32_4_off_budget_32.log` |

## Conclusion

The first longer controlled `rtr=off` run did not confirm raising MiniMax above the legacy `16` hot-expert budget.

Practical result:
- `16` won on the meaningful mixed row `pp32+tg4`
- `16` also won on `pp512` and `tg128` within the same `pg32,4` run
- `32` only led on standalone `tg32`

Use raw logs plus `project_docs/benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md` as the interpretation layer.
