# dmaivel feedback on PR #1738 — analysis and proposed response

**Date**: 2026-05-05 (updated same-day after dmaivel edited his comment)
**Comment URL**: https://github.com/ikawrakow/ik_llama.cpp/pull/1738#issuecomment-4376277369
**Status**: response drafted, holding push of code changes pending maintainer input
**Note on edits**: dmaivel edited his original comment (created 03:08 UTC,
latest observed edit 05:19:53 UTC) to insert/refine an `EDIT:` paragraph
addressing the GPU+CPU split case. That paragraph is reflected in the quote
below and analysed as Point 5 further down.

## Original comment

dmaivel (community contributor, not maintainer) tested `-rtr auto` on a
real swap-bound configuration and reported that the auto policy did not
fire when it should have. Quoting the relevant pieces:

> Given that `-rtr` requires mmap to be disabled, I'm not sure users
> running swap-bounded MoE models are likely to specify it in the
> first place.
>
> I tested `-rtr auto` with a model that does not fit in RAM, and it
> behaved the same as `-rtr on`, which seems problematic. This was on
> a Linux system with 64 GB of RAM and a ~120 GB model:
>
> ```
> GGML_CUDA_NO_PINNED=1 ./llama-server \
>     --model ~/.../Qwen3.5-397B-A17B-IQ2_XS-00001-of-00004.gguf \
>     -c 4096 -ngl 99 -ot exps=CPU \
>     -b 4096 -ub 4096 \
>     -rtr auto
> ```
>
> EDIT: For the above, I read your note about GPU+CPU split inference;
> if the path can't determine whether repacking should be enabled or
> disabled, isn't the wiser choice to disable? Otherwise, the user is
> left with the same failure message they would have gotten if they
> just used `-rtr` in its current form.
>
> Also, checking total system memory is not sufficient because the
> allocation can still fail if other processes are consuming a
> significant amount of RAM. In that case, checking available memory
> would be more relevant.
>
> I'm not sure it's necessary, but, if we do want to guard `-rtr`,
> would it make more sense to check whether there is enough available
> RAM and disable it automatically when there is not? That would
> avoid changing the argument to require `on`/`off`/`auto`; instead,
> we could simply print a message saying that `rtr` was disabled due
> to insufficient memory.

## Analysis of each point

### Point 1: «users running swap-bounded MoE are unlikely to specify -rtr»

This is an observation, not a bug. It is also weak as an argument against
the feature. Users routinely follow performance-tuning guides that
recommend `-rtr 1`, then apply that recipe to a model that does not fit
in RAM. The point of an auto-disable safety net is exactly to catch this
mismatch. dmaivel tested this scenario himself, which suggests it is at
least plausible.

Worth acknowledging without conceding the design rationale.

### Point 2 (confirmed bug): `-ngl 99 -ot exps=CPU` does not trigger auto

The implementation has a guard:

```cpp
if (params.n_gpu_layers > 0) {
    return false;
}
```

This was added with the rationale that GPU offload typically shifts the
CPU-side footprint to something small. But the guard inspects only
`n_gpu_layers`, not `tensor_buft_overrides`. dmaivel's command:

- `-ngl 99` sets `params.n_gpu_layers = 99` (effectively all layers on GPU)
- `-ot exps=CPU` overrides expert tensors back to CPU buffer

Result: GPU loads only the small non-MoE portion (attention, embeddings,
output), CPU holds all the experts. For a 120 GB MoE this is roughly
115 GB on CPU, with 64 GB of RAM. Worst case for swap.

Our `n_gpu_layers > 0` skip evaluates true, the auto check returns false,
and the feature behaves identically to `-rtr 1`. dmaivel's report matches
the code path exactly.

### Point 3 (confirmed valid): total vs available RAM

The implementation uses:

- Windows: `MEMORYSTATUSEX.ullTotalPhys`
- Linux: `sysconf(_SC_PHYS_PAGES) * sysconf(_SC_PAGE_SIZE)`

Both return total installed physical memory. They do not reflect what
other processes have already allocated. On a busy machine the actual
allocatable headroom is significantly less.

Better APIs:

- Windows: `MEMORYSTATUSEX.ullAvailPhys`
- Linux: parse `/proc/meminfo` for `MemAvailable` (more accurate than
  `_SC_AVPHYS_PAGES` because it accounts for reclaimable page cache)
- macOS: `host_statistics64(mach_host_self(), HOST_VM_INFO64, ...)`,
  available = `(free_count + inactive_count) * page_size`

### Point 4 (architectural alternative): drop the `auto` mode

dmaivel suggests removing the new `-rtr 0|1|auto` syntax and instead
making `-rtr 1` itself self-protective: always check available RAM, print
a message and skip the repack if there is not enough.

Pros:
- Less new CLI surface
- Existing scripts that say `-rtr` or `-rtr 1` automatically benefit
- Single source of truth for the policy

Cons:
- Changes the behavior of an existing flag. A user who scripts `-rtr 1`
  expecting forced repack will silently get a different load path.
  Arguably this is the right thing if the model would not fit anyway,
  but it is still a behavior change.
