# MoE routing trace and cache-locality simulator (experimental v1)

This package is a **prioritization tool** for the MiniMax/Qwen-style merged-MoE
experiments. It answers questions about logical expert bytes and cache locality.
It does **not** predict tokens/s, SSD latency, Windows page-cache behaviour, or
per-process physical I/O.

The simulator itself uses the standard library. Manifest extraction reuses the
repository's `gguf-py`, which requires NumPy and PyYAML:

```powershell
python -m pip install -r tools/moe_cache_sim/requirements.txt
```

```bash
python3 -m pip install -r tools/moe_cache_sim/requirements.txt
```

## End-to-end workflow

1. Produce a completed target-decode trace. The run is deliberately slow:

   ```powershell
   build\bin\llama-cli.exe -m D:\models\model.gguf -p "..." -n 512 `
     --moe-trace trace.ndjson
   ```

   ```bash
   ./build/bin/llama-cli -m /models/model.gguf -p "..." -n 512 \
     --moe-trace trace.ndjson
   ```

2. Build the byte-layout manifest from the exact same GGUF artifact:

   ```powershell
   python -m tools.moe_cache_sim.build_layout `
     --model D:\models\model.gguf --output layout.json
   ```

   ```bash
   python3 -m tools.moe_cache_sim.build_layout \
     --model /models/model.gguf --output layout.json
   ```

   A canonical split model is discovered from `-00001-of-000NN.gguf`. For
   noncanonical names, repeat `--shard PATH` for every shard.

3. Validate completion, schema, all per-token MoE layers, expert counts, and the
   common model signature:

   ```powershell
   python -m tools.moe_cache_sim.simulate validate `
     --layout layout.json --trace trace.ndjson
   ```

   ```bash
   python3 -m tools.moe_cache_sim.simulate validate \
     --layout layout.json --trace trace.ndjson
   ```

4. Run scenarios:

   ```powershell
   python -m tools.moe_cache_sim.simulate simulate `
     --layout layout.json --trace trace.ndjson --cache-gib 32 `
     --policy lru --predictor previous-token --access-model cpu-ggml-phase-v1 `
     --up-gate-mode fused --output result.json
   ```

   ```bash
   python3 -m tools.moe_cache_sim.simulate simulate \
     --layout layout.json --trace trace.ndjson --cache-gib 32 \
     --policy lru --predictor previous-token --access-model cpu-ggml-phase-v1 \
     --up-gate-mode fused --output result.json
   ```

   Use `--chunk-pages 1` for exact 4 KiB replacement units. The default is 256
   pages (1 MiB at a 4 KiB page), which is much cheaper but only an approximate
   eviction model.

