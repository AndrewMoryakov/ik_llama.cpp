# Mixed Path Step 2a: Hypothesis Check (2026-02-28)

## Purpose
This note records the first round of targeted measurements after initial mixed-path tracing.

Goal:
- decide which classes of hypotheses remain worth pursuing
- reject or downgrade weak hypotheses before deeper instrumentation

## 1) What Was Measured

### A) Transition trace with `IK_LLAMA_PG_TRACE=1`
Models:
1. `Qwen3-30B-A3B-Q4_K_M`
2. `gpt-oss-20b-MXFP4`

Scenario:
- `pg512,128`

Measured internally:
- scheduler reset
- graph build
- graph alloc
- set_inputs
- compute
- first decode after prompt

### B) High-level A/B toggles
Models:
1. `Qwen3-30B-A3B-Q4_K_M`
2. `gpt-oss-20b-MXFP4`

Scenarios:
1. `tg128`
2. `pg512,128`

Toggles checked:
1. `graph_reuse` (`-gr 0/1`)
2. `fused_moe` (`-fmoe 0/1`)
3. `fused_up_gate` (`-no-fug 0/1`)
4. `flash_attn` (`-fa 0/1`)

## 2) Main Results

### A) Transition cost is real, but small
Observed on both Qwen and gpt-oss:
- prompt path rebuilds graph
- first decode after prompt also rebuilds once
- however, `build/alloc/reset/set_inputs` are tiny compared to `compute`

Interpretation:
- prompt -> decode boundary exists
- but it is not currently the main cost center

### B) `graph_reuse` is not the main lever for mixed-path throughput
Measured effect:
- `gr 0/1` produced only small changes in both `tg128` and `pg512,128`

Interpretation:
- graph reuse behavior is not the first optimization target

### C) `fused_moe` and `fused_up_gate` do not show dominant top-level impact here
Measured effect:
- `fmoe 0/1` and `no-fug 0/1` moved `pg` and `tg` only slightly in current in-RAM runs

Interpretation:
- this does not prove they are unimportant internally
- but it strongly suggests they are not the first macro bottleneck to attack for these two models under this profile

### D) `flash_attn` materially affects `pg`, much more than `tg`
Measured effect:
- Qwen:
  - `pg`: `fa1 103.59` vs `fa0 94.78`  -> strong `pg` gain
  - `tg`: `fa1 29.11` vs `fa0 28.54`   -> small `tg` gain
- gpt-oss:
  - `pg`: `fa1 88.90` vs `fa0 83.95`   -> meaningful `pg` gain
  - `tg`: `fa1 22.02` vs `fa0 22.29`   -> nearly flat

Interpretation:
- the mixed-path sensitivity is much stronger on the prompt/attention side than on TG-only
- this makes attention-side prompt compute the strongest current candidate class

## 3) What Hypotheses Are We Downgrading

### Downgraded Hypothesis 1
"Prompt -> first decode graph transition is the main bottleneck"

Status:
- downgraded

Why:
- the transition exists, but measured cost is too small relative to compute time

### Downgraded Hypothesis 2
"`graph_reuse` is the main mixed-path lever"

Status:
- downgraded

Why:
- top-level A/B impact is too small in current tests

### Downgraded Hypothesis 3
"Macro `fused_moe` / `fused_up_gate` toggles are the first thing to optimize"

Status:
- downgraded

Why:
- top-level gains are too small in current in-RAM tests

## 4) What Hypotheses Are Strengthened

### Strengthened Hypothesis 1
Prompt-side attention compute is a major mixed-path cost driver.

Why:
- `fa` changes `pg` meaningfully
- `fa` changes `tg` only slightly

### Strengthened Hypothesis 2
The next useful instrumentation should move closer to attention-side compute and prompt-path graph internals, not scheduler/transition bookkeeping.

## 5) Next Recommended Step
Proceed to second-wave instrumentation focused on:
1. prompt-side attention graph sections
2. prompt-side mask/setup cost around attention
3. path-specific build-context branches used during prompt processing

The next implementation step should therefore not be:
- graph reuse rewrite
- scheduler reset redesign

It should be:
- deeper prompt/attention-path measurement

## 6) Practical Conclusion
Current evidence says:
- mixed-path optimization should now move toward **compute-side prompt attention analysis**
- not toward graph-transition cleanup as the first target
