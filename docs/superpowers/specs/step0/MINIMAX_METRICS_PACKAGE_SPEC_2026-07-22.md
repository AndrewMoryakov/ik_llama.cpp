# MiniMax target metrics package specification — 2026-07-22

## Objective

Extend the target-machine evidence package without changing the authoritative
CPU-only mmap workload. The package must distinguish device I/O pressure,
host-memory pressure, CPU saturation and temporal MoE locality. It must not
claim that an offline cache model predicts tokens/s.

## Measurement lanes

### Lane A — authoritative baseline

The existing three uncleared-cache repeats after a separate warm-up remain
authoritative candidates for tokens/s; the warm-up itself is diagnostic. They
must continue to run without `--moe-trace`, runtime RTR, runtime up/gate
merging, GPU offload or `--no-mmap`.

The harness has an explicit `-NonAuthoritative` evidence label. Warm-up, ETW,
smoke and other diagnostic invocations must set it (token timing implies it),
and must preserve a machine-readable reason in the manifest. Descriptive
labels and separate CSV filenames are not sufficient evidence separation.

The one-second sampler is extended with optional diagnostics collected in one
combined `Get-Counter` query. Exact paths are:

- `PhysicalDisk(instance)\\Avg. Disk sec/Read`, `Avg. Disk Read Queue
  Length`, `Disk Reads/sec` and `Avg. Disk Bytes/Read`;
- `Memory\\Available Bytes`, `Committed Bytes` and `Pages Input/sec`;
- `Processor Information(_Total)\\Actual Frequency` and
  `% Processor Performance`.

The primary model-device read-bytes/s counter remains required and a sampling
gap remains fatal. Every iteration validates its status and finite,
non-negative value. Auxiliary paths are probed individually before the run and
unsupported paths are omitted and recorded as unavailable. A returned
auxiliary sample with bad status or a non-finite value becomes unavailable; it
does not poison primary integration. A combined-query exception still
invalidates the interval. Raw samples retain every available value.

Process CPU, working set and private bytes are sampled from the launched
`System.Diagnostics.Process` object. Normalized process CPU is derived from the
formula `100 * delta TotalProcessorTime / delta wall / logical CPU count`, with
an initial cumulative sample captured promptly after launch. Process-exit races
leave missing tail values instead of inventing a delta. No process
performance-counter instance-name lookup is used.

Disk latency is summarized only for samples with reads/s greater than zero and
reports the active sample count. Names such as
`p95_sampled_interval_avg_read_latency_ms` make clear that a percentile of
one-second interval averages is not a per-I/O latency percentile. Queue and all
disk diagnostics remain whole-device observations; ETW/WPA is required for
per-I/O distributions and attribution.

### Lane B — token-timing diagnostic

Stdout chunk arrival is not a token boundary. MoE eval callbacks synchronize
the backend and are not benchmark-safe. Add a main-only optional
`--token-timing FILE` sidecar with these rules:

- single sequence, non-interactive, non-CFG, non-speculative target decode;
- no eval callback;
- `--token-timing` and `--moe-trace` are mutually exclusive, and v1 enforces
  one sequence/parallel stream, CFG off, interactive/conversation off and all
  MTP/speculative/lookup paths off;
- timestamps are captured after sampling, where logits access has synchronized
  the preceding decode; timing only `llama_decode` is forbidden because it may
  enqueue work asynchronously;
- the first sampled token establishes the baseline. For `G` tokens actually
  sampled (including an emitted EOG), the file contains `max(G-1, 0)` intervals;
  a non-short full `-n N` run therefore emits `N-1`, matching `n_eval`;
- an interval ending at output token `i` contains evaluation of input token
  `i-1` and sampling of output token `i`; both token IDs and output EOG state are
  recorded explicitly;
- each interval records monotonic CLI-ready cadence plus deltas of cumulative
  `llama_get_timings(ctx).t_eval_ms` and `t_sample_ms` snapshots taken after
  sampling/synchronization. CLI-ready cadence includes intervening output and
  loop work and is not pure model-eval time;
- one header anchor maps UTC to the monotonic clock; token records use monotonic
  offsets, avoiding a wall-clock query per token;
- records are buffered and published with a same-directory temporary file,
  flush/close and atomic rename only after footer/count validation. Existing
  destinations are not overwritten. Write/rename/count failure makes llama-cli
  fail, and an early failure never publishes a complete final file;
- output-path aliases with model shards or other CLI inputs are rejected.

The footer cross-checks actual generated tokens, interval count and final
reported `n_eval`. The harness may parse the sidecar and report p50/p95/p99
inter-token, eval and sampling latency. Until an interleaved, matched OFF/ON A/B
with multiple repeats shows both a median tokens/s change below one percent and
no change larger than baseline run-to-run noise, a token-timing run is
diagnostic and is not part of the authoritative three-run summary.

