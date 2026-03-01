# Mixed Path Optimization Plan (`pg`)

## Purpose
This document explains what "optimize mixed path" means in this project and why it matters.

Mixed path:
- prompt + generation in one benchmark or practical inference flow
- represented in current benchmark discipline as `pg512,128`

## Why Mixed Path Is A Separate Problem
Historically it is easy to optimize only:
- `tg` (token generation)

That is not enough.

Why:
- `pg` exercises different runtime behavior
- prompt processing and generation interact through memory layout, warm state, and execution order
- a configuration that is good for TG-only can be suboptimal for mixed runs

This is now a hard requirement:
- `pg` must be tuned and validated separately

## What Will Be Optimized

### 1. Runtime profile separation
Goal:
- do not use one implicit universal profile for both `tg` and `pg`

What this means:
- preserve current compatibility
- add or internalize separate profile choices for:
  - thread count
  - repack mode
  - path-sensitive execution behavior

### 2. Repack / layout transition cost
Goal:
- identify where `pg` spends time or memory on avoidable layout transitions

What to inspect:
- prompt phase tensor preparation
- transition from prompt phase to generation phase
- repeated or redundant repack/copy steps

### 3. MoE routing/runtime overhead in mixed execution
Goal:
- reduce non-matmul cost that becomes visible in `pg`

What to inspect:
- routing preparation
- expert selection bookkeeping
- transient allocations or state resets between prompt and generation parts

### 4. Swap-bound stability
Goal:
- improve real-world `pg` behavior when model size is above RAM

What to inspect:
- page churn during mixed runs
- load/startup overhead of repack modes
- whether some mixed-path steps trigger more expensive memory behavior than TG-only

## What This Does Not Mean
It does not mean:
- dropping TG optimization
- removing support for old quant families
- changing model format compatibility

It means:
- mixed path becomes a first-class optimization target

## Benchmark Contract For Every Mixed-Path Change
Any change intended to improve mixed path should be checked on:
1. `pg512,128`
2. `tg128`
3. optionally `pp512`

At minimum compare:
- `rtr off/on/auto`
- one in-RAM model
- one large model

## Acceptance Criteria For A Mixed-Path Improvement
A change is considered successful only if:
1. `pg` improves on target model(s)
2. there is no unacceptable `tg` regression
3. load/startup cost is understood if it increases
4. results are recorded in benchmark docs

## Compatibility
Expected compatibility stance:
- full backward compatibility for CLI and model support should remain
- changes should be internal runtime improvements or additive profile logic

## Immediate Next Engineering Actions
1. Profile `pg` hot path on current tree.
2. Identify repack/copy/layout transitions specific to prompt->generation flow.
3. Implement one contained optimization.
4. Re-run `pg512,128` A/B.
5. Re-run full sanity matrix if result is promising.

## Canonical References
- `project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-27.md`
- `project_docs/strategy/EXECUTION_PLAN_ZEN4_MOE_2026-02-27.md`
