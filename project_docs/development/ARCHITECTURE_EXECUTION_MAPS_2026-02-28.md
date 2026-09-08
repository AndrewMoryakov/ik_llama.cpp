# Architecture Execution Maps

Updated: 2026-02-28

## Purpose

This document explains how the main target model families actually execute inside the current fork.

It is written for two audiences:

- developers who need concrete optimization targets
- readers who are new to `ik_llama`, but need to understand what is special about each model family

The goal is not to document every internal detail.

The goal is to answer:

- which code path each architecture uses
- why the architectures must not be optimized as if they were the same
- what is already measured
- what is still only a hypothesis

## Why This Matters

If we optimize all MoE models as if they behave the same way, we will get weak or misleading results.

That already happened in practice:

- `pg` and `tg` do not behave the same
- `Qwen3MoE` and `gpt-oss` do not behave the same
- `gpt-oss-20b` and `gpt-oss-120b` are the same family, but different performance regimes
- `MiniMax M2.5` has its own attention path constraints and its own `rtr` behavior

So the correct next step is architecture-specific execution mapping.

## How To Read This Document

For each family, this document answers four questions:

1. Which code path is used
2. What makes the architecture special
3. What is already benchmark-backed
4. Where the next optimization target probably is

## Quick Comparison

| Family | Main builder path | Current role in project | Main risk if treated generically |
|---|---|---|---|
| `Qwen3MoE` | `build_qwen3moe()` | validated in-RAM MoE baseline | overfitting mixed-path policy from `tg` only |
| `gpt-oss-20b` | `build_openai_moe()` | validated compute-oriented MoE baseline | missing decode-side and sliding-window effects |
| `gpt-oss-120b` | `build_openai_moe()` | validated memory-pressure subset | choosing policies from `20b` that fail under RAM pressure |
| `MiniMax M2.5` | `build_minimaxm2()` | supported + historically benchmarked swap-bound MoE | assuming generic attention and generic `rtr` behavior |

## 1. Qwen3MoE

### Code Entry Points

- builder: `ik_llama.cpp/src/llama-build-context.cpp`
- function: `build_qwen3moe()`
- dispatch: `ik_llama.cpp/src/llama-build-context.cpp`
- arch-specific runtime hooks: `ik_llama.cpp/src/llama.cpp`

### What This Path Does

At a high level:

1. build token embeddings
2. build standard attention per layer
3. build standard MoE FFN per layer
4. apply output head

Important practical detail:

- current validated `Qwen3MoE` runs are going through the generic split-QKV attention path, not a dedicated fused QKV fast path

This matters because it creates a large amount of attention projection work in prompt-like batches.

### What Is Special About Qwen3MoE

For the current validated representative:

- family: `Qwen3-30B-A3B`
- execution regime: mostly in-RAM on the target host
- attention path: generic split `Q/K/V`
- MoE path: standard MoE FFN

What we already confirmed:

- `flash_attn` materially helps mixed path
- `pg` must not be inferred from `tg`
- prompt-side packed-QKV experiments reduce prompt graph work, but do not yet produce a strong stable end-to-end `pg` win

### What This Means For Optimization

The current best interpretation is:

- the easy prompt-side graph reductions are partly real
- but they are not enough by themselves to move total `pg` strongly

So the next real target for `Qwen3MoE` is not more blind prompt repacking.

It is:

- decode-side mixed-path behavior
- or a larger architecture-specific attention-side improvement

### Current Confidence Level

High confidence:

- execution family identification
- `flash_attn` importance
- `pg` versus `tg` separation

Medium confidence:

- decode-side dominance as the next major target

Not yet validated:

- a stable public `Qwen3MoE` fast path

## 2. gpt-oss-20b

### Code Entry Points

- builder: `ik_llama.cpp/src/llama-build-context.cpp`
- function: `build_openai_moe()`
- dispatch: `ik_llama.cpp/src/llama-build-context.cpp`
- arch-specific runtime hooks: `ik_llama.cpp/src/llama.cpp`

### What This Path Does

At a high level:

1. build token embeddings
2. build standard attention per layer
3. apply sliding-window attention mask on part of the layers
4. build OpenAI-style MoE FFN per layer
5. apply output head

Important practical detail:

- this family also currently runs through the generic split-QKV path on the validated CPU baseline
- there is a sliding-window pattern in the attention path

### What Is Special About gpt-oss-20b

For the current validated representative:

- family: `gpt-oss-20b-MXFP4`
- execution regime: compute-oriented, mostly in-RAM
- attention path: generic split `Q/K/V`
- attention pattern: part of the layers are sliding-window
- MoE path: OpenAI MoE FFN variant

What we already confirmed:

- `flash_attn` helps mixed path
- `pg` behavior differs from `Qwen3MoE`
- prompt-side packing does not translate into a strong overall `pg` win here either

### What This Means For Optimization

`gpt-oss-20b` is currently the strongest candidate for the next architecture-specific optimization cycle.

Reason:

- it is cheap enough to iterate on
- it represents the `gpt-oss` family
- it already shows that generic prompt-side improvements are not sufficient

So the next likely target is:

