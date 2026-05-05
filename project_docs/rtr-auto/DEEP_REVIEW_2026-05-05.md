# Deep review PR #1738: `-rtr auto`

Дата ревью: 2026-05-05  
PR: <https://github.com/ikawrakow/ik_llama.cpp/pull/1738>  
Reviewed snapshot: `0115ace21eaee3853f015f5e703ffef2ec2a8acc` (`runtime : add --run-time-repack auto mode for swap-bound MoE safety`)  
Local review branch: `pr/rtr-auto-mode`  
Report branch: `dev`

## Methodology

Проверенный внешний статус PR через `gh`:

- `gh pr view 1738 --repo ikawrakow/ik_llama.cpp --json state,reviewDecision,headRefOid,updatedAt,comments`
- `gh api repos/ikawrakow/ik_llama.cpp/issues/1738/comments`
- `gh api repos/ikawrakow/ik_llama.cpp/pulls/1738/comments`
- `gh api repos/ikawrakow/ik_llama.cpp/pulls/1738/reviews`

Состояние на момент ревью:

- PR открыт.
- `headRefOid` совпадает с `0115ace21eaee3853f015f5e703ffef2ec2a8acc`.
- `reviewDecision = REVIEW_REQUIRED`.
- Pull request reviews отсутствуют.
- Pull request code comments отсутствуют.
- Последний содержательный внешний feedback - комментарий `dmaivel` про `-ngl 99 -ot exps=CPU -rtr auto`, total-vs-available RAM и возможную архитектурную альтернативу "make `-rtr` self-protective".

Локально проверено:

- `git checkout pr/rtr-auto-mode`
- `git log -1 --oneline --decorate`
- `git diff origin/main..HEAD --stat`
- `git diff --check origin/main..HEAD`
- targeted source review по изменённым файлам:
  - `common/common.cpp`
  - `common/common.h`
  - `include/llama.h`
  - `src/llama.cpp`
  - `examples/llama-bench/llama-bench.cpp`
- targeted dependency review:
  - `src/llama-model-loader.cpp`
  - `src/llama-model-loader.h`
  - `src/llama-mmap.cpp`
  - `src/llama-hparams.cpp`
- RTR docs read полностью:
  - `project_docs/rtr-auto/README.md`
  - `project_docs/rtr-auto/ANALYSIS.md`
  - `project_docs/rtr-auto/POST_SUBMIT_BUG_2026-05-04.md`
  - `project_docs/rtr-auto/DMAIVEL_FEEDBACK_2026-05-05.md`

Build/test не запускались, потому что task spec явно говорит не билдить "just because". Единственная mechanical gate: `git diff --check origin/main..HEAD`, результат чистый.

## Severity summary

| Severity | Count | Notes |
| --- | ---: | --- |
| 🔴 Critical | 1 | Known from `dmaivel`, real swap-bound MoE scenario can keep legacy dangerous `-rtr on` behavior. |
| 🟡 Medium | 4 | One known memory-policy bug, three new review risks. |
| 🟢 Low | 2 | Benchmark/reporting and docs/config drift. |
| ℹ Informational / clean | 5 | Multi-shard, mmap lifetime, integer math, concurrency, failure mode observations. |

Known vs new:

- Known before this review: F1, F2.
- New from this review: F3, F4, F5, F6, F7.

## Findings

### F1 - 🔴 Critical - `n_gpu_layers > 0` skip breaks real `-ot exps=CPU` swap-bound MoE

Status: known from `dmaivel`, independently confirmed by code review.

Location:

- `src/llama.cpp:3387-3390`
- `src/llama.cpp:3444-3459`
- `common/common.cpp:1641-1688`

Current logic:

```cpp
// Mixed CPU/GPU placement can make total model size a bad proxy for RAM pressure.
// Be conservative and keep legacy behaviour until placement-aware accounting exists.
if (params.n_gpu_layers > 0) {
    return false;
}
```

What goes wrong:

