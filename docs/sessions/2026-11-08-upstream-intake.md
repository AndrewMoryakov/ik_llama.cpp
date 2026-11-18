# Intake through 30903876bcef

Assessed on 2026-11-08. This extends the existing draft PR #13, rather than
duplicating its three already assessed upstream changes. The prior record is
`2026-11-07-upstream-intake.md` in this directory.

## Baseline

- Fork `dev`/`main`: `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
- Existing PR head before this intake: `500d27ceb8cfa4fafb6f0b890f339e90743bd0d9`.
- Previously assessed upstream: `0d5aaa826b24014dcd67fbdef6055410db7d8079`.
- Newly assessed upstream head: `30903876bcef4cab5dc802db16fb34c1fd1d966b`.
- Six new commits, listed below. The upstream merge base remains `656036d9`:
  these are ports with different commit IDs, not an ancestry-based mirror.

The intake branch remains `intake/upstream-2026-11-06`, targeting `dev`.
Neither `dev` nor `main` was moved. Follow `FORK_WORKFLOW.md` for promotion.
Future runs must inspect this pending PR and both intake records before
selecting commits; this head is assessed, not yet integrated into `main`.

## Decisions

| Upstream SHA | Class | Port and fork interaction |
|---|---|---|
| `e894442cb5299491bc8068d2b9d4ce12f098a9b2` (#2857) | 1: unchanged | Clamp negative bucket indices and restore original score/index correspondence after compacting interspersed `-inf` scores. The affected IQK helper has no fork-specific changes. Added a public indexer regression test against a reference cutoff, including tightly clustered values, a scalar tail, interleaved masks and dispersed retained groups. Does not alter expert cache sizing or weight placement. |
| `7c1deaf38602c512c1b042cb5c274d14c2dd50d3` (#2856) | 1: unchanged | Template the small CUDA GEMM for F32/F16/BF16. Type-specific row strides and even-width guards are retained. The fork has no competing changes in this dispatch. No CPU behavior changes; CUDA compilation and execution remain unverified. |
| `cc616943c096f564d25e5db768c355e7a0f60154` (#2863) | 2: adapt caller/test | Port the new HC_PRE clamp argument. Xing4 uses 30; DeepSeek4, GLM5Next and OpenPangu use zero. Preserve the previous intake's transpose flag. Adapt the fork's regression test to the new signature and compare with explicitly clipped reference logits and explicit transpose/HC_POST. |
| `69b5568886dcf020dab6c5e216e7db89aed11053` (#2860) | 1: unchanged | Restore LayerNorm, epsilon and bias before FFN for eight architectures. These builders have no fork edits. Verified GPT-2's graph with a tiny deterministic synthetic model; this is not a model-quality evaluation of all eight families. |
| `0c24daf7b03c5fa73152f8febb6dffd16e1f2e09` (#2853) | 2: adapt fork integration | Port separate n-gram GGUF append/shard replacement, option aliases, model parameters and draft reset. Also pass the sidecar to the fork-only RTR metadata probe, so it sees the same tensors as the actual loader. Register every supplied sidecar path in `protected_input_paths` to protect it from diagnostic output. Resolve the documentation conflict by preserving the fork's defer-experts/RTR/no-warmup and mmap guidance, adding the new option beside it. |
| `30903876bcef4cab5dc802db16fb34c1fd1d966b` (#2858) | 1: unchanged algorithm | Port raw NVFP4 import, NVFP4_KS row metadata, CPU/CUDA kernels and quantization/reader support. The loader and quantization files have no competing fork algorithms in this range. RTR's generic tensor-byte accounting includes the four-byte row metadata. Raw type-40 import forces mmap off and allocates owned buffers; this is a material limitation for this fork's out-of-RAM workload, not an mmap-preserving optimization. Only trailing whitespace was removed from the imported loader patch. |

No commit in this range was intentionally excluded. These decisions do not
justify applying future upstream changes without another semantic review.
Benchmark SQL schema, RTR status fields, cgroup handling and the fork's
instrumentation implementations are preserved.

## Verification without Actions

Linux x86-64, GCC 14.2.0, CMake 4.4.4, Ninja 1.13.2. Temporary build tools,
Jinja2 and test models live outside the repository. A previous environment was
lost before its build result was observed; no result from that build is counted.

```bash
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DGGML_CUDA=OFF -DGGML_NATIVE=ON -DLLAMA_CURL=OFF -DLLAMA_BUILD_TESTS=ON
cmake --build build -j 4
PYTHONPATH=/path/to/temporary/python/dependencies \
LLAMACPP_TEST_MODELFILE=/path/to/stories260K.gguf OMP_NUM_THREADS=2 \
  ctest --test-dir build --output-on-failure -j 2 --timeout 120
