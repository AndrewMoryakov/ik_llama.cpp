# Project State For Agents - 2026-03-04

## Purpose

This is the fastest single-document state transfer for a new LLM agent.

Read this first if you need to understand:

1. what the project is optimizing for now
2. what is already settled
3. what is still open
4. what branch/workflow model is in use
5. what the next meaningful work should be

This is not a user tutorial and not a release post.

## Project Identity

This fork is not pursuing generic llama.cpp speed on small in-RAM models.

Current strategic target:

1. large CPU-only MoE
2. swap-bound / out-of-RAM execution
3. Zen4-aware runtime policy
4. practical throughput plus memory behavior, locality, paging, startup cost

The project should be reasoned about as:

- runtime policy engineering
- memory/locality engineering
- architecture-specific optimization

not only as kernel speed work.

## Main Model Families

Treat these as separate lines. Do not transfer conclusions mechanically.

1. `Qwen3MoE`
2. `gpt-oss-20b`
3. `gpt-oss-120b`
4. `MiniMax M2.5`

Important distinction:

- `gpt-oss-20b` and `gpt-oss-120b` are one family but two different performance regimes
- `20b` is the cleaner compute/runtime line
- `120b` is a huge-model / memory-pressure / throughput-vs-startup line

## Current Practical Truth

### Qwen3MoE

Current baseline:

1. `rtr=auto`
2. `flash_attn=on`
3. mixed-path (`pg`) must be measured separately from `tg`

Prompt-packed work exists, but current practical value is weak-to-neutral for mixed path.

### gpt-oss-20b

Current baseline:

1. `rtr=auto`
2. `flash_attn=on`
3. use March 3 baseline numbers, not older February-only numbers

Current important findings:

1. `Prompt Packed QKV` improves prompt-side throughput
2. practical mixed-path value is still neutral/slightly negative
3. `tail-window=16` / hot-expert line has a weak positive signal, but not enough for a baseline change

Meaning:

- do not treat prompt-packed as the next mainline win for `20b`
- next real line for `20b` should be decode-side optimization

### gpt-oss-120b

Current baseline:

1. `rtr=auto` is the throughput-first mode
2. `rtr=off` matters mainly for more conservative startup-sensitive packaging

Current most important result:

`Prompt Packed QKV back-half` is now:

1. confirmed useful
2. medium confidence
3. not a family-wide default

Meaning:

- this is currently the strongest practical branch among recent generalized experimental paths
- it is worth productization later
- but it must remain specific to `gpt-oss-120b`, not generalized to all `gpt-oss`

### MiniMax M2.5

MiniMax is a primary line, not a side case.

Current practical truth:

1. `TG-only`: safest baseline still leans to `rtr=off`
2. mixed path: `rtr=auto` is now a real viable branch after the fixed policy bug
3. `IK_LLAMA_HOT_EXPERT_BUDGET` should remain unset in normal use
4. larger hot-expert budgets are research-only
5. `tail-window=16` is not a new baseline

Meaning:

- MiniMax policy questions are mostly closed for now
- the next MiniMax line is smarter locality / paging / expert-selection, not re-running the same budget and RTR questions blindly

## What Is Already Settled Enough

Do not re-open these without a new hypothesis.

1. `pg` must not be inferred from `tg` alone
2. `flash_attn` matters materially for mixed path
3. `rtr=auto` is already the strong start for `Qwen3MoE` and `gpt-oss`
4. MiniMax hot-expert `24/32` is not a new default
5. MiniMax `tail-window=16` is not a new baseline
6. `Prompt Packed QKV` is not a universal winner for every split-QKV model

## Current Phase Model

### Phase 1

Closed.

Purpose:

- establish semantic model for experimental knobs

Canonical distinctions:

1. `Applicability`
2. `Runtime support today`
3. `Validation`
4. `Confidence`

### Phase 2

Closed on bounded scope.

Purpose:

- move class-capable experimental knobs from family-first runtime paths toward class-capable runtime support

Key delivered slices:

1. `Hot Expert Selection / Tail Window`
2. `Hot Expert Budget / Budget Mult`
3. `Prompt Packed QKV` manual path for `Split-QKV`

Important rule preserved:

- family-specific defaults remain intact even when manual/experimental support is widened to a model class

### Phase 3

Partially executed and currently at a natural stopping point.

Purpose:

- validate generalized knobs with targeted A/B