- The skip treats any `n_gpu_layers > 0` as "mixed placement, cannot reason about RAM".
- The real reported command uses `-ngl 99 -ot exps=CPU`, so expert tensors are explicitly routed to CPU while non-expert layers may be offloaded.
- The auto policy never inspects `params.tensor_buft_overrides` before returning `false`.
- `llama_model_load()` then takes the "auto keeps repack enabled" branch and forces `params.use_mmap = false`.
- For a swap-bound expert-heavy MoE, this recreates the exact failure mode that `auto` is supposed to prevent.

Root cause:

- The policy uses `n_gpu_layers` as a coarse proxy for actual RAM pressure.
- The runtime already has a more specific signal in `tensor_buft_overrides`, but the auto probe exits before using it.

Why severity is critical:

- This was reproduced by an upstream collaborator on the target class of workload: Linux, 64 GiB RAM, ~120 GiB multi-shard MoE, experts on CPU.
- The user-visible behavior is indistinguishable from `-rtr on` in the unsafe scenario.
- This is not an edge-only correctness issue; it directly invalidates the main upstream promise for common hybrid MoE usage.

Recommendation:

- Do not ship current policy as-is if maintainer wants `auto` to protect `-ngl ... -ot exps=CPU` runs.
- Minimal fix for current design: remove the unconditional `n_gpu_layers > 0` skip and base the decision on RAM-resident tensors or at least treat CPU-forced experts as CPU RAM pressure.
- Better architectural fix: decide after placement information is available, or make `-rtr` self-protective based on available RAM and actual CPU-loaded bytes.
- If keeping conservative skip temporarily, log an explicit warning that `auto` was not evaluated because GPU layers are enabled; silent fallback to repack-on is too dangerous.

### F2 - 🟡 Medium - total physical RAM is the wrong threshold input

Status: known from `dmaivel`, independently confirmed by code review.

Location:

- `src/llama.cpp:3350-3372`
- `src/llama.cpp:3391`
- `src/llama.cpp:3424-3431`

Current logic:

- Windows: `GlobalMemoryStatusEx().ullTotalPhys`
- Linux: `_SC_PHYS_PAGES * _SC_PAGE_SIZE`
- macOS: `sysctl(CTL_HW, HW_MEMSIZE)`
- Threshold: `model_bytes > 90% of total physical RAM`

What goes wrong:

- The risk is not "model larger than installed RAM" in isolation.
- The risk is "repack requires non-mmap writable tensor buffers and enough currently available RAM headroom".
- On a machine with 128 GiB installed RAM and 80 GiB already in use, a 90 GiB MoE can pass the current total-RAM threshold even though repack is likely to fail or thrash.

Root cause:

- The probe asks "is this model bigger than physical RAM?".
- The feature requirement is "is there enough currently available memory to safely do the repack path?".

Why severity is medium:

- It can produce false negatives for the safety policy on busy systems.
- It is less immediately reproducible than F1, but it is a fundamental mismatch between the heuristic and the failure mode.

Recommendation:

- Replace total-RAM threshold with available-memory threshold.
- Use platform-specific available memory:
  - Windows: `MEMORYSTATUSEX::ullAvailPhys`
  - Linux: `/proc/meminfo` `MemAvailable`, plus cgroup handling from F5
  - macOS: `host_statistics64()` free/inactive/speculative accounting or an equivalent available-memory helper
- Log the exact value used: "available RAM", not "RAM".
- Revisit threshold after switching to available memory; `90% of available` is probably too aggressive because repack has allocator overhead.

### F3 - 🟡 Medium - probe duplicates normal GGUF loader metadata logs

Status: new from this review.

Location:

- `src/llama.cpp:3398-3413`
- `src/llama.cpp:3462-3465`
- `src/llama-model-loader.cpp:412`
- `src/llama-model-loader.cpp:433`
- `src/llama-model-loader.cpp:553-577`

What happens:

- `llama_rtr_auto_should_disable()` constructs a normal `llama_model_loader` just to inspect metadata and hparams.
- `llama_model_loader` logs normal loader messages while doing that:
  - additional split metadata loaded
  - loaded meta data with key-value pairs and tensors
  - full key-value dump when verbosity enables it
  - tensor type counts
