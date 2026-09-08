# Fork workflow: the branch model

Entry point for anyone — human or agent — starting work in
`AndrewMoryakov/ik_llama.cpp`. It records **where work belongs and why**, not a
claim that any branch is current. Always inspect live Git state before editing
or pushing.

Upstream in this document always means **`ikawrakow/ik_llama.cpp`**. Configure
it under an unambiguous remote name:

```bash
git remote add ik-upstream https://github.com/ikawrakow/ik_llama.cpp.git
```

Do **not** call it `upstream`: a sibling clone of this project already uses that
name for `ggerganov/llama.cpp`, and `git merge upstream/main` typed from muscle
memory would fold vanilla llama.cpp into an ik_llama fork.

## The model at a glance

| | Branch / prefix | Role | Merges |
|---|---|---|---|
| permanent | `main` | stable fork baseline | ← `dev`, fast-forward only |
| | `dev` | integration of everything that is ours | ← `feature/*`, `upstream-sync` |
| | `upstream-sync` | intake of upstream | → `dev` |
| temporary | `feature/<topic>` | work meant for the fork, hardware included | → `dev`, then deleted |
| | `exp/<topic>` | runtime behaviour not yet proven | nowhere, until it passes the gates |
| | `up/<topic>` | an extract offered to upstream | nowhere; cut from `ik-upstream/main` |
| snapshots | `snapshot/*`, `archive/*` | tags, never branches | — |

Code flows one way: `feature/*` → `dev` → `main`; `upstream-sync` → `dev`;
`dev` → `exp/*`. Moving anything back out of `exp/*` is a deliberate act, not a
merge.

## Permanent branches

### `main`
The baseline you can build and run. It changes **only by fast-forward from
`dev`**, after the gates below have passed. No direct commits except an urgent
documentation fix.

Fast-forward rather than merge is deliberate: it makes "`main` is exactly some
gated state of `dev`" true by construction, so there is never a `main` that
nobody validated.

### `dev`
Where everything of ours is integrated. Merge **one branch at a time**, each
through the gates. If two branches are pending, they are two merges with two
gate runs, not one.

### `upstream-sync`
The recurring lane for taking upstream in. One cycle:

```bash
git fetch ik-upstream
git switch upstream-sync && git merge dev          # start from current dev
git merge-tree --write-tree --name-only HEAD ik-upstream/main   # conflict map, no side effects
git merge --no-commit --no-ff ik-upstream/main     # then resolve
# gates
git switch dev && git merge upstream-sync
```

`git merge-tree` is worth the extra step: it computes the whole merge in the
object database, touching neither the working tree, the index, nor `HEAD`. You
get the exact conflict map before committing to anything, and you can re-run it
daily to watch the cost of a pending sync grow.

## Namespaces

### `feature/<topic>` — work for the fork
Anything intended to land in `dev`, **including hardware-specific work**. A
laptop profile, a dashboard, benchmark data and build scripts are ordinary
features: this fork is a personal environment, and there is no reason to keep
its hardware work permanently on the side.

### `exp/<topic>` — unproven runtime behaviour
The boundary between `feature/` and `exp/` is **not** the topic and **not** the
size. It is one question:

> Does this change inference behaviour in a way the gates cannot yet confirm?

A dashboard touches 26 files and zero behaviour — that is a `feature/`. A
hot-expert blend touches 3 files and all behaviour — that is an `exp/`. An
`exp/` branch may live indefinitely; it is synced forward from `dev` so it does
not rot, and it enters `dev` only once someone can show it working.

This matters most while a measurement baseline is open: an unproven runtime
change on the same line as the measurement harness silently invalidates the
numbers.

### `up/<topic>` — an extract offered to upstream
A pull request shows the difference between your branch and the base in the
maintainer's repository. That difference depends on **where you cut the branch
from**, far more than on what you committed. Measured on this repository:

| Branch cut from | Files in the PR diff | Commits |
|---|---|---|
| `dev` | **71** | 46 |
| `ik-upstream/main` | **21** | 13 |

A branch grown from `dev` puts `FORK_WORKFLOW.md`, `dashboard/`,
`docs/rtr-handoff/` and `docs/superpowers/specs/` in front of the maintainer —
not because you proposed them, but because they exist here and not there.

So cut from upstream:

```bash
git fetch ik-upstream
git switch -c up/<topic> ik-upstream/main    # the base is theirs, not ours
git cherry-pick <1-3 commits>                # or write the change fresh
git push prfork up/<topic>     # NOT origin - see below
# PR: base ikawrakow:main  <-  head AndrewMoryakov:up/<topic>
```

**Push `up/*` to `AndrewMoryakov/ik_llama-pr`, not to `origin`.** This
repository is not a GitHub fork:

```console
$ gh api repos/AndrewMoryakov/ik_llama.cpp --jq '{fork, parent}'
{"fork": false, "parent": null}
$ gh api repos/AndrewMoryakov/ik_llama-pr  --jq '{fork, parent}'
{"fork": true, "parent": "ikawrakow/ik_llama.cpp"}
```

