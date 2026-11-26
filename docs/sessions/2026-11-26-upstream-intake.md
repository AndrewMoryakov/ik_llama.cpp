# Upstream intake through ff9b96b0e7c9

Assessed 2026-11-26 after reading the current fork entry points:
- `AGENTS.md`, blob `51c0405d0c8e0826cb8b16293adcea10344ec684`
- `FORK_WORKFLOW.md`, blob `d0f7b8503bd1200693c672cf7f99bbf0bfbfb623`

Last assessed upstream: `16214732274e07ae9e7c1cda30d52c5b7f5f8718` (Nov 25 record).
GitHub compare confirms **10 commits ahead, 0 behind** from that SHA to upstream main:
`ff9b96b0e7c9ba64c77aaf8c6b51d13849d30791`.
The upstream repository has no `AGENTS.md` at main (404).

The only open intake PR is #13, draft, base `dev` at
`9aea4daefc7f0043255d78f8cb47ea58179090f8`, head branch
`intake/upstream-2026-11-06`, prior head
`fbfb1f71d0ffd3ddf9874056551ebf00e663ab8e`. This is an assessment-only
extension of the existing branch; no duplicate intake branch or PR.

## Blocker / execution status

This execution environment has no local repository checkout. A `git ls-remote`
attempt against both GitHub remotes failed because DNS could not resolve
`github.com`. Therefore a clean working tree, both local remotes, native
build tools, and focused tests could not be run here. No code ports are
attempted speculatively.

The GitHub contents fetch of fork `ggml/src/ggml.c` returned an empty content
field for the large file. It was **not** treated as source: the reported blob
SHA `902af1ad79b0e050e9f4cc0a531454eec3a667da` was fetched through the Git
blob endpoint; the verified text is 1,203,985 bytes / 34,359 lines and
contains the fork's graph-compute and custom CPU-affinity code. This confirms
that large-file source was retrieved by blob, not from an empty response.

The decisions below are source/diff assessments. Class 1 means the smallest
port should be upstream-equivalent; class 2 means the port must retain the
fork-specific constraints. **None of the code/test implementation evidence is
claimed in this cycle.** Previous class-3 exclusions (unsafe small-softmax and
control fusions, ARM quant retirement, ATTN retirement) remain unchanged.

## Per-SHA decisions

