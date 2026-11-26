# Intake through 1180df7edc23

Assessed 2026-11-22 after reading live dev AGENTS.md and FORK_WORKFLOW.md.
Current dev/main: `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
Last assessed upstream: `3ed960ed3b9debf22e4e833f492a275b593072b0`, recorded
in docs/sessions/2026-11-21-upstream-intake.md on existing draft PR #13.
Previous published intake head: `b7926cb0f09fa0643efd9e8cb0d47e695d454b25`.
Checked current branches and open dev PRs: #13 is the only pending intake.
Used clean isolated worktree intake-local/2026-11-22 from that head, descendant
of current dev, with origin and ik-upstream remotes and no tracking upstream.
Older incorporation is covered by upstream-sync history, snapshot tags and
prior durable records. Seven reviewed upstream patches applied cleanly with
-x attribution. No dev/main changes and no automatic merge.

## Decisions

Six class 1, one class 2; no class 3 decisions in this interval.
Prior retention of ARM legacy quant formats and ATTN=2/GRAPH=3 remains in force.

| Upstream SHA | Class | Intent, implementation and fork interaction |
| --- | --- | --- |
| `11f5e7cf62dbf5132681a6178eceb6e759295f78` | 1 | model: add Inkling 2 Mini (inkling2_loop) (#2967). Inkling 2 Mini converter, graph, tokenizer/no-BOS/chat and looped residual stacks; relative-position attention bias on generic CPU, IQK and CUDA. Output weights are viewed at tokenizer vocabulary size, small scaling/router tensors stay F32, logits row offsets use size_t. Shared host expert weights become inputs for every consuming scheduler split so loop visits copy their own selected IDs. Retain the fork MoE callback fallback, expert padding bounds, pinned caps, mmap/sidecar validation, allocation overflow guard and WMMA Dv store bound. Real looped MoE/mmap/offload parity remains a model gate. |
| `3e74c31410e14e78203f9e593be234563a26017a` | 1 | qwen35: add SenseNova-Loop support (partial layer loop + mHC) (#2936). SenseNova official loop architecture, converter and MTP/mHC; physical weights are shared while execution visits have separate KV/conv/recurrent state. Sparse stored tail is mapped to physical slots and MTP bytes are counted with output allocation. Reject preview/mislabeled GGUFs rather than silently using wrong layouts. The Nanbeige full-loop path is preserved. Upstream test covers partial/full loop execution and sparse tail mapping; real model memory/restore/MTP remains a gate. |
| `ef5040cc6e5503c35a0d362816322b2f63b7106e` | 1 | Added mappings for: (#2969). HIP pointer/host-memory attribute aliases support the existing direct-copy validation. AMD compilation/execution cannot be checked here; preserve fallback and registration behavior. |
| `14735e3c08b7ee17bc4c477a94392a0d93f99829` | 1 | server: release slots that hold a pending prompt (#2970). Release pending IDLE+LOAD_PROMPT slots as well as active decoding slots. Drop redundant state toggling in empty/embedding rejection paths. This prevents rejected requests retaining server slots/KV resources; runtime HTTP rejection/reuse regression is required. |
| `86a0bceea3abd8521cb6f136acc53074e82a42f0` | 1 | Fix compilation failure. Repair the SenseNova test compilation after its introduction; final test checks identity, partial loop, sparse tail and full-model loop without calling the unavailable has_layer_loop method. |
| `07ee48088d92fb0b6e6df5a0ba6996cc105ee468` | 1 | CUDA: SiTU in the fused up-gate ops (#2972). CUDA SiTU support for dense/fused MoE up-gate, FP8 and quantized MMV paths; carry beta parameters, disable fusion for LoRA/unsupported backends, retain unfused fallback and guarded GEMM. Existing cache bias IDs/device hint and callback paths remain. GPU numerical parity and LoRA/mixed placement are pending. |
| `1180df7edc2349470b651b64cade01341b52e0af` | 2 | Add clip op for Inkling2 (#2971). Add dedicated CPU/CUDA Inkling clipping operation, fuse the graph expression and bump RPC protocol. Remove upstream diagnostic-only SQR pattern printing from the runtime: it performs no fusion and emits unsolicited stdout, which interferes with CLI/benchmark consumers. Preserve all numerical clip code. New test compares strided 3D clipping and relative-bias attention against scalar references. Rebuild RPC peers together; CUDA clip/FA numerical parity remains pending. |

## Fork interaction

No RTR default changes, no promotion of unmeasured hot-expert budgets, and no
benchmark test_v3 schema changes. Looped execution adds per-visit state while
sharing physical model weights; its memory estimates and scheduler expert-copy
semantics are material for large out-of-RAM models and need real-model checks.
Model mmap ownership, deferred loading, sidecar duplicate/scale validation,
MoE-cache copy coordination and existing bounded kernel dispatch remain intact.
No performance or memory improvement is claimed from compilation/smoke tests.

## Verification

- Clean Linux x86-64 GCC 14.2 CPU Release shared-library build passed all
  364 initial steps and the final rebuild of the changed source/tests. Native
  CPU enabled; CUDA/CURL disabled. Provisioned temporary CMake/Ninja, matching
  Python 3.13 NumPy/Jinja and CUDA 13.5 tools in the execution environment.
- Full final CTest: 57/59 passed. Only the documented Granite trailing-newline
  assertion and eval-callback download in a CURL-disabled build failed. No new
  failures; no skipped model-fixture checks. Existing FP8/NVFP4/import, sidecar,
  warmup, quantization, MoE policy, masks, timing and Jinja checks passed.
- Added test-inkling-ops passes: noncontiguous 3D clip input with row padding,
  scalar norm/clamp reference and three worker threads; F32 relative-bias FA
  scalar references at widths 8 and 128, two queries, past/future keys and
  capped distances. Upstream SenseNova test passes identity/partial/full loop
  execution and sparse tail indexing.
- Added tests/test-server-pending-release.py. On the previous Nov21 build it
  fails its final no-KV-overflow assertion: rejected long prompts were still
  decoded to KV exhaustion. On the final new server it passes three cycles of
  400 rejection, idle slot and successful two-token short request, without KV
  overflow. Run with --server <binary> --model <F32 fixture>.
- CUDA 13.5 compiled sm_80 ggml-cuda.cu, inkling2.cu, unary.cu, f8.cu, mmvq.cu,
  fattn-wmma-f16.cu and the 1x8 MMA template instance. No on-device execution or
  complete CUDA link is claimed. No NVIDIA/AMD devices were present.
- Converter/update script and changed GGUF Python sources compile. Full real
  checkpoint conversion and inference remain pending; syntax is not numerical
  converter validation.
- Final eight-token generation passed with HAVE_FANCY_SIMD. Token timing has a
  header, eight interval records and an end record. Benchmark JSON has pp4/tg4.
  Help retains RTR/auto, offload-device, SWA, MoE-cache share/policy and deferred
  expert/PLE controls. No performance gain is inferred from these smokes.
- Fixture SHA-256: 270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d.
- git diff --check passes. No CLI push credentials; publish through connector
  with expected branch head b7926cb0f09fa0643efd9e8cb0d47e695d454b25, no force.
  Large upstream ggml.c fetched by blob d57c08880638bbbfee377d9c61f8599274a8667b
  and verified after creation. Fork blob 794c0b12218dc665cf87dcb8b8323607684cdbbf
  was created and verified with diagnostic removal, legacy ARM types and prior
  allocation overflow guard retained. Published tree must equal tested tree.

## Remaining gates

Keep PR #13 draft. Real Inkling 2 and SenseNova GGUF conversion/loading,
logits and MTP acceptance, looped per-visit state/checkpoint/session restore,
shared-expert copies on every split, MoE-cache warmup and CPU share, pinned and
pageable fallback and out-of-RAM execution remain model/hardware gates.
CUDA FA relative bias (MMA/WMMA/vec/tile), clip and SiTU (FP8 and quantized),
LoRA fallback, multi-GPU placement and HIP/Metal/Vulkan/RPC require their
platforms. Rebuild RPC peers for the changed protocol. Earlier draft gates
listed in the Nov21 and preceding intake records remain open.
GitHub Actions is unavailable and was not used.
