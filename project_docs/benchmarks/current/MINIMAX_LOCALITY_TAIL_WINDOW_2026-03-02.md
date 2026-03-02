# MiniMax Locality: Tail-Window A/B (2026-03-02)

## Goal

Check a narrow MiniMax-specific hypothesis:

- current hot-expert selection uses the full prompt
- for `mixed` workloads, the last prompt tokens may predict early decode better
- therefore a small `tail-window` may improve `PG` without increasing the hot-expert budget

This is a short research pass, not a new default.

## Code under test

- branch: `feature/minimax-locality`
- change: env-gated MiniMax hot-expert selection mode
  - `IK_LLAMA_HOT_EXPERT_SELECTION=tail-window`
  - `IK_LLAMA_HOT_EXPERT_TAIL_WINDOW=<N>`

Current implementation:

- resets expert-hit accumulation at the prompt tail boundary
- leaves the one-time lock mechanism unchanged
- only affects `LLM_ARCH_MINIMAX_M2`

## Benchmark

Model:

- `D:\ggufs\un\minimax2.5-m2\MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005.gguf`

Command shape:

```powershell
build/bin/llama-bench.exe -m <model> -t 16 -fa 1 -rtr auto -muge 0 -pg 32,4 -r 1 -w 1 -o json
```

Compared runs:

1. `baseline_full_prompt`
2. `tail_window_16`

Run dir:

- `bench_results/2026-03-02_minimax_tail_window16_pg32_4_ab`

## Results

| Test      | Baseline | Tail-Window 16 | Delta |
|-----------|----------|----------------|-------|
| `pp512`   | `6.710563` | `7.871003`   | `+17.29%` |
| `tg128`   | `1.160309` | `1.141644`   | `-1.61%` |
| `pp32+tg4`| `1.244988` | `1.260103`   | `+1.21%` |

## Interpretation

1. The mixed-path signal is positive but small.
- `pp32+tg4` improved by about `+1.2%`

2. `TG-only` did not improve.
- `tg128` regressed by about `-1.6%`

3. The strong `pp512` gain is directional, not yet enough for a conclusion by itself.
- it says the tail-window logic changes prompt-side expert selection materially
- it does **not** automatically justify a new default

## Current conclusion

This hypothesis is still viable.

What is supported by this short pass:

1. `tail-window=16` is worth further investigation for `MiniMax mixed-path`
2. there is no evidence yet that it should affect `TG-only` policy
3. this is still research-only and must remain env-gated

## Next step

Do not run a large matrix yet.

Best next step:

1. improve telemetry around `prompt -> decode` expert overlap
2. if the overlap signal supports it, run one longer confirm pass for:
   - baseline full prompt
   - `tail-window=16`

