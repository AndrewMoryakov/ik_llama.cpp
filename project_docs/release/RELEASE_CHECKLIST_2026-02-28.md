# Release Checklist

## Purpose

This is the minimal checklist required before calling the current state a respectable public milestone.

It is intentionally short.

The goal is not to block progress with bureaucracy, but to avoid publishing a release that still looks like an internal notebook.

## 1. Scope

- Confirm the public target scope explicitly:
  - `Qwen3MoE`
  - `gpt-oss-20b`
  - `gpt-oss-120b`
  - Zen4 CPU path

## 2. User-Facing Wins

- At least one strong architecture-specific improvement is closed and documented.
- The improvement is benchmark-backed and reproducible.

## 3. Minimal Validation Matrix

- `Qwen3-30B-A3B-Q4_K_M`
  - `pp512`
  - `tg128`
  - `pg512,128`
- `gpt-oss-20b-MXFP4`
  - `pp512`
  - `tg128`
  - `pg512,128`
- `gpt-oss-120b-MXFP4`
  - `tg128`
  - `pg512,128`
  - load probe subset

## 4. Stable Versus Experimental

- Stable features are listed explicitly.
- Experimental features are listed explicitly.
- Experimental features are not described as defaults.

## 5. Release Docs

- Current status doc exists.
- Validated scope doc exists.
- Stable vs experimental doc exists.
- Benchmark summary is current enough for the release.
- Runbook is current enough for the release.

## 6. Public Messaging

- Release notes can answer:
  - what got better
  - for which models
  - on which hardware
  - what is still experimental

## 7. Sanity Of Code State

- No obviously abandoned half-integrated code in the release path
- Experimental code paths are clearly gated
- No accidental user-facing behavior changes without documentation
