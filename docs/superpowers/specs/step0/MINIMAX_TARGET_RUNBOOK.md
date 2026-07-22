# MiniMax-M2.7 target-machine runbook

This is an execution runbook for an AI agent on the Ryzen 9 7950X / 96 GiB
Windows machine. It separates performance measurement from routing observation.
Do not merge this work into RTR PR #1738.

## Non-negotiable experiment boundaries

- Use the exact intended MiniMax-M2.7 GGUF artifact throughout one experiment.
- For the >RAM mmap regime, do **not** use runtime `-rtr` or runtime `-muge`.
  An R4 or fused layout must be created offline before the run, then loaded with
  mmap enabled.
- A `--moe-trace` run is an observation run, not a benchmark: its eval callback
  causes scheduler synchronization. Never report its t/s or disk counters as a
  performance result.
- Do not start prefetch, SER, top-k reduction, pinning, or pruning before the
  baseline and trace gates below are complete.
- Store model files, NDJSON traces, manifests, raw Step0 data, ETW captures and
  generated outputs outside Git.

## 0. Preflight

```powershell
git switch feature/minimax-step0-readiness
git pull --ff-only
git status --short --branch

# Configure a clean CPU build with tests. This uses the default installed
# Windows generator; adapt -G/-A explicitly if the machine has several toolchains.
cmake -S . -B build -DLLAMA_BUILD_TESTS=ON -DGGML_CUDA=OFF `
  -DGGML_NATIVE=ON -DCMAKE_BUILD_TYPE=Release

# Build the actual Release path used below.
cmake --build build --config Release --target llama-cli test-moe-trace-writer test-token-timing-writer

# Adapt these paths once if the selected generator writes build\bin\ directly.
$llamaCli = (Resolve-Path '.\build\bin\Release\llama-cli.exe').Path
$traceWriterTest = (Resolve-Path '.\build\bin\Release\test-moe-trace-writer.exe').Path
$tokenTimingTest = (Resolve-Path '.\build\bin\Release\test-token-timing-writer.exe').Path
& $traceWriterTest
& $tokenTimingTest

python -m pip install -r tools/moe_cache_sim/requirements.txt
python -m pip install pytest
python -m pytest -q tests/test-moe-cache-sim.py
```

If the build layout has no `Release` subdirectory, set all three executable
variables to the real Release paths. Record `git rev-parse HEAD`, the executable
path and the exact GGUF path in the run directory.

Create a quiet output directory on a drive other than the model SSD if possible:

```powershell
$run = 'E:\minimax-runs\2026-07-21-baseline'
New-Item -ItemType Directory -Force $run
Get-Counter '\PhysicalDisk(*)\Disk Read Bytes/sec' |
  Select-Object -Expand CounterSamples | Select-Object InstanceName,Path
```

Choose and record the `PhysicalDisk` instance for the model SSD. Do not use
`_Total` for an authoritative run; the harness only allows it with explicit
smoke-only opt-in.

## 1. Authoritative Step0 baseline

Ensure other disk-heavy work is stopped and the pagefile is not competing on
the model SSD. Use a fixed prompt/seed/context and CPU-only execution.
`step0-bench.ps1` forces `-ngl 0` and rejects GPU offload, `--no-mmap`, runtime
RTR (including `-rtra`/`--run-time-repack-auto`) and runtime up/gate merging
overrides.

Do not mix the first cache-populating run into the repeat summary. Run one
separate warm-up/mechanics pass, then collect three consecutive steady-regime
runs without clearing the standby cache between them. Record this as
`cache_policy=warmup_then_three_uncleared_repeats`; the >RAM model will still
page, but the three summarized runs start from an explicitly defined policy.

```powershell
.\docs\superpowers\specs\step0\step0-bench.ps1 `
  -LlamaCli $llamaCli `
  -ModelPath 'D:\models\MiniMax-M2.7.gguf' `
  -DiskInstance '<MODEL_SSD_PHYSICALDISK_INSTANCE>' `
  -Label warmup_cpu_mmap -CachePolicy warmup_before_uncleared_repeats `
  -NonAuthoritative -NonAuthoritativeReason warmup_before_baseline `
  -NGen 512 -CtxSize 4096 -Repeat 1 `
  -Csv "$run\step0-warmup.csv"
```

Then run the authoritative repeat set:

```powershell
.\docs\superpowers\specs\step0\step0-bench.ps1 `
  -LlamaCli $llamaCli `
  -ModelPath 'D:\models\MiniMax-M2.7.gguf' `
  -DiskInstance '<MODEL_SSD_PHYSICALDISK_INSTANCE>' `
  -Label baseline_cpu_mmap -CachePolicy warmup_then_three_uncleared_repeats `
  -NGen 512 -CtxSize 4096 -Repeat 3 `
  -Csv "$run\step0-results.csv"
```

