# Intake through ac2169477c6f

Assessed 2026-11-23 after reading current dev AGENTS.md and FORK_WORKFLOW.md.
Existing draft PR #13 is the only pending intake into dev. Prior intake head:
`735bcb645ca6d0a319421589c305c834fb2124f1`, with upstream assessed through
`1180df7edc2349470b651b64cade01341b52e0af` in the Nov22 intake record.
Current dev/main remain `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
Use a clean isolated worktree from that intake head, descendant of current dev,
with origin and ik-upstream remotes and tracking removed. Earlier upstream
incorporation is recorded by upstream-sync history, snapshot tags and previous
intake records. No main/dev update, force push, or automatic merge.

## Decisions

Five assessed SHAs: three class 1 (one empty upstream commit), two class 2.
Four upstream patches carried with -x attribution; the empty commit was skipped.

| Upstream SHA | Class | Intent, evidence, tests and fork interaction |
| --- | --- | --- |
| `96d3666144d43eddafd51cd4eaecf20f2db434f1` | 2 | inkling2: load and apply per-expert expert scales (#2973). Import Inkling per-expert scales into supported fp16 block deltas and consume .scale tensors; disable mmap only for folding. Resolve the loader conflict by retaining n-gram registration and duplicate validation before all scale-consuming imports. Fix load_data_for: it rereads raw bytes on each call, so always fold after that read; pointer bookkeeping must not suppress folding on an imatrix/quantize second pass. Keep the post-load guard for already-folded buffers. Added real-loader synthetic GGUF test for factors 2/3 and two reads of the same tensor. |
| `87cb532f15726ad9e0426f7b68c8080f8a02972a` | 1 | Do not duplicate tok_embd when not necessary (#2976). Reuse tok_embd itself for a tied output head only when contexts, names and dimensions match, with tok_embd initialized to nullptr. Gemma4 creates the embedding before resolving the output fallback. CPU no-mmap avoids duplicate allocation and file reads; separate GPU contexts still retain their own head. RTR exclusion by tensor name remains intact. Added a fixture that removes output.weight and checks actual model pointer identity in CPU no-mmap mode. |
| `3fc2b618ffda8dc2b89d1f5877870508c09231ff` | 2 | Handle GQA=3 in the CPU flash attention kernels (#2975). Use the generic CPU FA for GQA=3 and accept the Inkling mix graph reshape. The new IQK GQA=3 helper leaves head-2 query rows unwritten in the four-worker reference test, so retain the previous IQK helper code and bypass IQK for ratio 3. Exclude the newly bundled small softmax/GEMM fusion on CPU and CUDA: its helpers read the SOFT_MAX output buffer before SOFT_MAX executes, lack output/consumer safety, and the CPU branch can enter with width 1 despite requiring >=2. Retain ordinary softmax then matmul and existing fork fusion guards. Added GQA=3 scalar reference plus widths 1/3/7 softmax/matmul tests with an explicit probabilities output and sentinel contents. |
| `a28f79a5ac4b8db54eddf3907dc4e607ccca460c` | 1 | Inkling2: optimize the mix (#2974). Empty upstream commit: the mix implementation is already included in 3fc2b618f. No duplicate patch or new behavior; the same class-2 fusion exclusion applies to that implementation. |
| `ac2169477c6f2ea2af1cf993f527af249bd94df2` | 1 | ggml: fix multi-threaded CPU clamp skipping rows (#2980). Remove thread-0-only early return from CPU clamp so each worker processes its assigned rows. Added 17-row numerical regression with 1/2/4/8 threads and sentinel output; no change to clamp boundaries or memory ownership. |

## Fork invariants

Keep model/sidecar duplicate checks before consuming scales, mmap ownership,
pinned caps, deferred expert policy, MoE-cache callback scheduler fallback,
expert padding/GEMM/WMMA guards, existing output/fanout fusion protection,
legacy ARM formats, ATTN=2/GRAPH=3 and benchmark test_v3. Expert folding changes
host materialization only for matching Inkling tensors; CPU tied heads avoid
one physical weight copy. No large-model memory/throughput claim is inferred.
The loader conflict was resolved by preserving the already-reviewed sidecar
ordering; the rejected optimization uses the ordinary validated operator path.

## Verification

- Clean Linux x86-64 GCC 14.2 shared-library CPU Release build and final
  rebuilds succeeded (native CPU, CUDA/CURL off). Temporary CMake/Ninja and
  Python 3.13 NumPy/Jinja dependencies were provisioned in the environment.
- Final CTest: 60/62 passed. Only the known Granite trailing-newline
  expectation and eval-callback download without libcurl fail; no new failures.
- The CPU regression detects GQA=3 and 2/4/8-worker clamp failures on the
  previous Nov22 build. Clamp's parallel consumer is essential: a graph with
  only clamp is planned with one worker. Final clamp passes 1/2/4/8 workers
  across 17 rows. Softmax/matmul widths 1/3/7 match independent scalar values
  and retain an explicit probabilities output initialized with a sentinel.
- The newly ported IQK GQA=3 path failed its four-worker scalar reference:
  head 2, queries 2/3/4 retained the -99 output sentinel. The generic CPU path
  passes the same F32-query/F16-KV test (D=128, five queries, three heads,
  32 keys). Removed the new IQK helper changes and route ratio 3 to the
  existing generic CPU implementation. No speed claim is made for that path.
- A synthetic Inkling GGUF with two Q2_0 experts and scales 2 and 3 passes
  actual loader import, scale consumption, mmap disabling and two raw reads
  of the same tensor with unchanged folded deltas. Full-model imatrix/COPY
  and split-expert/GPU staging scenarios remain pending.
- The tied-head fixture removes output.weight from the small Llama fixture
  and loads CPU no-mmap. It passes actual output==tok_embd identity; the
  previous build loads it but fails that identity. These internal-loader
  C++ tests are Linux/non-Windows tests; no DLL export validation is claimed.
- Final eight-token generation prints HAVE_FANCY_SIMD; timing contains header,
  eight interval records and end. Benchmark JSON has pp4/tg4. Help retains
  RTR/auto, MoE-cache share/policy, deferred loading, SWA and offload controls.
  The pending-prompt HTTP regression passes three rejection/reuse cycles.
- No GPU or AMD devices are present. Final CUDA source is identical to Nov22
  because the unsafe new fusion was excluded; no new CUDA execution or build
  result is claimed. Prior platform/model gates stay open.
- Fixture SHA-256: 270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d.
- git diff --check passes. Publish through connector with expected head
  735bcb645ca6d0a319421589c305c834fb2124f1, no force, after matching the
  published tree to the tested source. Large upstream ggml.c was fetched
  by SHA eafaf2fa4eb7befbc11ad60fb22cffc4b2426e96 and verified after creation.
  Fork blob 609bca5b9c204429d76ba63a510c04ae9a171a32 was created and verified,
  retaining prior allocation/ARM guards and adding the generic GQA fallback.

## Remaining gates

Keep #13 draft. Full Inkling scaled-quant GGUF inference, COPY/repack and
estimated-imatrix multi-pass paths, split expert scales, whole-tensor GPU staging peak RAM and hot reload, real
Gemma4/Qwen tied-head RAM/RSS and GPU-context placement remain model gates.
The optimized IQK GQA=3 path is disabled pending full numerical/tail coverage.
Small softmax/GEMM fusion is deliberately absent until a separate guarded,
raw-logits implementation has CPU/GPU parity, output/consumer, layout and mask
coverage. GPU/ARM execution is unavailable. Prior model/platform, looped-state,
MoE-cache multi-GPU, FP8/ModelOpt and out-of-RAM gates remain open.
GitHub Actions was unavailable and was not used.