- Removes the user's explicit opt-in. Some users may want to force
  repack even on borderline cases for benchmarking.

This is a maintainer decision, not ours to make. Worth surfacing the
trade-off rather than pre-committing.

### Point 5 (added in edit): uncertainty should default to disable

This is the new/refined paragraph dmaivel added via EDIT after reading our
mention that GPU+CPU split inference was the original motivation for the
`n_gpu_layers > 0` skip. He asks: if the path cannot determine whether
repacking should be enabled or disabled, is disabling the wiser default?
Otherwise the user gets the same failure mode as plain `-rtr`.

This is a real and well-formed argument. Reframed in our terms:

- Current behaviour when the auto policy cannot decide (probe failure,
  unknown placement, ambiguous metric): keep `params.repack_tensors`
  set to true, log INFO and continue. This is permissive — it preserves
  the user's explicit choice even when we lack signal.
- Proposed alternative: when the policy cannot decide, disable repack,
  log a WARN that explains why. This is safety-first — it accepts a
  small performance regression on the in-RAM case for protection on
  the swap-bound case.

The argument in favour of safety-first: the failure mode of permissive
default is exactly the failure dmaivel hit (the feature did nothing on
the case it was meant to rescue). The failure mode of safety-first
default is a user with a fits-in-RAM model who scripted `-rtr 1` finds
that repack did not run. The latter is recoverable (re-run without
`auto`, performance is the only thing lost); the former is the
catastrophic OOM scenario that motivated the feature.

This collides directly with our own `FOLLOWUP_REVIEW_2026-05-05.md` D5
and `ADDITIONAL_REVIEW_2026-05-05.md` «Open question for the
maintainer» — we had already flagged this internally before dmaivel's
edit. His edit is independent confirmation that an external reader
arrives at the same question.

Implications for design:

- If maintainer picks option A (keep `-rtr auto`), the policy should
  be safety-first by default. Probe failure should disable rather
  than no-op. WARN level for the disable path.
- If maintainer picks option B (drop `auto`, make `-rtr 1` itself
  self-protective), the entire flag becomes safety-first by
  construction. There is no probe-failure-permissive ambiguity.
- Either way, the current permissive default in `0115ace21` is
  unlikely to be the final shape.

Implication for our reply: acknowledge dmaivel's argument is correct,
state that we had reached the same conclusion in internal review,
note that the right place to set the safety-first default depends on
which architectural option ikawrakow prefers, and offer to fold the
change into whichever shape ships.

Worth noting: dmaivel's prefix «I'm not sure it's necessary» (added in
the same edit, just before the «if we do want to guard `-rtr`»
clause) softens his earlier suggestion. He is not pushing for the
no-flag design; he is laying out the trade-off.

## Compounding interaction between points 2 and 3

The two confirmed issues actually fix each other if we switch the metric.

Original concern that motivated the `n_gpu_layers > 0` skip: model is
big on disk but the CPU-resident portion is small because of GPU offload,
so total-RAM-vs-model-size triggers a false positive.

If we switch from total to available memory, GPU offload that moves bytes
off CPU naturally shows up as more available RAM at probe time. The metric
itself becomes the right answer for both directions. We can drop the
`n_gpu_layers > 0` skip entirely.

For dmaivel's case:
- `available_ram` ≈ 50 GB (64 GB total, minus other processes, minus
  buffers, etc.)
- `model_size` ≈ 120 GB
- `120 > 0.9 * 50 = 45` → policy fires, repack disabled

For the original concern (e.g. 120 GB model, 80 GB on GPU, 20 GB on CPU
on a 96 GB system):
- `available_ram` ≈ 80 GB (most weight is on GPU, CPU footprint is tiny)
- `model_size` ≈ 120 GB
- `120 > 0.9 * 80 = 72` → policy fires, but this is a false positive

The over-estimation when most weight is on GPU is a remaining caveat. In
practice available RAM is usually high in this case so the check rarely
fires spuriously, but it is a sharper instrument than ideal. A precise
fix would estimate CPU-side bytes from probe accounting for
`tensor_buft_overrides` and `n_gpu_layers`. That is a larger change.

For the immediate response we accept this caveat and document it. If
real false positives appear we add the more accurate estimator as a
follow-up.

## Mmap interaction note

After my self-review fix in commit `0115ace21`, the parser for `-rtr auto`
leaves `use_mmap` untouched. In load logic:

- If auto disables repack: `use_mmap` remains as user-set (default true),
  so loader can stream weights via page-faults. Works for swap-bound
  configurations.
- If auto keeps repack on: `use_mmap = false` is set in the else branch
  (legacy alignment with `-rtr 1`).

On dmaivel's system, the current `n_gpu_layers > 0` skip puts execution
into the else branch of load, which sets `use_mmap = false`. Loader then
attempts to load 120 GB into 64 GB RAM with mmap disabled. This is the
catastrophic case (cannot allocate, fails or extremely slow). Hence
dmaivel's «behaved the same as `-rtr on`».

With the proposed fix (available RAM, drop `n_gpu_layers > 0` skip), the
auto policy correctly triggers on his configuration:

