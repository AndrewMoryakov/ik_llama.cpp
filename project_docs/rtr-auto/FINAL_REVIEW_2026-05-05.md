# Final RTR review and PR decision

Date: 2026-05-05  
PR: <https://github.com/ikawrakow/ik_llama.cpp/pull/1738>  
Reviewed PR snapshot: `0115ace21eaee3853f015f5e703ffef2ec2a8acc`  
Local docs reviewed: `ANALYSIS`, `POST_SUBMIT_BUG`, `DMAIVEL_FEEDBACK`,
`DEEP_REVIEW`, `FOLLOWUP_REVIEW`, `ADDITIONAL_REVIEW`, `README`, `INDEX`,
`AGENT_BRIEF`.

## Current external state

Checked through GitHub CLI/API:

- PR is open.
- Head is still `0115ace21eaee3853f015f5e703ffef2ec2a8acc`.
- Reviews: none.
- Pull request code comments: none.
- Last external signal is dmaivel's edited issue comment
  (`updatedAt=2026-05-05T05:19:53Z`).

dmaivel's current position:

- `-rtr auto` behaved like `-rtr on` on Linux 64 GiB RAM with a ~120 GiB
  split MoE and `-ngl 99 -ot exps=CPU`.
- Total RAM is the wrong metric; available/effective RAM is the relevant one.
- If the path cannot determine safe vs unsafe, disabling repack is the wiser
  default.
- Making existing `-rtr` self-protective may be better UX than adding
  `on|off|auto`, but he phrases this as a suggestion, not a hard demand.

## Final verdict

Do not merge or push the current PR as-is.

Do not immediately rewrite the PR into self-protective `-rtr` unless
ikawrakow explicitly asks for that architecture.

Recommended next step:

1. Post a short PR response acknowledging dmaivel's findings.
2. State the minimal technical fix for the current explicit `-rtr auto` design.
3. Ask ikawrakow to choose between:
   - path A: keep explicit `-rtr auto` and fix the policy;
   - path B: rewrite existing `-rtr` to be self-protective;
   - path C: defer to a larger placement-aware design.

Default recommendation if maintainer is neutral: path A.

Reason: path A fixes the reproduced bug with the smallest reviewable patch and
does not silently change legacy `-rtr` behavior. Path B is attractive UX, but
it is a behavior change and needs a parser/load refactor to avoid recreating the
same mmap failure mode.

## Blocking issues

### B1 - `n_gpu_layers > 0` skip makes auto fail on `-ot exps=CPU`

Location:

- `src/llama.cpp:3387-3390`

Why it blocks:

- This is exactly dmaivel's reproduced workload.
- The model is swap-bound on CPU because expert tensors are forced to CPU.
- The current guard exits before looking at `tensor_buft_overrides`.
- Load then keeps repack enabled and forces `use_mmap=false`.

Required fix if path A:

- Remove unconditional `n_gpu_layers > 0` skip.
- Accept the full-model-byte heuristic as safety-biased until a placement-aware
  estimator exists.

### B2 - Total physical RAM must become available/effective memory

Location:

- `src/llama.cpp:3350-3372`
- `src/llama.cpp:3424-3431`

Why it blocks:

- Repack safety depends on current allocatable headroom, not installed RAM.
- Busy systems and containers can fail even when total RAM looks sufficient.

Required fix if path A:

- Windows: use `MEMORYSTATUSEX::ullAvailPhys`.
- Linux: use `/proc/meminfo MemAvailable` plus cgroup v2/v1 effective limits.
- macOS: use `host_statistics64` or equivalent available-memory accounting.
- Update logs/help from "RAM" to "available memory".

### B3 - Probe failure/unknown currently means keep repack

Location:

- `src/llama.cpp:3434-3437`
- `src/llama.cpp:3452-3458`

Why it blocks:

- `false` from the policy means both "safe" and "unknown".
- Caller treats false as "keep repack" and forces `use_mmap=false`.
- dmaivel explicitly called out that unknown should probably disable.

Required fix if path A:

- Return a decision enum instead of bool, or otherwise distinguish
  `disable`, `keep`, and `unknown`.
- For explicit `auto`, make `unknown` safety-first: disable repack, keep mmap,
  log WARN.

## Non-blocking but important issues

### N1 - Public API/ABI surface

`include/llama.h` adds `repack_tensors_auto` to public
`llama_model_params`, which is passed/returned by value.

Decision:

- Not a blocker if upstream accepts public params layout churn.
- If maintainer chooses self-protective `-rtr`, this field may be unnecessary
  and should probably be removed.

### N2 - Full model bytes are not exact CPU-resident bytes

`probe.n_bytes` is all GGUF tensor bytes across shards, not final CPU-resident
bytes after `n_gpu_layers`, `-ot`, `--fit`, split mode, and generated
overrides.

Decision:

- Accept for path A as a conservative safety heuristic.
- Document false-positive risk.
- Do not claim exact placement-aware accounting.

### N3 - Duplicate loader metadata logs

The probe constructs a normal `llama_model_loader`, so metadata logging can
appear twice.

Decision:

- Not a blocker for the bug fix.
- Good follow-up if maintainer asks for polish.

### N4 - Reporting and docs drift

`llama-bench` and YAML/config output cannot cleanly represent requested vs
resolved RTR state.