The extended samples/manifest contain whole-device read latency, queue, IOPS
and transfer size; host memory pressure; normalized llama-cli CPU share; sampled
working/private memory; and OS frequency estimates. These are diagnostic
one-second interval values, not per-I/O distributions, package temperature or
proof of thermal throttling.

## 1a. Token-timing diagnostic (not authoritative)

Run one separate timing-instrumented pass. It uses no eval callback and records
`G-1` generated-decode intervals, but remains diagnostic until an interleaved
multi-repeat OFF/ON overhead A/B is below one percent and within baseline noise.

```powershell
.\docs\superpowers\specs\step0\step0-bench.ps1 `
  -LlamaCli $llamaCli `
  -ModelPath 'D:\models\MiniMax-M2.7.gguf' `
  -DiskInstance '<MODEL_SSD_PHYSICALDISK_INSTANCE>' `
  -Label diagnostic_token_timing `
  -CachePolicy warmup_then_diagnostic_uncleared `
  -TokenTiming -NGen 512 -CtxSize 4096 -Repeat 1 `
  -Csv "$run\step0-token-timing.csv"
```

Use the manifest/CSV p50/p95/p99 values for CLI-ready cadence and deltas of
llama's cumulative eval/sampling counters. They are not an independent
wall-time decomposition. `inter_ready` includes intervening CLI loop/output
work and is not pure model evaluation. Do not pass `--token-timing` manually through
`-ExtraArgs`; the harness owns its sidecar and validates it.

## 1b. ETW attribution diagnostic (not authoritative)

Run elevated, with the output directory on a drive other than the model SSD:

```powershell
.\docs\superpowers\specs\step0\step0-etw.ps1 `
  -LlamaCli $llamaCli `
  -ModelPath 'D:\models\MiniMax-M2.7.gguf' `
  -DiskInstance '<MODEL_SSD_PHYSICALDISK_INSTANCE>' `
  -OutputDirectory $run -NGen 512
```

The wrapper refuses an already active or unrecognized WPR session, always
attempts `wpr -stop <etl>` after a successful start, and uses cancel only if
stop fails. Open the ETL in WPA and correlate the manifest PID plus GGUF path
with File/Disk I/O and hard faults. The ETW run never enters the authoritative
t/s summary and must not be combined with `--moe-trace`. If package
temperature/power/effective-clock data is needed, preserve a separate HWiNFO
sensor CSV; ACPI thermal zones are not Ryzen package temperature.

The harness records a raw log, JSON manifest, timestamped counter
series and a repeat summary for every run. It fails if a run fails,
ends early, cannot parse timings, cannot validate the counter, or cannot make a
valid device-level estimate. Do not use an old `step0-results.csv` with a
different schema; preserve it and choose a new path.

Repeat the same raw-series analysis at transient fractions 0.20/0.30/0.40
(the default harness sensitivity). Treat `phys_gen_bytes_per_tok` as a
device-level estimator, not per-process ground truth. The authoritative lane
reconstructs decode boundaries; the token-timing diagnostic uses exact CLI-ready
boundaries but still interpolates one-second whole-device samples. Before
attributing a bottleneck, cross-check a representative run with ETW.

## 2. Separate MiniMax routing-trace smoke

Use the same absolute GGUF artifact, but create the layout before capturing the
trace. For canonical split files (`-00001-of-000NN.gguf`) sibling shards are
discovered automatically; otherwise pass every shard explicitly to
`build_layout`.

```powershell
$model = 'D:\models\MiniMax-M2.7.gguf'
$layout = "$run\minimax-layout.json"
$trace = "$run\minimax-smoke.ndjson"

python -m tools.moe_cache_sim.build_layout --model $model --output $layout

# Trace only. Do not use this run's timings or disk counters.
& $llamaCli -m $model -p 'Write a detailed 1500-word technical tutorial on CPU memory hierarchies, SSD paging, and mixture-of-experts inference.' `
  -n 32 --seed 1234 -ngl 0 --moe-trace $trace

python -m tools.moe_cache_sim.simulate validate --layout $layout --trace $trace
```

Trace v1 requires MiniMax-M2 routing, `norm_w=true`, one classic single-token
decode sequence, and a completed footer. It rejects interactive/conversation,
CFG, MTP, speculative and other unsupported modes. The trace path must not
alias a GGUF file and must not use the `.gguf` extension.

