# RTR independent follow-up review after community feedback

Date: 2026-05-05  
PR: <https://github.com/ikawrakow/ik_llama.cpp/pull/1738>  
Reviewed PR snapshot: `0115ace21eaee3853f015f5e703ffef2ec2a8acc`  
Purpose: record the additional analysis from this review session, especially
the parts not fully covered by `DMAIVEL_FEEDBACK_2026-05-05.md` or
`DEEP_REVIEW_2026-05-05.md`.

## Scope of this document

This is not another summary of the whole PR. The earlier docs already cover:

- the original `-rtr auto` rationale;
- the post-submit `use_mmap` parser regression;
- `dmaivel`'s reproduced failure with `-ngl 99 -ot exps=CPU`;
- the deep review findings around multi-shard accounting, probe lifetime,
  API/ABI, cgroups, bench reporting, and docs drift.

This document focuses on the extra layer that became clear only after looking
at the community feedback as a design decision:

- what exactly can be fixed in the current explicit `-rtr auto` architecture;
- what changes if maintainer prefers `dmaivel`'s "make `-rtr` self-protective"
  suggestion;
- why the self-protective path is not a one-line load-time guard;
- which state is currently missing from the code to implement either path
  cleanly;
- what additional failure modes remain even after the obvious F1/F2 fixes.

## Current external state

Checked via:

- `gh pr view 1738 --repo ikawrakow/ik_llama.cpp --json state,reviewDecision,headRefOid,updatedAt,comments`
- `gh api repos/ikawrakow/ik_llama.cpp/pulls/1738/comments`
- `gh api repos/ikawrakow/ik_llama.cpp/pulls/1738/reviews`

Result:

- PR is still open.
- Head is still `0115ace21eaee3853f015f5e703ffef2ec2a8acc`.
- No pull request reviews.
- No pull request code comments.
- The blocking community feedback is still `dmaivel`'s runtime report:
  `-ngl 99 -ot exps=CPU -rtr auto` on a 64 GiB Linux system with a ~120 GiB
  split MoE behaved like `-rtr on`.

## Executive conclusion

The community feedback is not just "fix the threshold". It exposes a design
boundary:

- If we keep explicit `-rtr auto`, a small technical patch can probably close
  `dmaivel`'s reproduced case.
- If we make legacy `-rtr` self-protective, we must refactor the parser/load
  contract first, otherwise the feature still disables mmap too early and keeps
  the swap-bound failure mode.

The most important new conclusion from this review:

`self-protective -rtr` cannot be implemented by only adding a load-time
"disable repack if unsafe" check. The parser currently turns legacy `-rtr` into
`use_mmap=false` before the load-time safety decision exists. If a later safety
check disables repack but leaves that early `use_mmap=false` behind, the model
still loads without mmap and the swap-bound user still loses.

## Delta findings from this review

### D1 - Self-protective `-rtr` requires moving the mmap decision to load time

New analysis:

- Previous docs note that `dmaivel` suggested making `-rtr` self-protective.
- The missing implementation detail is that current legacy `-rtr` has a
  parse-time side effect: it disables mmap immediately.

Relevant code:

- `common/common.cpp:1641-1688`
- `src/llama.cpp:3444-3459`

Current explicit `auto` path after `0115ace21`:

- `-rtr auto` sets `repack_tensors=true` and `repack_tensors_auto=true`.
- It does not set `use_mmap=false` in the parser.
- `llama_model_load()` decides later:
  - unsafe: `repack_tensors=false`, leave mmap as configured;
  - safe: keep repack and force `use_mmap=false`.

Current legacy `-rtr` path:

- `-rtr` / `-rtr 1` sets `repack_tensors=true`.
- Parser also sets `use_mmap=false` immediately.

Why this matters:

- In a self-protective design, legacy `-rtr` would also need a late safety
  decision.
- If the parser has already set `use_mmap=false`, disabling repack later does
  not restore mmap.
- That recreates the exact bad state: `repack=false`, `mmap=false`, swap-bound
  model tries to load through RAM instead of page faults.

Required fix if maintainer chooses self-protective `-rtr`:

- Remove parse-time `use_mmap=false` from the legacy `-rtr` parser path.
- Resolve mmap only after the safety policy:
  - final repack enabled: force `use_mmap=false`;
  - final repack disabled: preserve the original user/default mmap setting.

This is the key implementation gate for the self-protective architecture.

### D2 - The code needs to distinguish requested mode from resolved mode

New analysis:

- The current booleans express only partial state:
  - `repack_tensors`
  - `repack_tensors_auto`
  - `use_mmap`
- They do not cleanly separate "what the user requested" from "what the loader
  finally resolved after policy".

