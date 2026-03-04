# Phase 3 Generalized Validation - 2026-03-03

## Purpose

This document is the source of truth for the first non-MiniMax `Phase 3` pass.

It answers:

- which generalized knobs were tested after `Phase 2`
- where generalized support already shows practical value
- where support exists but practical value is still weak or neutral

## Raw Artifacts

- `ik_llama.cpp/bench_results/2026-03-03_162813_phase3_validation`
- `ik_llama.cpp/bench_results/2026-03-04_061657_gptoss120b_prompt_packed_confirm`

## Scope

Models in this pass:

1. `gpt-oss-20b`
2. `gpt-oss-120b`
3. `Qwen3-30B-A3B`

MiniMax was intentionally deferred for a later dedicated window.

## Results

### 1. `Hot Expert Selection / Tail Window` on `gpt-oss-20b`

`pg128,32`

- baseline `pp128+tg32`: `79.594862`
- `full-prompt`: `79.246333`
- `tail-window=16`: `80.978128`

`tg128`

- baseline: `21.942375`
- `full-prompt`: `21.990312`
- `tail-window=16`: `22.013617`

Interpretation:

1. generalized `tail-window=16` is not a no-op outside MiniMax
2. the signal is positive but small
3. keep this as `partial / promising`, not a baseline change

### 2. `Prompt Packed QKV` on `gpt-oss-20b`

`pp512`

- baseline: `272.100196`
- `back-half`: `284.094653`

`pg512,128`

- baseline mixed: `87.285178`
- back-half mixed: `86.838406`

Interpretation:

1. prompt-side gain is real
2. mixed-path practical value remains neutral/slightly negative
3. this is not a family-level practical win for `20b`

### 3. `Prompt Packed QKV` on `gpt-oss-120b`

`pp512`

- baseline: `150.405577`
- `back-half`: `161.931084`

`pg512,128`

- baseline mixed: `56.995574`
- back-half mixed: `58.590794`

Interpretation:

1. this is a real positive practical signal
2. a later dedicated confirm run kept the branch positive, but at a more moderate level
3. the current honest status is:
- confirmed useful
- medium confidence
- not a family-wide default

### 3b. Dedicated confirm on `gpt-oss-120b`

From `2026-03-04_061657_gptoss120b_prompt_packed_confirm`, `t=16`, `fa=1`, `rtr=auto`, `muge=0`, `r=3`.

`pp512`

- baseline: `161.103907`
- `back-half`: `165.294421`

`pg512,128`

- baseline mixed: `60.379250`
- back-half mixed: `60.740783`

Interpretation:

1. the positive signal survives confirm
2. the branch is useful, but moderate rather than dominant
3. productization should treat this as a medium-confidence huge-model branch

### 4. `Prompt Packed QKV` on `Qwen3-30B-A3B`

`pp512`

- baseline: `284.994612`
- `front-half`: `311.178162`

`pg512,128`

- baseline mixed: `101.874129`
- front-half mixed: `102.146926`

Interpretation:

1. prompt-side gain is confirmed
2. mixed-path practical value is still weak
3. keep this as partial/neutral, not a promoted default

## Final Classification

### Confirmed useful

1. `Prompt Packed QKV` on `gpt-oss-120b`

### Partial / promising

1. `Hot Expert Selection / Tail Window` on `gpt-oss-20b`

### Neutral / weak practical value

1. `Prompt Packed QKV` on `gpt-oss-20b`
2. `Prompt Packed QKV` on `Qwen3-30B-A3B`

## What This Means Next

1. continue `Prompt Packed QKV` specifically for `gpt-oss-120b`, but as a medium-confidence huge-model branch
2. do not promote it as a family-wide default for all `gpt-oss`
3. keep `gpt-oss-20b` mainline work focused on decode-side optimization
4. keep `tail-window=16` as a promising but not yet baseline-worthy generalized MoE knob
