# Benchmark Results Index

**Hardware:** AMD Ryzen 9 7950X (Zen4, 2 CCD), 96 GB DDR5, Windows 11 Pro
**Build:** MSVC 2022, AVX-512 (VBMI, VNNI, BF16), Release
**Current commit for active snapshot:** `1ee50255a` (2026-02-27)

---

## Active Snapshot (source of truth)

### `2026-02-27_1831` + `2026-02-27_1856` - Current Validation Baseline

| | |
|---|---|
| **Focus** | Unified matrix for `rtr off/on/auto` with separate `pp/tg/pg` analysis |
| **Models** | In-RAM: Qwen3-30B-A3B Q4_K_M, gpt-oss-20b MXFP4; Swap-bound: gpt-oss-120b MXFP4 |
| **Scenarios** | `pp512`, `tg128`, `pg512,128`, load probe |
| **Reps** | In-RAM `r=3`; swap-bound `r=1` (time-cost constrained) |
| **Files** | raw json logs + `current/SUMMARY_CURRENT_2026-02-27.md` |

Key points:
- In current matrix, throughput best mode is generally `rtr=auto` (or tied with `on`).
- `rtr=off` can have better startup wall-time on very large swap-bound models.
- Mixed path (`pg`) must stay separately tuned and evaluated; TG-only is not sufficient.

### `MiniMax M2.5` - Current Truth Lives In A Separate Current-Status Note

Use:

- `current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- `current/MINIMAX_OFF_VS_AUTO_CLOSEOUT_2026-03-02.md`

Reason:

- MiniMax is a huge swap-bound target with its own current-tree fixes, quick verification, and directional hot-expert findings
- the first longer hot-expert run did not confirm raising MiniMax above the legacy `16` default
- it should not be summarized only through the in-RAM / gpt-oss validation matrix above

### Family-Specific Current-Status Notes

Use these as the active interpretation layer for each main target family:

- `current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- `current/MINIMAX_OFF_VS_AUTO_CLOSEOUT_2026-03-02.md`

### Consolidated Current Objective Summary

Use:

- `SUMMARY_ALL.md`

Reason:

- it gathers the current objective benchmark numbers for `Qwen3MoE`, `gpt-oss-20b`, `gpt-oss-120b`, and `MiniMax` in one place
- it is the shortest current answer to "what are the latest numbers and what do they imply operationally"

---

## Historical Runs (do not treat as current truth)

### `current_2026-02-26_zen4` - Prior baseline snapshot
- Useful for comparison and continuity.
- Superseded by `2026-02-27_*` matrix + mixed-path focused runs.

### `2026-02-22_2311` - Baseline Matrix (historical)
- Commit: `bd387a279`
- 88 entries
- Models: gpt-oss-20b, Qwen3-30B-A3B, Llama-3.1-8B
- Notes: useful for trend comparison, but superseded by `current_2026-02-26_zen4`.

### `2026-02-23_0030` - MiniMax-M2.5 (historical)
- Commit: `bd387a279`
- 12 entries
- Notes: old conclusion "rtr catastrophically hurts MiniMax" is not fully reproducible on current code.

### `adv_2026-02-23_1223` - Advanced scenarios (historical/partial)
- 30/54 planned entries
- Includes KV-cache and thread-32 scenarios.
- Script/parser issues were present in this run.

### `thr_2026-02-23_1247` - Thread scaling (historical but still useful)
- 42 entries
- Main finding still valid on this host: `t=16` is best default for mixed workloads.

### `cpu_2026-02-23_1304` - CPU topology (historical but still useful)
- 48 entries
- Main finding still valid on this host: no CCD pinning, SMT on.

---

## Archived / Early Runs

| Directory | Entries | Note |
|---|---:|---|
| `2026-02-21_2324` | 0 | Early attempt |
| `2026-02-21_2325` | 0 | Early attempt |
| `2026-02-21_2331` | 0 | Empty |
| `2026-02-21_2333` | 0 | Empty |
| `2026-02-21_2334` | 1 | First successful single test |
| `2026-02-22_0013` | 5 | Partial large-model run |
| `2026-02-22_2305` | 16 | Partial baseline (superseded) |
| `2026-02-22_2334` | 2 | Partial run (superseded) |

---

## Benchmark Scripts

| Script | Purpose |
|---|---|
| `scripts/bench-moe.ps1` | Full flag matrix benchmark |
| `scripts/bench-advanced.ps1` | KV-cache quant, long context, mixed PG |
| `scripts/bench-thread-scaling.ps1` | Thread count scaling |
| `scripts/bench-cpu-topology.ps1` | CCD affinity, prompt length, SMT |
| `monitor.ps1` | System monitor |
| `cleanup.ps1` | Kill llama processes, show memory |

---

## Known Issues (current)

1. `llama-bench` output is not clean JSON (runtime logs interleave with JSON objects); parsing must be regex/robust parser.
2. gpt-oss PP has high variance on this host; compare only with repeated runs and stddev control.
3. Swap-bound MiniMax results are sensitive to OS memory state; run cleanup and consistent warmup before claims.
4. For MiniMax, use `current/MINIMAX_CURRENT_STATUS_2026-02-28.md` and `current/MINIMAX_OFF_VS_AUTO_CLOSEOUT_2026-03-02.md` as the active interpretation layer before quoting older notes.
5. For `Qwen3MoE` and `gpt-oss`, use the family-specific current-status notes before quoting isolated experimental docs.

## Resolved / Revalidated

- Old `muge+rtr` crash claims are not reproduced in current 2026-02-26 validation set.
- Topology recommendations remain unchanged: `t=16`, SMT on, no CCD pinning.

---

## Next Benchmark Stage

Target: custom quantization variants from `../strategy/TASK.md` (A/C/D/E/F), while keeping UD-Q/IQ/Q support intact.
Execution plan: `CUSTOM_QUANT_BENCH_PLAN.md`.
