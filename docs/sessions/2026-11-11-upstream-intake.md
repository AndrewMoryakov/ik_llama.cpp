# Intake through 883789c25ba9

Assessed on 2026-11-11. This continues draft PR #13 and the intake records from
2026-11-07 through 2026-11-10; it does not create a competing intake branch.

## Baseline and scope

- Fork `dev`/`main`: `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
- Existing intake head before this run: `243de702b270b2e8a010ebd15ad2463d5e9ec6a6`.
- Previously assessed upstream: `4e24d0b2122fd34e5817978b00ddefde314df5d9`.
- Newly assessed upstream head: `883789c25ba93e625bb5266f41f9b73150cf6fa6`.
- Eight commits were assessed and applied individually to the existing intake
  branch. `dev` and `main` were not moved.

The changes do not alter the fork's RTR policy, mmap/deferred-expert placement,
MoE-cache accounting, benchmark SQL or runtime instrumentation. One upstream
quantizer fix needed a small extension for an explicit CLI override path.

## Decisions

| Upstream SHA | Class | Decision and fork interaction |
|---|---|---|
| `ceee8f888400cefff45ef819da2189275a3ee837` (#2892) | 1: unchanged | Optimize one-column CUDA BF16 and NVFP4_KS mat-vec, with a bounded warp reduction and a fused NVFP4 scale path. This is isolated to CUDA dispatch/kernels; it does not change model placement or mmap. CUDA compilation and execution remain unavailable locally. |
| `16d4e8ddff6dc848f86e9989abf4287e0bdb9b35` (#2890) | 1: unchanged | Use `block_iq4_ks_r16` in the AVX-512 IQ4_KS_R16 dequantizer instead of interpreting the packed bytes as the non-interleaved block. This is a correctness fix. The native AVX-512 build, IQ4 decode tests and CPU smoke pass. |
| `2817767859d4b0b76e1a289a5ac40f65ac943947` (#2886) | 1: unchanged | Treat PQ2_0_R8 and PTQ1_0_R8 as 16-row AVX-512 slices. This changes kernel tiling, not tensor residency or cache policy. The relevant code compiles natively; dedicated Prism models are unavailable. |
| `4c1987cad2303ecbaa53b8a3a3dac6f7672bff0c` (#2885) | 1: unchanged | Avoid the fused up/gate node for SWIGLU_OAI/SITU when its weight types would make the backend fall back internally; build the two matmuls and activation explicitly instead. This can change graph node/workspace shape for those model/type combinations, but the scheduler accounts that graph normally and no fork allocator shortcut is bypassed. Existing fused-work sizing tests pass; a real affected model remains unavailable. |
| `479074ccac2ac94f06b6d24a9ce26f0f9e9aa6ae` (#2889) | 1: unchanged | Use actual token count, rather than an unrelated output dimension, when deciding whether CUDA should offload SSM_CONV and Q/K RMS norms. It changes GPU dispatch only and leaves memory placement policy intact. CUDA execution is unavailable. |
| `ffca8935d02fceb1627bb17ae17f1f15819f5771` (#2891) | 1: unchanged | Preserve consumed `.input_scale` tensors when an NVFP4_KS model is copied/requantized. The loader keeps these scale weights outside the ordinary model-weight list, so normal inference allocation and mmap behavior are unchanged. A generated 32-weight fixture verifies all scale names and values survive COPY, the resulting weights remain NVFP4_KS, and the copied model loads and generates on CPU. |
| `41d123e95e3a68df1786408a27e5cb464e28b25a` (#2887) | 1: unchanged | Correct legacy-quant vec-dot partner types, remove unreachable IQK fallbacks, quantize indexed-query rows with their real strides, and relax the Q8_KV width guard. These are CPU correctness fixes. Indexer top-k (24 cases), IQ4 decode (113 checks) and the full CPU suite pass. |
| `883789c25ba93e625bb5266f41f9b73150cf6fa6` (#2897) | 2: adapted | Prevent row-interleaved IQ4_KS_R16 for token embeddings. Upstream fixed the automatic fallback path, but an explicit `--token-embedding-type IQ4_XS` overwrote that decision and reproduced an assert on the 64×512 fixture. The common final type-selection step now applies the same shape/repack-forbidden fallback to explicit choices. The fixture falls back to IQ4_NL, produces a readable GGUF and generates on CPU. |

No change in this range was intentionally excluded.

## Verification without Actions

Environment: Linux x86-64, GCC 14.2.0, CMake 4.4.4, Ninja 1.13.2, native CPU,
CUDA and CURL disabled. Jinja2 3.1.6 and all build/model artefacts were kept
outside tracked source.

- Clean CPU Release shared-library build passed: **336/336 targets**.
- Complete CTest: **43/45 passed**. The two failures are the existing Granite
  trailing-newline mismatch and the Hugging Face callback in a CURL-disabled
  build.
- Focused checks passed: 32 NVFP4_KS input scales survive COPY byte-for-byte and
  the output loads; explicit token-embedding IQ4_XS safely becomes IQ4_NL and
  loads; IQ4_KS/KT decode (113 checks); indexer top-k (24 CPU cases); fused
  up/gate work-buffer sizing; prior RTR, cache, n-gram and instrumentation tests.
- Standard F32 CPU smoke generated eight tokens.
- CLI help retains RTR/mmap, MoE-cache, NVFP4, trace and token-timing options.
- Smoke model SHA-256:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- `git diff --check` passed.

## Remaining risk and gate status

Keep PR #13 draft. CUDA compilation/execution remains missing for the BF16 and
NVFP4_KS mat-vec changes and SSM/norm offload heuristic. Real-model checks remain
for SWIGLU_OAI/SITU fallback graphs, PQ2_0/PTQ1_0 16-row kernels and large
NVFP4_KS models. The small fixtures establish file/layout and functional CPU
compatibility, not target-machine out-of-RAM memory or performance behavior.

The explicit token-embedding override defect was observed before the adaptation
and is covered by a regression test. No force-push, upstream merge, `dev` update
or `main` update is part of this intake.
