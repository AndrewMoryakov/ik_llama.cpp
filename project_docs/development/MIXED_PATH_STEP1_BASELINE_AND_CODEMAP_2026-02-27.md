# Mixed Path Step 1: Baseline And Code Map (2026-02-27)

## Purpose
This document records Step 1 of the mixed-path optimization phase:
- lock the current mixed-path baseline
- map the code path used by `pg`
- identify concrete bottleneck candidates before instrumentation

This is the bridge between benchmark policy work and engine implementation work.

## 1) Baseline Locked For A/B

### Benchmark references
Current benchmark sources for this phase:
- `ik_llama.cpp/bench_results/2026-02-27_1831`
- `ik_llama.cpp/bench_results/2026-02-27_1856`
- `project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-27.md`

### Baseline model set
Use these as first-line A/B targets:
1. `Qwen3-30B-A3B-Q4_K_M`
2. `gpt-oss-20b-MXFP4`
3. `gpt-oss-120b-MXFP4-00001-of-00002`

### Baseline scenarios
Primary:
1. `pg512,128`
2. `tg128`

Secondary:
1. `pp512`

### Baseline runtime profile
Default comparison profile for early mixed-path engine changes:
- `-t 16`
- `-fa 1`
- `-rtr auto`
- model-specific extras only if the benchmark set already fixed them

Why:
- matches current benchmark direction
- keeps the change set focused on engine behavior, not policy churn

## 2) How `pg` Really Executes In `llama-bench`

The current mixed-path benchmark is not a special single API call.

It is executed as:
1. clear KV cache
2. run prompt processing
3. run generation in the same context

Relevant code:
- `ik_llama.cpp/examples/llama-bench/llama-bench.cpp:2048`
- `ik_llama.cpp/examples/llama-bench/llama-bench.cpp:2071`
- `ik_llama.cpp/examples/llama-bench/llama-bench.cpp:2190`
- `ik_llama.cpp/examples/llama-bench/llama-bench.cpp:2195`
- `ik_llama.cpp/examples/llama-bench/llama-bench.cpp:2199`

Key implication:
- mixed path is effectively `test_prompt(...)` followed by `test_gen(...)`
- the important engine question is the transition from prompt-phase to generation-phase inside the same context

## 3) Code Path Map

### A) Entry point
Main decode path:
- `ik_llama.cpp/src/llama.cpp:3412` - `llama_decode_internal(...)`

This is the main function for both:
- prompt chunks (`n_tokens > 1`)
- generation tokens (`n_tokens == 1`)

### B) Graph reuse behavior
Relevant code:
- `ik_llama.cpp/src/llama.cpp:552` - `reset_scheduler()`
- `ik_llama.cpp/src/llama.cpp:557` - `can_reuse_graph(...)`
- `ik_llama.cpp/src/llama.cpp:3649` - graph reuse check
- `ik_llama.cpp/src/llama.cpp:3674` - `prev` saved only for single-token graph reuse
- `ik_llama.cpp/src/llama.cpp:3840` - scheduler reset if no reusable graph exists

Important observed behavior:
1. graph reuse only works for:
   - `u_batch.n_tokens == 1`
   - token input (not embeddings)
   - `graph_reuse == true`
2. prompt processing (`n_tokens > 1`) does not populate reusable graph state
3. after a multi-token prompt decode call, `prev` is absent
4. this causes `reset_scheduler()` at the end of the call
5. first generation token after prompt must build/alloc a new decode graph

This is the first major mixed-path-specific candidate.

### C) Input setup path
Relevant code:
- `ik_llama.cpp/src/llama.cpp:2719` - `llama_set_inputs(...)`

This function performs:
1. token/embedding upload
2. position setup
3. output-id setup
4. KQ mask preparation

Observed risk area:
- KQ mask preparation becomes significantly more complex for prompt batches (`n_tokens > 1`)
- prompt and generation have very different setup cost profiles

This is a likely source of `pg` cost concentration, especially in the prompt half.

### D) Build-context path
Relevant code:
- `ik_llama.cpp/src/llama-build-context.cpp:6859`
- `ik_llama.cpp/src/llama-build-context.cpp:6860`

