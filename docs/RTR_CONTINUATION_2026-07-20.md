# RTR: continuation handoff

> Canonical context for continuing the RTR pull request after a restart or
> context compaction. Updated 2026-07-20 (Asia/Irkutsk).

## 1. Current objective

Finish PR [ikawrakow/ik_llama.cpp#1738](https://github.com/ikawrakow/ik_llama.cpp/pull/1738)
without reintroducing the original silent-repack and out-of-memory risks.

Expected PR head prefix:

```text
843de95f
```

Resolve the complete object ID directly from Git or GitHub. Do not reuse a
transcribed long SHA from an older conversation summary.

At this checkpoint the PR is open and review is required. `@ikawrakow` was
explicitly asked to review the refreshed PR. The branch was 0 commits behind
`upstream/main` and 13 commits ahead when last checked.

## 2. Repositories: do not mix them

### RTR PR worktree

```text
O:\user files\Projects\ik_llama.cpp-rtr-pr
branch: feature/rtr-auto-pr-prep
expected HEAD: 843de95f
```

This is the source of the PR and the place where the RTR tests were built.

The GitHub PR head repository is **not** `AndrewMoryakov/ik_llama.cpp`. It is:

```text
AndrewMoryakov/ik_llama-pr
head ref: pr/rtr-auto-mode
```

A branch with the same name also exists in `AndrewMoryakov/ik_llama.cpp`, but
GitHub PR #1738 does not read from it. Verify `pull.head.repo.full_name` before
every force-push.

### Main local worktree

```text
O:\user files\Projects\ik_llama.cpp
branch at checkpoint: feature/rtr-auto-review-fixes
known unrelated commit visible in this tree: c472ed52
```

This tree contains many uncommitted MiniMax/superpowers changes. **Do not run
`reset --hard`, `clean`, mass checkout, or rebase here.** It is not the clean RTR
PR worktree. Run `git status` before any operation and preserve all user work.

## 3. Original confirmed problems

### P1 — `-rtr 1` could do nothing

Parsing set `repack_tensors=true` but left `use_mmap=true`. The actual repack
pass was guarded by `!ml.use_mmap`, so the most common explicit RTR invocation
could be accepted but leave `n_repacked == 0`.

Resolution: once explicit repack is enabled, loader-level mmap is disabled so
the repack pass can execute. For auto mode this is allowed only after a safe
decision; on disable/unknown, repack is turned off and requested mmap remains.

### P1 — compare-bench source incompatibility

The producer moved to a newer schema while the comparison script still read
`test`, and the comparison keys did not adequately isolate RTR configurations.
Runs with and without repack could be mixed.

Resolution: producer schema `test_v3`; source-aware reads for `test`, `test_v2`
and `test_v3`; `source_schema` participates in grouping and joins; RTR fields
are comparison keys; missing legacy values degrade to `Unknown`.

### P1/P2 — unsafe auto-memory conclusions

The auto decision had to account for more than repacked tensor bytes. Enabling
RTR disables mmap for the model load, so total CPU-resident tensors, workspace,
read buffers, CUDA staging, platform/cgroup limits and tensor placement matter.

Resolution rule: **uncertainty => AUTO_UNKNOWN => repack off, requested mmap
preserved**. Never guess AUTO_KEEP.

## 4. Implemented design in `843de95f`

### CLI and state

- `-rtr 0|off`: disabled;
- `-rtr 1|on` and bare `-rtr`: explicit repack;
- `-rtr auto` and alias `-rtra`: guarded automatic mode;
- repeated options obey last-one-wins semantics;
- requested mmap, loader mmap, mmap-backed buffers, repack-pass execution,
  `n_repacked`, and RTR status are distinct observations;
- `repack_effective` is based on `n_repacked > 0`, not only the request bit;
- RTR status values include disabled, enabled, auto_keep, auto_disable and
  auto_unknown.

### Peak model

The checked peak is approximately:

```text
CPU-resident model bytes
+ repack workspace
+ worker count * maximum read buffer
+ worker count * CUDA staging bytes (where active)
```

Overflow, unsupported placement, defer/prefetch interactions, or inability to
obtain trustworthy platform limits returns unknown rather than keep.

### Platform and cgroup behavior

- Linux: parse `/proc/self/cgroup` plus `/proc/self/mountinfo`, handle cgroup v1
  and v2, mount roots, namespaces, escaped paths and all limiting candidates;
- intersect effective limits rather than selecting a convenient mount;
- both `memory.max` and `memory.current` may be absent only exactly at the v2
  mountpoint; absence below it or just one missing file is an error/unknown;
- Windows: any Job Object membership or inability to query it returns unknown;
- available physical/pagefile constraints are considered;
- macOS/other uncertain paths degrade conservatively.

### Defer/prefetch behavior

If model mmap is not active, `defer_experts` is actually disabled after the
warning. Auto mode must not silently invalidate deferred/prefetched expert
assumptions and then report keep.

### Bench schema

`llama-bench` uses `test_v3`, records requested/effective mmap and repack state,
and does not overwrite historical tables. `compare-llama-bench.py` isolates
schema versions and has explicit tests for no-cross-source joins, NULL legacy
values and RTR keys.

## 5. Review history and why these choices are trusted

A multi-phase review was run with Claude through `maestro` before updating the
PR. It found and then re-checked the cgroup-v2 mountpoint issue, defer-state
wording/state mismatch, fixed `% 4` workspace eligibility, NULL repack-status
display, and missing nullptr status assertion.

The final Claude verdict was **GO**, with these explicit boundaries:

1. CUDA, macOS and MinGW were not comprehensively executed locally;
2. an invalid table found beside a valid one still makes compare-bench fail
   closed rather than silently skip data;
3. some display/grouping behavior is a non-blocking reporting limitation;
4. further quantized repack coverage would be useful.

All currently registered repack row groups are 4, 8 or 16, so removing the
hard-coded `% 4` check aligns workspace calculation with `num_rows` and does not
currently enable a non-multiple-of-four registered format.

## 6. Tests completed before the latest full build

- `test-rtr-params`, `test-cgroup-resolver`, `test-rtr-auto-peak`: 3/3 passed;
- compare-bench Python suite: 14/14 passed;
- selected MSVC targets built successfully;
- cgroup and peak headers passed GCC 13.3 with `-Wall -Wextra -Werror`;
- WSL validation reproduced the real mountpoint case:

```text
/sys/fs/cgroup/init.scope: memory files present, skip=0
/sys/fs/cgroup: both files absent at mountpoint, skip=1
```

- an actual model load showed requested mmap=true, loader mmap=false,
  mmap-backed=false, repack executed, `n_repacked > 0`, status enabled;
- a 60-column `test_v3` row was imported and compared successfully.

## 7. Full-build and differential-test checkpoint

The entire available MSVC build completed successfully.

CTest result:

```text
22/26 passed
```

Four tests failed in the PR build:

1. `test-tokenizer-0-bert-bge`;
2. `test-jinja-py` (the plain C++ `test-jinja` test passed);
3. `test-chat-template`;
4. `test-eval-callback` (its run attempted external model/data access).

The same selection was then run against the exact unmodified PR base commit
`9d07d8681ece159a89fb4e16a1f9c9f3a5fac20f` with matching arguments and
environment. Both builds produced:

```text
20% tests passed, 4 tests failed out of 5
```

| Test | RTR PR | Exact upstream base | Classification |
|---|---|---|---|
| `test-tokenizer-0-bert-bge` | failed | failed identically | baseline fixture/tokenizer issue |
| `test-jinja-py` | failed | failed identically | Windows CRLF Python parity issue |
| `test-chat-template` | exit `0xc0000409` | same assertion/exit | baseline failure |
| `test-eval-callback` | model initialization failed without libcurl | same | build/environment dependency |

These four failures reproduce on the exact upstream base and are therefore not
RTR-only regressions. Do not modify RTR code to conceal them. Raw evidence is
stored in:

```text
docs/rtr-handoff/pr-four-tests.log
docs/rtr-handoff/upstream-four-tests.log
```

The original full PR suite remains `22/26`; all RTR-specific tests pass.

## 8. Exact next steps

### A. Verify state before touching anything

```powershell
git -C 'O:\user files\Projects\ik_llama.cpp-rtr-pr' status --short --branch
git -C 'O:\user files\Projects\ik_llama.cpp-rtr-pr' rev-parse HEAD
git -C 'O:\user files\Projects\ik_llama.cpp-rtr-pr' rev-list --left-right-count upstream/main...HEAD
```

Expected head starts with `843de95f`; last known divergence was `0 13`. If the
state differs, stop and understand why before writing.

Verify GitHub source:

```text
repo: ikawrakow/ik_llama.cpp
PR: 1738
expected head repo: AndrewMoryakov/ik_llama-pr
expected head ref: pr/rtr-auto-mode
```

### B. Continue the PR

1. Verify the live GitHub PR state and read any new maintainer comments.
2. If the differential result is not already recorded on PR #1738, post a
   concise evidence-based comment stating that all four failures reproduce on
   the exact upstream base.
3. Wait for and respond to `@ikawrakow` review.
4. Rebase and retest only if `upstream/main` advances or review requests code
   changes.
5. Re-run all RTR and compare-bench tests after any RTR code change, and rerun
   full CTest when the change can affect the full suite.
6. Update `AndrewMoryakov/ik_llama-pr:pr/rtr-auto-mode`, not the similarly named
   branch in the other fork.
7. Do not promise universal CUDA, Metal, MinGW or complete upstream-CI
   guarantees; those remain outside the local validation boundary.

## 9. Definition of done

The PR is ready to merge when:

- GitHub points to the intended head and branch;
- it is not accidentally behind base or rebasing has been revalidated;
- any failure not reproduced on upstream is fixed;
- RTR/peak/cgroup/compare tests pass;
- review comments are resolved;
- tested guarantees and untested platform boundaries remain explicit.

Maintainer review/merge latency is not itself evidence that the code should be
redesigned again.

## 10. Safety rules for the next agent

- preserve all uncommitted files in `O:\user files\Projects\ik_llama.cpp`;
- never use destructive Git cleanup as a convenience;
- never infer successful repack from the request bit alone;
- never return AUTO_KEEP on missing placement/memory evidence;
- do not fold the active MiniMax acceleration work into PR #1738;
- do not add unrelated optimizations while classifying the four failures;
- report facts, commands, hashes and exact test outcomes.

## 11. Related but separate MiniMax work

The main worktree also contains ongoing work on MiniMax-M2 acceleration:
measurement methodology, expert-access simulation, cache/defer ideas and CPU
performance analysis. It shares motivation with RTR but is a separate change
stream and must remain outside PR #1738 until the RTR PR is complete.

### Migration checkpoint validation

The separate MiniMax/MoE worktree snapshot was validated before its migration
checkpoint:

- `python tests/test-moe-cache-sim.py`: 28/28 passed;
- all `tools/moe_cache_sim/*.py` files and the Python test passed `py_compile`;
- MSVC built `test-moe-trace-writer` and `llama-cli` from `build-review`;
- `build-review/bin/Debug/test-moe-trace-writer.exe` passed.

These results validate the transport snapshot. The four full-CTest failures in
the separate RTR PR checkout have also been differentially classified as
reproducing on the exact upstream base; see section 7 and
`docs/rtr-handoff/MIGRATION_STATE.md`.
