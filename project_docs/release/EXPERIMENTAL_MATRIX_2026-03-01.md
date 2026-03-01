# Experimental Matrix

This document lists code paths and ideas that are real, usable for engineering work, but not yet promoted as stable release-facing features.

## Experimental Runtime / Engine Paths

| Item | Status | Why it stays experimental |
|---|---|---|
| prompt packed-QKV path | real code path | end-to-end user-facing win is too weak for promotion |
| packed-QKV presets and ranges | real code path | useful for research, not validated as a stable default |
| packed-QKV arena | real code path | improves locality structure, but not a closed public win |
| deep mixed-path tracing | engineering tooling | for profiling, not a user-facing feature |
| layer scoring / exec-layer tracing | engineering tooling | useful for diagnosis, not release behavior |

## Experimental MiniMax Paths

| Item | Status | Why it stays experimental |
|---|---|---|
| `IK_LLAMA_HOT_EXPERT_BUDGET` overrides | real tuning knob | long-run evidence did not justify promoting a new default |
| large MiniMax hot-expert budgets (`24/32`) | rejected as default candidate | quick-check signal did not survive the longer controlled run |
| current `MiniMax rtr=auto` branch | pending closeout | policy bug is fixed, but final long `off vs auto` closeout is still pending |

## Experimental Claims To Avoid

1. "prompt packed-QKV is a stable public acceleration feature"
2. "MiniMax now has a validated better hot-expert default than legacy `16`"
3. "all large MoE families now have mature architecture-specific presets"
4. "custom quantization line is already benchmark-closed"

## How To Use This Layer

1. Keep it in the private lab.
2. Use it for profiling and controlled A/B work.
3. Do not let it silently become the public story of the fork.
