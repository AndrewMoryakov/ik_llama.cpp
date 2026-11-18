# Intake through 093e74cb0590

Assessed on 2026-11-18 for [draft PR #13](https://github.com/AndrewMoryakov/ik_llama.cpp/pull/13).
The intake branch started at `cbf6d5a6a9ad6ef3b30eb3d2d9b6d539ad9f3136`,
which descends from current dev and main,
`9aea4daefc7f0043255d78f8cb47ea58179090f8`.
The previous record assessed upstream through
`464613d7c12f8f0ba6cf910b38659ece3eb321e9`.
The older upstream-sync head and upstream snapshot tags cover earlier work.
Live branch and open-PR checks found PR #13 as the existing pending intake.
AGENTS.md and FORK_WORKFLOW.md were read from current dev before editing.

## Decisions

| Upstream SHA | Class | Implementation and interaction with the fork |
| --- | --- | --- |
| `8d50c6ff206bfc3c19a74bf1002f3894757cf852` (#2937) | 1, unchanged | Set default matrix-multiplication precision on both local destinations in fused up/gate fallback. The unary operation parameter must not be interpreted as a precision enum. Existing shape and placement dispatch and the fork's GEMM stride guards apply. CUDA translation-unit compilation passes. On-device output parity remains a gate. |
| `832cfca2adb3d30df79b41d10b7dfc65264a134b` (#2918) | 2, adapted | Port native row-scaled and block-scaled E4M3 FP8, CPU W8A8/BF16 routes, CUDA operations, precision selection, loader import and reload scale tracking. Retain the fork's guarded simple-GEMM dispatch after the new FP8 dispatch. Validate duplicate names across the model and n-gram sidecar before either NVFP4 or FP8 consumes scales, then calculate tensor counts and bytes from the final set. Native FP8 can retain mmap, while raw FP8 import materializes weights and disables mmap. The MoE cache copies activation-scale metadata with cached expert views. Hot swap restores input scales and rejects unsupported raw-type or static-scale reloads. CPU matmul and model fixtures are checked below. Real FP8 MoE cache and hot-swap transitions remain gates. |
| `59754241f19833038a44ba76112dc19d199850d8` (#2919) | 1, unchanged | Port ModelOpt Qwen3.5/Qwen4Exp NVFP4 and FP8 conversion, activation metadata, MTP extraction and streamed PLE serialization. CPU fixtures cover FP8 row/block scale layout, unsupported-layout dequantization, invalid scale shapes, NVFP4 nibble and endian layout, and lazy PLE chunk order. These fixtures verify packing without model weights. Full ModelOpt checkpoint conversion and MTP/PLE inference are pending. |
| `44e80fc6cbcdc8498f1b7a27bb76fff7b7d95ffd` (#2931) | 2, adapted | Replace the global fixed context table with independent context allocations and coallocated owned arenas. External arenas remain caller-owned. Add an overflow guard before rounding and adding arena size to context overhead. Tests exercise 256 simultaneous contexts, external-buffer ownership/alignment and concurrent init/free. This changes ggml metadata/arena allocation, while model mmap, pinned CUDA host allocations and the fork's model-memory policy use their existing paths. The legacy Windows stdio setting remains documented. |
| `e034e99bdeaa75379b51d7250d5a53baa1a15492` (#2939) | 2, adapted | Port the upstream release notes and parameter documentation. Replace the new instruction to alter the legacy benchmark test table with the fork's actual test_v3 and comparison-script behavior. Keep the fork's RTR headroom descriptions and supported attention-only split mode. |
| `ff5fe8422f982a3ec88d489722b2321035eac8f5` (#2921) | 2, adapted | Port backend-level graph input copy hooks with scheduler fallback. In the fork, return to the scheduler for every active MoE-cache callback so placement/share and prefill expert-range reuse retain their existing coordination. Bound TG padding clears to the next allocated expert and its extent, and use block-strided writes for paired up/gate copies. Upstream cleared beyond the last expert and used overlapping per-thread clear loops in the paired kernel. Host-pointer registration and alignment checks still control direct access. Page-fallback, cross-device synchronization and multi-GPU runtime checks remain gates. |
| `093e74cb0590eaf462a04516ba1bab8c6b6637bc` (#2940) | 2, adapted | Fuse CUDA MULTI_ADD followed by SCALE only when the next node exists, uses that sum, has the same shape/device and is its sole consumer. Preserve explicit outputs and branched consumers. The upstream single ampersand evaluates the next-node access even at the graph tail. Use the destination's row stride for fused output. A CPU structural test exercises valid fusion, terminal-node bounds, explicit intermediate output and a second consumer. CUDA numerical and strided-output checks remain pending. |

No commits in this interval were classified 3. The earlier decision to retain
attention-only splitting and its public enum values remains in effect.

## Verification

- Clean native Linux x86-64 GCC 14.2 CPU Release build passed the 347 initial
  build steps. The follow-up build compiled and registered the new tests and
  rebuilt the checked context allocator. CUDA and libcurl were disabled.
  Temporary CMake, Ninja, NumPy, Jinja, CPU PyTorch and CUDA tools were provisioned.
- CTest passed 52 of 54. The documented baseline failures remain Granite's
  chat-template newline expectation and eval-callback's Hugging Face download
  in a build without libcurl. No new test failed.
- New tests passed for FP8 KS/B128 CPU matrix multiplication with exact small
  values, context ownership/alignment and 256 simultaneous contexts, eight
  threads performing 1000 init/free iterations each, and structural fusion
  eligibility including a terminal node, explicit output and branched consumer.
- The SIZE_MAX allocation request was rejected with the size-overflow diagnostic
  before allocation. The final test binary was used for this subprocess check.
- The new raw-FP8 fixture imported 37 tensors. Unified raw GGUF, detached
  token-embedding sidecar and equivalent native KS GGUF produced identical
  four-token output in W8A16 mode. A duplicate sidecar scale was rejected.
  The existing NVFP4 import/sidecar and precision tests also passed.
- Four ModelOpt packing and streaming tests and the seven existing Step-5
  conversion tests passed with CPU PyTorch. Converter and lazy tensor sources
  passed Python syntax compilation.
- CUDA 13.5 compiled ggml-cuda.cu, f8.cu and multiadd.cu for sm_80. The final
  expert-copy bounds and fusion guards are included. No GPU was available,
  so no on-device numerical, synchronization or memory-check result is claimed.
- The CLI generated eight tokens and a complete timing record. The benchmark
  JSON smoke produced pp4 and tg4 rows. The help audit found the FP8 precision
  control and the existing RTR, SWA, deferred-loading and MoE-cache options.
  No throughput or memory improvement is inferred from these smokes.
- The stories260K.gguf fixture SHA-256 was
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- git diff --check passed. GitHub Actions was unavailable.
  The large upstream ggml.c source was fetched by blob SHA
  `d995b4a2bfe7960f431f876bdd20eef91cca0006` and verified. The fork's
  overflow-guarded blob `c215e259e1dbf0b9ee417861440a466dc4a41104` was
  verified after creation. The published tree must match the tested local tree.

## Remaining gates

Keep PR #13 draft. CUDA compilation checks do not establish GPU numerical
correctness. Run FP8 W8A8/W8A16 and block-scaled weights on Ampere and newer
hardware, including Blackwell TMA/cuBLASLt routes, multi-GPU expert copies,
pageable fallback, MoE-cache hits/misses and prefill, FP8 hot-swap scale state,
fused up/gate fallback and MULTI_ADD/SCALE with strided outputs and branches.
Convert a real ModelOpt Qwen checkpoint and compare target/MTP and PLE outputs.
Previous DSV4 vision, QSA large-context memory, CUDA/RPC, DeltaNet, WMMA, MMQ,
recurrent ban restore and out-of-RAM model gates remain open.