Decision:

- Not a blocker for first fix.
- Important for future reproducibility.

## Architecture options

### Path A - Keep explicit `-rtr auto`

Recommended if maintainer is neutral.

Patch shape:

1. Replace total RAM helper with available/effective memory helper.
2. Remove `n_gpu_layers > 0` skip.
3. Make policy result tri-state or otherwise safety-first on unknown.
4. Keep `-rtr auto` parser behavior from `0115ace21`: no parse-time
   `use_mmap=false`.
5. If policy disables repack, leave mmap as user/default.
6. If policy keeps repack, force `use_mmap=false`.
7. Update help text and PR validation row.

Pros:

- Minimal diff.
- Preserves legacy `-rtr` semantics.
- Fixes dmaivel's case.
- Easier to get reviewed.

Cons:

- Existing `-rtr` users do not get protection unless they opt into `auto`.
- Keeps new public `repack_tensors_auto` field.
- Full-model-byte heuristic can false-positive on heavy GPU offload.

### Path B - Make existing `-rtr` self-protective

Do this only if maintainer prefers no new flag.

Required shape:

1. Remove parse-time `-rtr -> use_mmap=false`.
2. Run safety policy whenever `repack_tensors=true`.
3. Resolve mmap after policy:
   - final repack enabled: force `use_mmap=false`;
   - final repack disabled: preserve user/default mmap.
4. Decide whether a force mode is needed for unconditional repack.
5. Consider removing `repack_tensors_auto` from public API.

Pros:

- Best UX for existing scripts.
- Avoids new `auto` surface if no force mode is added.
- Aligns with dmaivel's suggestion.

Cons:

- Changes legacy behavior.
- Larger rewrite.
- Easy to get wrong if mmap coupling remains in parser.

Hard stop:

- Do not implement path B as only "if unsafe, repack=false" in load logic. That
  leaves parser-forced `use_mmap=false` behind and preserves the bad
  swap-bound path.

### Path C - Placement-aware policy

Best long-term design, not recommended for this PR unless maintainer requests
it.

Shape:

- Decide after metadata/hparams and placement planning, before tensor data load
  and before repack.
- Estimate CPU-resident writable tensor bytes instead of full GGUF bytes.

Pros:

- Correct for `-ngl`, `-ot`, `--fit`, split modes, and generated overrides.

Cons:

- Larger refactor.
- Higher review risk.
- Needs broad runtime testing.

## Recommended PR response

Use a short comment. Do not paste the whole internal review.

```text
Thanks, this is a real miss in the current policy.

There are two concrete bugs here. First, the current auto check skips whenever
n_gpu_layers > 0, but your command forces the experts back to CPU with
-ot exps=CPU, so the run is still swap-bound on the CPU side. Second, the check
uses total physical RAM, while the relevant value is available/effective memory.

I also agree with your point about unknown cases. If the auto path cannot
determine that repack is safe, preserving the -rtr path leaves the user with the
same failure mode. The safety mode should disable repack and keep mmap enabled
in that case.

If we keep the explicit auto mode, the minimal fix is:

1. use available/effective memory instead of total RAM;
2. remove the n_gpu_layers skip;
3. make probe-failure/unknown safety-first;
4. update the log/help text to say available memory.

Your suggestion to make -rtr itself self-protective is also reasonable, but it
changes legacy behavior and requires moving the current -rtr -> mmap=false
coupling from parse time to load time. I would prefer Ivan's direction before
rewriting the PR that way.
```

## Recommended code path if Ivan says "keep auto"

Implement only the focused patch:

- `src/llama.cpp`
  - replace RAM helper;
  - add Linux effective available memory with cgroup v2/v1;
  - remove GPU-layer skip;
  - return policy decision enum;
  - safety-first unknown behavior.
- `common/common.cpp`
  - update help wording to "available memory".
- PR body
  - update validation table row to include `-ngl 99 -ot exps=CPU`.

Avoid in first patch:

- placement-aware estimator;
- `llama-bench` reporting overhaul;
- YAML/config tri-state;
- public API redesign;
- duplicate loader log suppression.

## Recommended code path if Ivan says "make `-rtr` self-protective"

Rewrite more deliberately:

- remove `repack_tensors_auto` unless a separate explicit auto/force mode is
  still wanted;
- preserve requested mode and resolved decision internally;
- remove parse-time no-mmap coupling for `-rtr`;
- resolve mmap after safety policy;
- consider adding a force spelling if unconditional repack remains useful.

This is not a small fix on top of the current PR. It is a different PR shape.

## Stop rules

- Do not push current PR as-is.
- Do not push F1/F2 fixes before posting a response unless user explicitly
  decides to proceed without maintainer direction.
- Do not silently change legacy `-rtr` behavior without maintainer approval.
- Do not claim Linux container safety without cgroup-aware available memory.
- Do not claim exact CPU memory accounting while comparing full `probe.n_bytes`.

## Final recommendation

Post the response now. It is better to acknowledge the real bug and ask for
architecture direction than to keep the PR silent while local analysis grows.

If there is no maintainer response after that, proceed with path A as the
smallest responsible update: keep explicit `-rtr auto`, fix the safety policy,
and document the conservative full-model-byte heuristic.

