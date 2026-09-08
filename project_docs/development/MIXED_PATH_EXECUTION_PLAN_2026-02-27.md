# Mixed Path Execution Plan (2026-02-27)

## 1) Goal Of This Phase
This phase is not about "speeding up anything in general". It is about a narrower and more important target:

- accelerate the mixed `prompt + generation` path (`pg`)
- do not optimize only for `tg-only`
- do not damage existing `tg` performance
- preserve compatibility with current model families and quant formats

In practical terms, this means:
- find where mixed path loses time
- determine what behaves differently in `pg` vs `tg`
- make limited, testable engine changes
- validate each change with benchmarks

## 2) Why This Phase Exists
We have already confirmed several things:

1. `pg` and `tg` behave differently.
2. `rtr` affects `pg` and `tg` differently.
3. Runtime policy is now clearer, but policy alone is not enough.

This means:
- we already know how to choose better modes
- the next step is to make the mixed path itself faster

## 3) What Counts As Mixed Path
In this project, mixed path means:
- benchmark scenario `pg512,128`
- more generally: practical inference with both:
  - a meaningful prompt phase
  - a following generation phase

This is neither pure prefill (`pp`) nor pure decode (`tg`), but their combined real-world path.

## 4) Main Engineering Hypothesis
The working hypothesis is:

**`pg` contains additional overhead that either does not exist in `tg`, or is much weaker there.**

Possible sources:
1. extra layout / repack transitions
2. extra buffer copies
3. inefficient prompt -> generation transition
4. routing / expert preparation overhead
5. unnecessary realloc / reset / rebuild work
6. memory-locality issues that show up more strongly in `pg`

This phase is about proving or disproving these candidates with code and measurements.

## 5) Success Criteria
This phase is successful only if all of the following are true:

1. `pg` gets faster on target MoE models
2. `tg` does not receive unacceptable regression
3. the result is explainable, not accidental
4. compatibility is preserved for:
   - CLI
   - model formats
   - `Q / IQ / UD-Q`
5. conclusions can be documented clearly for future contributors

## 6) Execution Steps

### Step 1: Lock Mixed-Path Baseline
What:
- use current benchmark results as the baseline
- isolate `pg` scenarios as the main reference for A/B work

Baseline model set:
1. `Qwen3-30B-A3B-Q4_K_M`
2. `gpt-oss-20b-MXFP4`
3. `gpt-oss-120b-MXFP4` as large pressure/swap-bound representative

Baseline scenarios:
1. `pg512,128`
2. `tg128`
3. optionally `pp512`

Why:
- every optimization needs a real comparison point

What this gives:
- prevents subjective evaluation
- makes later regressions visible

### Step 2: Map The Code Path
What:
- identify code used by:
  - prompt processing
  - prompt -> generation transition
  - MoE routing/runtime
  - repack / tensor layout handling

What to look for:
1. differences between `pp`, `tg`, and `pg`
2. where internal structures are created or recreated
3. where copies or repacks may be repeated
4. where mixed path does extra work

Why:
- without code-path mapping, optimization is guesswork

What this gives:
- localization of likely bottlenecks
- understanding of safe vs risky changes

### Step 3: Instrument Mixed Path
What:
- add lightweight timing/profiling around key `pg` sections
- measure:
  - repack/layout transitions
  - routing overhead
  - prompt -> decode transition cost
  - buffer rebuild/reset costs

Why:
- end-to-end benchmark numbers do not show where the time is lost

What this gives:
- cost breakdown of `pg`
- a rational basis for selecting the first optimization

Constraints:
- instrumentation should not distort runtime heavily
- profiling code should be isolated and controllable

### Step 4: Choose 1-2 Highest ROI Candidates
What:
- do not rewrite the whole path at once
- select one or two focused changes, for example:
  1. remove a redundant repack/copy during prompt -> generation transition
  2. reuse already-prepared layout/state
  3. reduce MoE reset/rebuild work between phases

Why:
- small isolated changes are easier to validate
- attribution is clearer

What this gives:
- faster iteration cycle
- lower regression risk

### Step 5: Implement The First Change
What:
- make one focused code change
- avoid touching unrelated code
- preserve external behavior

Why:
- the project now needs measured implementation work, not more abstract planning

What this gives:
- first hard test of the mixed-path hypothesis

Constraints:
- keep the change local and reversible
- preserve existing runtime modes

### Step 6: Run A/B Benchmarks
What:
- rerun at minimum:
  1. `pg512,128`
  2. `tg128`
  3. optionally `pp512`

Coverage:
- at least one in-RAM case
- at least one large/swap-bound case
- same `t/fa/rtr/muge` profile as baseline

Why:
- mixed-path changes cannot be validated by one number

What this gives:
- proof of usefulness or proof of failure

### Step 7: Accept, Iterate, Or Reject
There are only three valid outcomes:

1. Keep the change
- if `pg` improves
- and `tg` does not regress critically
- and behavior is stable

2. Refine the change
- if there is some gain but also a downside

3. Reject the idea
- if there is no measurable value

Why:
- prevents accumulation of "optimizations" that do not optimize

### Step 8: Repeat The Cycle
If the first change helps:
- move to the next bottleneck

If it does not:
- return to instrumentation and pick the next candidate

The working loop is:
1. measure
2. localize
3. change
4. verify
5. document

## 7) What Counts As Acceptable Regression
We need a rule in advance.

Proposed standard:
1. `pg` improvement is the primary goal
2. small `tg` regression may be acceptable only if:
   - it is small
   - `pg` gain is clearly larger
   - the tradeoff is understood and documented

Not acceptable:
- a change that gives a nice `pg` number but destabilizes runtime behavior
- a change that explodes startup/load cost without explicit justification

## 8) What Must Not Break
This phase must not break:
1. quant support:
   - `Q`
   - `IQ`
   - `UD-Q`
2. existing CLI modes
3. current `rtr off/on/auto` behavior
4. large-model loading path

## 9) Main Risks
1. false optimization
- benchmark improves for the wrong reason

2. overfitting to one model
- one target improves, others worsen

3. hidden `tg` regression
- caused by looking only at `pg`

4. code complexity growth
- without a meaningful return

5. mixing policy and engine optimization
- better defaults are not the same thing as a faster engine

## 10) Why This Plan Is The Right Next Step
We already have:
- benchmark infrastructure
- runtime policy direction
- current documentation baseline
- proof that `pg` is a separate optimization problem

So the next reasonable step is:
- isolate bottlenecks
- implement one meaningful optimization
- prove it with A/B benchmarks

## 11) Short Practical Version
1. Lock baseline for `pg`
2. Map `pp -> pg -> tg` code path
3. Add profiling/instrumentation
4. Find the strongest bottleneck
5. Implement one local change
6. Run A/B benchmarks
7. Keep or reject the change
8. Update docs based on actual result

## 12) Immediate Next Action
The next concrete action after this document is:

1. inspect mixed-path related code in `src/llama.cpp` and nearby files
2. identify exact locations for instrumentation
3. produce a short list of 3-5 concrete optimization candidates
4. choose the first candidate for implementation

## Canonical References
- `project_docs/development/MIXED_PATH_OPT_PLAN.md`
- `project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-27.md`
- `project_docs/strategy/EXECUTION_PLAN_ZEN4_MOE_2026-02-27.md`
