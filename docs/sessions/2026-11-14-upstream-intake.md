# Intake through fcf7b364786e

Assessed on 2026-11-14. Continues [draft PR #13](https://github.com/AndrewMoryakov/ik_llama.cpp/pull/13).
The fork's `dev` and `main` were both at `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
The draft started at `f3e50e1bb1a94430cf629d2755da602d29c48a87`, a descendant
of current `dev`. Its November 13 intake record ended at upstream
`7aa7e01482db892b023bb9aace9a40567ab5297a`.
The `upstream-sync` branch and upstream snapshot tags mark older work.

## Decisions

| Upstream SHA | Class | Implementation and evidence |
| --- | --- | --- |
| `b0f05ddbffe3237e6a72c65f745d026fc11528ac` (#2913) | 2, adapted | Port the FP16 Qwen4exp QSA bias and padded cut-mask addition, tiled CUDA DeltaNet prefill, and 64-byte CUDA-host alignment. On failed pinning, capped/chunked host allocations retain their CUDA-host buffer type for the existing fork cleanup path. That branch now reserves alignment slack and exposes a 64-byte-aligned base while retaining the original CPU pointer for free. Pinning limits, fallback decisions, mmap eligibility and expert placement policy are preserved. The QSA bias takes two bytes per entry and has extra rows for padded prefill batches. CPU mask fixtures cover F16/F32 causal masks, the padding boundary, finite boosts and infinity handling. |
| `970c29a16e597d9a2e9cf127420826f67359959f` (#2912) | 1, unchanged | Skip token and per-layer embeddings and Engram tensors in estimated imatrix generation using the existing repack exclusion predicate. The skip precedes reading and dequantizing the tensor, reducing work in the offline quantizer. Model loading, the mmap policy and quantizer type selection retain their existing paths. The model fixture asserts that token embeddings are absent from the generated imatrix and still completes estimated IQ2_KT quantization. |
| `fcf7b364786ec621d0c53eae39223efc5492b8c5` (#2916) | 1, unchanged | Dispatch 10 active experts to the existing specialized CUDA row-ID helper in the additional MMQ path. The earlier dispatch already uses this helper. Expert selection, residency, cache policy and buffer sizes are unchanged. Static inspection confirms the shared helper pads the 10 slots to 16 lanes. CUDA output parity remains unverified. |

Benchmark schema, trace format and runtime options are unchanged. No throughput
or memory improvement on target hardware is claimed from the CPU checks.
No changes in this range were excluded.

## Local verification

- Clean native CPU Release build passed, 336 Ninja steps, Linux x86-64, GCC 14.2,
  CUDA and libcurl disabled.
- CTest with the local `stories260K.gguf` fixture passed 44 of 46. The two
  baseline failures are the Granite chat-template newline and the Hugging Face
  eval callback in a build without libcurl.
- Targeted imatrix and indexer tests passed. The latter covers six CPU
  QSA cut-mask cases plus the existing 24 indexer ranking cases.
- F32 CPU generation produced eight tokens and a complete token timing record.
  The help audit found RTR, SWA, MoE cache, deferred experts, speculation and
  diagnostic trace flags. The instrumentation lifecycle tests passed.
- Fixture SHA-256:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- `git diff --check` passed. GitHub Actions was unavailable.

## Remaining verification

Keep PR #13 draft. Build with the CUDA toolkit and compare tiled DeltaNet with
the reference for head sizes 64/128, tail tiles and saved states. Check pinned
and pageable allocation with `GGML_CUDA_HOST_CHUNK_GIB`, including forced pin
failure. Compare 10-expert MMQ routing and outputs with the generic helper.
On real Qwen4exp, compare fused and unfused QSA ranking and measure hybrid prefill
and memory against the previous head. Earlier CUDA/RPC transfer, DeepSeek-V4
device-cache reset, Blackwell and out-of-RAM model checks remain open.
The existing GEMM stride and NVFP4 n-gram sidecar review threads also remain open.