It holds the same history but was never created through GitHub's fork button,
so it is outside the upstream fork network. A cross-repository pull request
whose head lives here is rejected — `404` on compare, `422 head invalid` on
create. Add the fork as a remote once:

```bash
git remote add prfork https://github.com/AndrewMoryakov/ik_llama-pr.git
```

Do not leave a copy of an `up/*` branch in `origin` as well. Two branches of
one name in two repositories is exactly the confusion the PR #1738 section
below warns about.

**`up/*` is never merged back.** It is an extract, not a development branch:
the change already exists in `dev`, which is where it came from. If upstream
accepts it, it returns on the next `upstream-sync` as part of upstream. If not,
nothing is lost. There is no dangling merge to forget.

An empty `up/*` lane is a valid state — it means there is nothing worth
offering right now, not that upstream work was abandoned.

## Snapshots are tags, not branches

```text
snapshot/<what>-<date>    a safety point taken before an irreversible step
archive/<branch>-<date>   the tip of a retired branch
```

A branch invites the question "should this be merged?"; a tag only preserves.
Several branches in this repository are snapshots by intent (`milestone/*`,
`safety/*`) and generate that question every time someone reviews the branch
list.

## Inherited upstream branches

Measured 2026-09-08: **742 remote branches, of which 12 are ours.**

```text
ik/*                 697   upstream's own feature branches
s6/*                  27   ditto
fcp/*                  4   ditto
ikawrakow-patch-1/-1-1 2   ditto
feature/*              4   ours
pr/*                   3   ours
milestone/*            2   ours
safety/*               1   ours
main, dev              2   ours
```

The 730 inherited branches came with the copy of upstream's history. They are
not yours and never a merge source. Deleting them cuts the noise that makes
"tidy up the branches" look impossible when it is in fact a 12-item task.

**How to get one back, corrected 2026-09-08.** An earlier version of this file
claimed the objects survive deletion because forks share storage with their
parent. That is true of real GitHub forks and **not true here** — this
repository is not one (see the `up/*` section). Once the last ref to a commit
is gone, GitHub may garbage-collect it. The recovery path is therefore through
upstream, which still has every one of those branches:

```bash
git fetch ik-upstream '+refs/heads/*:refs/remotes/ik-upstream/*'
git push origin <sha>:refs/heads/<name>     # sha and name from the manifest
```

`docs/branch-manifest-2026-09-08.tsv` records the name and SHA of all 742 refs
as they stood before the prune. Restoring `ik/mla` this way was verified
immediately after the prune; that test proves the mechanism, not that the
objects will still be in *this* repository months later.

## Where the fork's content actually lives

Also measured 2026-09-08, with
`git rev-list --count <branch> --not dev feature/raptor-lake-laptop`:

| Branch | Commits outside `dev` ∪ `raptor-lake` |
|---|---|
| `dev` (pre-2026-09-08 tip) | 0 |
| `feature/rtr-auto-v2` | 0 |
| `feature/rtr-auto-review-fixes` | 0 |
| `feature/minimax-step0-readiness` | 0 |
| `milestone/2026-03-01-logical-snapshot` | 0 |
| `milestone/upstream-sync-2026-05-02` | 0 |
| `safety/pre-upstream-merge-2026-05-02` | 0 |
| `pr/rtr-auto-mode` | 13 |
| `pr/rtr-auto-mode-v2` | 2 |
| `pr/docs-zen-cpu-build` | 1 |

The whole fork is three lines: `dev`, `feature/raptor-lake-laptop`, and the
three `pr/*`. The rest are historical imprints that store nothing unique. A
branch with zero unique commits should be archived as a tag and deleted — it
costs a decision every time it is read, and preserves nothing.

## Migration from the current layout

Pending; none of it is done yet, and every step below touches `origin`.

| Now | Action | Why |
|---|---|---|
| `feature/upstream-integration` | rename → `upstream-sync` | make the lane permanent and recurring |
| `dev` (old tip `b226021f`) | tag `archive/dev-2026-05-06` (done), delete branch | 0 unique |
| `feature/rtr-auto-v2` | archive tag, delete | 0 unique |
| `feature/rtr-auto-review-fixes` | delete | already in `dev` |
| `feature/minimax-step0-readiness` | delete once the Step0 baseline is captured | already in `dev` |
| `milestone/*`, `safety/*` | convert to tags, delete branches | these are snapshots |
| `feature/raptor-lake-laptop` | merge into `dev` in three portions (below) | hardware work belongs in `dev` |
| raptor's experimental runtime | split into `exp/hot-experts`, `exp/rtr-auto-v2` | unproven behaviour |
| `pr/rtr-auto-mode` | → `up/rtr-auto` | upstream candidate |
| `pr/rtr-auto-mode-v2` | archive tag | 2 commits, superseded |
| `pr/docs-zen-cpu-build` | → `up/docs-zen-build` | upstream candidate |
| `ik/*`, `s6/*`, `fcp/*`, `ikawrakow-patch-*` | leave, or delete from the fork | not ours |

