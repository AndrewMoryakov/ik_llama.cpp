# Complete Benchmark Summary - ik_llama.cpp

**As of:** 2026-02-26
**Hardware:** AMD Ryzen 9 7950X (Zen4, 16C/32T, 2 CCD), 96 GB DDR5, Windows 11
**Current validation commit:** `1ee50255a`
**Historical comparison commit:** `bd387a279`

---

## 1. Current Stable Runtime Profile (this host)

- Threads: `t=16`
- Flash attention: `fa=1`
- KV-cache: `ctk=q8_0` (where relevant)
- Affinity: no manual CCD pinning
- SMT: enabled

This profile stays the default baseline for future custom quantization tests.

---

## 2. Current Measured Performance

| Model | Flags | PP512 t/s | TG128 t/s | Notes |
|---|---|---:|---:|---|
| Qwen3-30B-A3B Q4_K_M | `t16 fa1 rtr1 muge0` | 308.84 | 30.05 | Stable vs old baseline |
| Qwen3-30B-A3B Q4_K_M | `t16 fa1 rtr1 muge1` | - | 29.10 | No crash in current tests |
| gpt-oss-20b MXFP4 | `t16 fa1 rtr1 muge1` | 267.97 (r=3), 275.10 (r=5) | 23.92 | PP variance remains high |
| MiniMax-M2.5 UD-Q5 | `t16 fa1 rtr0 muge0` | - | 1.3366 | Swap-bound |
| MiniMax-M2.5 UD-Q5 | `t16 fa1 rtr1 muge0` | - | 1.2263 | Swap-bound |

MiniMax mixed prompt+gen (`-pg 512,128`):
- `rtr0`: PP 7.6931, TG 1.2206, mixed 3.8580
- `rtr1`: PP 3.6369, TG 0.7787, mixed 2.9124

---

## 3. What Changed vs Historical Conclusions

1. Qwen performance is effectively unchanged (within ~1%).
2. gpt-oss TG is near-flat; PP conclusions require repeated runs because of high stddev.
3. MiniMax remains very slow on 96 GB RAM (swap-bound).
4. Old statement "`rtr` catastrophically hurts MiniMax" is outdated for TG-only path on current code.
5. For mixed `pg512,128`, `rtr1` is still significantly worse than `rtr0`.

---

## 4. Project Direction (updated)

- Support for UD-Q / IQ / Q stays in place.
- R&D focus moves to new custom quantization variants from `../strategy/TASK.md`.
- Engine optimization now targets real MoE behavior under RAM pressure (including mixed prompt+gen path, not TG-only only).

---

## 5. Priority Next Stage

For each custom quant variant A/C/D/E/F, run:
- `tg32`
- `tg128`
- `pp512`
- `pg512,128`

With fixed runtime baseline: `t16 fa1 ctk=q8_0`.

Collect per run:
- avg t/s
- stddev
- model size
- peak commit/swap
- wall time

---

## 6. Source Files

- Current snapshot summary: `current/SUMMARY_CURRENT_2026-02-26.md`
- Current snapshot raw logs: `../../ik_llama.cpp/bench_results/current_2026-02-26_zen4/*.json`
- Historical runs index: `INDEX.md`
- Historical report (2026-02-23): `RESULTS_2026-02-23.md`
- Custom quant benchmark plan: `CUSTOM_QUANT_BENCH_PLAN.md`
