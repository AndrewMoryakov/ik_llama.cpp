# MiniMax Refresh - 2026-02-28

## Purpose

This note records a fresh partial rerun of `MiniMax M2.5` on the current working tree.

It exists for one reason:

- MiniMax is relevant to the project
- but current release-facing validation was centered on `Qwen3MoE` and `gpt-oss`
- so MiniMax needed at least one fresh checkpoint before making stronger claims

## Host

- AMD Ryzen 9 7950X
- Zen4
- 96 GB RAM
- Windows

## Model

- `D:\ggufs\un\minimax2.5-m2\MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005.gguf`

## What Was Completed

Fresh reruns completed successfully for:

1. `tg128`, `rtr=off`
2. `pg512,128`, `rtr=off`
3. focused `tg128`, explicit `-p 0`, with `rtr=off/on/auto`
4. MiniMax-specific quick verification after fixing `rtr auto`
5. short `hot expert budget` quick matrix

The broader `rtr off/on/auto` refresh matrix was started but not finished in this pass because MiniMax remained an expensive swap-bound workload on this host.

## Fresh Results

### `tg128`, `t16 fa1 rtr=off muge0`, `r=1`

- `1.0875 t/s`

Artifact:

- `ik_llama.cpp/bench_results/2026-02-28_minimax_refresh/tg128_rtr_off.json`

### Focused `tg128`, explicit `-p 0`, `t16 fa1 muge0`, `r=1`

This focused rerun exists because `llama-bench` defaults to `-p 512` and we wanted a strictly decode-only check.

Results:

- `rtr=off`: `1.2638 t/s`
- `rtr=on`: `1.2369 t/s`
- `rtr=auto`: `0.8525 t/s`

Artifacts:

- `ik_llama.cpp/bench_results/2026-02-28_minimax_tg_recheck/tg128_rtr_off_p0.json`
- `ik_llama.cpp/bench_results/2026-02-28_minimax_tg_recheck/tg128_rtr_on_p0.json`
- `ik_llama.cpp/bench_results/2026-02-28_minimax_tg_recheck/tg128_rtr_auto_p0.json`

Interpretation:

1. `rtr=on` is **not** catastrophically bad on current `TG-only` MiniMax.
2. In this rerun it is only about `2.1%` slower than `off`.
3. So a small local speedup observed by a user in some machine state is plausible.
4. But current local rerun still does **not** show `on` beating `off`.
5. `rtr=auto` was the real problem in this earlier check: it kept repack enabled and dropped to `0.8525 t/s`.

This earlier result exposed a policy bug rather than a stable MiniMax rule.

That bug is now fixed and quick-verified separately. See:

- `MINIMAX_HOT_EXPERT_BUDGET_QUICKCHECK_2026-02-28.md`

### `pg512,128`, `t16 fa1 rtr=off muge0`, `r=1`

- `PP512`: `5.8544 t/s`
- `TG128`: `1.1143 t/s`
- `PP512+TG128`: `3.6110 t/s`

Artifact:

- `ik_llama.cpp/bench_results/2026-02-28_minimax_refresh/pg512_128_rtr_off.json`

## Comparison To Earlier Stored Results

Stored earlier local result set from `2026-02-26` for `rtr=off`:

- `tg128`: `1.3366 t/s`
- `pg512,128` mixed: `3.8580 t/s`

Fresh partial rerun is lower in absolute speed:

- `tg128`: `1.3366 -> 1.0875`
- mixed `pp512+tg128`: `3.8580 -> 3.6110`

## Practical Interpretation

This does **not** mean MiniMax support regressed in a proven way.

What it does mean:

1. MiniMax is still strongly swap-bound on this host.
2. MiniMax absolute speed is highly sensitive to machine memory state.
3. MiniMax public claims should not be built from a single lucky run.
4. MiniMax should remain a careful huge-model target, but the narrow `off vs auto` closeout is now completed on the fixed tree.
5. The earlier bad `auto` result turned out to be a real policy/reporting issue and not something we should keep as the current recommendation.
6. For `TG-only`, `rtr=on` is close to `off`, but not better in the current local rerun.

## Follow-Up Fix And Quick Verification

After the partial refresh above, the runtime policy was updated so that `rtr=auto` disables repack for huge `MiniMax M2` on this host.

Quick verification confirmed:

1. the log now reports that `auto` disables repack for MiniMax
2. `llama-bench` metadata now reports the effective state correctly
3. short exploratory MiniMax runs can now be used to study `hot expert` behavior without the old `auto` policy bug

This no longer stands alone. The later fixed-tree closeout should now be read together with:

- `MINIMAX_OFF_VS_AUTO_CLOSEOUT_2026-03-02.md`

It does mean the current tree is in a better state for that next pass.

## What This Refresh Confirms

The fresh pass still supports the following statements:

1. MiniMax remains a relevant but difficult huge-model target.
2. MiniMax should not be grouped together with in-RAM MoE cases.
3. MiniMax should not be pulled into tight release-facing validated scope yet.

## What This Refresh Does Not Yet Settle

This partial rerun does not by itself settle:

1. longer and heavier mixed-path `auto` behavior
2. final `hot expert` budget choice for long runs
3. whether locality-oriented work can move MiniMax more than policy did

## Recommended Next Step

Read the closeout note for the newer practical answer:

- `MINIMAX_OFF_VS_AUTO_CLOSEOUT_2026-03-02.md`

Current interpretation:

1. `TG-only`: `off` still wins over `auto`
2. mixed path: `auto` is now a real branch after the fix and slightly wins on the closeout row
3. the next engineering step should move from policy into locality/paging behavior