- decode-side mixed-path profiling
- with special attention to sliding-window layers and decode tail behavior

### Current Confidence Level

High confidence:

- family path identification
- sliding-window presence
- `flash_attn` importance

Medium confidence:

- decode-side path is the next profitable target

Not yet validated:

- a stable public `gpt-oss-20b` fast path

## 3. gpt-oss-120b

### Code Entry Points

- same builder family as `gpt-oss-20b`: `build_openai_moe()`

### Why It Is Separate From 20b

The architecture family is the same.

The performance regime is not.

That difference is large enough that it must be treated separately.

For this project, `gpt-oss-120b` is not primarily a compute benchmark.

It is a memory-pressure and swap-bound benchmark.

### What This Means In Practice

For `120b`, the fork must be judged not only by:

- raw `t/s`

but also by:

- startup time
- memory behavior
- `rtr off/on/auto` policy
- stability under RAM pressure

### What Is Already Confirmed

For the current local work:

- `gpt-oss-120b` is used as the current validated huge-model stress subset
- `rtr auto` is part of the current serious policy discussion
- huge-model conclusions must not be copied from in-RAM cases

### What This Means For Optimization

The main target here is not a fancy compute micro-optimization first.

The main target is:

- stable huge-model runtime policy
- memory behavior that survives limited RAM

This makes `gpt-oss-120b` a release-relevant architecture family even if it is slower to benchmark.

### Current Confidence Level

High confidence:

- family identity
- need for separate memory-pressure treatment

Medium confidence:

- which exact huge-model policy package should become public guidance

Not yet validated:

- a finalized public huge-model optimization package

## 4. MiniMax M2.5

### Code Entry Points

- builder: `ik_llama.cpp/src/llama-build-context.cpp`
- function: `build_minimaxm2()`
- tensor loader: `ik_llama.cpp/src/llama-load-tensors.cpp`
- tensor creation helper: `create_minimaxm2_tensors()`
- arch dispatch/runtime: `ik_llama.cpp/src/llama.cpp`

### What Makes MiniMax Different

MiniMax M2.5 is not just "another MoE model".

Its attention path has an important special property:

- `Q` and `K` are normalized before RoPE

This is explicitly called out in the builder comments and is the reason the generic standard attention helper is not reused in the same way.

That matters because it limits how safely we can assume that optimizations from `Qwen3MoE` or `gpt-oss` transfer to MiniMax.

### What The Builder Does

At a high level:

1. build embeddings
2. build a custom self-attention path
3. normalize `Q` and `K` before RoPE
4. build KV path
5. build standard MoE FFN
6. apply output head

In split graph modes there is an extra constraint:

- the code intentionally keeps full `wq` and `wk` copies on each device because normalizing partial fragments before reassembly would hurt correctness or performance

That is a concrete architectural limitation, not a theory.

### What Is Already Measured

MiniMax is already present in the project's benchmark history.

What is currently backed by local stored results:

- `tg32` and `tg128`
- `pg512,128`
- `rtr0` versus `rtr1`
- swap-bound behavior on the local host

Current historical finding from stored local artifacts:

- old claim "`rtr` catastrophically hurts MiniMax" is no longer true for `tg` on the current code state that was measured
- but for mixed `pg512,128`, `rtr1` was still materially worse than `rtr0`

### What This Means For Release Positioning

MiniMax should be treated as:

- code-supported
- historically benchmarked
- relevant to project direction

But not yet as part of the tight current public validated loop unless it is rerun in the same fresh benchmark pass as the other release-facing families.

That is the honest position.

### What This Means For Optimization

MiniMax is a good target for:

- swap-bound runtime policy work
- architecture-aware attention-path analysis
- future custom quantization work

MiniMax is not a good target for blindly reusing `Qwen3MoE` or `gpt-oss` prompt-path conclusions.

### Current Confidence Level

High confidence:

- code support is real
- architecture-specific attention constraints are real
- swap-bound historical behavior is real

Medium confidence:

- current public runtime recommendation for MiniMax without a fresh rerun

Not yet validated:

- fresh release-facing MiniMax baseline in the current documentation pass

## Practical Rules From These Maps

1. Do not use `tg` alone to choose mixed-path policy.
2. Do not copy `Qwen3MoE` conclusions directly into `gpt-oss`.
3. Do not copy `gpt-oss-20b` conclusions directly into `gpt-oss-120b`.
4. Do not assume MiniMax can use the same attention-side optimization logic as generic split-QKV families.

## What Becomes The Next Optimization Priority

Based on the current evidence, the next order remains:

1. `gpt-oss-20b` decode-side mixed-path profiling and optimization
2. `gpt-oss-120b` huge-model runtime and memory-policy stabilization
3. `Qwen3MoE` next architecture-specific fast path
4. `MiniMax M2.5` fresh rerun plus architecture-aware swap-bound study

## Public-Safe Summary

The fork now has enough evidence to say:

- it supports several distinct MoE execution families
- those families do not behave the same
- architecture-specific optimization is not optional anymore

But it would still be wrong to claim:

- that all target families already have stable fast paths
- or that MiniMax has a fresh release-grade baseline in the current validation pass
