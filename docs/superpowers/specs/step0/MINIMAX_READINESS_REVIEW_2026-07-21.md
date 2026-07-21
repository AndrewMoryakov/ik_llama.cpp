# MiniMax Step0 readiness review — 2026-07-21

## Verdict

**GO for controlled live testing on the Ryzen 9 7950X / 96 GiB target.**

This is a go-ahead to execute `MINIMAX_TARGET_RUNBOOK.md`, not a claim that the
MiniMax bottleneck or any optimization speedup has already been proven.

## Blocking defects found and fixed during review

1. The timing parser result (`n_eval`) was treated as the number of sampled
   output tokens. In this codebase it excludes the first generated token, so a
   normal completed `-n N` run reports `N-1` eval runs. The old readiness
   harness would classify every full 512-token run as short and throw. The
   completion gate now uses `expected_eval_runs = NGen - 1`, while the steady
   denominator remains reported eval runs.
2. Runtime `Get-Counter` failures were silently swallowed. A later one-second
   rate could then be multiplied by a multi-second gap and fabricate integrated
   bytes. Counter gaps now reset the next sampling interval origin, set
   `counter_sampling_failed`, enter the manifest, exclude the run from the
   repeat summary, and make the harness fail.
3. A clean-clone runbook tried to build an unconfigured `build` directory and
   did not install pytest. It now configures a Release CPU build with tests and
   defines reusable executable paths.
4. The handoff prompt tried to read `FORK_WORKFLOW.md` after switching to a
   branch that does not contain that main-only file. It now reads it explicitly
   with `git show origin/main:FORK_WORKFLOW.md` before switching.
5. The 512-token trace procedure did not prove that natural EOS had not cut the
   trace short. It now uses a long-output prompt and requires a complete footer
   with at least 480 target batches. It explicitly avoids using
   `--ignore-eos` as the default workaround.

## Additional safety and provenance fixes

- Explicit `PhysicalDisk(_Total)` requires the smoke-only opt-in.
- All supported GPU-layer aliases are guarded, including
  `--n-gpu-layers`; non-zero offload is rejected.
- `--no-mmap`, runtime RTR (including the `-rtra` and
  `--run-time-repack-auto` aliases), and runtime up/gate merge options are
  rejected from the Step0 baseline passthrough arguments.
- Repository identity is captured even when `-LlamaCli` is passed explicitly.
- Canonical split GGUFs record every shard identity and aggregate size; full
  content hashing stays opt-in because reading 110 GiB would perturb cache
  state before the benchmark.
- The runbook separates one cache-populating warm-up from three summarized
  uncleared-cache repeats and records the policy in CSV/manifests.
- The post-exit disk sample and all bytes/token results remain explicitly
  labeled as reconstructed device-level estimates rather than exact B3 phase
  attribution.

## Executed validation

- PowerShell AST parse: passed.
- Windows PowerShell 5.1 positive harness run with a fake CLI: passed.
- Windows command-line quoting preserved paths with spaces, an embedded quote,
  and a trailing backslash.
- Full-run semantics fixture: `NGen=2`, reported `n_eval=1`: accepted and
  summarized, proving the `N-1` completion rule.
- Invalid disk instance: rejected.
- Explicit `_Total` without opt-in: rejected.
- GPU/no-mmap/RTR/muge passthrough cases: rejected.
- Failure-path evidence preservation and non-zero harness exit: passed.
- Existing CSV schema mismatch: rejected instead of appending incompatible
  rows.
- `python -m pytest -q tests/test-moe-cache-sim.py`: 28 passed.
- Python simulator modules: `py_compile` passed.
- Existing Release `test-moe-trace-writer.exe`: passed.
- `git diff --check`: passed before commit.

## Boundaries that remain for the target agent

- No authoritative MiniMax-M2.7 run has yet executed on the Ryzen target.
- The local review reused an existing Release C++ build because CMake was not
  installed in the review shell. The target agent must perform the clean
  configure/build/test preflight in the runbook.
- `phys_gen_bytes_per_tok` is machine/drive-level and reconstructed from process
  end plus reported eval duration. It is not per-process ground truth. Preserve
  raw samples and use ETW when attribution is noisy.
- Trace timings are invalid as benchmark timings because the observation
  callback introduces synchronization.
- Simulator results describe logical byte locality under an approximate access
  model; they do not predict SSD latency or tokens/s.

The next agent should stop after producing the baseline/trace/simulator evidence
and bottleneck classification. Any prefetch, cache, SER, top-k, pinning or
pruning implementation requires a new focused decision and branch.