### Folding `raptor-lake-laptop` into `dev`

Three portions, by increasing risk:

| # | Content | Files | Effect on the binary |
|---|---|---|---|
| 1 | `dashboard/`, `eval/`, `bench_results/`, docs | ~396 | none — the gates are unaffected by construction |
| 2 | `build_raptor_lake.bat`, `project_docs/hardware/`, laptop profile | a few | build only; one gate run confirms it |
| 3 | experimental runtime (rtr-auto v2, hot-expert blend, prompt-packed-qkv, `--experimental` CLI) | ~14 | yes — this is where all 9 merge conflicts live |

Portion 1 is verifiable in one command: if the diff touches nothing under
`ggml/`, `src/`, `common/` or `examples/`, the build cannot have changed.

Note before porting anything from that branch: its MSVC AVX-VNNI VEX/EVEX fix
(`bfff3fb7`) is **obsolete**. Upstream now solves the same problem in
`ggml/src/iqk/iqk_config.h` with named `ggml_mm256_dpbusd_epi32` wrappers rather
than by redefining the standard intrinsics. Check the new base before carrying
an old fix across; otherwise you reintroduce a regression as an improvement.

## Special case: PR #1738

```text
https://github.com/ikawrakow/ik_llama.cpp/pull/1738
head repository: AndrewMoryakov/ik_llama-pr
head branch:     pr/rtr-auto-mode
base:            ikawrakow/ik_llama.cpp:main
```

**Closed 2026-09-08.** The branch had not tracked `main` for a while — upstream
was 143 commits past the PR head `843de95f` and the PR showed as conflicting.
Upstream never took the feature: `-rtr` there is still a plain boolean and none
of the PR's files exist in `ikawrakow/main`. The fork-side branches
`pr/rtr-auto-mode` and `pr/rtr-auto-mode-v2` are archived as tags.

The routing note above is **not** a special case — it is the general rule,
and the reason is now understood: `ik_llama-pr` is the only repository of the
two that GitHub recognises as a fork, so every upstream PR must be served from
it. See the `up/*` section. Before any push aimed at an open PR, still verify
`pull.head.repo.full_name` and `pull.head.ref` with `gh`.

First contribution under this rule: PR
[#2425](https://github.com/ikawrakow/ik_llama.cpp/pull/2425), one commit and
one file, served from `ik_llama-pr`.

## The gates

Every merge into `dev`, and every `upstream-sync` cycle, passes:

1. **Build** — clean CPU-only Release build.
   `cmake -G Ninja -DCMAKE_BUILD_TYPE=Release -DGGML_CUDA=OFF`
2. **Tests** — `ctest`. Four failures are known and pre-existing on upstream
   itself: `test-tokenizer-0-bert-bge`, `test-jinja-py`, `test-chat-template`
   (`0xc0000409`) and `test-eval-callback` (needs libcurl). The reference logs
   are committed at `docs/rtr-handoff/upstream-four-tests.log` and
   `pr-four-tests.log` — compare against them rather than re-diagnosing.
3. **`--help` audit** — the fork's flags and the new upstream flags are both
   listed. This is the only check that catches a flag whose parser survived a
   merge while its help entry did not; it has already caught one (`-rtra`).
4. **Smoke** — a short generation on a small model, plus the instrumentation
   artefacts when they are in play (`--token-timing`, `--moe-trace`).

The last full run is recorded in
`docs/sessions/2026-09-08-upstream-merge/evidence-2-gate-results-2026-09-08.md`.

## Safe operating rules

1. Start with `git status --short --branch`, `git fetch --all --prune` and
   `git log --oneline --decorate -n 10`.
2. Never use `reset --hard`, `git clean`, mass checkout or rebase to discard
   work whose ownership you do not understand.
3. Tag a `snapshot/` before anything irreversible.
4. Do the risky half of a merge in a **worktree**, not in the checkout you work
   in daily. Choose the merge direction so that a conflict leaves the scratch
   worktree in a merging state, never the primary one.
5. `git worktree add -b <branch>` sets tracking to the source branch. Run
   `git branch --unset-upstream` on integration branches, or a careless `git
   push` lands on the shared branch it was cut from.
6. Before merging into `dev` or `main`, record the source branch, the tests
   run, and whether the change is fork-only or an upstream candidate.
7. Branch names and PR status are not live truth. Verify divergence, remotes
   and PR head repository immediately before a push.

## Navigation

```bash
git branch --show-current
git status --short --branch
git fetch --all --prune
git worktree list

# what does this branch actually add?
git rev-list --count <branch> --not ik-upstream/main

# is it already contained somewhere?
git merge-base --is-ancestor <branch> dev && echo contained

# what would a merge cost, without touching anything?
git merge-tree --write-tree --name-only dev <branch>
```

If this file conflicts with the live state of GitHub, preserve its safety
boundaries and correct the map in a dedicated documentation commit.
