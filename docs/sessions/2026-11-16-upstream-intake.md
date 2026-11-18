# Intake through a6383da414f7

Assessed on 2026-11-16 for [draft PR #13](https://github.com/AndrewMoryakov/ik_llama.cpp/pull/13).
Fork `dev` and `main` were both `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
The open intake branch was its descendant `59a2827d0e2acf330dc7911cb3ce9fe910f4abf6`.
Its November 14 record covered upstream through `fcf7b364786ec621d0c53eae39223efc5492b8c5`.
The `upstream-sync` branch at `979debc90620` and snapshot tags cover earlier work.
The nine commits below are the full range to the observed `ik-upstream/main`.

## Decisions

| Upstream SHA | Class | Implementation and evidence |
| --- | --- | --- |
| `3b431f2c318168b3d798a9b3a9b0cabaff4496b1` (#2870) | 1, unchanged | Record the actual max KV position on every successful server context checkpoint. Skip the scan when the latest cached model position, including system tokens, cannot reach the interval. Log HTTP 500 exceptions. This leaves fork checkpoint eviction and NVMe spill decisions on their existing paths. Qwen3.5 CPU observations were 63, 104, 112, 120 and 128, with identical greedy output when interval checkpoints were disabled. Fragmented-cache retries and image position accounting still need integration coverage. |
| `86704cea75c8cfa432070d0dcdbfbaeb6e4f801f` (#2903) | 1, unchanged | Add dense Raon-1 nano conversion and GGUF metadata, hybrid RDA and NoPE MLA graphs, mHC, per-layer embeddings and single-block MTP. Reuse the Gemma 4 PLE projection with its existing scale. Quantization keeps the sensitive mHC and SSM tensors at source precision. The change uses the existing weight loader and does not allocate an expert cache for the dense model. Native CPU compilation and converter syntax passed. Raon-1 nano and Gemma 4 PLE generation with real weights remain to be checked. |
| `900e08c01cd8adcfeaebf9fd89f646c48837a14b` | 1, unchanged | Remove an unused tensor and correct the MLA expansion types introduced by Raon-1 nano. The loader and runtime translation units built on CPU. Verify hybrid MLA/MTP with the preceding port. |
| `7edf54fddb9e096dcbfd27b7b04f5c5c8d86bd62` (#2915) | 1, unchanged | Reuse resident expert ranges from the same CUDA backend during prefill. Preserve contiguous host writes on misses and the existing padding copy. The callback installs on both scheduler creation paths. It uses the current slot map with geometry, backend and extent checks. Cache budgets, replacement policy, deferred mmap loading and CPU-share policy retain their existing configuration and allocation paths. CPU cache-share and simulator tests passed. The CUDA-enabled cache code passed syntax compilation. Mixed hit/miss transfers and logits on CUDA are pending. |
| `08788a039dbaad070cf988760c31de116513d38e` (#2917) | 1, unchanged | Translate tool outputs with image URLs into chat-completions image parts. Existing text and tool call IDs survive. The focused parser test covers mixed parts, plain text, a missing URL and an unsupported type. Real image ingestion still needs a multimodal model and projector. |
| `34fd30e49ff92d255399c1e975492137ada6f4c8` (#2926) | 2, adapted | Explicitly select the all-expert warmup graph in common, llama-bench and sweep-bench. Store warmup mode in the fork's cached graph metadata so a mode transition rejects a graph from the previous mode. The two-expert CPU fixture routes 1/2/1 experts in successive equal-shape BOS batches. Small benchmark PP/TG JSON smokes with `-w 0` and `-w 1` passed. Result schemas and placement flags are preserved. |
| `4f60fdfdd9b5b1f9e3530a9b6f735ded3df8145e` (#2927) | 2, adapted | Bound both the fragment array and shared-memory store by the initialized value width `Dv`. For 192-key/128-value heads the upstream change caps the eight-column store and still stores uninitialized tails at 16 and 32 columns. The port retains the padded column stride and stores only live value rows for all widths. The CUDA translation unit compiled for `sm_75` and `sm_80`. Numerical comparison and device memory checking remain pending. |
| `adb7971bfbd78360e56aacbdea3f5c7ea2f50a67` (#2922) | 1, unchanged | Allocate ban rewind state only for effective bans and require an exact recurrent checkpoint. Negative or unsuccessful checkpoints are rejected or discarded. The DSV4 state validity check is preserved with the existing arena capacity and fork memory diagnostics. A Qwen3.5 CPU server accepted empty bans with two slots, rejected a non-empty ban with two slots and accepted it with one slot. The one-slot request exercised checkpoint saves. A matched ban and restore, a failed save or restore, and DSV4 device state still need coverage. |
| `a6383da414f74c944999e7b9312a5a5d76191f6b` (#2914) | 1, unchanged | Add dense Step-5-Preview GGUF conversion and text graph with layer-specific RoPE, SWA geometry and Q/K normalization. Existing loader placement and mmap policy apply. The seven upstream CPU conversion tests passed. Real dense weight loading, logits and SWA compaction remain to be compared. |

No commits in this interval were classified 3. No throughput or memory
improvement is inferred from the smoke runs.

## Prior review corrections included in this branch

- The CUDA simple GEMM dispatch from #2856 now checks tensor strides, row and
  pointer alignment, destination contiguity and split placement before using its
  small fast kernel. The existing fallback handles unsupported layouts.
  CUDA `ggml-cuda.cu` compiled for `sm_80`. The four F16/BF16 mathematical CPU
  reference cases passed. The matching CUDA numerical cases require a device.
- Import NVFP4 after registering the tensors from #2858's n-gram sidecar and
  reject duplicates before scale consumption. The loader still disables mmap
  when conversion materializes weights. The unified and split raw-NVFP4 GGUFs
  generated the same four tokens. The duplicate scale was rejected, and the
  existing precision and quantizer checks passed.

## Local verification

- Native Linux x86-64 GCC 14.2 CPU Release build passed with CUDA and libcurl
  disabled. The initial eight-job run exhausted available memory. A retry at
  three jobs and the final targeted rebuild passed.
- CTest passed 47 of 49. The pre-existing failures are Granite chat-template
  newline expectations and the Hugging Face eval-callback in a no-libcurl build.
  The added warmup, GEMM reference and tool-output tests passed, along with
  NVFP4, n-gram, cache, imatrix and diagnostic lifecycle tests.
- Seven Step-5 converter tests passed with CPU PyTorch. The Raon-1 nano
  converter passed syntax compilation.
- The fork CLI help audit found RTR, SWA, MoE cache, deferred expert and PLE
  loading, speculation and both trace/timing options. TinyLlama generated eight
  tokens and a complete timing record. PP/TG benchmark JSON matched the
  requested workloads with warmup on and off.
- Fixture SHA-256, `stories260K.gguf`:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
  [Qwen3.5-0.8B-Q4_K_M.gguf](https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/blob/main/Qwen3.5-0.8B-Q4_K_M.gguf):
  `bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517`.
- `git diff --check` passed. GitHub Actions was unavailable.

## Remaining gates

Keep PR #13 draft. A complete CUDA build and on-device checks are outstanding.
Compare WMMA 192/128 against a reference at query batches selecting 8, 16 and
32 columns. Check strided and misaligned CUDA GEMM, mixed-hit MoE prefill across
host fallback and CUDA cache, and the earlier Qwen4exp tiled DeltaNet,
pinned/pageable fallback, 10-expert MMQ, CUDA/RPC transfer and Blackwell paths.
The real-model gates are Raon-1 nano RDA/MLA/MTP, Gemma 4 PLE, Step-5 dense
sliding-window inference, multimodal tool output, failed and successful recurrent
ban restores, and DSV4 device-cache reset and out-of-RAM configurations.
