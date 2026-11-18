# Intake through 4e24d0b2122f

Assessed on 2026-11-10. This continues draft PR #13 and the intake records from
2026-11-07 through 2026-11-09; it does not start a second intake branch.

## Baseline and scope

- Fork `dev`/`main`: `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
- Existing intake head before this run: `f5b2587a1daac4b59ae2bcb9ebad10a18da1b866`.
- Previously assessed upstream: `308fb08df6fb3fa65943d6b0feed7c87d6cc2d07`.
- Newly assessed upstream head: `4e24d0b2122fd34e5817978b00ddefde314df5d9`.
- Ten commits were assessed and ported individually onto the existing intake
  branch; `dev` and `main` were not moved.

There were no textual conflicts, but the MXFP4 loader change required a semantic
adaptation to the fork's RTR memory probe. The fork's mmap/deferred-expert paths,
memory reporting, MoE tracing, benchmark SQL and token-timing code remain in
place.

## Decisions

| Upstream SHA | Class | Decision and fork interaction |
|---|---|---|
| `9da557ca4a02f7f7c404daff9d1e1c29d764cd5f` (#2881) | 1: unchanged | Correctness bundle: avoid in-place DeltaNet SILU when layers span CPU/device backends, bound the CUDA MMVQ final row, reject unsupported Metal NVFP4_KS operations, and correct/enable Arm Clang, IQ1_BN, Q8_0 and Q5_1 paths. The DeltaNet fix is relevant to fork CPU offload but changes neither tensor placement nor allocator policy. CPU x86 compilation covers shared code; CUDA, Metal and Arm execution remain hardware gates. |
| `766611c4fb7128fc0cb24e13a6216f6c2f8d6f63` (#2876) | 1: unchanged | Apply the missing fp32 scale multiplication in CUDA K-quant MMQ on sm_61 and AMD. It is isolated to the CUDA kernel and does not alter mmap, MoE cache or runtime option semantics. CUDA execution is unavailable locally. |
| `97a5bce89de807c5317e1425911b166fea092740` (#2878) | 1: unchanged | Make the separate DeepSeek-V4.1 graph builder the default and set replay-keep to 256 when SWA compression is active. The old builder remains selectable with `V41_SEPARATE=0`; replay is disabled when SWA compression is absent. Defaults and common-to-context propagation are tested, but a real V4.1 model is unavailable for output/quality and memory comparison. |
| `c7ea52b33ad7ecfb6fe034f890b496573634136a` (#2880) | 2: adapted | Repack MXFP4 weights with input-scale metadata to NVFP4_KS for native Blackwell W4A4. AUTO/W4A4 therefore creates owned buffers and disables mmap; explicit INT8 retains MXFP4 and mmap eligibility. The fork's metadata-only RTR probe previously hard-coded AUTO, so an INT8 request could be assessed with the wrong memory/mmap behaviour. The probe now receives the selected precision. A generated GGUF verifies AUTO repack and INT8 preservation; Blackwell execution remains untested. |
| `c2785c01b84588425175348e8a8d46899091f0d9` (#2884) | 1: unchanged | Route supported P100 GQA decode Flash Attention through the tile kernel and keep the fallback for unsupported head sizes. This is a backend dispatch correction with no fork memory-policy changes. P100 hardware is unavailable. |
| `c260cbde5766408a4a52f882407100d0d6843ca4` (#2883) | 1: unchanged | Add `--moe-cache-cpu-share` so a fixed fraction of unique misses can remain on CPU while GPU cache hits/fills continue normally. The default is zero and is regression-tested against the prior LRU/ClassLRU plan. New zero/guard rows are included in actual allocated buffers and therefore in existing cache memory breakdown. Parser/API validation, geometry, maps and zero-share parity pass locally; real GPU cache performance remains unmeasured. |
| `6bad43e078c2cb3893a11bf1f24bda939d9beed7` (#2882) | 1: unchanged | Add byte/progress reporting to the offline ternary-to-Prism repack script. Model bytes and runtime behaviour are unchanged. |
| `72104e91f89b6c6f7243bc9c90d1a53d08b40792` (#2875) | 1: unchanged | Widen dense CPU Flash-Attention mask row offsets to `size_t`, preventing overflow on large strides. It is a correctness-only address calculation and is compatible with fork memory placement. |
| `46473e2edf90919ff235145308d850e9d0ed2acb` (#2888) | 1: unchanged | Apply `size_t` to the indexed FA mask offset as well and correct the Q1_0_G128_R8 packing/alignment classification used by IQK multiplication. Local CPU tests and smoke cover compilation/runtime generally; a dedicated large-stride or Q1 model is unavailable. |
| `4e24d0b2122fd34e5817978b00ddefde314df5d9` (#2877) | 1: unchanged | Allow the existing multi-head CPU FA specialization for small workloads instead of requiring at least 32 work units per thread. This broadens a functionally equivalent optimized path and does not change model/cache allocation. CPU smoke passes; no performance claim is made from the tiny model. |

No change in this range was intentionally excluded.

## Verification without Actions

Environment: Linux x86-64, GCC 14.2.0, CMake 4.4.4, Ninja 1.13.2, native CPU,
CUDA and CURL disabled. Jinja2 3.1.6 was provisioned outside the repository for
the Python parity test. The smoke model and all temporary files were outside the
repository.

- Clean CPU Release shared-library build passed: **336/336 targets**.
- Complete CTest after provisioning Jinja2: **42/44 passed**. The two failures
  are the already-recorded Granite trailing-newline mismatch and the Hugging
  Face callback test in a CURL-disabled build.
- Focused tests passed: MoE CPU-share geometry/maps/validation and zero-share
  LRU/ClassLRU parity; CLI/API default and propagation checks; generated raw
  NVFP4 import; generated MXFP4 AUTO repack to NVFP4_KS; the same fixture with
  explicit INT8 retaining MXFP4; all prior RTR, cache, n-gram and instrumentation
  regressions in CTest.
- Standard F32 CPU smoke generated eight tokens successfully.
- CLI help exposes `--moe-cache-cpu-share`, `--nvfp4-precision` and the new
  DeepSeek-V4.1 replay default of 256.
- Smoke model SHA-256:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- `git diff --check` passed.

## Remaining risk and gate status

Keep PR #13 draft. CUDA compilation/execution is still missing for Blackwell
MXFP4 W4A4, sm_61/AMD K-quant MMQ, P100 tile FA and the CUDA parts of #2881;
Metal and Arm paths also remain unexecuted. Real-model checks remain for
DeepSeek-V4.1 separate-builder output/quality and replay memory, DeltaNet mixed
CPU/device layers, Q1_0_G128_R8 multiplication, very-large FA mask strides and
GPU MoE-cache CPU-share correctness/performance.

AUTO/W4A4 MXFP4 repack deliberately disables mmap and is therefore unsuitable
for the fork's largest swap-bound models unless the memory budget is proven.
Explicit INT8 preserves the original MXFP4/mmap route, and RTR now evaluates
that choice consistently. No target-machine out-of-RAM or performance claim
follows from the small in-RAM fixtures.