Important current outcomes:

1. `Prompt Packed QKV back-half` on `gpt-oss-120b`:
   - confirmed useful
   - medium confidence

2. `Prompt Packed QKV` on `gpt-oss-20b`:
   - prompt-side gain only
   - weak practical mixed-path value

3. `Prompt Packed QKV` on `Qwen3-30B-A3B`:
   - prompt-side gain
   - weak mixed-path value

4. `Tail Window` on `gpt-oss-20b`:
   - weak positive signal
   - still partial / promising only

Meaning:

- `gpt-oss-120b` is the only current strong productization candidate from this line
- `gpt-oss-20b` should move to decode-side optimization instead of more prompt-packed tuning

### Phase 4

Not started as an active mainline phase yet.

Expected content:

1. `MiniMax locality / paging / expert-selection`
2. `gpt-oss-20b decode-side optimization`
3. other architecture-specific lines only when evidence supports them

### Phase 5

Productization.

Expected content:

1. presets
2. dashboard guidance
3. tutorial/docs/replay/live product layer

### Phase 6

Release-facing stabilization.

Expected content:

1. validated vs experimental matrix
2. clean claims
3. milestone snapshots
4. public-facing packaging

## Data-Driven Evidence Layer

This is now a core product architecture concept.

Definition:

- benchmark truth is recorded in benchmark docs and raw run dirs
- dashboard/product semantics are derived from a central evidence registry

Canonical runtime/product source:

- `dashboard/evidence-layer.js`

What it now covers:

1. experimental knobs
2. experimental presets
3. standard presets
4. runtime profiles / family-regime guidance
5. overview summaries
6. overview next-actions
7. model badges/status line

Why this matters:

- new findings should be integrated as data updates
- not as new hardcoded product logic spread across `dashboard.js`

## Branch / Workflow Model

Use this model.

1. `main`
- release-facing branch

2. `dev`
- integration branch

3. `feature/*`
- bounded implementation work

4. `research/*`
- hypothesis-driven work

5. `milestone/*`
- frozen reference snapshots

6. `safety/*`
- create only before risky history-rewrite or destructive git operations

Current relevant branches from recent work:

1. `feature/runtime-generalization`
2. `feature/gptoss120b-prompt-packed-confirm`
3. `research/expert-selection`

## Current Best Next Work

If the goal is the next practical mainline step, the recommended order is:

1. `gpt-oss-120b prompt-packed productization`
2. `gpt-oss-20b decode-side optimization`
3. return to `MiniMax` only with a new smarter locality hypothesis or a dedicated large benchmark window

## What “Productization” Means Here

For `gpt-oss-120b prompt-packed back-half`, productization means:

1. keep class-level availability broad
2. keep confidence model-specific
3. do not promote it as a family-wide `gpt-oss` default
4. wire it into dashboard/docs/presets as:
   - confirmed useful
   - medium confidence
   - `gpt-oss-120b` specific practical branch

## What Not To Do Next

1. do not reopen closed MiniMax budget/default questions
2. do not promote `tail-window=16` to baseline
3. do not describe prompt-packed as a universal split-QKV winner
4. do not mix `gpt-oss-20b` and `gpt-oss-120b` confidence/product guidance
5. do not add new dashboard guidance that runs ahead of evidence

## Fast Read Map After This Document

Read next only as needed:

1. Benchmark truth:
- `../benchmarks/SUMMARY_ALL.md`

2. GPT-OSS current truth:
- `../benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`

3. MiniMax current truth:
- `../benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`

4. Phase 3 plan and open tail:
- `../strategy/PHASE3_VALIDATION_PLAN_2026-03-03.md`

5. Parameter-generalization rules:
- `../strategy/PARAMETER_GENERALIZATION_PRINCIPLES_2026-03-03.md`

6. Evidence layer definition:
- `../strategy/DATA_DRIVEN_EVIDENCE_LAYER_2026-03-03.md`

## Short Resume Instruction For A New Agent

If you are starting cold:

1. do not start with broad benchmarks
2. do not start by re-reading everything
3. assume:
   - Phase 1 closed
   - Phase 2 closed on bounded scope
   - Phase 3 yielded one strong branch: `gpt-oss-120b prompt-packed back-half`
4. first choose:
   - productize `gpt-oss-120b prompt-packed`
   - or start `gpt-oss-20b decode-side`

That is the current project state in one page.
