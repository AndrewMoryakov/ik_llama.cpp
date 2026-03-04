# Experimental Matrix

This document lists code paths and ideas that are real, usable for engineering work, but not yet promoted as stable release-facing features.

## Experimental Runtime / Engine Paths

| Item | Status | Why it stays experimental |
|---|---|---|
| prompt packed-QKV path | real code path | practical value is model/regime-dependent; not a universal default |
| packed-QKV presets and ranges | real code path | useful for research and targeted productization, not a stable default for all compatible models |
| packed-QKV arena | real code path | improves locality structure, but not a closed public win |
| deep mixed-path tracing | engineering tooling | for profiling, not a user-facing feature |
| layer scoring / exec-layer tracing | engineering tooling | useful for diagnosis, not release behavior |

## Experimental MiniMax Paths

| Item | Status | Why it stays experimental |
|---|---|---|
| `IK_LLAMA_HOT_EXPERT_BUDGET` overrides | real tuning knob | long-run evidence did not justify promoting a new default |
| large MiniMax hot-expert budgets (`24/32`) | rejected as default candidate | quick-check signal did not survive the longer controlled run |
| `MiniMax tail-window=16` | research-only | realistic confirm kept only a weak mixed-path signal and regressed other metrics |

## Experimental Family- and Regime-Specific Branches

| Item | Status | Why it stays experimental |
|---|---|---|
| `Prompt Packed QKV back-half` on `gpt-oss-120b` | confirmed useful, medium confidence | practical value is real, but moderate and model/regime-specific |
| `Prompt Packed QKV` on `gpt-oss-20b` | partial / low-confidence | prompt-side gain exists, but mixed-path benefit is weak |
| `Prompt Packed QKV` on `Qwen3-30B-A3B` | partial / low-confidence | prompt-side gain exists, but mixed-path benefit is almost neutral |
| `Tail Window / Hot Expert Selection` outside `MiniMax` | partial / low-confidence | path is generalized, but validation remains weak outside tested cases |

## Experimental Claims To Avoid

1. "prompt packed-QKV is a stable public acceleration feature"
2. "MiniMax now has a validated better hot-expert default than legacy `16`"
3. "all large MoE families now have mature architecture-specific presets"
4. "custom quantization line is already benchmark-closed"
5. "`Prompt Packed QKV` is equally useful across all `Split-QKV` families"

## How To Use This Layer

1. Keep it in the private lab.
2. Use it for profiling and controlled A/B work.
3. Do not let moderate or family-specific wins silently become family-wide defaults.
