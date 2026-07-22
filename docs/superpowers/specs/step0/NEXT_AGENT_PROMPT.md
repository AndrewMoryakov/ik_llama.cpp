# Copy/paste prompt: MiniMax target-machine agent

```text
Continue MiniMax-M2.7 live-test preparation in AndrewMoryakov/ik_llama.cpp.

1. Clone/fetch the fork. Read the fork-wide branch map before switching:
   git fetch --all --prune
   git show origin/main:FORK_WORKFLOW.md
2. Switch to:
   feature/minimax-step0-readiness
3. Verify that the checked-out commit contains the finalized readiness fixes:
   git merge-base --is-ancestor 15089c54593995ca440eba451b0a7cd90bc40569 HEAD
   Stop if this command returns non-zero.
4. Read, in this order:
   - docs/superpowers/specs/00-INDEX.md
   - docs/superpowers/specs/analysis-3-step0-measurements.md
   - docs/superpowers/specs/step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md
   - docs/superpowers/specs/step0/MINIMAX_TARGET_RUNBOOK.md
5. Do not use RTR PR #1738 worktrees for this task.
6. Follow runbook sections 0 and 1 first: build/validate tools, identify the
   model SSD PhysicalDisk instance, then capture three CPU-only mmap baseline
   runs on the exact MiniMax-M2.7 GGUF.
7. Do not use runtime -rtr/-rtra or runtime -muge. Do not treat --moe-trace
   timing as a performance result.
8. Preserve raw logs, manifests, samples CSV, summaries and any ETW capture
   outside Git. Report their paths plus median/min/max t/s and
   phys_gen_bytes_per_tok.
9. After the authoritative baseline is valid, capture the separate token-timing
   and ETW diagnostic runs. Never mix either with --moe-trace or treat their
   t/s as authoritative.
10. Then execute runbook sections 2 and 3:
   32-token trace smoke -> validate -> 512-token trace -> validate ->
   demand-only and previous-token cache simulations -> routing-locality report.
11. Stop after reporting the evidence and bottleneck classification. Do not
   implement prefetch/SER/top-k/pinning/pruning without a separate decision.

The agent must request the local values that Git cannot provide: the exact GGUF
path, output directory, and PhysicalDisk instance for the model SSD.
```

This prompt is intentionally subordinate to the runbook. If its contents and
`MINIMAX_TARGET_RUNBOOK.md` differ, follow the runbook and update this file in a
separate documentation commit.