Why this matters:

- For logging and reproducibility, `-rtr auto` that disables repack should not
  be indistinguishable from user-specified `-rtr 0`.
- For self-protective `-rtr`, `-rtr` that disables itself should not be
  indistinguishable from no `-rtr`.
- For mmap, "default mmap true" and "user explicitly requested `--no-mmap`"
  are semantically different when safety disables repack.

Concrete risk:

- If safety disables repack and `use_mmap=false`, we need to know whether that
  false came from the user's `--no-mmap` or from earlier `-rtr` coupling.
- Without that provenance, a fix can accidentally preserve the dangerous
  parser side effect or accidentally override a user's explicit no-mmap choice.

Recommended state model:

- Keep a requested RTR mode internally:
  - `off`
  - `on`
  - `auto`
  - optionally `force` if maintainer wants a way to bypass safety
- Keep a resolved RTR decision:
  - `disabled_by_user`
  - `enabled`
  - `disabled_by_policy`
  - `unknown_policy_result`
- Track whether mmap was explicitly set by the user if the parser keeps
  modifying mmap.

Minimal alternative:

- For explicit `auto`, current booleans are sufficient with a small patch.
- For self-protective legacy `-rtr`, the current state model is too weak unless
  parser-side mmap mutation is removed.

### D3 - Available memory fixes the reproduced false negative, but not exact placement

New analysis:

- Replacing total RAM with available/effective RAM is necessary.
- It is not equivalent to estimating CPU-resident model bytes.

Relevant code:

- `src/llama.cpp:3350-3372`
- `src/llama.cpp:3424-3431`
- `src/llama.cpp:2661-3327`

Why `dmaivel`'s case is fixed by available memory:

- `-ot exps=CPU` makes the large expert tensors CPU-resident.
- `params.n_gpu_layers > 0` currently prevents the policy from running.
- Dropping that skip lets the policy compare model size with available memory.
- On 64 GiB RAM with a ~120 GiB MoE, it should disable repack and leave mmap
  enabled.

Remaining caveat:

- `probe.n_bytes` is full GGUF tensor bytes across shards.
- It is not the final CPU-resident byte count after:
  - `n_gpu_layers`
  - `tensor_buft_overrides`
  - split mode
  - backend buffer choices
  - `--fit`
  - auto-generated CPU overrides

False-positive example:

- 120 GiB model.
- 100 GiB effectively offloaded to GPU.
- CPU-resident weights would fit.
- Full `probe.n_bytes` still says 120 GiB, so policy may disable RTR
  unnecessarily.

This is safer than the current false negative, but it is still a correctness
trade-off. It should be documented if we choose the minimal patch.

### D4 - `--fit` and generated overrides are invisible to the current early probe

New analysis:

- The auto decision currently runs before the placement machinery.
- `--fit` can generate CPU overrides later inside the load path.

Relevant code:

- `src/llama.cpp:2717-2723`
- `src/llama.cpp:2794-3059`
- `src/llama.cpp:3444-3465`

Why this matters:

- `llama_rtr_auto_should_disable()` runs in `llama_model_load()` before
  `llama_model_load_internal()` performs final placement and `--fit` logic.
- The probe sees user-supplied params, but not auto-generated overrides.
- `--fit` can move tensors between devices based on available VRAM and expert
  placement after the probe has already decided the RTR policy.

Failure modes:

- False positive: policy disables RTR based on full model bytes, but `--fit`
  would have placed enough tensors on GPU for CPU repack to be safe.
- False negative in a more complex future design: policy assumes GPU offload
  reduced CPU pressure, but later generated overrides keep large expert
  tensors on CPU.

Conclusion:

- A fully correct RTR policy belongs after metadata/hparams and placement
  planning, but before actual tensor data allocation/repack.
- The current pre-loader probe is acceptable only as a conservative heuristic.

### D5 - Probe failure currently means "keep repack", which is not safety-first

New analysis:

- The existing `auto` path treats probe failure as "do nothing".
- Because `llama_model_load()` interprets "do nothing" as "keep repack and
  force no-mmap", a probe failure can produce the dangerous path.

Relevant code:

- `src/llama.cpp:3434-3437`
- `src/llama.cpp:3452-3458`

Current flow:

- Probe throws.
- `llama_rtr_auto_should_disable()` returns false.
- Caller enters the "keeping repack enabled" branch.
- Caller sets `params.use_mmap=false`.

Problem:

- For a feature advertised as a swap-bound safety net, "unknown" should not be
  collapsed into "safe".

Better decision model:

- Return a decision enum rather than bool:
  - `disable`
  - `keep`
  - `unknown`