- `should_disable` returns true
- if-branch in load: `params.repack_tensors = false`, `use_mmap` left as
  default true
- Loader streams experts through mmap, manageable working set
- Works

## Proposed code fix

Sketch (not pushed, holding for maintainer direction):

1. Replace `llama_get_total_ram_bytes` with `llama_get_available_ram_bytes`,
   using per-OS APIs:
   - Windows: `MEMORYSTATUSEX.ullAvailPhys`
   - Linux: parse `/proc/meminfo` for `MemAvailable`, fall back to
     `sysconf(_SC_AVPHYS_PAGES)` if /proc not readable
   - macOS: `host_statistics64` and `(free_count + inactive_count) * page_size`
2. Drop the `if (params.n_gpu_layers > 0) return false;` guard in
   `llama_rtr_auto_should_disable`.
3. Update log message and PR description to mention "available memory"
   instead of "physical memory".
4. Document in PR: known caveat about overestimation when GPU offload
   shrinks CPU-resident bytes, possible follow-up to estimate CPU-side
   bytes more precisely.
5. Switch probe-failure default from permissive (keep repack) to
   safety-first (disable repack with WARN log). Addresses Point 5
   from dmaivel's edit and FOLLOWUP D5. Trivial code change in
   `llama_rtr_auto_should_disable`'s catch block.

Estimated change: 30-50 lines for items 1-4, plus ~5 lines for item 5.

## Why we are not pushing the fix yet

The technical fix sketched above is held until ikawrakow chooses
between (a) keeping the explicit `-rtr auto` design, (b) rewriting
`-rtr` to be self-protective, or (c) a larger placement-aware design.
Pushing the focused (a)-shaped patch now and then having to rewrite
for (b) or (c) would waste review cycles.

Default behavior if maintainer is silent: proceed with (a) as the
smallest reviewable change. Threshold for "silent" is 5 working days
from the response post (2026-05-05 05:39 UTC), absent any other
signal in the PR.

Response to dmaivel was posted on 2026-05-05 05:39 UTC explicitly
asking ikawrakow to pick between (a)/(b)/(c). See "Response status"
below.

## Response status

Posted upstream on 2026-05-05 at 05:39:45 UTC.

- URL: https://github.com/ikawrakow/ik_llama.cpp/pull/1738#issuecomment-4376786508
- Author: AndrewMoryakov
- Body length: 2753 characters

The response was a tightened revision of the version drafted in
`FINAL_REVIEW_2026-05-05.md` lines 247-269 with three corrections:

1. The mmap claim was rephrased. After commit `0115ace21`, parser no
   longer forces `use_mmap=false` for `-rtr auto`. In dmaivel's case
   mmap is disabled in the load-time "auto keeps repack enabled" else
   branch, not at parse time. The posted text reflects this.
2. Dense-model handling was removed from the uncertainty list. Dense
   means "policy intentionally does not apply", which is distinct from
   "could not determine". Conflating them in the response would have
   misled review.
3. The text was shortened from ~750 to ~470 words to fit a PR-comment
   audience without losing the technical substance.

Key points the posted response covers:

- Confirms both bugs (GPU offload skip too coarse, total vs available
  RAM)
- Explains root cause precisely for each
- Proposes the available-memory fix and notes how it compounds-fixes
  the GPU-offload case
- Acknowledges the over-estimation caveat for heavy GPU-offload
  scenarios
- States the focused fix shape as five numbered steps (item 3 covers
  the keep/disable/unknown tri-state)
- Acknowledges Point 5 (uncertainty defaults to disable) from
  dmaivel's edit
- Surfaces the architectural alternative without committing to either
- Asks ikawrakow to choose between (a) keep auto mode and apply fix,
  (b) rewrite for self-protective `-rtr`, (c) defer to placement-aware
  design
- Declares default behavior on silence: proceed with (a) as smallest
  reviewable change

Verbatim text of the posted comment is preserved on GitHub at the URL
above; we did not commit a copy in this repo.

## What this means for our pre-submit process

We had a thorough pre-submit ANALYSIS document. We also had a follow-up
post-submit bug discovery for the `use_mmap` regression. Now there is a
third class of finding: a community contributor identified a false
negative in our skip logic by running a real workload we did not have
access to.

This pattern (community finds the case maintainer's home setup did not
exercise) is normal in OSS. The lessons:

- Pre-submit testing on synthetic boundary cases is necessary but not
  sufficient. Real configurations with GPU offload, tensor overrides,
  and competing workloads matter.
- Conservative guards (like `n_gpu_layers > 0` skip) can hide failures
  rather than prevent them.
- Available memory is generally a better metric than total memory for
  any "would this allocation succeed" question.
- Architectural feedback (dmaivel's "no new flag" suggestion) deserves
  separate handling from technical bug fixes; bundling them muddles the
  review.
- Default-on-uncertainty matters. The permissive default (preserve
  user choice when probe is ambiguous) sounded reasonable when written
  but produced exactly the failure mode dmaivel hit. Safety-first
  default (disable repack with WARN when uncertain) is the correct
  choice for a feature whose entire purpose is to prevent OOM.
