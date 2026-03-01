# RTR Policy (`off/on/auto`)

## Purpose
This document explains how to choose `--run-time-repack` mode in `ik_llama.cpp`.

Modes:
- `off`
- `on`
- `auto`

This is not a generic theoretical guide. It reflects the current validated direction on:
- Ryzen 9 7950X
- 96 GB RAM
- Windows
- current benchmark set documented in `current/SUMMARY_CURRENT_2026-02-27.md`

## What `rtr` Changes
`rtr` affects two important things:
1. Steady-state throughput
2. Startup/load-time cost

This is why one mode can be best for throughput but worse for startup.

## Current Rule Of Thumb
Default recommendation:
- use `auto`

Why:
- In current benchmark sets, `auto` is the best or nearly-best throughput mode in both:
  - in-RAM
  - swap-bound
- It also preserves the option to make runtime policy smarter over time.

## Policy Table

| Situation | Recommended mode | Why |
|---|---|---|
| In-RAM, mixed workload (`pg`) | `auto` | Best current default, avoids manual guesswork |
| In-RAM, TG-only | `auto` or `on` | Current difference is small; both are strong |
| In-RAM, PP-heavy | `auto` | Best current default in aggregate |
| Swap-bound, throughput-first | `auto` | Best current default in current data |
| Swap-bound, startup-sensitive | `off` | Load/start can be much shorter |
| Diagnostic A/B test | `off`, `on`, `auto` | Needed to see tradeoff directly |

## What `auto` Means In Practice
`auto` is a runtime policy mode, not a new model format.

What it does:
- keeps backward compatibility with existing model support
- allows runtime to apply logic depending on model size and memory regime

What it does not do:
- it does not remove `off`
- it does not remove `on`
- it does not break old command lines

## Why `off` Still Exists
`off` is still useful for:
1. startup-sensitive runs
2. debugging
3. validating whether repack itself is helping or hurting
4. environments where throughput matters less than initial load time

`off` is not obsolete. It is just not the best general default in current measured results.

## Why `on` Still Exists
`on` is still useful for:
1. direct A/B against `auto`
2. verifying whether `auto` tracks the best throughput behavior
3. forcing the repack path when testing regressions or implementation changes

## Important Caveat
Current swap-bound evidence is based on current locally available large model coverage.

What is solid:
- `auto/on` beat `off` in throughput on the tested very large model
- `off` can have much better load/start wall time

What is still incomplete:
- full repeated (`r>=3`) swap-bound matrix is expensive and not yet complete
- MiniMax-specific updated local rerun was not possible because the artifact was not found in local storage during this pass

## What Users Should Actually Do
If you just want a sane default:

```bash
--run-time-repack auto
```

If the model is huge and you care most about startup time:

```bash
--run-time-repack off
```

If you are doing performance validation:

```bash
--run-time-repack off
--run-time-repack on
--run-time-repack auto
```

Run all three on:
- `tg128`
- `pg512,128`

## Backward Compatibility
Compatibility status:
- preserved

Why:
- `auto` is additive
- old `off/on` workflows still work
- model support for `Q`, `IQ`, `UD-Q` remains in scope

## Canonical References
- `project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-27.md`
- `project_docs/runbooks/MOE_RUNTIME_PROFILES.md`
