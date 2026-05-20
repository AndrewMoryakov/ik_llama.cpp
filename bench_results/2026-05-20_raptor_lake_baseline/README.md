# Raptor Lake laptop baseline placeholder

Placeholder for the first bench run on the i7-1360p / 16 GB laptop.
Populate after build via `build_raptor_lake.bat` succeeds and the first
smoke runs complete.

## What to capture per model

For each target model below, run:

```
.\build\bin\llama-cli.exe -m <path> -t 8 -fa 1 -rtr auto -ctk q8_0 -n 8 -p "Hi" --no-display-prompt
```

Capture from stderr/stdout:

1. The `--run-time-repack auto:` log line — shows decision (KEEP /
   disabled / disabled with uncertainty) and the byte numbers used.
2. The `llama_print_timings:` block at the end — load time, PP
   tok/s, TG tok/s, total time.

## Target model matrix

| Model                            | Status      | rtr=auto log | PP tok/s | TG tok/s | Notes |
|----------------------------------|-------------|--------------|----------|----------|-------|
| Generic 7B Q4_K_M                | not run     | TBD          | TBD      | TBD      |       |
| Generic 13B Q4_K_M               | not run     | TBD          | TBD      | TBD      |       |
| Gemma-4-E4B                      | not run     | TBD          | TBD      | TBD      | Path on disk: TBD |
| Gemma-4-26B-A4B                  | not run     | TBD          | TBD      | TBD      | Likely borderline |
| Qwen3.6-35B-A3B                  | not run     | TBD          | TBD      | TBD      | Swap-bound expected |
| GLM-4.7-Flash                    | not run     | TBD          | TBD      | TBD      | Quant TBD |

## Thread count sweep (Gemma-4-E4B once available)

| -t | PP tok/s | TG tok/s |
|----|----------|----------|
| 4  | TBD      | TBD      |
| 8  | TBD      | TBD      |
| 12 | TBD      | TBD      |
| 16 | TBD      | TBD      |

## llama-bench reference numbers

If `llama-bench` is needed for clean r=5 numbers:

```
.\build\bin\llama-bench.exe -m <path> -t <winning_t> -fa 1 -rtr 2 -p 512 -n 32 -r 5
```

Use `-rtr 2` (auto) to exercise the v3 placement-aware policy.
