# Copy/paste prompt: MiniMax target-machine agent

```text
Continue MiniMax-M2.7 live-test preparation in AndrewMoryakov/ik_llama.cpp.

1. Clone/fetch the fork and switch to:
   feature/minimax-step0-readiness
2. Verify the checked-out commit is at least:
   6ed39a6b
3. Read, in this order:
   - FORK_WORKFLOW.md
   - docs/superpowers/specs/00-INDEX.md
   - docs/superpowers/specs/analysis-3-step0-measurements.md
   - docs/superpowers/specs/step0/MINIMAX_TARGET_RUNBOOK.md
4. Do not use RTR PR #1738 worktrees for this task.
5. Follow runbook sections 0 and 1 first: build/validate tools, identify the
   model SSD PhysicalDisk instance, then capture three CPU-only mmap baseline
   runs on the exact MiniMax-M2.7 GGUF.
6. Do not use runtime -rtr or runtime -muge. Do not treat --moe-trace timing
   as a performance result.
7. Preserve raw logs, manifests, samples CSV, summaries and any ETW capture
   outside Git. Report their paths plus median/min/max t/s and
   phys_gen_bytes_per_tok.
8. Only after the baseline is valid, execute runbook sections 2 and 3:
   32-token trace smoke -> validate -> 512-token trace -> validate ->
   demand-only and previous-token cache simulations.
9. Stop after reporting the evidence and bottleneck classification. Do not
   implement prefetch/SER/top-k/pinning/pruning without a separate decision.

The agent must request the local values that Git cannot provide: the exact GGUF
path, output directory, and PhysicalDisk instance for the model SSD.
```

This prompt is intentionally subordinate to the runbook. If its contents and
`MINIMAX_TARGET_RUNBOOK.md` differ, follow the runbook and update this file in a
separate documentation commit.
