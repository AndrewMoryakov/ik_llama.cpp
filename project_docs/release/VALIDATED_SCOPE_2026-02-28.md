# Validated Scope

## Purpose

This document states what is currently validated enough to be shown publicly without overclaiming.

It does not list every supported feature in the codebase.

It lists the part of the fork state that is currently backed by recent local measurements and review.

## Host

Primary validation host:

- AMD Ryzen 9 7950X
- Zen4
- 96 GB RAM
- Windows

## Model Families In Current Validation Loop

### 1. Qwen3MoE

Validated representative:

- `Qwen3-30B-A3B-Q4_K_M`

Why it matters:

- good in-RAM MoE representative
- useful for `pp`, `tg`, `pg` comparisons

### 2. gpt-oss

Validated representatives:

- `gpt-oss-20b-MXFP4`
- `gpt-oss-120b-MXFP4` subset / stress regime

Why they matter:

- `20b` is the main compute-oriented `gpt-oss` case
- `120b` is the large-model memory-pressure case

## Model Families In Research Scope But Not In Tight Current Public Validation

### MiniMax M2.5

Current honest status:

- supported in code
- historically benchmarked on this host
- partially refreshed on `2026-02-28`, but not yet with a full controlled `off/on/auto` rerun set
- relevant to project direction
- not rerun yet in the same fresh release-facing validation pass as the current Qwen3MoE and `gpt-oss` set

Why this distinction matters:

- MiniMax has architecture-specific attention behavior
- MiniMax also has its own `rtr` behavior, especially in swap-bound mixed-path runs
- so it should not be omitted from research scope
- but it should also not be overclaimed as part of the tight current public validation set without a fresh rerun

## Benchmark Modes Considered Validated

Current validated benchmark modes:

- `pp512`
- `tg128`
- `pg512,128`

These are the modes used to support current conclusions about:

- `rtr auto`
- `flash_attn`
- mixed-path behavior
- architecture-specific differences

## Runtime Policy Findings Considered Validated

### 1. `flash_attn`

For current Zen4 + validated MoE cases:

- `-fa 1` is important for mixed-path performance

### 2. `rtr auto`

For current validated MoE cases:

- `auto` is a credible default policy
- especially for mixed path and MoE runtime behavior

### 3. `pg` versus `tg`

This is considered validated:

- `pg` must not be inferred from `tg` alone

## Experimental But Real

The following are real code paths, but still experimental:

- prompt packed-QKV path
- layer-range packed-QKV policy
- packed-QKV preset policy
- prompt packed-QKV arena
- deep mixed-path tracing helpers

They are useful for engineering work, but are not yet validated as public defaults.

## Not Yet Claimed As Validated

The following should not yet be presented as settled public claims:

1. A stable architecture-specific fast path for `Qwen3MoE`
2. A stable architecture-specific fast path for `gpt-oss-20b`
3. A finalized huge-model optimization package for `gpt-oss-120b`
4. New custom quantization performance claims

## Public-Safe Summary

Current public-safe scope is:

- Zen4-focused MoE optimization work
- benchmark-backed runtime-policy improvements
- benchmark-backed mixed-path analysis
- validated comparison work on:
  - `Qwen3-30B-A3B-Q4_K_M`
  - `gpt-oss-20b-MXFP4`
  - `gpt-oss-120b-MXFP4` subset
- research-backed but not freshly rerun in the same pass:
  - `MiniMax M2.5`
