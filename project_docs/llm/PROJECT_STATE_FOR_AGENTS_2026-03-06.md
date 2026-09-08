# Project State For Agents - 2026-03-06

## Purpose

Fastest single-document state transfer for a new LLM agent.

Read this first. It supersedes `PROJECT_STATE_FOR_AGENTS_2026-03-04.md`.

## What Changed Since 2026-03-04

1. **Upstream sync merged** — fused delta-net AVX512, Qwen3.5 dense+MoE, MTP, parallel quantize
   - HEAD: `3e2036452` (post-merge commit on `dev`)
   - 4 conflicts resolved, build clean
   - SER (`-ser Kmin,t`) is now in `dev` — this is ikawrakow's upstream PR #239 feature

2. **New benchmark baseline (2026-03-06, Large Pages ON)**
   - gpt-oss-20b MXFP4: PP 281.2, TG 23.85 t/s (fa=1, rtr=auto, ctk=q8_0, t=16)
   - Qwen3-30B-A3B Q4_K_M: PP 316.8, TG 30.10 t/s
   - gpt-oss-120b MXFP4: PP 160.8, TG 17.07 t/s
   - ctv=q8_0: confirmed neutral, safe (saves V-cache memory)
   - ub=512 (default): confirmed optimal, do not change
   - Large Pages: confirmed active via SeLockMemoryPrivilege + MEM_LARGE_PAGES

3. **muge crash diagnosed** — `-muge` flag crashes (exit 127) on gpt-oss-20b MXFP4 on ALL tested
   commits including old `bd387a279`. Pre-existing issue, NOT regression from upstream merge.
   Likely Large Pages + muge allocation conflict. Use `muge=0` as baseline for gpt-oss-20b.

4. **Dashboard modular refactoring COMPLETE**
   - Phase A (tests): 115/115 tests pass (Vitest, vm-sandbox)
   - Phase B (modular split): 6 IIFE modules extracted from monolithic dashboard.js
   - dashboard.js: 4959 → 2604 lines
   - New files: dashboard-i18n.js, dashboard-help.js, dashboard-data.js, dashboard-rules.js,
     dashboard-command.js, dashboard-autoconfig.js
   - evidence-layer.js remains unchanged as canonical data source

5. **SER clarification** — SER (Smart Expert Reduction) is ikawrakow's upstream feature,
   NOT our custom code. Already merged into dev via upstream sync.
   Algorithm: always select top Kmin experts; include experts Kmin+1..K only if p_i > t*p_0.
   Usage: `-ser 4,0.15` for MiniMax (swap-bound); smaller gains for in-RAM models.

## Project Identity

This fork optimizes for:
1. Large CPU-only MoE inference
2. Swap-bound / out-of-RAM execution
3. Zen4-aware runtime policy
4. Practical throughput + memory behavior + locality + paging

Reason about it as runtime policy engineering + memory/locality engineering + architecture-specific
optimization, not only kernel speed work.

## Main Model Families

Treat as separate lines. Do not transfer conclusions mechanically.

| Family | Type | Status |
|--------|------|--------|
| Qwen3-30B-A3B | in-RAM MoE | Active, validated |
| gpt-oss-20b | in-RAM MoE | Active, decode-side next |
| gpt-oss-120b | huge-model MoE | Prompt-packed confirmed useful |
| MiniMax M2.5 | swap-bound MoE | On hold, needs new locality hypothesis |

## Current Practical Truth Per Family

### Qwen3MoE / Qwen3-30B-A3B

- `rtr=auto`, `flash_attn=on`, `ctk=q8_0`, `t=16`
- PP 316.8, TG 30.10 (Large Pages ON, 2026-03-06 baseline)
- Prompt-packed: prompt-side gain only, weak practical mixed-path value
- Do NOT use `-muge` (crashes on MXFP4 models)

### gpt-oss-20b

- `rtr=auto`, `flash_attn=on`, `ctk=q8_0`, `t=16`, `muge=0`
- PP 281.2, TG 23.85 (Large Pages ON, 2026-03-06 baseline)
- `-muge` flag: crashes, do not use
- Next line: decode-side optimization, NOT more prompt-packed tuning

### gpt-oss-120b

- `rtr=auto`, `flash_attn=on`, `ctk=q8_0`, `t=16`
- PP 160.8, TG 17.07 (Large Pages ON, 2026-03-06 baseline)
- `Prompt Packed QKV back-half`: confirmed useful, medium confidence, 120b-specific
- Not a family-wide default for all gpt-oss
- Productization in dashboard: still pending

### MiniMax M2.5