| Upstream SHA / change | Class | Intent, fork interaction, proposed port and focused validation |
|---|---:|---|
| [`ff9b96b0e7c9`](https://github.com/ikawrakow/ik_llama.cpp/commit/ff9b96b0e7c9ba64c77aaf8c6b51d13849d30791) — fuse SSM_CONV + ADD + SCALE (#3012) | 2 | Fuse only the exact adjacent graph pattern and keep the fork's liveness/output/consumer, stride, alias, and backend guards. The CPU patch checks F32 shape; CUDA assumes F32 contiguous element-0 and asserts shape. Do not weaken the fork's general fusion safety policy. Test fused/unfused CPU parity for Mamba2/Inkling2, optional delta, short/long token paths, non-contiguous and fanout/output cases; CUDA compile and numerical parity remain GPU gates. |
| [`c16b4a7f8176`](https://github.com/ikawrakow/ik_llama.cpp/commit/c16b4a7f81760836d2993c08a2476bd23185c1f1) — SenseNova-Loop DFlash2 draft support (#3009) | 2 | Adds final-postnorm as a DFlash target feature (converter sentinel 1000 -> runtime 999), disables output-row reduction during capture, and captures `l_final`. Adapt the fork's capture/feature-position, partial-loop and per-visit state paths; ensure feature width and sentinel validation are consistent. Converter metadata tests and capture-shape tests first; real DFlash2 draft GGUF and target logits are model gates. |
| [`b4c0946d4590`](https://github.com/ikawrakow/ik_llama.cpp/commit/b4c0946d4590e9230fc32bd9927d899fcc8f7b90) — MoE-cache tuner (#3008) | 2 | Adds an eight-probe budget/share sweep, scoring after two conditioning checkpoints, then requires >=5% TG gain in two confirmation runs. JSONL fields `n_kv/speed_pp/speed_tg` match the fork sweep-bench schema inspected. Adapt reporting and recommendation limits to fork cache policy, RTR/hot-expert policy, CPU share, test_v3/benchmark output and out-of-RAM use; never present a cache recommendation as universal. Add mock-runner/schema tests and a live small-model sweep. |
| [`479a41aa40c8`](https://github.com/ikawrakow/ik_llama.cpp/commit/479a41aa40c85ee0d43acd5031969122ff9546e0) — IQK FA split-K for 2–7 query tokens (#3005) | 2 | Splits KV chunks across workers for speculative multi-token decode and balances chunk count/work-buffer bounds. Keep the fork's generic GQA=3 fallback; do not route the known problematic ratio through the new IQK path without proving it. Validate q=2..7, GQA ratios incl. 3, quantized K/V, mask/relative-bias fallback, chunk/work-buffer bounds, and 1/2/4/8 workers against scalar/generic FA. |
| [`049b783e14c1`](https://github.com/ikawrakow/ik_llama.cpp/commit/049b783e14c1f10e7bd7158824812b69dd3206fd) — parallel recurrent-state restore (#3006) | 2 | Adds OpenMP host-copy API using the thread/NUMA/CPU-affinity team from the last graph compute, and collects host SSM/conv snapshots for parallel copy. Fork affinity and NUMA policy must be preserved. Upstream stores team/affinity in global state; concurrent contexts could race, so prefer context/thread-scoped metadata or prove serialization. Test host vs backend/split copies, no-OMP/single-thread fallback, threshold, exact rollback, concurrent contexts, and affinity restoration. |
| [`4cca3b112f51`](https://github.com/ikawrakow/ik_llama.cpp/commit/4cca3b112f512b0c18071795b76dbf910657917c) — Raon-1 mini reasoning-effort steering (#3002) | 2 | Adds optional F32 per-layer MoE-branch vectors, per-sequence alpha input, converter metadata and CLI/server `reasoning_effort`. Fork supports RAON1 and RAON1_NANO but its current graph/model layer has no steering tensor/API. Adapt only to the mini architecture (not nano by name similarity); keep per-sequence isolation, default/none semantics, vector F32, template kwargs and API validation. Converter/load tests, two-sequence isolation and server request tests; real mini GGUF is a model gate. |
| [`f25029e17e6b`](https://github.com/ikawrakow/ik_llama.cpp/commit/f25029e17e6bdd202d636e3f34364ad1232ec19e) — delta-net row-block prompt path (#2999) | 2 | Skips a state self-copy and adds AVX2 prompt processing split over 32-row tasks for >=32-token batches. Fork has custom recurrent layouts and per-step MTP/rollback snapshots. Port only if its layout/alias contract matches; avoid excessive per-thread stack scratch and preserve state snapshot semantics. Test bit-identical output/state for in-place/out-of-place, thresholds, head dimensions, 1..many threads and MTP restore. |
| [`13df6be47605`](https://github.com/ikawrakow/ik_llama.cpp/commit/13df6be476059ea4448102f944675be6a1a04f57) — DSV4 index-key state row bound (#2997) | 2 | Uses the largest tensor's rows for shared streams where ratio-1/ratio-2 index-key owners differ. Fork has custom DSV4 shared/device-cache layouts and state format; adapt stream sizing and per-tensor min-row copy. Test shared-stream ratio-1/2 owners, save/restore after n_ctx/2, per-stream and full-stream state and decode parity. |
| [`de14e5831030`](https://github.com/ikawrakow/ik_llama.cpp/commit/de14e5831030c4a7a56998923ad0d6ceb44513d4) — refuse incomplete/extra sequence-state data (#2996) | 1 | Require the sequence-state reader to consume exactly the declared file size and clear the destination sequence/cache on mismatch. The check is independent of model/cache placement; preserve the fork's DSV4 version-specific reader accounting. Test valid exact-size, truncated, trailing-byte and incompatible-layout files, and verify destination cleanup. |
| [`630f084a8e06`](https://github.com/ikawrakow/ik_llama.cpp/commit/630f084a8e0636fece9e6add896db021ea0a58ee) — deliver server task errors to waiters (#2995) | 2 | `recv(id)` now also consumes matching error results and handlers register waiter IDs before posting. Fork has a custom legacy result queue and some handlers register after posting; adapt task-ID reservation/registration to avoid losing immediate results and retain queue ownership semantics. Test missing/invalid slot files/IDs, LoRA and control-vector failures, immediate completion race, HTTP error response and clean shutdown. |

## Verification and next step

- Upstream comparison: **10 commits, no behind commits**, from `16214732274e` to `ff9b96b0e7c9`.
- Source inspection: commit patches for all 10; fork sweep-bench JSONL schema and queue code; fork graph/architecture code; large ggml.c fetched by blob SHA.
- Tests/builds: **not run** (no checkout; GitHub DNS unavailable). No CUDA/GPU, model, ARM, or container execution is claimed.
- No Actions/workflows were created or consulted.
- No code port, PR-ready state, merge, or main/dev change. Existing #13 stays draft. Resume with a working local clone/toolchain, create a clean worktree from this intake head, port class 1–2 changes in coherent groups, and run the listed focused tests before changing the draft's confidence.

Review Complexity: High. Assessment prepared with AI assistance.