```

- Full CPU Release build passed, including CLI, server, benchmark, all graphs
  and tests. The final build also regenerated the test registration and built
  the added NVFP4 target.
- Final complete CTest run: **40/42 passed**, 22.87 s. No tests were skipped.
  The two failures match the previous intake: Granite's expected trailing
  newline in `test-chat-template`, and URL download in `test-eval-callback`
  with CURL deliberately disabled. This is not an all-green suite.
- HC_PRE regression: 128 cases across S=1..8, one/five tokens, one/three CPU
  threads, eps=0/1e-6 and clamp=0/30. Both clipping limits are exercised;
  pre/post gates and downstream HC_POST match the explicit reference.
- Indexer regression: 24 cases, top 2048 against a reference cutoff with
  uniqueness/range checks; includes 8192 clustered scores and masked caches
  up to 65536 entries. One/two threads cover the partial-sort and bucket
  paths. A separate temporary harness compiled the actual old/new bucket
  functions with native SIMD: the interleaved-mask case failed before and
  passed after (`before=1 after=0`). The harness is not shipped.
- NVFP4_KS regression: nine matrix/vector cases, widths 64/128/256 and
  one/three/eight activation columns. Checks row metadata and quantized CPU
  products against dequantized F32 products, allowing Q8 activation error.
- Raw NVFP4 import: generated a type-40 GGUF from the small F32 model with
  normalized rows, shared scales and input-scale tensors. Import consumed
  scales, disabled mmap as expected, and generated four tokens with complete
  timing output. Synthetic data is not evidence of real-model quality.
- Separate-file loader: detached the small model's embedding table, then
  checked append, alias plus RTR auto, missing-neighbor shard replacement,
  duplicate/missing-file rejection and protection of the sidecar against
  diagnostic output. Generated output matches the original F32 model.
  These exercise loader plumbing, not real PLE/Engram model semantics.
- GPT-2 LayerNorm: a one-layer synthetic model using the repository's GPT-2
  vocabulary generated four tokens with the final multi-token prompt fixture.
- RTR parser regression covers both sidecar aliases, propagation to model
  parameters, protection of repeated input paths and clearing the draft's
  inherited sidecar. The metadata probe's extra loader argument was reviewed.
- Fork cgroup, MoE cache, trace/timing and parser tests passed. CLI help lists
  the sidecar option/alias and existing RTR/cache/instrumentation options.
- Standard small-Llama smoke with `-rtra` generated eight tokens; timing ended
  with `complete:true`, `generated_tokens:8`, `intervals:7`. Container memory
  headroom is unknown, so RTR took its safe disabled-repack path. AUTO_KEEP
  was not validated here.
- Smoke model SHA-256:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- `git diff --check` passed across the complete new intake range.

## Remaining evidence and a newly observed limitation

CUDA GEMM and NVFP4/HC_PRE kernels need CUDA compilation and execution.
Real Ripple, DeepSeek V4.1 compaction/MTP, PLE/Engram and mainline NVFP4
model runs remain unverified. No out-of-RAM or target-machine performance
claim follows from these in-RAM fixtures. In particular, raw NVFP4 import's
forced owned-buffer load needs memory-budget evaluation before such use.

The initial synthetic GPT-2 fixture used the single token `hello` as prompt.
Generation reached the diagnostic writer, but its final check failed with
`llama n_eval does not match the token timing interval`. The final LayerNorm
fixture uses `hello world` to isolate the restored FFN graph and passes.
The one-token-prompt timing discrepancy is **not fixed** by this intake and
has not been reproduced on a separately built pristine fork baseline. A
focused follow-up should examine whether the prompt's single-token decode is
included in `n_eval`; do not use this diagnostic configuration as a validated
measurement path until it is resolved.

PR #13 remains draft; no automatic merge or GitHub Actions dependency is added.
