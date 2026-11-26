# Intake through 308fb08df6fb

Assessed on 2026-11-09. This continues draft PR #13 and the records from
2026-11-07 and 2026-11-08; it does not start a second intake branch.

## Baseline and scope

- Fork `dev`/`main`: `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
- Existing intake head before this run: `1cbfd57173ee9a1fc26372b22241625a3e2e8a8a`.
- Previously assessed upstream: `30903876bcef4cab5dc802db16fb34c1fd1d966b`.
- Newly assessed upstream head: `308fb08df6fb3fa65943d6b0feed7c87d6cc2d07`.
- Ten commits were assessed. All were ported onto the existing intake branch;
  `dev` and `main` were not moved.

The commits were applied individually rather than by merging or fast-forwarding
upstream. The fork's RTR memory probe, mmap/deferred-expert paths, MoE tracing,
benchmark SQL path and token-timing code remain in place.

## Decisions

| Upstream SHA | Class | Decision and fork interaction |
|---|---|---|
| `d248847514850c8e0d60c4c22e1b149d424311ff` (#2861) | 1: unchanged | Add explicit `lru`/`classlru` replacement policy for the GPU MoE expert cache. LRU remains the API and CLI default, so existing fork behaviour does not change unless the option is selected. ClassLRU adds CPU frequency/age metadata but does not change expert weight placement, mmap/RTR decisions or device-cache allocation. The existing cache memory breakdown still accounts for device and slot-map buffers. Added fork-side CLI-to-runtime propagation checks. |
| `abe0ce240ed89412f94dd2db6bbebbacfa9b4a03` (#2866) | 1: unchanged | Read Xing4's expert gating metadata and retain softmax only as the missing-metadata fallback. This affects Xing4 routing semantics, not fork memory or instrumentation. A real Xing4 model is unavailable locally. |
| `8a9bf106ed25e4e6d63b51e48a459d0cbbb1e613` (#2867) | 1: unchanged | Remove the obsolete rejection of LoRA adapters when Flash Attention is enabled. No allocator or graph changes are introduced by the commit. A real LoRA adapter plus base model is unavailable locally. |
| `39fc3128ccc428314a64b98de09af24bd7bb4990` (#2753) | 1: unchanged | Refresh README model support, quantization, feature, performance and paper sections. The fork's workflow note, measured Step0 material and CPU-only MoE section survive the three-way application. |
| `ff9d603d36c6291a086a7c105b5bcf802fbe76c1` (#2862) | 1: unchanged | Add analytical importance-matrix generation and optional on-the-fly use during quantization; also move IQ2_KT/IQ3_KT CUDA template instantiations without changing their intended kernels. This is an offline quantization path: it scans weight mappings and unmaps fragments, but does not affect runtime model mmap, RTR or cache policy. The tiny F32 model produced 37 finite entries and completed IQ2_KT quantization and inference. A diagnostic Q4_0 attempt failed validation with a NaN in `ffn_down`; estimated imatrix is therefore validated here only for its intended imatrix-dependent IQ2_KT use, not as a universal option or as quality evidence. |
| `469ee7a6bb18ff4c7ede47342f33e83dcaf0e0f7` (#2859) | 1: unchanged | Restrict the multi-head indexed CPU Flash-Attention gather to layouts where heads share a cache row. Expanded MLA/DSA layouts fall back to dense FA with the sparse mask instead of reading wrong rows. No memory-placement policy changes; real GLM-5.2 DSA perplexity remains untested. |
| `b71fe5368fd17630089bc082e3571a4f23027e95` (#2868) | 1: unchanged | Add Blackwell native NVFP4 W4A4/MMQ-ID, input-scale import and `--nvfp4-precision`. Native NVFP4_KS can retain mmap; raw type-40 conversion still forces owned buffers and disables mmap, preserving the previously recorded out-of-RAM limitation. Scale metadata is propagated through merged QKV/up-gate tensors and MoE-cache views. Added fork parser/default and view/dup metadata tests. CUDA execution is unavailable here. |
| `03227eb51eb54527366d27d126c1ae04054121bd` (#2871) | 1: unchanged | Size fused up/gate conversion work buffers from activation rows rather than weight rows, including merged MoE up/gate. Added a graph-plan regression covering dense and merged-MoE Q8_0 weights with 64 activation rows. This prevents an overwrite; it does not change computed values. |
| `83950a3dd2d67a4799f3f763ec09ddde2e9be943` (#2874) | 1: unchanged | Select NEOX/rotate-half RoPE for Orion. Local code has no competing Orion adaptation; a real Orion model is unavailable. |
| `308fb08df6fb3fa65943d6b0feed7c87d6cc2d07` | 1: unchanged | Update contributor attribution only. |

No change in this range was intentionally excluded. “Applicable unchanged”
describes the imported production code; fork-native tests were added so that
the new options and invariants are checked in this repository.

## Verification without Actions

Environment: Linux x86-64, GCC 14.2.0, CMake 4.4.4, Ninja 1.13.2, native CPU,
CUDA and CURL disabled. Temporary tools and model files were outside the repo.

- Clean CPU Release build passed: 336 targets, including CLI, server,
  quantizer, graph builders and tests.
- Complete CTest: **42/44 passed** in 22.08 s, no skips. The two failures are
  the existing Granite expected trailing-newline mismatch and the URL download
  callback in a CURL-disabled build.
- New focused checks passed: ClassLRU/LRU defaults and CLI propagation; NVFP4
  precision defaults and propagation; NVFP4 input-scale preservation through
  duplicate/view; dense and merged-MoE fused up/gate work-buffer sizing;
  analytical imatrix generation plus IQ2_KT quantization; upstream ClassLRU
  state/token geometry tests.
- Prior intake regressions remained green: 128 HC_PRE cases, 24 indexer top-k
  cases, NVFP4 CPU GEMM/GEMV, raw NVFP4 import, n-gram sidecar integration,
  synthetic GPT-2 LayerNorm, cache simulation, RTR/cgroup/parser, tracing and
  token-timing lifecycle.
- Standard F32 smoke with `-rtra` generated eight tokens and ended with
  `complete:true`, `generated_tokens:8`, `intervals:7`, `n_eval:7`.
- The IQ2_KT model produced by `--estimate-imatrix` loaded and generated four
  tokens on CPU. This validates file/runtime compatibility, not model quality.
- CLI help contains `--moe-cache-policy`, `--nvfp4-precision`, n-gram/RTR,
  deferred-expert, trace and token-timing options. The help command's existing
  exit status is 1 despite printing valid output.
- Smoke model SHA-256:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- `git diff --check` passed.

## Remaining risk and gate status

Keep PR #13 draft. CUDA compilation/execution is still missing, especially
Blackwell W4A4/MMQ-ID and the moved IQ2_KT/IQ3_KT instances. Real-model checks
remain for Xing4 gating, Orion RoPE, LoRA with FA, GLM-5.2 DSA indexed FA,
ClassLRU hit/eviction behaviour and NVFP4 input-scale accuracy. No target-machine
out-of-RAM or performance claim follows from the small in-RAM fixtures.

The estimated-imatrix heuristic has only a functional IQ2_KT check here; it
needs perplexity/quality comparison before use in production quantization. The
Q4_0 NaN diagnostic should be isolated separately rather than interpreted as a
passed configuration. Raw NVFP4 import continues to disable mmap, so its memory
budget remains unsuitable for the fork's largest swap-bound workloads without
additional evidence.
