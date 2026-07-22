# MiniMax metrics implementation review — 2026-07-22

## Verdict

**GO for target-machine evidence collection after a clean target build.**

This package adds observability, not an inference optimization. The
authoritative performance lane is unchanged: CPU-only mmap, a diagnostic
warm-up followed by three authoritative-candidate uncleared-cache repeats
without callbacks or timing instrumentation.

## Implemented lanes

### Authoritative Step0

- Required physical read-bytes/s plus fail-soft auxiliary counters in one
  one-second PDH query: sampled interval-average read latency, queue, IOPS,
  bytes/read, memory pressure and OS CPU frequency/performance estimates.
- Process-object CPU time, working set and private bytes without fragile
  performance-counter instance matching.
- Manifest v2: PID, UTC process lifetime, exact counter paths/availability,
  static CPU/DIMM/pagefile/storage/power-plan provenance and probe errors.
- Primary counter gaps remain fatal; auxiliary absence remains non-fatal.
- An explicit non-authoritative switch and manifest reason prevent warm-up,
  ETW, smoke and timing lanes from being mislabeled as baseline evidence.

### Token timing

- Main-only `--token-timing FILE`, mutually exclusive with `--moe-trace` and
  unsupported parallel/CFG/speculative/interactive paths.
- Sampling-ready monotonic timestamps with explicit input-to-output token
  association and cumulative eval/sample deltas.
- `G-1` intervals for `G` actually generated tokens, final public `n_eval`
  cross-check, buffered atomic no-overwrite publication and alias protection.
- Harness-owned `-TokenTiming` mode validates the sidecar, interpolates the
  one-second device counter at exact CLI-ready phase boundaries and emits
  p50/p95/p99. It is explicitly not authoritative until a target overhead A/B.

### ETW

- `step0-etw.ps1` runs one distinct WPR `GeneralProfile` diagnostic.
- It refuses an active/unrecognized WPR session, stops in `finally`, cancels
  only after stop failure, records WPR provenance and preserves a usable ETL
  when the benchmark itself fails.

### Routing locality

- Offline `report` subcommand emits global and per-layer deterministic expert
  popularity, normalized entropy, hot-set sizes, previous-token overlap,
  token-gap reuse, selected-weight concentration and 8/32/128-token working
  sets.
- Global expert identity is `(layer, expert)`. The report is baseline-route
  locality only and cannot predict physical I/O, post-intervention routing or
  tokens/s.

## Validation executed on the review machine

- PowerShell 7 and Windows PowerShell 5.1 parser: passed.
- Extended positive Step0 fake run under Windows PowerShell 5.1: passed.
- Token-timing harness fixture: exact sidecar validation and p50/p95/p99 passed.
- Process-failure path: logs/samples/manifest/CSV preserved and the intended
  nonzero final error returned.
- ETW wrapper with a fake WPR provider under Windows PowerShell 5.1: an active
  session was refused without cancel; native-stderr start failure preserved
  `exit_code=11`; success produced a nonempty ETL; benchmark failure still
  stopped and preserved ETL/metadata; stop `exit_code=12` invoked last-resort
  cancel and recorded `etl_usable=false`. Successful benchmark manifests were
  attached with PID, process lifetime, model identity and
  `authoritative_summary_eligible=false` (`etw_diagnostic`).
- Simulator suite: 32 passed; Python compilation passed.
- Release CTest: token-timing writer/lifecycle and MoE trace writer/lifecycle,
  4/4 passed.
- Independent routing-report re-review: GO after popularity/semantics/test fixes.
- For separate gate/up layouts whose runtime mode is not established, the
  runbook now requires fused and unfused simulator sensitivity runs rather
  than silently selecting fused. Offline `gate_up` layouts are not applicable.
- Step0 does not measure achieved DRAM bandwidth; the runbook requires the
  RAM-bandwidth-versus-compute resident-path classification to remain
  `unresolved` without synchronized memory-controller evidence.
- `git diff --check`: required again immediately before commit.

## Target-only gates that remain

- Clean configure/build/test using the target toolchain.
- Real MiniMax-M2.7 baseline on Ryzen 9 7950X / 96 GiB.
- Interleaved matched token-timing OFF/ON repeats: median change below one
  percent and no larger than baseline run-to-run noise before treating timing
  runs as performance evidence.
- WPA correlation by recorded PID and GGUF path; device counters alone are not
  process attribution.
- Optional HWiNFO sensor CSV for package temperature/power/effective clocks;
  OS/ACPI values are not proof of thermal throttling.

No prefetch, pinning, slab cache, SER, top-k, pruning or quantization change is
included. The next implementation decision must follow the live evidence.