- For explicit `auto`, strongly consider `unknown -> disable repack, keep mmap`
  with a warning.
- If maintainer wants legacy-preserving semantics, log that policy failed and
  legacy `-rtr` behavior is being used. Do not present it as safety.

### D6 - Linux available-memory helper must be effective-memory, not just host memory

New analysis:

- `DMAIVEL_FEEDBACK` already points out total-vs-available RAM.
- The important implementation detail is that Linux "available" must account
  for container/cgroup limits if we want robust Linux behavior.

Relevant code:

- `src/llama.cpp:3358-3363`

Recommended Linux order:

1. Read host available memory from `/proc/meminfo` `MemAvailable`.
2. Read cgroup v2 if present:
   - `memory.max`
   - `memory.current`
3. Read cgroup v1 if present:
   - `memory.limit_in_bytes`
   - `memory.usage_in_bytes`
4. Effective available = minimum sensible budget across host and cgroup.
5. Fall back to `_SC_AVPHYS_PAGES` only if `/proc/meminfo` is unavailable.

Implementation notes:

- Treat cgroup `max` as unlimited.
- Ignore impossible or non-positive values.
- Use unsigned parsing with overflow checks.
- Log only the final effective available memory unless verbose diagnostics are
  added.

### D7 - The safest minimal patch is intentionally biased toward false positives

New analysis:

- A minimal fix that compares full model bytes to available memory will
  sometimes disable RTR even when exact CPU-resident bytes would fit.
- That is a deliberate safety bias, not an accidental bug, if documented.

Why this is acceptable for the PR:

- The current failure is a false negative that can cause allocation failure or
  severe swap thrash.
- The conservative false positive costs potential RTR speedup but preserves
  successful model loading.
- For an `auto` safety mode, false positive is preferable to false negative.

When it becomes unacceptable:

- If maintainers want `auto` to maximize performance rather than protect load
  success.
- If many hybrid GPU users report that `auto` disables RTR too often.

Follow-up path:

- Add a CPU-resident byte estimator after placement planning.
- Then compare estimated CPU-side writable bytes, not full GGUF bytes, against
  effective available memory.

### D8 - The public API question depends on the architectural choice

New analysis:

- The deep review notes that adding `repack_tensors_auto` changes public
  `llama_model_params`.
- The follow-up conclusion is that this field may not be necessary if maintainer
  chooses self-protective `-rtr`.

Relevant code:

- `include/llama.h:363-431`
- `include/llama.h:421-422`
- `include/llama.h:584-586`
- `src/llama.cpp:5564-5618`

If explicit `auto` stays:

- Public API needs some way to request auto behavior outside CLI.
- Keeping `repack_tensors_auto` may be acceptable if upstream does not promise
  ABI stability.
- Otherwise it needs a versioned params strategy or a non-ABI-breaking API.

If self-protective `-rtr` wins:

- The safety policy can apply whenever `repack_tensors=true`.
- The new public `repack_tensors_auto` field can likely be removed.
- This reduces API surface and weakens the ABI objection.

Therefore:

- Do not push another code change until maintainer chooses the design.
- Otherwise we may optimize the wrong API shape.

### D9 - Observability must report both requested and resolved RTR state

New analysis:

- The previous review notes `llama-bench` and YAML drift.
- The stronger point is that runtime policy decisions need two separate fields:
  requested mode and resolved decision.

Current ambiguous states:

- User requested `-rtr auto`, policy kept RTR.
- User requested `-rtr auto`, policy disabled RTR.
- User requested `-rtr 1`, self-protective policy disabled RTR.
- User requested `-rtr 0`.
- User did not specify RTR.

Today these collapse too easily into:

- `repack: true`
- `repack: false`

Recommended logging:

- requested mode: `off`, `on`, `auto`, optionally `force`
- resolved decision: `enabled`, `disabled_by_policy`, `disabled_by_user`
- model bytes used by policy
- effective available memory used by policy
- threshold/headroom
- whether mmap remains enabled

This is not just polish. Without it, future benchmark reports can draw the
wrong conclusion from `rtr=1` or `repack=false`.

## Architecture options

### Option A - Keep explicit `-rtr auto`

Intent:

- Existing `-rtr` remains legacy force-on.
- New `-rtr auto` is an opt-in safety mode.

Minimal implementation:

1. Replace `llama_get_total_ram_bytes()` with an effective available-memory
   helper.
2. Remove `if (params.n_gpu_layers > 0) return false;`.
3. Change the probe result from bool to a small enum if we want safe handling of
   probe failure.
4. Keep parser behavior from `0115ace21`: `-rtr auto` does not disable mmap at
   parse time.