Observed behavior:
- the build path contains explicit prompt-processing optimization logic:
  - comment: `n_tokens is higher during prompt processing, this allows to optimize for this case`
  - `pp_opt = n_tokens >= 128`

This matters because:
- prompt and generation already diverge at graph-build level
- mixed-path cost is not just "prompt cost + generation cost"; it also includes switching between these two graph regimes

### E) Output-id build pressure
Relevant code:
- `ik_llama.cpp/src/llama-build-context.cpp:337` - `build_inp_out_ids()`
- many model builders allocate/use `inp_out_ids` when `n_tokens > 1`

Implication:
- prompt path may pay repeated shape/setup overhead that generation does not
- some of this may be avoidable or cacheable depending on builder behavior

## 4) Initial Bottleneck Candidates

These are the current ranked candidates before adding instrumentation.

### Candidate 1: First-token-after-prompt graph rebuild
Why it matters:
- prompt path cannot reuse graph state
- decode graph reuse starts only after the first generation token

Evidence in code:
- `ik_llama.cpp/src/llama.cpp:557`
- `ik_llama.cpp/src/llama.cpp:3674`
- `ik_llama.cpp/src/llama.cpp:3840`

What this could mean in practice:
- every mixed run pays:
  - one prompt graph build/alloc
  - one first-generation graph build/alloc
  - only then enters reusable decode mode

Why this is promising:
- highly specific to `pg`
- contained optimization surface

### Candidate 2: Scheduler reset boundary between prompt and generation
Why it matters:
- after prompt decode, if `prev` is absent, the scheduler is reset
- this may destroy state that could otherwise reduce transition overhead

Evidence in code:
- `ik_llama.cpp/src/llama.cpp:552`
- `ik_llama.cpp/src/llama.cpp:3840`

Why this is promising:
- likely connected to the prompt -> decode transition cost
- easy to instrument

### Candidate 3: Prompt-side `llama_set_inputs()` mask setup cost
Why it matters:
- prompt batches (`n_tokens > 1`) build much heavier KQ mask state than decode tokens
- `pg` always includes this prompt-side setup

Evidence in code:
- `ik_llama.cpp/src/llama.cpp:2719`

Why this is promising:
- direct CPU-side overhead
- likely measurable without deep architectural changes

### Candidate 4: Repeated prompt-specific graph-build setup
Why it matters:
- prompt path uses a different build regime than decode
- builder contains explicit prompt-specific branching

Evidence in code:
- `ik_llama.cpp/src/llama-build-context.cpp:6859`
- `ik_llama.cpp/src/llama-build-context.cpp:6860`

Why this is promising:
- may expose reusable/cachable work
- likely relevant to `pg` more than TG-only

### Candidate 5: Output-selection plumbing for `n_tokens > 1`
Why it matters:
- prompt path uses additional output-id setup and plumbing that decode avoids or simplifies

Evidence in code:
- `ik_llama.cpp/src/llama-build-context.cpp:337`
- many `n_tokens > 1 ? build_inp_out_ids() : nullptr` call sites

Why this is lower priority:
- likely smaller than graph build/reset costs
- needs instrumentation before any change

## 5) What Step 1 Concludes

The mixed-path problem is currently best understood as:
1. prompt and generation already use materially different execution paths
2. the prompt -> generation boundary is real and code-visible
3. graph reuse is decode-only right now
4. `pg` likely pays a transition tax that TG-only does not

This means the first implementation work should not start from arbitrary kernel tuning.
It should start from:
- transition cost
- graph reuse / scheduler reset behavior
- prompt-side setup cost

## 6) Immediate Next Step
Step 2 should add lightweight instrumentation around:
1. graph build
2. graph alloc
3. scheduler reset
4. `llama_set_inputs`
5. first generation token after prompt

The first optimization candidate to evaluate after instrumentation should be:
- **prompt -> first decode transition cost**, specifically graph reuse/reset behavior

## Canonical References
- `project_docs/development/MIXED_PATH_EXECUTION_PLAN_2026-02-27.md`
- `project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-27.md`
