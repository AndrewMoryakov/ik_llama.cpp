# Intake through 9513b3d44f48

Assessed on 2026-11-12. This continues draft PR #13 and the intake records from
2026-11-07 through 2026-11-11; it does not create a competing intake branch.

## Baseline and scope

- Fork `dev`/`main`: `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
- Existing intake head before this run: `139daa3b2b1fc398f38dc0f4b3a16d19b80b16c3`.
- Previously assessed upstream: `883789c25ba93e625bb5266f41f9b73150cf6fa6`.
- Newly assessed upstream head: `9513b3d44f480fd83fe26fa55eaad77f582019ba`.
- Seven commits were assessed and applied individually to the existing intake
  branch. `dev` and `main` were not moved.

The range adds two model families and several runtime features, but does not
replace the fork's RTR, deferred-expert mmap, MoE-cache, benchmark or memory
reporting policies. Step-5's extra indexer caches flow through the existing KV
cache allocator and `cache_size()` accounting. The MoE scheduler rule only
selects CPU when no backend was already assigned, so explicit placement remains
authoritative.

## Decisions

| Upstream SHA | Class | Decision and fork interaction |
|---|---|---|
| `8a68bd559da92bb15468659151d800b7fec778b6` (#2902) | 1: unchanged | Stop disabling the IQK flash-attention path for ordinary DeepSeek-V4 graphs, while disabling flash attention for models with ALiBi bias. This corrects backend selection and does not alter tensor residency, mmap or MoE-cache behavior. The affected graph code compiles; a DeepSeek-V4 model is unavailable locally. |
| `1c0b98a5809c7f4758754b0281b1fdd948be1a41` (#2901) | 1: unchanged | Keep a large `MUL_MULTI_ADD` MoE combine on CPU when its expert input is on CPU and the CPU backend supports the op. The rule runs only for an unassigned backend, preserving explicit `-ot` placement and fork cache/offload choices. CPU compilation passes; a mixed CPU/GPU MoE fixture is unavailable. |
| `3137cfc546481a6ca8b450827418de5026068ea0` (#2896) | 1: unchanged | Add unified Gemma 4 vision/audio projector loading and preprocessing. This is isolated to mtmd/projector paths and does not change language-model allocation or expert residency. The mtmd library and CLI compile; real projector fixtures are unavailable. |
| `62ce0949b9aff6e05dbc87dcf5b72ea507eab470` (#2869) | 1: unchanged | Correct the server stream lifecycle when its first result is already final by sending the terminal marker and closing the sink. It does not touch inference graphs or memory policy. The server builds; an HTTP streaming integration fixture is not present locally. |
| `2bfb53fb6c17a668ec7bf0fff6a27833b172a4ba` (#2894) | 1: unchanged | Expand analytical importance propagation across MoE up/gate/down tensors, coupled K/Q/V attention weights and SSM output. This is an offline quantization change, not a runtime allocator change. Analytical-imatrix generation and IQ2_KT estimated-imatrix quantization pass on the small model fixture. |
| `2a0832d7cb57fd63ef5966760ccfd6db3994a1d9` (#2900) | 2: adapted | Add Hy3/hy_v3 conversion, tensor loading, graph support and chat template. Model code uses the existing standard/MoE builders, so fork memory, mmap and expert policies remain in force. The upstream template used Python `str.format()`, which the embedded C++ Jinja runtime rejects; token construction was changed to equivalent supported concatenation and a focused render test was added. |
| `9513b3d44f480fd83fe26fa55eaad77f582019ba` (#2737) | 1: unchanged | Add Step-5 Preview/Step-3.5 support: sparse-GQA indexer and CSA cache, MTP/SWA-compress rewind handling, vision projector, converter and new ggml CPU/CUDA ops. The new proxy/z indexer caches are allocated through the fork's existing KV buffer contexts and included by `llama_model::cache_size()`; fork indexer type selection remains active. Existing memory breakdown counts the owning backend buffers, and the model's MoE tensors continue through standard expert placement/cache paths. CPU graph and indexer tests pass. A real 600B-A27B model, CUDA build and MTP/SWA long-context run are unavailable. |

No change in this range was intentionally excluded.

## Verification without Actions

Environment: Linux x86-64, GCC 14.2.0, CMake 4.4.4, Ninja 1.13.2, native CPU,
CUDA and CURL disabled. Jinja2 and all build/model artefacts were kept outside
tracked source.

- Clean CPU Release shared-library build passed: **337/337 targets**.
- Complete CTest with the local model fixture: **44/46 passed**. The two failures
  are the existing Granite trailing-newline mismatch and the Hugging Face
  callback in a CURL-disabled build.
- With `LLAMACPP_TEST_MODELFILE` set, NVFP4 import, analytical imatrix, quantize
  invariants and n-gram sidecar tests all passed.
- Focused Hy3 template rendering passed in the embedded C++ Jinja engine after
  reproducing the upstream `str.format()` failure.
- Indexer top-k, NVFP4, fused up/gate sizing, HC_PRE transpose, RTR parameters
  and MoE-cache share tests passed.
- Converter and GGUF Python sources compile successfully.
- Standard F32 CPU smoke generated eight tokens.
- CLI help retains SWA compression, indexer-cache type, MoE-cache,
  deferred-expert and speculative-stage controls.
- Smoke model SHA-256:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- `git diff --check` passed.

## Remaining risk and gate status

Keep PR #13 draft. The main confidence gap is Step-5: no real Step-5/Step-3.5
model is available to validate sparse indexer cache contents, CSA selection,
MTP rewind or long-context SWA compaction, and its CUDA kernels were neither
compiled nor executed. Real Hy3, Gemma 4 projector, DeepSeek-V4 flash-attention,
mixed CPU/GPU `-ot exps=CPU` and one-result server-stream checks also remain.

The Hy3 template failure was observed before the adaptation and is now covered
by a regression test. No force-push, upstream merge, `dev` update or `main`
update is part of this intake.
