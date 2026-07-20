# Fork workflow map

This file is the entry point for an agent or contributor starting from this
fork's `main` branch. It records **where work belongs**, not a claim that any
branch is current or mergeable. Always fetch and inspect live Git state before
editing or pushing.

## First decision: choose the correct branch

| Work type | Start from / work in | Why |
|---|---|---|
| Stable baseline, documentation, or a small fork-wide maintenance change | `main` | The default branch of `AndrewMoryakov/ik_llama.cpp`; keep it usable and free of experimental work. |
| Combine changes intended for this fork, after review | `dev` | Integration branch. Do not use it as an unreviewed scratch branch. |
| Bring changes from `ikawrakow/ik_llama.cpp` into this fork | `feature/upstream-integration` | Isolates upstream merges and their conflict resolution before proposing a merge to `dev`. |
| Ryzen/Raptor-Lake-specific local CPU experiments | `feature/raptor-lake-laptop` | Personal hardware branch; it may remain a fork-only experiment and is not automatically an upstream candidate. |
| RTR PR #1738 review, fixes, tests, or maintainer responses | the dedicated RTR PR worktree described below | The PR is sourced from a different fork. Do not accidentally push RTR PR commits to this repository's similarly named branch. |
| MiniMax/MoE SSD/cache/prefetch research and prototypes | `feature/rtr-auto-review-fixes` | This branch contains the current research snapshot and AI handoff. It is separate from the RTR PR and must not be folded into it. |
| A new independent feature | a new `feature/<topic>` branch from the intended base | Keep the experiment isolated; document its purpose and intended destination before merging. |

## RTR PR #1738: special routing

The authoritative GitHub PR is:

```text
https://github.com/ikawrakow/ik_llama.cpp/pull/1738
head repository: AndrewMoryakov/ik_llama-pr
head branch: pr/rtr-auto-mode
base: ikawrakow/ik_llama.cpp:main
```

The branch `pr/rtr-auto-mode` may also exist in this fork, but GitHub PR #1738
does **not** read from it. Before every push, verify `pull.head.repo.full_name`
and `pull.head.ref` using GitHub or `gh`.

Bootstrap the isolated PR worktree from a clone of this fork:

```bash
git remote add upstream https://github.com/ikawrakow/ik_llama.cpp.git
git remote add prfork https://github.com/AndrewMoryakov/ik_llama-pr.git
git fetch --all --prune
git worktree add -b feature/rtr-auto-pr-prep ../ik_llama.cpp-rtr-pr \
  prfork/pr/rtr-auto-mode
```

Read these committed handoff files before changing RTR code:

```text
docs/RTR_CONTINUATION_2026-07-20.md
docs/rtr-handoff/MIGRATION_STATE.md
```

They contain the solved safety invariants, exact PR/base identities, validation
evidence, known upstream-reproduced test failures, and the next action. Treat
their identifiers as a checkpoint: re-check live state before acting.

## MiniMax/MoE work: separate stream

The MiniMax-M2 acceleration work is intentionally outside PR #1738. Its
research, measurement plan, trace tooling, cache simulator and tests are on
`feature/rtr-auto-review-fixes`, notably under:

```text
docs/superpowers/specs/
tools/moe_cache_sim/
tests/test-moe-cache-sim.py
```

Do not merge this stream into the RTR PR merely because both involve model
loading or expert tensors. First follow the documented measurement and quality
gates, then create a focused feature branch/PR for any implementation.

## Safe operating rules

1. Start with `git status --short --branch`, `git fetch --all --prune`, and
   `git log --oneline --decorate -n 10`.
2. Never use `reset --hard`, `git clean`, mass checkout, or rebase to discard
   work whose ownership is not understood.
3. Keep upstream integration, fork integration, hardware experiments, RTR PR
   work, and MiniMax research in their designated branches/worktrees.
4. Before merging into `dev` or `main`, record the source branch, tests run,
   intended audience, and whether the change is suitable for upstream.
5. Branch names and PR status are not live truth. Verify divergence, remotes,
   PR head repository, and maintainer feedback immediately before a push.

## Minimal navigation commands

```bash
git branch --show-current
git status --short --branch
git fetch --all --prune
git branch -vv
git worktree list
git log --graph --oneline --decorate --all -n 80
```

If this map conflicts with current GitHub state, preserve this file's safety
boundaries and update the map in a dedicated documentation commit.
