# Release Candidate Inventory

## Purpose

This document answers a practical question:

- if we wanted to assemble a respectable public milestone from the current fork state, what exactly would go into it?

The answer is divided into three groups:

1. ready for milestone
2. experimental but keep in tree
3. not suitable for release-facing scope yet

This is not a full technical history.

It is a packaging document.

## Current Verdict

The fork is not a raw draft anymore.

But the current working tree is still too mixed to present as a clean release candidate without explicit scope selection.

So the correct approach is:

- define a narrow milestone scope
- present only the benchmark-backed part of the work
- keep the research infrastructure, but do not oversell it

## 1. Ready For Milestone

These items are already strong enough to include in a public milestone story.

### A. Runtime repack auto-policy

Include:

- `--run-time-repack auto`
- CLI support
- API support
- `llama-bench` support

Why it is ready:

- implemented in code
- benchmark-backed
- easy to explain
- relevant to MoE on limited RAM

### B. Mixed-path benchmark discipline

Include:

- `pp / tg / pg` benchmark framing
- explicit warning that `pg` must not be inferred from `tg`
- benchmark scripts and stored result corpus

Why it is ready:

- this is already part of the engineering reality of the fork
- it is a methodological improvement, not just an internal note

### C. Zen4 runtime guidance

Include:

- `t=16` as current safe starting point on the validated host
- `-fa 1` as current preferred mixed-path setting
- `--run-time-repack auto` as current serious default candidate

Why it is ready:

- directly useful to users
- benchmark-backed on the target host

### D. Architecture-specific framing

Include:

- `Qwen3MoE` and `gpt-oss` should not be treated as identical
- `gpt-oss-20b` and `gpt-oss-120b` are different performance regimes
- `MiniMax M2.5` is a supported and relevant family, but not yet in the tight current public validation loop

Why it is ready:

- this is already grounded in code and benchmark evidence
- it prevents misleading claims

### E. Release-facing documentation set

Include:

- `project_docs/release/CURRENT_STATUS_2026-02-28.md`
- `project_docs/release/VALIDATED_SCOPE_2026-02-28.md`
- `project_docs/release/STABLE_VS_EXPERIMENTAL_2026-02-28.md`
- `project_docs/release/CHANGELOG_MILESTONE_2026-02-28.md`
- `project_docs/release/RELEASE_CHECKLIST_2026-02-28.md`
- `project_docs/development/ARCHITECTURE_EXECUTION_MAPS_2026-02-28.md`

Why it is ready:

- these docs already turn the project into something a third party can understand

## 2. Experimental But Keep In Tree

These items should remain in the repository and in engineering discussion, but not be presented as stable public features.

### A. Prompt packed-QKV path

Keep:

- code path
- benchmark notes
- env-based controls

Do not present as:

- default optimization
- stable public feature

Reason:

- measurable effect exists
- but current end-to-end user-facing gain is too weak

### B. Packed-QKV preset policy

Keep:

- `auto|full|front-half|back-half`
- architecture-aware experimentation

Do not present as:

- final runtime policy

Reason:

- useful for engineering
- still heuristic

### C. Packed-QKV arena

Keep:

- locality cleanup
- profiling value

Do not present as:

- release win

Reason:

- prompt-side traces improved
- end-to-end `pg` win did not materialize strongly enough

### D. Deep profiling helpers

Keep:

- `IK_LLAMA_PG_TRACE`
- `IK_LLAMA_PG_TRACE_DECODE_WINDOW`
- `IK_LLAMA_LAYER_SCORE_TRACE`
- `IK_LLAMA_EXEC_LAYER_TRACE`
- `IK_LLAMA_LOCALITY_TRACE`

Do not present as:

- user-facing product features

Reason:

- these are engineering tools

## 3. Not Suitable For Release-Facing Scope Yet

These items should not be used as milestone claims today.

### A. Strong architecture-specific win

Missing today:

- one clear benchmark-backed engine improvement that is easy to explain publicly

This is the biggest release blocker.

### B. Final huge-model package for `gpt-oss-120b`

Not ready:

- runtime and memory policy are still being shaped

### C. Fresh full MiniMax validation pass

Current status:

- code support is real
- fresh partial rerun exists
- full current `off/on/auto` rerun did not complete in this pass

So MiniMax is:

- valid research scope
- not tight release-facing validated scope

### D. New custom quantization performance claims

Not ready:

- custom quantization remains the strategic direction
- but current release-facing evidence is still centered on runtime and engine work

## 4. Code-State Reality

The current repository state still has a practical packaging issue:

- the `ik_llama.cpp` working tree is dirty
- there are unrelated local changes mixed with current work
- benchmark artifacts and scripts are present in-tree

This does not make the work invalid.

But it does mean:

- current state is not yet a clean release snapshot

## 5. What A Minimal Publishable Milestone Should Claim

A narrow and defensible milestone could claim:

1. better MoE runtime policy story on Zen4
2. benchmark-backed `rtr auto`
3. benchmark-backed mixed-path methodology
4. validated runtime guidance for:
   - `Qwen3MoE`
   - `gpt-oss-20b`
   - `gpt-oss-120b` subset
5. architecture-specific execution analysis as the basis for next wins

It should **not** claim:

1. final stable architecture-specific fast paths
2. final MiniMax policy
3. final custom quantization results

## 6. Minimal Actions Needed To Turn This Into A Cleaner Candidate

### Option A: Documentation-first milestone

Needed:

1. freeze milestone scope
2. separate stable and experimental clearly
3. package only the benchmark-backed story

Result:

- respectable engineering milestone
- but still without a headline engine win

### Option B: Better milestone

Needed:

1. close one strong `gpt-oss-20b` or `Qwen3MoE` engine win
2. rerun minimal validation matrix
3. then freeze milestone scope

Result:

- better public story
- stronger article material

## 7. Recommended Position Right Now

Right now the fork is ready for:

- technical preview
- engineering milestone
- publishable research snapshot

It is not yet ready for:

- clean stable public release with a headline performance win

## 8. Recommended Next Step

If the goal is a respectable public milestone, the next best move is:

1. close one strong architecture-specific improvement
2. keep the current release-facing docs
3. assemble a clean milestone snapshot around that result
