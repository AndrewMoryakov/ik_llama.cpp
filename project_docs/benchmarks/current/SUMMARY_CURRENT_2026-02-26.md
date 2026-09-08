# Current State Validation - 2026-02-26 (Updated)

## Context
- Repo: `ik_llama.cpp`
- Build commit: `1ee50255a`
- Host: Ryzen 9 7950X, 96 GB RAM, Windows
- Benchmark binary rebuilt from current working tree before tests.
- Raw results directory: `../../../ik_llama.cpp/bench_results/current_2026-02-26_zen4`

## Test Set Executed
- Qwen3-30B-A3B Q4_K_M: `t16 fa1 rtr1 muge0` (`tg128`, `pp512`) + `muge1` (`tg128`) with `r=3`.
- gpt-oss-20b MXFP4: `t16 fa1 rtr1 muge1` (`tg128`, `pp512`) with `r=3`.
- gpt-oss-20b MXFP4: PP stabilization rerun `r=5`.
- MiniMax-M2.5 UD-Q5: `t16 fa1 muge0` with `rtr0/rtr1` (`tg32`, `tg128`, `r=1`).
- MiniMax-M2.5 UD-Q5: mixed path `-pg 512,128` with `rtr0/rtr1` (`r=1`).

## Current Measurements

### Core TG/PP
| Case | t/s | Stddev |
|---|---:|---:|
| Qwen3 TG128 t16 fa1 rtr1 muge0 (r=3) | 30.05 | 0.04 |
| Qwen3 PP512 t16 fa1 rtr1 muge0 (r=3) | 308.84 | 1.37 |
| Qwen3 TG128 t16 fa1 rtr1 muge1 (r=3) | 29.10 | 1.77 |
| gpt-oss TG128 t16 fa1 rtr1 muge1 (r=3) | 23.92 | 1.52 |
| gpt-oss PP512 t16 fa1 rtr1 muge1 (r=3) | 267.97 | 42.80 |
| gpt-oss PP512 t16 fa1 rtr1 muge1 (r=5) | 275.10 | 35.60 |

### MiniMax TG-only (swap-bound)
| Case | t/s |
|---|---:|
| TG32 rtr0 | 1.0267 |
| TG32 rtr1 | 0.9105 |
| TG128 rtr0 | 1.3366 |
| TG128 rtr1 | 1.2263 |

### MiniMax mixed path (`-pg 512,128`)
| Case | PP512 | TG128 | PP512+TG128 |
|---|---:|---:|---:|
| rtr0 | 7.6931 | 1.2206 | 3.8580 |
| rtr1 | 3.6369 | 0.7787 | 2.9124 |

## Delta vs historical baseline (`bd387a279`)
| Case | Old | Current | Delta |
|---|---:|---:|---:|
| Qwen3 TG128 t16 fa1 rtr1 muge0 | 29.92 | 30.05 | +0.43% |
| Qwen3 PP512 t16 fa1 rtr1 muge0 | 306.19 | 308.84 | +0.87% |
| gpt-oss TG128 t16 fa1 rtr1 muge1 | 24.18 | 23.92 | -1.07% |
| gpt-oss PP512 t16 fa1 rtr1 muge1 | 289.53 | 267.97 | -7.45% |
| MiniMax TG128 t16 fa1 rtr0 muge0 | 1.48 | 1.34 | -9.67% |
| MiniMax TG128 t16 fa1 rtr1 muge0 | 0.65 | 1.23 | +89.24% |

## Important Observations
- Qwen path remains stable (within ~1%).
- `muge+rtr` for Qwen is working in current tree (no crash observed in current tests).
- MiniMax remains swap-bound and slow.
- Old thesis "rtr catastrophically hurts swap-bound MiniMax" is no longer true for TG-only path on current code.
- For mixed `pg512,128`, `rtr1` is still substantially worse than `rtr0`.
- gpt-oss PP remains high-variance even at `r=5`; treat PP deltas with caution.

## Gap for new quantization focus
- No model artifacts of the new custom quantization were found in local model storage yet.
- Current measured data is still primarily Q4_K_M / MXFP4 / UD-Q5.

## Recommended next benchmark scenario (custom quant)
1. Compare variants A/C/D/E/F from `../../strategy/TASK.md` with fixed runtime profile: `t16 fa1 ctk=q8_0`.
2. For each variant run: `tg32`, `tg128`, `pp512`, `pg512,128`.
3. Run `rtr` on/off only for variants near RAM-fit boundary.
4. Collect: avg t/s, stddev, model size, peak commit/swap, wall time.
5. Store raw outputs in JSONL + one normalized summary table.