Only after the 32-token smoke validates, collect a 512-token trace with the
same simple CPU-only/mmap decode settings, then validate it before simulation:

```powershell
$trace512 = "$run\minimax-512.ndjson"
& $llamaCli -m $model -p 'Write a detailed 1500-word technical tutorial on CPU memory hierarchies, SSD paging, and mixture-of-experts inference.' `
  -n 512 --seed 1234 -ngl 0 --moe-trace $trace512

python -m tools.moe_cache_sim.simulate validate --layout $layout --trace $trace512

$footer = Get-Content -LiteralPath $trace512 -Tail 1 | ConvertFrom-Json
if (-not $footer.complete -or $footer.batches -lt 480) {
  throw "Trace is complete structurally but too short for the final locality run: batches=$($footer.batches), require >=480. Use a longer-output prompt and rerun; do not force --ignore-eos by default."
}
```

Do not move, rename, repack or modify the GGUF between layout extraction and
trace capture.

## 3. Offline locality scenarios

Validation binds the trace to the layout/model signature. Run demand-only
first, then previous-token locality. These are prioritization results, not t/s
predictions.

```powershell
python -m tools.moe_cache_sim.simulate simulate `
  --layout "$run\minimax-layout.json" --trace $trace512 `
  --cache-gib 32 --policy lru --predictor none `
  --access-model cpu-ggml-phase-v1 --up-gate-mode fused `
  --output "$run\sim-lru-demand.json"

python -m tools.moe_cache_sim.simulate simulate `
  --layout "$run\minimax-layout.json" --trace $trace512 `
  --cache-gib 32 --policy lru --predictor previous-token `
  --access-model cpu-ggml-phase-v1 --up-gate-mode fused `
  --output "$run\sim-lru-previous-token.json"

python -m tools.moe_cache_sim.simulate report `
  --layout "$run\minimax-layout.json" --trace $trace512 `
  --output "$run\routing-locality.json"
```

The commands above show the `fused` hypothesis. If the layout contains separate
`gate`, `up`, and `down` tensors and the exact runtime graph mode has not been
independently established, **do not select only that result**: repeat both
simulations with `--up-gate-mode unfused`, use distinct output names, and report
the fused/unfused range as a sensitivity result. A layout whose per-layer
`representation` is `fused` (`gate_up` plus `down`) needs no mode sensitivity;
the simulator reports the mode as `not_applicable`. Never infer runtime mode
from the filename or quant name.

Use `--chunk-pages 1` for exact 4 KiB replacement units only when its runtime
is acceptable. The default 256 pages (about 1 MiB) is deliberately approximate.
For a separate gate/up layout, choose `--up-gate-mode fused` or `unfused` to
match the actual CPU runtime; an offline `gate_up` layout is already fused, so
that option is not applicable. For a static policy, use a genuinely separate
calibration trace from different documents/sessions; the simulator rejects
aliases and byte-identical copies.

The simulator does not model Windows page cache, SSD latency, actual queue
depth, kernel row order, prefetch lead time, or tokens/s. `previous-token` and
`oracle` prefetch timings are idealized route-JIT upper bounds. Any top-k, SER
or pruning intervention invalidates the baseline route for causal claims and
requires a new runtime trace.

## 4. Gate for the next implementation decision

Capture in the run report:

1. median/min/max decode t/s and `phys_gen_bytes_per_tok` from Step0;
2. sampled device latency/queue/IOPS, process CPU, host-memory pressure and
   token-timing p50/p95/p99, with their estimator/diagnostic labels preserved;
3. transient sensitivity, model-SSD identity, raw logs/manifests and ETW result;
4. trace validation result, model/layout fingerprints and simulator assumptions;
5. routing report plus demand locality and previous-token predictor
   coverage/precision/recall;
6. whether the evidence supports a disk, RAM-bandwidth, compute, mixed, or
   unresolved bottleneck classification. Step0 does not measure achieved DRAM
   bandwidth. Without a synchronized, trustworthy memory-controller bandwidth
   measurement, it may separate disk pressure from the resident path but must
   label the resident-path split between RAM bandwidth and compute as
   `unresolved`, not guess from CPU utilization or a standalone MLC/AIDA peak
   bandwidth benchmark.

Only then select one focused implementation branch:

- strong temporal locality and meaningful physical disk pressure -> bounded
  previous-token prefetch prototype;
- poor locality but a stable hot set -> evaluate selective pinning/slab-cache
  design;
- physical I/O is secondary -> CPU/kernel, threads/affinity and AVX-512 A/B;
- a quality-approved bytes/token reduction is required -> real top-k 8 -> 7 ->
  6 runs, each with a new trace and the full quality gate.
