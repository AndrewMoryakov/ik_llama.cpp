# Intake through 464613d7c12f

Assessed on 2026-11-17 for [draft PR #13](https://github.com/AndrewMoryakov/ik_llama.cpp/pull/13).
The current intake head was `3879c5212164b0f9d0a8c4c2f8d4fd115319067c`.
It descends from the current `dev` and `main`,
`9aea4daefc7f0043255d78f8cb47ea58179090f8`.
The November 16 intake record covered upstream through
`a6383da414f74c944999e7b9312a5a5d76191f6b`.
The older `upstream-sync` head is `979debc90620335b8b24cfa52bcfbae6d5ca4a76`.
The upstream snapshot tags cover earlier integration work. Live open PR and
branch checks found the existing PR #13 as the pending intake into dev.

## Decisions

| Upstream SHA | Class | Implementation and interaction with the fork |
| --- | --- | --- |
| `77fa184dfac79d927402834c5849da2fed89d8cc` (#2932) | 1, unchanged | Correct spelling in comments, documentation and messages across 44 files. The two edits in the large ggml.c file affect an error string and a comment. Existing fork documentation about RTR headroom remains present. Kernel arithmetic, identifiers, placement, mmap and benchmark schemas retain their existing implementation. Native compilation and the test suite cover the resulting tree. |
| `aa294ca322488008144c0219e04e99c007418bcf` (#2930) | 1, unchanged | Preserve the windowed SWA mask when non-causal image decoding uses an architecture with swa_full_non_causal. This is the DSV4 vision path that already fills non-causal spans inside a windowed view. Other non-causal architectures still select the full mask. The port keeps the fork's compressed-cache layout, sink rows and mask stride rules. Compilation passes. A real DSV4 image with --swa-compress remains a required model gate. |
| `a408c053ccd1c1efe610d8eaaebce5a0d7314bf6` (#2929) | 3, intentionally not applicable | Upstream removes attention-only tensor splitting and renumbers GRAPH from 3 to 2. This fork still exposes ATTN=2 and GRAPH=3 in include/llama.h, accepts --split-mode attn in the CLI and benchmark, implements its distinct attention/FFN placement, and documents it in the RTR headroom exclusions. Removing it changes supported callers and device memory placement. Retain the existing implementation and numeric API values. Any retirement requires a separate compatibility and multi-GPU validation change. The later mask optimization has no dependency on this removal. |
| `24663eef11c55d3a0928223a9c69645d744102ba` (#2924) | 1, unchanged | Precompute QSA base bias and per-sequence KV visibility for causal FP16 prompt masks with at least 1024 KV cells and 32 input tokens. Retain the F32, ALiBi, SWA and small-batch fallback paths and padded-row initialization. The added mask fixture compares actual decode inputs with KV sequence membership and position across two interleaved sequences for both FP16 and FP32. Temporary visibility memory is sizeof(llama_pos) * distinct_sequences * n_kv, plus token and sequence indices. QSA adds two bytes per KV cell. Neither allocation changes model mmap ownership, MoE-cache budget or benchmark output. Large-context memory and real Qwen4exp QSA fill remain model gates. |
| `464613d7c12f8f0ba6cf910b38659ece3eb321e9` (#2934) | 1, unchanged | Implement stable first-occurrence array unique in the embedded Jinja runtime, with default case folding, case_sensitive and attribute arguments. This enables the tool-ID checks used by GLM-5.3-Flash templates. Ten upstream regression cases cover ordering, case sensitivity, attribute selection, mixed types, empty arrays and duplicate tool IDs. The change is confined to template rendering, with no loader or runtime placement changes. |

## Verification

- Clean native Linux x86-64 GCC 14.2 CPU Release build passed all 344 initial
  build steps. A follow-up build registered and compiled the new mask test.
  CUDA and libcurl were disabled. CMake and Ninja were provisioned temporarily.
- CTest passed 48 of 50 tests. The two baseline failures are the Granite
  trailing-newline expectation in test-chat-template and test-eval-callback
  attempting a Hugging Face download in the no-libcurl build. Both were
  documented before this intake. No additional test failed.
- The new test-kq-mask-fill passed. It snapshots inputs through the scheduler
  callback before graph execution can reuse their memory. It checks two
  interleaved sequences with 1040, 31 and 33 tokens for both FP16 and FP32,
  including invalid/future cells and padded rows. The fixture reaches the
  n_kv >= 1024 and n_tokens >= 32 parallel path.
- The embedded Jinja test, including the ten new unique cases, and Python
  Jinja comparison passed. Existing QSA cut-mask/indexer, NVFP4 sidecar,
  MoE-cache, warmup, RTR, imatrix and trace/timing lifecycle tests passed.
- TinyLlama generated eight tokens with a complete timing record and printed
  HAVE_FANCY_SIMD is defined. A llama-bench JSON smoke produced the requested
  pp4 and tg4 rows. CLI help retained RTR, SWA, MoE cache, deferred expert/PLE,
  speculation and diagnostic options.
- Fixture SHA-256 for stories260K.gguf was
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- git diff --check passed. GitHub Actions was unavailable. No new CUDA kernels
  were introduced in this interval. The large ggml.c file was fetched by
  blob SHA `dd143e29014d9c80d9e8c0b206edbea6abafa58f`; the created blob SHA
  matched before the tree was published.

## Remaining gates

Keep PR #13 draft. A real DSV4 vision GGUF and projector are needed to exercise
non-causal windowed SWA end to end, including compacted cache and long image
spans. Qwen4exp QSA fill needs actual model comparison at large context and
memory measurements. Full GLM-5.3-Flash tool-call rendering needs its model
template and an inference smoke. Previous CUDA/RPC, DeltaNet, WMMA, GEMM,
Blackwell, MoE prefill reuse, recurrent ban restore and out-of-RAM model gates
from the November 16 record remain outstanding.