5. Log the final resolved decision with effective memory numbers.

Pros:

- Smallest patch from current PR.
- Does not change legacy `-rtr` semantics.
- Easy to explain as "new safety mode".

Cons:

- Users with existing `-rtr` scripts do not benefit automatically.
- Public `llama_model_params` field likely remains.
- Some users may still apply legacy tuning guides and hit the old failure.

When to choose:

- Maintainer wants minimal behavior change.
- Maintainer is okay with explicit new CLI/API surface.

### Option B - Make existing `-rtr` self-protective

Intent:

- `-rtr` means "enable RTR when safe".
- Unsafe loads disable RTR and preserve mmap.
- No new `auto` mode needed for ordinary users.

Required implementation:

1. Remove parse-time `use_mmap=false` from legacy `-rtr`.
2. Run safety policy for `repack_tensors=true`.
3. If policy says enabled, then force `use_mmap=false`.
4. If policy says disabled, leave mmap as originally configured.
5. Decide whether there is a force mode for old unconditional behavior.
6. Remove `repack_tensors_auto` if no explicit auto API remains.

Pros:

- Existing scripts get protection.
- Cleaner UX.
- Possibly avoids public `repack_tensors_auto` ABI/API addition.

Cons:

- Changes legacy behavior.
- Requires parser/load refactor, not just threshold fix.
- Needs clear logs because users may ask why `-rtr` did not run.

When to choose:

- Maintainer agrees safety should override legacy performance behavior.
- Maintainer prefers no new `auto` flag.

### Option C - Placement-aware policy

Intent:

- Decide based on estimated CPU-resident writable tensor bytes, not full model
  bytes.

Implementation direction:

- Move decision after metadata/hparams and placement planning.
- Reuse or extract placement estimation from the existing loader internals.
- Decide before actual tensor data load and before repack mutates buffers.

Pros:

- Most correct.
- Handles GPU offload, `-ot`, `--fit`, split modes, and generated overrides.
- Avoids full-model-byte false positives.

Cons:

- Larger refactor.
- Higher risk for a small upstream PR.
- Requires careful testing across CPU-only, GPU, split, and MoE paths.

When to choose:

- Maintainer rejects heuristic false positives.
- Maintainer wants RTR policy to become a general runtime placement feature.

## Recommended path from this review

Wait for `ikawrakow` on architecture, then choose one:

If he wants minimal PR completion:

- Keep explicit `-rtr auto`.
- Patch available/effective memory.
- Remove `n_gpu_layers` skip.
- Make probe failure safety-first or at least avoid silently treating unknown as
  safe.
- Keep false-positive caveat in PR comment.

If he prefers `dmaivel`'s no-new-flag design:

- Rewrite as self-protective `-rtr`.
- First remove parse-time `-rtr -> use_mmap=false`.
- Resolve mmap only after final policy decision.
- Consider dropping `repack_tensors_auto` from public API.

Do not implement a hybrid half-step where legacy `-rtr` self-disables repack
but still inherits parser-forced `use_mmap=false`. That is the main trap found
in this review.

## Suggested maintainer-facing response

Keep the PR comment short. Do not paste this whole analysis.

```text
Thanks, this is a real miss in the current policy.

There are two separate issues. First, the current guard skips the auto check
whenever n_gpu_layers > 0, but your command forces experts back to CPU with
-ot exps=CPU, so the model is still swap-bound on the CPU side. Second, the
check uses total physical RAM, while the relevant value is available/effective
RAM.

If we keep the explicit auto mode, the minimal fix is to use available memory
and remove the n_gpu_layers skip. That should make your case disable repack and
leave mmap enabled.

Your suggestion to make -rtr itself self-protective is also reasonable, but it
changes legacy behavior and needs a small parser/load refactor: -rtr currently
forces mmap off before the load-time decision, and that would have to move to
after the safety check. I would prefer to wait for Ivan's preference before
rewriting the PR in that direction.
```

## Stop rules

- Do not push code until maintainer chooses explicit `auto` vs self-protective
  `-rtr`.
- Do not implement self-protective `-rtr` without moving mmap resolution to
  load time.
- Do not claim Linux safety if the available-memory helper ignores cgroup
  limits.
- Do not claim exact memory accounting while the policy still compares full
  `probe.n_bytes` with available RAM.
- Do not include benchmark/docs/reporting cleanup in the first fix unless
  maintainer asks; keep the first response focused on the reproduced bug.

## Not covered in this follow-up

- No build run.
- No runtime reproduction on the 4-shard model.
- No implementation of the proposed memory helper.
- No ABI binary compatibility repro.
- No attempt to refactor placement-aware accounting.

