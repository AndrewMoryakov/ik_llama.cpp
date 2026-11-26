# Upstream intake through 0d5aaa826b24

Assessed 2026-11-07 (Europe/Moscow). The fork is a deliberately divergent
product: preserve its CPU/out-of-RAM MoE, RTR auto policy, mmap telemetry,
benchmark schema and instrumentation while evaluating upstream changes.

## Baseline and integration route

- Repository: `AndrewMoryakov/ik_llama.cpp` (independent repository, outside
  GitHub's upstream fork network; use a branch in this repository for the PR).
- Fork `dev` and `main` at assessment: `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
- Last common upstream ancestor: `656036d98503e154952f6c633cb3febc1a4f08b4`.
- Assessed upstream head: `0d5aaa826b24014dcd67fbdef6055410db7d8079`.
- Three new upstream commits; 161 fork commits beyond the common ancestor.
- Intake branch: `intake/upstream-2026-11-06`; PR target: `dev`, following
  `FORK_WORKFLOW.md`. Promotion of a gated `dev` state to `main` remains a
  separate reviewed step. This intake does not merge or move either branch.

These SHAs are the assessed range, not a claim that the changes are already in
`main`. Until the PR is merged, future intake runs must find this pending branch
and PR rather than opening duplicates. Once merged, use the recorded upstream
SHAs as well as Git ancestry: ports have different commit IDs from upstream.

## Decisions

| Upstream commit | Intent and relevant paths | Decision and fork interaction |
|---|---|---|
| `6e390bde13db42b54f5e8eab101b729f7eb75d8e` (#2843) | DeepSeek V4.1 raw-K row construction in `src/llama-dsv4.cpp`: for compacted single-stream KV, derive contiguous live rows directly; retain raw planning between planning and tensor-setting phases. | Applicable unchanged. The fork has no differences from the baseline in this file. Inspected both prepare calls in `llama.cpp`: the planning call precedes graph reuse, and the tensor-setting call consumes that plan. Multi-stream and non-compacted cases retain the cell walk. Does not alter expert loading, mmap or repack policy. Real DSV4/MTP/compaction validation still requires an appropriate model. |
| `719d709a65e5de4542a47d6adfa0b17cf0bc279f` (#2848) | Write the transposed HC_PRE combination matrix directly on CPU/CUDA and remove Xing4's explicit permutation/contiguous copy. | Applicable unchanged, with a fork-side regression test. None of the three production files differ from the baseline in the fork. The test checks unchanged pre/post gates, equality to the former explicit permutation, and equality of the downstream HC_POST result for S=1..8, one/five tokens, one/three CPU threads and eps=0/1e-6. CUDA remains untested here. |
| `0d5aaa826b24014dcd67fbdef6055410db7d8079` (#2852) | Ripple/Ricursive architecture, tensors, hparams, graph and value-residual mixing. Extends shared attention helpers with optional inputs. | Applicable unchanged. Only `llama-model.h` and `llama.cpp` overlap fork-modified files; the new layer field/SwiGLU/SWA/RoPE cases compose with the fork's RTR telemetry and policy at separate locations. The other production files match the baseline. Default null arguments retain the pre-existing value input for existing model families. This is dense-model support and does not replace the fork's MoE placement or benchmark logic. No real Ripple weights are available in this run. |

No production adaptation was required for these three commits. A clean patch
application alone is not the evidence for that decision: the affected helpers,
call sites, model fields and fork-specific changes were inspected. Future
upstream changes must be reassessed individually.

## Verification

Verification is performed in the execution environment because GitHub Actions
is unavailable. Do not create an Actions dependency or describe its checks as
passed. Temporary CMake/Ninja tools and a small smoke-test model are outside
the repository.

Environment: Linux x86-64, GCC 14.2.0, CMake 4.4.4, Ninja 1.13.2. Production
source tree verified against the published port:
`b533a5ff1135c8159720c3f4500bdfa220f17ac7`.

```bash
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DGGML_CUDA=OFF -DGGML_NATIVE=ON -DLLAMA_CURL=OFF -DLLAMA_BUILD_TESTS=ON
cmake --build build -j 4
LLAMACPP_TEST_MODELFILE=/path/to/stories260K.gguf OMP_NUM_THREADS=2 \
  ctest --test-dir build --output-on-failure -j 2 --timeout 120
```

- **Full default CPU Release build: passed**, including the new Ripple graph,
  all existing graphs, CLI, server, benchmark and test binaries. No production
  source or build feature was disabled to work around a compilation error.
- **CTest: 35 of 37 registered tests passed after repairing the temporary
  Python environment.** Initial run: 34 passed; `test-jinja-py` failed because
  its Python subprocess could not import `jinja2`. Installed Jinja2 3.1.6 in
  the temporary tools directory and reran just that failed test with the
  directory on `PYTHONPATH`: passed (21.57 s). All other initial passes remain
  valid; this is an aggregate result, not a claim of an all-green full run.
- The remaining `test-chat-template` failure is the Granite expected-output
  trailing-newline mismatch already documented in `FORK_WORKFLOW.md`. This
  run fails at the same Granite comparison. The test and template formatter
  are unchanged by this port. A separate pristine-baseline build was not run.
- The remaining `test-eval-callback` failure requests a Hugging Face download
  in a build configured with `LLAMA_CURL=OFF`; its log explicitly reports
  missing libcurl support. **Manual local-model callback smoke passed** with
  `llama-eval-callback -m stories260K.gguf -p hello --seed 42 -ngl 0 -n 8`.
  This checks the callback path, not URL download support.
- `test-hc-pre-transpose`: **passed**, comparing the new fused output and
  downstream HC_POST against the previous explicit permutation in 64 CPU
  cases. A temporary negative-control wrapper cleared HC_PRE's transpose flag
  before graph execution, emulating the old kernel ignoring it: the test
  correctly failed at S=3, T=1, threads=1, eps=0. This wrapper is not shipped.
- Fork regression tests passed: RTR parameters, cgroup resolver, MoE trace
  and token timing writers/lifecycle, MoE cache shares and cache simulator.
  `test-chat-auto-parser` and `test-ngram-cache` also passed on this Linux host.
- **CLI help audit passed** for `-rtra`, `--run-time-repack [0|1|auto]`,
  `--moe-cache-mib`, `--moe-trace` and `--token-timing`.
- **Generation smoke passed** on the small Llama `stories260K.gguf` model:
  `llama-cli -m stories260K.gguf -c 128 -n 8 -p 'Once upon a time' -s 42
  -t 2 -ngl 0 -rtra --ignore-eos --no-display-prompt --token-timing timing.ndjson`.
  Eight tokens were generated; the timing end record reports `complete:true`,
  `generated_tokens:8` and `intervals:7`. RTR auto reported unknown memory
  headroom in this container and took its safety-first disabled-repack path;
  this does not validate AUTO_KEEP or out-of-RAM behavior.
- Smoke model source: `ggml-org/models`, `tinyllamas/stories260K.gguf` on
  Hugging Face. SHA-256:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- `git diff --check`: passed.

The obsolete one-shot Actions workflow was removed from the intake branch;
the PR's final diff contains no workflow changes. Publication uses ordinary
GitHub repository writes and does not depend on Actions.

## Remaining gates

- CUDA compilation/execution of the transposed HC_PRE kernel.
- Real Ripple inference, including sliding-window attention and value-residual
  behavior; a generic small-model smoke test cannot establish this.
- Real DeepSeek V4.1/MTP/compaction inference.
- Swap-bound out-of-RAM MoE measurements on the user's target machine. An
  in-RAM test cannot validate that workload or make a performance claim.

The intake must remain draft while these unverified changed inference paths
prevent a promotion decision. No auto-merge is configured.
