# Consolidated Benchmark Status

**As of:** 2026-03-03  
**Host:** AMD Ryzen 9 7950X (Zen4), 96 GB RAM, Windows  
**Purpose:** one-place current objective benchmark summary for the active tree

This document is the shortest current answer to:

- what are the latest benchmark numbers that matter
- which runs are the current reference points
- what do those numbers imply operationally

For family-specific interpretation and open questions, see the per-family current-status notes in `current/`.

---

## 1. Current Reference Runs

### Qwen3MoE

Reference run:

- `ik_llama.cpp/bench_results/2026-02-27_1831`

Reference profile:

- model: `Qwen3-30B-A3B-Q4_K_M`
- `t=16`
- `fa=1`
- `rtr=auto`
- `muge=0`
- `r=3`

### gpt-oss-20b

Reference run:

- `ik_llama.cpp/bench_results/2026-03-03_060928_gptoss20b_runtime_baseline`

Reference profile:

- model: `gpt-oss-20b-MXFP4`
- `t=16`
- `fa=1`
- `rtr=auto`
- `muge=0`
- `r=3`

### gpt-oss-120b

Reference run:

- `ik_llama.cpp/bench_results/2026-03-03_061156_gptoss120b_runtime_packaging`

Reference comparison:

- model: `gpt-oss-120b-MXFP4-00001-of-00002`
- `t=16`
- `fa=1`
- `muge=0`
- `rtr=off` vs `rtr=auto`
- `r=1`

### MiniMax M2.5

Reference policy runs:

- `ik_llama.cpp/bench_results/2026-03-01_224347_minimax_policy_closeout`
- `ik_llama.cpp/bench_results/2026-03-03_001015_minimax_locality_confirm`

Reference profile:

- model: `MiniMax-M2.5-UD-Q5_K_XL`
- `t=16`
- `fa=1`
- `muge=0`

---

## 2. Current Objective Numbers

## Qwen3MoE (`Qwen3-30B-A3B-Q4_K_M`)

From `2026-02-27_1831`, `t=16`, `fa=1`, `rtr=auto`, `muge=0`, `r=3`.

| Scenario | Test | avg_ts |
|---|---|---:|
| `pp512` | `pp512` | `309.474526` |
| `tg128` | `tg128` | `29.389274` |
| `pg512,128` | `pp512` | `308.563879` |
| `pg512,128` | `tg128` | `29.255790` |

Operational meaning:

1. `Qwen3MoE` remains the clean in-RAM MoE reference family.
2. `rtr=auto` remains a strong current baseline.
3. `fa=1` is part of the practical profile, not a secondary toggle.

## gpt-oss-20b (`gpt-oss-20b-MXFP4`)

From `2026-03-03_060928_gptoss20b_runtime_baseline`, `t=16`, `fa=1`, `rtr=auto`, `muge=0`, `r=3`.

| Scenario | Test | avg_ts |
|---|---|---:|
| `tg128` | `tg128` | `23.707807` |
| `pg512,128` | `pp512` | `272.749618` |
| `pg512,128` | `tg128` | `24.075077` |
| `pg512,128` | `pp512+tg128` | `90.283185` |

Operational meaning:

1. This is the fresh current-tree baseline for the next decode-side `gpt-oss-20b` line.
2. `rtr=auto` remains a strong default starting point.

## gpt-oss-120b (`gpt-oss-120b-MXFP4-00001-of-00002`)

From `2026-03-03_061156_gptoss120b_runtime_packaging`, `t=16`, `fa=1`, `muge=0`, `r=1`.

| Scenario | Test | `rtr=off` | `rtr=auto` |
|---|---|---:|---:|
| `tg128` | `tg128` | `14.134468` | `16.657064` |
| `pg512,128` | `pp512` | `118.331030` | `147.881111` |
| `pg512,128` | `tg128` | `16.773810` | `17.469667` |
| `pg512,128` | `pp512+tg128` | `59.089030` | `60.177522` |

Operational meaning:

1. On the current tree, `rtr=auto` is the throughput-first winner.
2. `rtr=off` still matters for conservative startup-sensitive packaging, not for peak steady-state throughput.

## MiniMax M2.5

### Policy closeout

From `2026-03-01_224347_minimax_policy_closeout` and paired closeout runs.

| Scenario | `rtr=off` | `rtr=auto` |
|---|---:|---:|
| `tg32` | `0.618850` | `0.553629` |
| `pg32,4` | `1.277317` | `1.316512` |

Operational meaning:

1. `TG-only` still leans toward `off`.
2. Mixed path now has a real `auto` branch on the fixed tree.

### Locality confirm (`tail-window=16`)

From `2026-03-03_001015_minimax_locality_confirm`, `rtr=auto`, `t=16`, `fa=1`, `r=3`.

| Scenario | Test | baseline | `tail-window=16` |
|---|---|---:|---:|
| `tg128` | `tg128` | `1.332637` | `1.282882` |
| `pg512,128` | `pp512` | `8.557544` | `8.162181` |
| `pg512,128` | `tg128` | `1.260793` | `1.246305` |
| `pg512,128` | `pp512+tg128` | `3.991484` | `4.030163` |

Operational meaning:

1. `tail-window=16` kept only a small positive mixed signal.
2. It regressed `TG128` and prompt-side larger-workload behavior.
3. It remains research-only and is not a new baseline.

---

## 3. Current Practical Conclusions

### Qwen3MoE

- use `t=16`
- use `fa=1`
- use `rtr=auto`
- treat `pg` separately from `tg`

### gpt-oss-20b

- use `t=16`
- use `fa=1`
- use `rtr=auto`
- use this March 3 baseline for future decode-side A/B

### gpt-oss-120b

- use `fa=1`
- start with `rtr=auto` if throughput matters more than startup cost
- compare against `off` only when conservative startup-sensitive packaging matters

### MiniMax

- treat `rtr=off` as the safest `TG-only` baseline
- for mixed path, `rtr=auto` is now a real branch
- do not promote larger hot-expert budgets or `tail-window=16` as defaults

---

## 4. What Is Closed vs Open

### Closed benchmark questions

1. `MiniMax off vs auto`
2. `MiniMax tail-window=16` as a candidate new baseline
3. `gpt-oss-120b off vs auto` throughput-first packaging question on the current tree

### Open next lines

1. `gpt-oss-20b` decode-side optimization
2. smarter `MiniMax locality` ideas beyond plain `tail-window=16`
3. optional fresh `Qwen3MoE` runtime refresh only if needed for a new comparison point

---

## 5. Related Source-of-Truth Notes

- `current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- `current/MINIMAX_OFF_VS_AUTO_CLOSEOUT_2026-03-02.md`
- `current/MINIMAX_LOCALITY_TAIL_WINDOW_2026-03-02.md`