5. Produce a routing-locality report before choosing an implementation:

   ```powershell
   python -m tools.moe_cache_sim.simulate report `
     --layout layout.json --trace trace.ndjson --output locality.json
   ```

   The report contains global and per-layer previous-token Jaccard/exact-match,
   popularity entropy, hot-set sizes, token reuse distance, selected-weight
   concentration and 8/32/128-token working sets. These are properties of the
   unchanged baseline route. They do not predict physical cache hits, SSD
   latency, post-intervention routing or tokens/s. Global expert identity and
   working-set units are `(layer, expert)` pairs; previous-token aggregates are
   over layer-route observations. Percentiles use nearest rank, and reuse
   distance is a generated-token `batch_index` gap rather than cache stack
   distance. Weights are normalized among selected experts: trace v1 cannot
   recover unselected probabilities, total captured gate mass or the k/k+1
   candidate gap.

Output safety is fail-closed for known inputs. `llama-cli` canonicalizes the
model path and refuses a trace path that aliases any GGUF file beside it
(including symlinks/hardlinks); trace outputs may not use the `.gguf`
extension. The manifest and simulator CLIs reject output aliases to their
model shards/layout/traces and publish complete JSON files by atomic replace.

## Routing trace schema

The file is versioned NDJSON with schema `ik_llama.moe_routing_trace`, version
1. A valid file contains, in order:

1. one `meta` record;
2. one `model` record;
3. one or more `route` records;
4. one `end` record with `complete=true` and exact batch/route counts.

Important route fields:

- `batch_index`: monotonic target-decode index; use this for adjacent-token
  analysis. It does not repeat after KV-cache context shifts.
- `pos`: actual KV position passed to the decoder; it may repeat after a shift.
- `input_token_id`: token being decoded, not the token sampled from its logits.
- `layer`, `n_expert`, and ordered `selected` entries.
- `selection_score`: router probability plus selection bias when the model has
  such a bias; otherwise the unmodified router probability. It must be finite
  but may be negative after MiniMax's additive selection bias.
- `weight`: normalized MoE contribution before any later output scale.

The routing trace deliberately does **not** embed GGUF byte ranges. It records
the dynamic route and scores; the separate expert-layout manifest maps each
`(layer, expert)` to shard-local byte ranges. Validation binds the two artifacts
before simulation. This keeps the trace compact and avoids claiming that a
baseline route is portable to a differently laid-out GGUF.

Trace v1 deliberately whitelists the `qwen3moe` and `minimax-m2` routing
contracts, requires `norm_w=true`, one sequence and classic single-token target
decoding, and rejects CFG, MTP, speculative, interactive, and conversation
modes. Prompt batches are excluded even when they contain one token.
`ggml_backend_sched_set_eval_callback` is an observation interface: trace v1
uses it to read several router nodes and therefore introduces scheduler splits
and backend synchronization. It is suitable for measurement, but it is **not**
a cheap production mid-graph prefetch trigger. **Never use trace-run timings or
I/O counters as a performance benchmark.** Default runs do not install the
callback. A production trigger still needs a design that avoids these repeated
synchronization boundaries; previous-token prediction avoids mid-graph readback
altogether.

An interrupted run has no complete `end` footer and is rejected rather than
silently treated as a full trace.

## Expert layout schema

`ik_llama.moe_expert_layout`, version 1, stores compact per-tensor expert
strides rather than expanding every expert range. It supports:

- separate `gate`, `up`, and `down` merged rank-3 tensors;
- offline-fused `gate_up` plus `down`;
- canonical split GGUF files;
- quantized and `_R4` tensors via exact `tensor_nbytes / n_experts` strides.

`file_offset` is an absolute, shard-local byte offset as reported by
`GGUFReader.data_offset`. The manifest describes weight payloads only; it does
not include router weights, dense layers, KV cache, allocator overhead, or OS
metadata pages.

Two identities are recorded:

- `fingerprint`: recomputed SHA-256 over the offset-bearing expert-layout
  manifest, including shard sizes and tensor offsets. It detects a modified or
  mismatched manifest but is not a hash of weight contents.
- `model_signature`: a shared FNV-1a signature over canonical expert tensor
  names, types, shapes, and byte sizes. The trace emits the same signature and
  validation requires equality. Validation also matches the traced model
  filename/path and byte size to a manifest shard. Together these catch common
  wrong-artifact mistakes, but they are not cryptographic weight attestation:
  the operator must still use the exact same GGUF checkpoint.

For the >RAM target, build the intended `_R4`/fused artifact offline and keep
mmap enabled. Runtime `-rtr` and `-muge` change residency/layout assumptions and
must not be used to claim results for the manifest-backed mmap scenario.

## Simulator semantics

Policies:

- `lru`: dynamic forced-admission LRU;
- `lfu`: online LFU with bounded heap compaction;
- `static`: a pinned-only cache selected from a **separate** calibration trace.
  It intentionally does not add a second dynamic page-cache tier.

Access ordering is an explicit approximation selected with
`--access-model cpu-ggml-phase-v1` (the only v1 access model). Demand uses unique
expert IDs in ascending order, independent of top-k rank, and follows logical
CPU GGML phases:

- an already-fused manifest: one approximate `gate_up` phase, then `down`.
  The file stores the gate half before the up half, while the CPU fused kernel
  reads row blocks from the up half and then the gate half; the simulator
  approximates that as interleaved up/gate chunks rather than file-offset order;
- a separate manifest with `--up-gate-mode unfused`: `up`, then `gate`, then
  `down`;
- a separate manifest with `--up-gate-mode fused`: an approximate `up_gate`
  phase that interleaves up/gate chunks by relative chunk index for each expert,
  then `down`. Layers whose gate/up GGML types differ automatically use the
  unfused three-phase fallback, matching graph construction; the result reports
  `mixed_by_layer` when both paths occur.

Demand chunks are deduplicated only inside one phase, so a chunk touched again
in a later phase refreshes replacement state. Unfused tensor/expert ranges are
ordered by file offset; fused phases use the interleaving rules above rather
than claiming a global physical order. This
contract approximates high-level CPU access and is useful for cache sensitivity;
it is **not** the exact row/block/thread order of a GGML kernel, exact page-fault
order, OS read-ahead, or a GPU/RPC/offload access model. The result records
`intra_kernel_order_exact=false` and the effective cache capacity after chunk
rounding. Predictor/prefetch ordering remains top-k rank plus manifest tensor
order and is intentionally distinct from demand order.

Predictors:

- `none`: demand only;
- `previous-token`: uses the previous contiguous `batch_index` for the same
  layer. v1 issues the predicted chunks at an idealized **route-JIT** boundary
  and treats admitted fills as immediately available before demand. This can
  test locality, cache pollution, and predictor coverage, but it does not model
  token-boundary queues, usable lead time, I/O completion, or overlap. It must
  not be interpreted as a realizable timing/speedup result.
- `oracle`: ideal perfect-chunk-JIT upper bound for hiding demand misses. It
  prefetches a missing chunk immediately before demand and must not be read as a
  realizable scheduler.

The result marks `idealized_prefetch_timing=true` for `previous-token` and
`oracle`, while `production_prefetch_timing_modeled=false` for every v1 mode.

`--prefetch-limit-mib` caps issued chunks per route in deterministic
expert/range order. Precision/recall before the cap and issued chunk recall are
reported separately. Plain `*_recall` is conditional on routes where a
prediction exists; `*_overall_recall` also includes uncovered cold-start
routes, and `predictor_route_coverage` makes that distinction explicit.

Result provenance includes the offset-bearing layout fingerprint and SHA-256 of
the evaluated raw trace. Static results also include the calibration-trace
SHA-256. A static profile must be a genuinely separate, byte-distinct
calibration run: the CLI rejects the same path, symlink/hardlink alias, and a
byte-identical copy. Split calibration/evaluation by documents or sessions, not
merely by filename. The library API also rejects an identical expert-routing
sequence, even when file hashes are not supplied. These hashes identify the simulator inputs; they do not turn
the layout fingerprint into cryptographic attestation of GGUF weight contents.

Key byte metrics:

- `logical_range_bytes`: exact selected expert weight ranges;
- `page_aligned_demand_bytes`: route-local union at page granularity;
- `demand_hit_bytes` / `demand_miss_bytes`: modeled replacement chunks;
- `prefetch_read_bytes`, `useful_prefetch_bytes`,
  `wasted_prefetch_bytes`, and `redundant_prefetch_bytes`;
- `modeled_cache_fill_bytes`: prefetch reads plus demand misses. Despite its
  name, it is **not** measured physical SSD traffic;
- `initial_resident_bytes`: static/pinned bytes present before evaluation;
  `modeled_total_fill_including_initial_bytes` adds them for a fairer comparison;
- `max_predicted_batch_bytes_before_cap`: prediction batch size, not peak
  in-flight I/O.

Dynamic policies start with an empty cache while prompt routes are absent, so
the early result includes a cold-start penalty. Use longer traces and inspect
sensitivity; v1 has no prompt-cache snapshot or timed I/O queue. All routes are
retained in memory after line-by-line NDJSON parsing, so very long traces will
need a later streaming simulator.

## Tests

```powershell
python -m pytest -q tests/test-moe-cache-sim.py
```

```bash
python3 -m pytest -q tests/test-moe-cache-sim.py
```

The synthetic suite covers separate/fused layouts, split shards, malformed
manifests/traces, completion and context-shift identity, LRU/LFU/static policy,
oracle semantics, prefetch caps/zero capacity, and both CLIs. A real MoE smoke
run has passed on Qwen3-Coder-30B-A3B (layout build, 96 routes / 48 layers / 2
target batches, validate and simulate). That validates mechanics only; its hit
rate must not be transferred to MiniMax.
