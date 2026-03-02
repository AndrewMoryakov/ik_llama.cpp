# Git Branching Model - 2026-03-02

## Purpose

This document defines the practical git structure for the private experimental lab.

The goal is simple:

1. keep a clean release branch
2. keep one real integration branch for ongoing work
3. keep milestone snapshots without mixing them into day-to-day development

## Branch Roles

### `main`

Role:

- release-facing branch
- only states that are fit for a clean public narrative should land here

Use it for:

- stable milestone cuts
- public-facing release preparation
- code that is no longer "active lab work"

Do **not** use it for:

- ongoing experiments
- mixed benchmark/tooling churn
- temporary research integration

### `dev`

Role:

- main integration branch for the private lab
- default branch for current active work

Use it for:

- integrating benchmark-backed changes
- dashboard/product work
- docs updates
- research code that is still part of active iteration

Practical rule:

- new work should normally branch from `dev`
- after review/validation, it merges back into `dev`

### `feature/*`

Role:

- short focused branches for bounded implementation work

Examples:

- `feature/minimax-locality`
- `feature/gptoss-decode-path`
- `feature/dashboard-live-heatmap`

Use them when:

- the change is big enough to isolate
- the work can be reviewed as one coherent line

### `research/*`

Role:

- branches for experiments that may not become baseline

Examples:

- `research/prompt-packed-qkv`
- `research/minimax-expert-selection`

Use them when:

- the code is hypothesis-driven
- outcome is uncertain
- you do not yet want the experiment to define the integration branch

### `milestone/*`

Role:

- frozen project snapshots
- important reference points

Current example:

- `milestone/2026-03-01-logical-snapshot`

Rule:

- treat milestone branches as mostly immutable reference cuts
- do not keep doing normal day-to-day development on them

### `safety/*`

Role:

- mandatory backup branches before specific state-destructive or history-rewriting operations

Create them before:

1. `git rebase`
2. `git reset --hard`
3. `git clean -fd` or stronger cleanup
4. force-push on an existing remote branch
5. risky upstream sync that may require history rewriting or discarding local state

Do not create them for:

1. normal commits on `dev`
2. routine feature work
3. ordinary non-rewriting merges
4. routine pushes

Naming:

- `safety/<reason>-YYYY-MM-DD`

## Working Rules

### Normal flow

1. start from `dev`
2. if the task is small, commit directly to `dev`
3. if the task is larger, create `feature/*` or `research/*`
4. merge back into `dev`
5. when `dev` becomes clean and publishable, promote selected state into `main`

### Mandatory safety branch rule

For LLM agents, `safety/*` is not an aesthetic convention.

It is required only for the specific destructive/history-rewriting cases listed above.

Outside those cases, do not create it.

### Promotion to `main`

Only move code into `main` when:

1. benchmark claims are already documented
2. dashboard/docs agree with the code
3. experimental knobs are not being sold as stable defaults
4. the state can be explained publicly without caveats that dominate the story

### Snapshot policy

When an important stage is reached:

1. create or update a `milestone/*` branch
2. keep it as a reference cut
3. continue active work on `dev`

## Current Practical Mapping

At the moment:

1. `main`
- existing release-facing baseline branch
- should stay cleaner than the lab integration branch

2. `dev`
- should become the main active branch from now on

3. `milestone/2026-03-01-logical-snapshot`
- should remain the frozen reference point for the current lab snapshot

## Remote Guidance

For day-to-day work in the private lab:

- use the private fork remote
- avoid pushing active lab churn into public remotes

If duplicate remotes point to the same private fork, keep only one long-term.

## Simple Rule Set

If unsure, use this:

1. stable public-ready state -> `main`
2. current active integration -> `dev`
3. bounded implementation -> `feature/*`
4. uncertain experiment -> `research/*`
5. frozen reference cut -> `milestone/*`
6. emergency backup -> `safety/*`