- Then `llama_model_load()` constructs the real loader and logs the same metadata path again.

Why this matters:

- `-rtr auto` can make logs look like the model was loaded twice.
- On multi-shard MoE, this makes startup diagnostics noisier exactly in the path where users need clear memory behavior.
- Log parsers and benchmark harnesses can accidentally count metadata/load messages twice.
- The final policy message ("disabled" or "keeping repack enabled") appears between two loader passes, which makes the startup story harder to read.

Root cause:

- There is no quiet/probe mode for `llama_model_loader`.
- The policy is implemented as a pre-loader dry run instead of integrating the decision into the real loader lifecycle.

Why severity is medium:

- It is not a memory safety bug.
- It is a user-facing observability regression in a feature whose primary value is explainable safety behavior.

Recommendation:

- Preferred: avoid the second loader by moving the auto decision into the real loader path after metadata/hparams are available and before tensor buffers are allocated/repacked.
- If that is too invasive: add a `quiet` or `probe` flag to `llama_model_loader` and suppress normal metadata logs during policy probing.
- At minimum: make the probe logs explicitly say "RTR auto probe" so users can distinguish them from real loading.

### F4 - 🟡 Medium - public C API/ABI surface changes by adding `repack_tensors_auto`

Status: new from this review.

Location:

- `include/llama.h:363-431`
- `include/llama.h:421-422`
- `include/llama.h:584-586`
- `src/llama.cpp:5564-5618`

Change:

```cpp
bool repack_tensors;      // repack if available
bool repack_tensors_auto; // if true, may auto-disable run-time repack on swap-bound MoE
bool use_thp;             // use THP if available
```

Risk:

- `struct llama_model_params` is public and passed by value to model-load APIs.
- Adding a field changes struct size and layout.
- Existing binaries compiled against the old header but dynamically linked against a new library can mis-pass `llama_model_params`.
- `llama_model_default_params()` also returns the struct by value, so return ABI is part of the compatibility surface.

Source compatibility notes:

- Normal source rebuilds should work because default params initialize the new field at `src/llama.cpp:5601`.
- Callers using aggregate positional initialization are more fragile.
- Adding the field in the middle of the bool block also shifts subsequent fields for source code that relies on layout assumptions.

Why severity is medium:

- If upstream treats the C API as not ABI-stable between builds, this is acceptable but should be an explicit maintainer call.
- If upstream cares about drop-in shared-library compatibility, this is a real break.

Recommendation:

- Ask maintainer whether this API/ABI break is acceptable for this fork.
- If not acceptable, keep `auto` out of `llama_model_params` and implement it in CLI/common layer, or add a versioned/extended params mechanism, or expose a setter rather than changing a by-value public struct.
- If acceptable, mention the API-surface change in the PR description because it is not just "CLI syntax".

### F5 - 🟡 Medium - Linux memory probe is not cgroup/container aware

Status: new from this review.

Location:

- `src/llama.cpp:3358-3363`
- `project_docs/rtr-auto/ANALYSIS.md` pre-submit rationale around Linux RAM detection

Current Linux logic:

```cpp
const long pages     = sysconf(_SC_PHYS_PAGES);
const long page_size = sysconf(_SC_PAGE_SIZE);
```

What goes wrong:

- `_SC_PHYS_PAGES` is physical host/VM page count, not a reliable process memory budget.
- In common Docker/cgroup deployments, the process may have a memory limit lower than host RAM.
- `/proc/meminfo MemAvailable` alone is also usually host-level and does not fully solve container limits.
- The pre-submit analysis claim that Docker reports cgroup limit through `sysconf(_SC_PHYS_PAGES)` is not a safe assumption.

Impact:

- In a container with 256 GiB host RAM but a 64 GiB memory limit, a 100 GiB MoE can look safe to current logic.
- Auto can keep repack enabled and force `use_mmap=false`, then the process hits cgroup OOM instead of disabling repack.

Root cause:

- The probe models installed memory, not the effective memory budget of the process.

Recommendation:

- If Linux support is part of the PR promise, add cgroup-aware budget detection:
  - cgroup v2: `memory.max`, `memory.current`
  - cgroup v1: `memory.limit_in_bytes`, `memory.usage_in_bytes`
  - fallback to `/proc/meminfo MemAvailable`
- Use the minimum of host-available and cgroup-available when both are present.
- If cgroups are intentionally out of scope, document that explicitly and avoid claiming Docker/cgroup safety.

### F6 - 🟢 Low - `llama-bench` cannot report `auto` distinctly from `on`

Status: new from this review.

Location:

- `examples/llama-bench/llama-bench.cpp:264-265`
- `examples/llama-bench/llama-bench.cpp:797-818`
- `examples/llama-bench/llama-bench.cpp:999-1052`
- `examples/llama-bench/llama-bench.cpp:1346`
- `examples/llama-bench/llama-bench.cpp:1394`
- `examples/llama-bench/llama-bench.cpp:1514-1581`
- `examples/llama-bench/llama-bench.cpp:1958-1959`

What is correct:

- Parser accepts `-rtr auto`.
- `cmd_params_instance` carries both `repack` and `repack_auto`.
- `to_llama_mparams()` maps both into `llama_model_params`.
- `equal_mparams()` includes `repack_auto`, so model reload grouping is correct.

What is wrong:

- Benchmark result `struct test` only stores `bool repack`.
- Output fields only include `repack`.
- Markdown/CSV/SQL-style output cannot distinguish:
  - `-rtr 1`
  - `-rtr auto` that kept repack enabled
  - `-rtr auto` that disabled repack at load time

Why this matters:

- `llama-bench` is an evidence generator for exactly this feature.
- A benchmark table that says `rtr=1` for an `auto` run is ambiguous and can mislead future analysis.

Recommendation:

- Represent RTR mode as an enum/string in bench output: `off`, `on`, `auto`.
- Or add a separate output field `repack_auto`.
- If possible, also expose the final resolved load decision (`auto_disabled` vs `auto_kept`) because that is the real behavioral split.

### F7 - 🟢 Low - docs/config output drift after adding `auto`

Status: new from this review.

Location:

- `docs/parameters.md:100`
- `common/common.cpp:2731-2734`
- `common/common.cpp:4699`
- `README.md:10`

Issues:

- `docs/parameters.md` still documents `-rtr, --run-time-repack` as a simple flag with no `0|1|auto`.
- Common help now says "model > 90% of RAM"; if F2 changes to available RAM, this help text will become stale.
- YAML/config dump writes only `repack: true/false` and loses `repack_tensors_auto`.
- Repository README still warns not to use `-rtr` for hybrid CPU/GPU MoE; with current F1 this warning remains materially relevant, but it does not clarify whether `auto` changes anything.

Why severity is low:

- This does not break runtime behavior directly.
- It increases support burden and can corrupt reproducibility records.

Recommendation:

- Update `docs/parameters.md` once maintainer chooses architecture.
- Add a config/reporting key for `repack_tensors_auto` or represent mode as a single tri-state.
- Keep README warning conservative unless F1 is fixed; after F1, clarify the exact supported hybrid scope.

## Verified clean

### C1 - Multi-shard GGUF size accounting includes all shards

Location:

- `src/llama-model-loader.cpp:359-412`
- `src/llama-model-loader.cpp:423`
- `src/llama.cpp:3424`

Review result:

- `llama_model_loader` reads `LLM_KV_SPLIT_COUNT`.
- For split models, it opens additional GGUF files and appends all split tensors into `weights`.
- `n_bytes` is accumulated over `weights`, not just the first shard.
- `llama_rtr_auto_should_disable()` uses `probe.n_bytes`, so the current model-size proxy is multi-shard aware.

Conclusion:

- No "first shard only" bug found.

### C2 - Probe does not actually mmap tensor data

Location:

- `src/llama.cpp:3397-3409`
- `src/llama-model-loader.cpp:983`
- `src/llama-model-loader.cpp:1060`

Review result:

- The code comment says "Metadata-only probe: mmap + no repack".
- The constructor receives `use_mmap=true`, but tensor mappings are created only by `llama_model_loader::init_mappings()`.
- The probe path never calls `init_mappings()`.

Conclusion:

- No mmap lifetime/double-mmap issue found in the probe.
- The comment is slightly misleading: it is "mmap-eligible metadata probe", not an actual mmap probe.

### C3 - Probe resource lifetime looks safe

Location:

- `src/llama.cpp:3398-3413`
- `src/llama-model-loader.cpp:599-605`
- `src/llama.cpp:404-419`

Review result:

- Probe loader is stack-scoped and its destructor frees GGUF metadata contexts.
- Probe model only loads arch/hparams metadata; it does not allocate model tensor buffers in this path.
- No ownership transfer from probe loader/model into the real loader was found.

Conclusion:

- No obvious leak, double free, or dangling mmap lifetime issue found.

### C4 - Integer threshold math is acceptable for supported targets

Location:

- `src/llama.cpp:3350-3372`
- `src/llama.cpp:3424-3427`

Review result:

- Threshold calculation uses `phys_ram - phys_ram / 10`, avoiding multiplication overflow.
- `probe.n_bytes` is `size_t` then cast to `uint64_t`; on practical 64-bit targets this is fine.
- On 32-bit, `size_t` already limits loader accounting for huge models, so this feature is not the primary blocker.

Conclusion:

- No new integer overflow issue found for 64-bit targets.

### C5 - No new obvious concurrency hazard

Location:

- `src/llama.cpp:3350-3439`
- `src/llama.cpp:3444-3459`

Review result:

- RAM probe uses local variables and OS read-only APIs.
- Loader probe uses local stack objects.
- The only shared behavior is existing global logging, where interleaving can already happen with concurrent loads.

Conclusion:

- No new data race found.

## Failure mode notes

The probe catches `std::exception` and falls back to keeping repack as-is:

- `src/llama.cpp:3434-3437`

This is conservative from a "do not change behavior on probe failure" standpoint, but not conservative from a swap-safety standpoint. If the feature's mission is safety, "probe failed -> keep repack enabled" can still be the dangerous choice. This intersects with `dmaivel`'s architectural question: if the policy cannot determine safety, should it disable repack rather than preserve legacy behavior?

No concrete non-`std::exception` probe throw path was found in normal metadata loading, but `GGML_ASSERT` paths can still abort on invalid/inconsistent metadata. That is consistent with existing real-load behavior, not a new RTR-specific bug.

## Conclusion

Verdict: not ready to push additional fixes until maintainer chooses the architecture, but the current PR snapshot should not be accepted as-is for the claimed swap-bound MoE safety behavior.

The two blocking design questions are:

- Should `auto` be a new explicit mode, or should legacy `-rtr` become self-protective when available memory is insufficient?
- Should failure/unknown cases preserve legacy behavior, or should they disable repack to protect swap-bound users?

If maintainer keeps the current explicit `-rtr auto` direction, minimum technical fix set before merge:

- Fix F1: placement/override-aware policy; do not skip `-ngl ... -ot exps=CPU`.
- Fix F2: use available/effective memory, not total installed RAM.
- Decide F4: confirm public ABI/API change is acceptable or redesign the params surface.

Recommended follow-up before final upstream reply:

- Do not send a purely apologetic response to `dmaivel`; acknowledge that his test exposed a real policy bug.
- Ask `ikawrakow` explicitly for architecture preference: explicit `auto` mode vs self-protecting `-rtr`.
- If `ikawrakow` prefers minimal patch, push F1/F2 only first; keep F3/F6/F7 as cleanup unless maintainer asks for polish in same PR.

## Не покрыто

- No build run in this review.
- No Linux/macOS compile verification.
- No runtime test on a real 4-shard swap-bound MoE.
- No sanitizer/valgrind run.
- No binary ABI repro with old headers and new shared library.
- No performance measurement of probe startup overhead.
- No source review outside the RTR call path except loader/mmap/hparams dependencies needed for this feature.