### Lane C — ETW attribution diagnostic

Document one separate elevated WPR `GeneralProfile` run. It must:

- use a distinct label/CSV and output ETL away from the model SSD;
- never run together with `--moe-trace`;
- query `wpr -status` before start and abort if another recording is active;
- after a successful start, always attempt `wpr -stop <etl>` in a `finally`
  path, including when the benchmark fails;
- use `wpr -cancel` only as last-resort cleanup if stop fails, and record that
  no usable ETL was produced;
- check and record start/stop/cancel exit status and preserve the ETL when stop
  succeeds;
- be treated as diagnostic because ETW itself adds overhead.

WPA inspection must correlate the llama-cli PID, GGUF file path, Disk/File I/O
and hard faults. `Process\\Page Faults/sec` and system `Pages Input/sec` must not
be presented as process hard-fault attribution.

Every benchmark manifest records launched PID plus process start/end UTC and
elapsed correlation. The ETW wrapper additionally records capture start/stop
UTC, ETL path, WPR profile/commands and statuses. Its distinct one-run
label/CSV is never merged into the authoritative three-run summary, and the
wrapper passes the explicit non-authoritative evidence flag to Step0.

### Lane D — routing-locality report

Add an offline report over a validated trace. Global and per-layer output must
include:

- previous-token expert-set overlap/Jaccard and exact-match rate;
- selected-expert popularity, unique expert count and normalized entropy;
- minimum hot-set sizes covering 50/80/90/95 percent of selections;
- reuse-distance and cold-selection summaries;
- selected weight concentration (top and tail contribution);
- sliding-window working-set summaries for fixed token windows.

This report describes the unchanged traced route only. It does not establish
post-intervention routing, physical cache hits, SSD latency or speedup.

## Static provenance

Manifests add best-effort, explicitly labeled host provenance. Each static
probe records its timestamp and error/unavailable state rather than failing the
baseline:

- physical/logical/core counts and topology ratio;
- per-DIMM capacities and SMBIOS configured clocks;
- pagefile paths/allocation/current usage at the snapshot time;
- storage inventory and, where resolvable, the model drive's disk identity;
- active Windows power plan;
- availability and exact paths of every sampled counter.

Drive-letter/partition/disk mapping is best effort and can fail for mounted
folders, Storage Spaces or network paths; the explicitly selected
`PhysicalDisk` instance remains authoritative. Preserve raw `powercfg
/getactivescheme` output and parse its GUID only when possible. SMBIOS clock is
not proof of EXPO/timings, and topology ratio is not proof of SMT policy. OS frequency counters are estimates,
not proof of Ryzen effective clocks or thermal throttling. ACPI thermal-zone
temperature must not be labeled as CPU package temperature. Package
temperature, power and effective-clock evidence requires a separately preserved
HWiNFO sensor CSV or equivalent external instrumentation.

## Acceptance criteria

1. PowerShell 7 and Windows PowerShell 5.1 parse the harness.
2. A fake positive run produces the extended raw schema, summaries and manifest.
3. One deliberately unavailable auxiliary counter degrades to `unavailable`.
4. A primary counter failure or a runtime sampling gap still invalidates a run.
5. Idle/zero-read samples never produce NaN, infinity or divide-by-zero output.
6. Process exit races preserve evidence and do not crash the harness.
7. Token timing has unit/lifecycle tests for first token, actual `G-1`
   intervals, input/output-token association, footer consistency, mutual mode
   exclusion, alias/existing-destination rejection, write/rename failure, temp
   cleanup and malformed/incomplete sidecars.
8. Locality-report synthetic tests cover exact expected overlap, entropy,
   hot-set, reuse and sliding-window results.
9. Existing simulator and MoE trace tests remain green.
10. The runbook and handoff prompt keep authoritative, token-timing, ETW and
    MoE-trace lanes separate.
11. ETW lifecycle tests cover an already-active session, start failure,
    benchmark failure with successful stop, and stop failure followed by
    last-resort cancel; manifests contain PID/capture provenance.
12. Bad primary status/NaN invalidates a sample, while bad auxiliary
    status/NaN degrades only that auxiliary metric.

## Explicit non-goals

- No prefetch, pinning, slab cache, top-k, SER, pruning or quantization change.
- No automatic claim of disk-bound behaviour from one counter.
- No inferred Ryzen temperature from ACPI or inferred process hard faults from
  aggregate Windows counters.
- No use of trace or ETW timings as authoritative performance numbers.
