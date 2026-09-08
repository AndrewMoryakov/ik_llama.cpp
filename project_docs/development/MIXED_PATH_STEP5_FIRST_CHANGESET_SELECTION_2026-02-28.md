# Mixed Path Step 5: First Change-Set Selection

Date: 2026-02-28

## Goal

Choose the first real engine change-set for mixed-path optimization on the currently validated Zen4 MoE targets.

This step is about narrowing from:

- "attention path is important"

to:

- "which specific attention-side modification should be attempted first"

## Inputs from previous steps

Already confirmed:

1. `pg` is not mainly limited by scheduler reset or graph transition overhead
2. `pg` sensitivity is attention-side, not structural MoE-side
3. current validated models use generic attention path
4. current validated models do **not** use split fast path
5. current validated models use separate `wq/wk/wv` in every attention layer

References:

- `project_docs/development/MIXED_PATH_STEP3_ATTENTION_TRACE_2026-02-28.md`
- `project_docs/development/MIXED_PATH_STEP4_GENERIC_ATTN_PATH_2026-02-28.md`

## Quantitative narrowing

From current graph summaries:

### Qwen3-30B-A3B-Q4_K_M

- total prompt-side `mul_mat` nodes: `241`
- attention layers: `48`
- split QKV layout in all layers: `48`

Minimum attention-projection `mul_mat` count:

- `48 layers * 4` projections (`Q`, `K`, `V`, `WO`) = `192`

Share:

- `192 / 241 = 79.7%`

### gpt-oss-20b-MXFP4

- total prompt-side `mul_mat` nodes: `121`
- attention layers: `24`
- split QKV layout in all layers: `24`

Minimum attention-projection `mul_mat` count:

- `24 layers * 4` projections (`Q`, `K`, `V`, `WO`) = `96`

Share:

- `96 / 121 = 79.3%`

## Main conclusion

For the current mixed-path targets, the dominant attention-side `mul_mat` footprint is not in flash attention itself.

It is in the projection stack:

1. `WQ * X`
2. `WK * X`
3. `WV * X`
4. `WO * Attn`

This means the first serious optimization candidate is no longer generic “attention”.

It is:

- reducing projection overhead in the split-QKV prompt path

## Candidate options considered

### Option A. Scheduler / graph reuse work

Status:

- rejected as first patch

Why:

- already measured to be too small relative to `compute`

### Option B. MoE routing / fused-up-gate work

Status:

- rejected as first patch

Why:

- structural MoE node counts do not explain current `pg` behavior

### Option C. Generic flash-attn kernel changes

Status:

- possible later, but not the first patch

Why:

- flash attention matters
- but current graph evidence says the larger prompt-side matmul footprint is in projections, not only in the attention kernel itself

### Option D. Packed prompt-QKV path for split-projection models

Status:

- selected as the best first candidate

Why:

1. current validated models use split QKV in all attention layers
2. split fast path is not used
3. the majority of prompt-side `mul_mat` nodes appear to be projection-related
4. this candidate directly targets the dominant repeated structure in the prompt graph

## What this candidate means

Proposed first engine direction:

- add an optional prompt-oriented packed/fused projection path for models that currently expose separate `wq/wk/wv`
- use it only where it is likely to help:
  - CPU
  - prompt-heavy or mixed path
  - split-QKV models

Practical interpretation:

- instead of paying three separate prompt projections in every attention layer, prepare a path that behaves more like a fused QKV read/compute layout for prompt processing

## Compatibility and constraints

This candidate must preserve:

1. model compatibility
2. existing runtime modes
3. `Q / IQ / UD-Q` support
4. current CLI behavior unless an additive opt-in flag is introduced

Important constraint:

- this fork explicitly cares about RAM pressure
- so any packed-QKV strategy that duplicates too much data is not automatically acceptable

## RAM tradeoff

Rough engineering estimate:

- packed prompt-QKV likely adds on the order of a few hundred MiB, not multiple GiB, for the currently validated models
- this looks potentially acceptable on the current host, but must be measured explicitly before making it a default path

This means:

- the candidate is viable
- but should begin as experimental/additive, not as unconditional default behavior

## Selected first change-set

The first real mixed-path engine patch should target:

1. split-QKV prompt attention path
2. generic builders currently used by:
   - `Qwen3-30B-A3B-Q4_K_M`
   - `gpt-oss-20b-MXFP4`
3. likely touchpoints:
   - `ik_llama.cpp/src/llama-build-context.cpp:1720`
   - `ik_llama.cpp/src/llama-build-context.cpp:1439`
   - `ik_llama.cpp/src/llama-build-context.cpp:1662`

## What should not be done first

1. large MoE rewrites
2. scheduler redesign
3. generic flash-attn kernel surgery without first reducing split-QKV projection cost

## Immediate next action

Before implementation:

1. estimate actual RAM cost of a prompt-packed-QKV path more precisely
2. decide whether it should be:
   - debug/experimental
   - runtime opt-in
   - tied to repack/on/auto policy

Then implementation can start with a narrow scope:

1. prompt-only
2. CPU-only
3. split-QKV models only
4. benchmarked first on `pg512,128`

## Status

The first change-set is now selected with sufficient justification:

- not a generic mixed-path guess
- not a policy change
- but a concrete engine target:
  - packed prompt-QKV for split-projection attention paths