- `rtr=off` (TG-only safest), `rtr=auto` (mixed path viable after policy fix)
- `IK_LLAMA_HOT_EXPERT_BUDGET`: leave unset
- hot-expert budgets > 16: research-only
- tail-window=16: research-only
- SER (`-ser 4,0.15`): +48-65% TG swap-bound but quality trade-off, research-only
- MiniMax on hold: resume only with new locality hypothesis or dedicated window

## What Is Already Settled

Do not re-open without a new hypothesis:

1. `pg` must not be inferred from `tg` alone
2. `flash_attn` matters materially for mixed path
3. `rtr=auto` is the strong start for Qwen3MoE and gpt-oss
4. MiniMax hot-expert 24/32 is NOT a new default
5. MiniMax tail-window=16 is NOT a new baseline
6. Prompt Packed QKV is NOT a universal split-QKV winner
7. SMT must NEVER be disabled (TG: -16 to -90%)
8. CCD pinning HURTS (-5 to -11%) — OS scheduler is optimal
9. ub=512 is optimal for llama-bench
10. t=16 is optimal for all tested models (MoE TG drops at t>16)
11. `-muge` crashes on gpt-oss-20b MXFP4 (all commits, pre-existing)
12. ctv=q8_0 is safe — neutral perf, saves V-cache memory

## Current Phase Model

- **Phase 1**: CLOSED — semantic model (Applicability/Runtime support/Validation/Confidence)
- **Phase 2**: CLOSED — runtime generalization (Hot Expert, Budget Mult, Prompt Packed QKV)
- **Phase 3**: PARTIALLY EXECUTED at natural stopping point
  - gpt-oss-120b prompt-packed back-half: confirmed useful, medium confidence (STRONGEST RESULT)
  - gpt-oss-20b prompt-packed: prompt-side only, weak mixed-path
  - Qwen3-30B-A3B prompt-packed: prompt-side only, weak mixed-path
  - gpt-oss-20b tail-window=16: weak positive signal, partial
  - MiniMax validation: deferred
- **Phase 4**: NOT STARTED — MiniMax locality/paging, gpt-oss-20b decode-side
- **Phase 5**: IN PROGRESS — productization (dashboard modular refactoring DONE; evidence-layer.js update pending)
- **Phase 6**: NOT STARTED — release-facing stabilization

## Data-Driven Evidence Layer

Canonical runtime/product source: `dashboard/evidence-layer.js`

New findings → update evidence-layer.js, not hardcode in dashboard.js.

Covers: experimental knobs, experimental presets, standard presets, runtime profiles,
overview summaries, model badges.

Dashboard is now modular (Phase B complete) — modules load before main dashboard.js.

## Branch / Workflow Model

- `main` — release-facing
- `dev` — integration branch (HEAD: `3e2036452`, upstream-synced 2026-03-04)
- `feature/*` — bounded implementation work
- `research/*` — hypothesis-driven work
- `milestone/*` — frozen reference snapshots

Active branches: `feature/runtime-generalization`, `feature/gptoss120b-prompt-packed-confirm`,
`research/expert-selection`

## Current Best Next Work

1. **gpt-oss-120b prompt-packed productization** — wire confirmed result into evidence-layer.js
   (update confidence, add model-specific preset badge)
2. **gpt-oss-20b decode-side optimization** — move to decode profiling
3. **MiniMax** — on hold unless new locality hypothesis or dedicated benchmark window

## What Not To Do Next

1. Do not reopen closed MiniMax budget/default questions
2. Do not promote tail-window=16 to baseline
3. Do not describe prompt-packed as a universal split-QKV winner
4. Do not mix gpt-oss-20b and gpt-oss-120b confidence/product guidance
5. Do not add new dashboard guidance that runs ahead of evidence
6. Do not use `-muge` flag anywhere

## Fast Read Map After This Document

1. Benchmark truth: `../benchmarks/current/BASELINE_2026-03-06.md`
2. GPT-OSS current truth: `../benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
3. MiniMax current truth: `../benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
4. Dashboard product layer: `../dashboard/PRODUCT_GUIDE.md`
5. Evidence layer spec: `../strategy/DATA_DRIVEN_EVIDENCE_LAYER_2026-03-03.md`

## Short Resume Instruction For A New Agent

Starting cold:

1. Phase 1, 2 closed. Phase 3 yielded one strong branch: gpt-oss-120b prompt-packed back-half.
2. Dashboard modular refactoring complete (115 tests green, 6 modules extracted).
3. Upstream sync merged (fused delta-net, Qwen3.5, SER).
4. New baselines from 2026-03-06 with Large Pages ON.
5. First priority: productize gpt-oss-120b prompt-packed in evidence-layer.js.
6. Second priority: gpt-oss-20b decode-side profiling.
