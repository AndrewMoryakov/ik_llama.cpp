# Copy/paste prompt: MiniMax target-machine agent

```text
Continue MiniMax-M2.7 live-test preparation in AndrewMoryakov/ik_llama.cpp.

1. Clone/fetch the fork and read the fork-wide branch map:
   git fetch origin --prune
   git show origin/main:FORK_WORKFLOW.md
2. Switch to the execution branch and fast-forward it before doing any work:
   git switch feature/minimax-step0-readiness
   In a fresh clone, Git normally creates the local branch from the unique
   origin branch. If the switch command fails because no local branch exists,
   run this instead:
   git switch --track origin/feature/minimax-step0-readiness
   Then continue:
   git merge --ff-only origin/feature/minimax-step0-readiness
   git status --short --branch
   Stop and ask the operator if the worktree has unexpected modifications.
3. Verify that the checked-out commit contains the finalized readiness fixes:
   git merge-base --is-ancestor 88235a0a6143a8f9fb37af191acbeca0f5fb680f HEAD
   Stop if this command returns non-zero.
   This SHA is the minimum implementation ancestor, not an expected exact HEAD;
   the branch-tip SHA recorded in main is only a moving documentation checkpoint.
4. Read FIRST, before the runbook:
   - docs/superpowers/specs/step0/PREFLIGHT_FINDINGS_2026-09-08.md
     Part of runbook section 0 is already done and recorded there; two
     conditions of section 1 are NOT met (the pagefile shares the model SSD,
     and C: has under 400 MB free). Both need an operator decision before an
     authoritative baseline can be claimed. It also records the exact
     PhysicalDisk instance, the build layout in use, and one open question:
     the runbook targets MiniMax-M2.7 while the disk holds
     MiniMax-M2.5-VariantA.
5. Then read, in this order:
   - docs/superpowers/specs/00-INDEX.md
   - docs/superpowers/specs/step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md
   - docs/superpowers/specs/step0/MINIMAX_METRICS_IMPLEMENTATION_REVIEW_2026-07-22.md
   - docs/superpowers/specs/step0/MINIMAX_TARGET_RUNBOOK.md
   - docs/superpowers/specs/analysis-3-step0-measurements.md (historical
     rationale only; never override the runbook with its archived commands)
6. Do not use RTR PR #1738 worktrees for this task.
7. Follow runbook sections 0 and 1 first: build/validate tools, identify the
   model SSD PhysicalDisk instance, then capture three CPU-only mmap baseline
   runs on the exact MiniMax-M2.7 GGUF.
8. Do not use runtime -rtr/-rtra or runtime -muge. Do not treat --moe-trace
   timing as a performance result.
9. Preserve raw logs, manifests, samples CSV, summaries and any ETW capture
   outside Git. Report their paths plus median/min/max t/s and
   phys_gen_bytes_per_tok.
10. After the authoritative baseline is valid, capture the separate token-timing
   and ETW diagnostic runs. Never mix either with --moe-trace or treat their
   t/s as authoritative.
11. Then execute runbook sections 2 and 3:
   32-token trace smoke -> validate -> 512-token trace -> validate ->
   demand-only and previous-token cache simulations -> routing-locality report.
12. Stop after reporting the evidence and bottleneck classification. Do not
   implement prefetch/SER/top-k/pinning/pruning without a separate decision.

The agent must request the local values that Git cannot provide: the exact GGUF
path, output directory, and PhysicalDisk instance for the model SSD.
```

This prompt is intentionally subordinate to the runbook. If its contents and
`MINIMAX_TARGET_RUNBOOK.md` differ, follow the runbook and update this file in a
separate documentation commit.
