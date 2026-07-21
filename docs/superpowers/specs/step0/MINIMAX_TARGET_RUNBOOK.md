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

# Build the actual Release path used below (adapt the CMake generator as needed).
cmake --build build --config Release --target llama-cli test-moe-trace-writer
build\bin\Release\test-moe-trace-writer.exe

python -m pip install -r tools/moe_cache_sim/requirements.txt
python -m pytest -q tests/test-moe-cache-sim.py
```

If the build layout has no `Release` subdirectory, pass the real executable path
to `-LlamaCli`. Record `git rev-parse HEAD`, the executable path and the exact
GGUF path in the run directory.

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
the model SSD. Use a fixed prompt/seed/context, CPU-only execution, and at
least three repetitions. `step0-bench.ps1` forces `-ngl 0` and rejects a
non-zero GPU override.

```powershell
.\docs\superpowers\specs\step0\step0-bench.ps1 `
  -LlamaCli .\build\bin\Release\llama-cli.exe `
  -ModelPath 'D:\models\MiniMax-M2.7.gguf' `
  -DiskInstance '<MODEL_SSD_PHYSICALDISK_INSTANCE>' `
  -Label baseline_cpu_mmap -NGen 512 -CtxSize 4096 -Repeat 3 `
  -Csv "$run\step0-results.csv"
```

The harness records a raw log, JSON manifest, timestamped counter
series and a timestamped repeat summary for every run. It fails if a run fails,
ends early, cannot parse timings, cannot validate the counter, or cannot make a
provisional reconstructed estimate. Do not use an old `step0-results.csv` with a
different schema; preserve it and choose a new path.

Repeat the same raw-series analysis at transient fractions 0.20/0.30/0.40
(the default harness sensitivity). Treat `phys_gen_bytes_per_tok` as a
device-level **reconstructed estimator**, not per-process ground truth. Before
attributing a bottleneck, cross-check a representative run with ETW if the
model SSD has unrelated activity.

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
.\build\bin\Release\llama-cli.exe -m $model -p 'Explain the proof strategy in a short mathematical argument.' `
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
.\build\bin\Release\llama-cli.exe -m $model -p 'Explain the proof strategy in a short mathematical argument.' `
  -n 512 --seed 1234 -ngl 0 --moe-trace $trace512

python -m tools.moe_cache_sim.simulate validate --layout $layout --trace $trace512
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
```

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
2. transient sensitivity, model-SSD identity, raw logs/manifests and ETW result;
3. trace validation result, model/layout fingerprints and simulator assumptions;
4. demand locality and previous-token predictor coverage/precision/recall;
5. whether the evidence supports a disk, RAM-bandwidth, compute, or mixed
   bottleneck classification.

Only then select one focused implementation branch:

- strong temporal locality and meaningful physical disk pressure -> bounded
  previous-token prefetch prototype;
- poor locality but a stable hot set -> evaluate selective pinning/slab-cache
  design;
- physical I/O is secondary -> CPU/kernel, threads/affinity and AVX-512 A/B;
- a quality-approved bytes/token reduction is required -> real top-k 8 -> 7 ->
  6 runs, each with a new trace and the full quality gate.
