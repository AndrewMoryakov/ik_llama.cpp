# Intake through 7aa7e01482db

Assessed on 2026-11-13. This continues draft PR #13 and the intake records from
2026-11-07 through 2026-11-12; it does not create a competing intake branch.

## Baseline and scope

- Fork `dev`/`main`: `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
- Existing published intake head before this run:
  `93a2ac7b6ce9b44da66e9e1807bee3bc23f328c2`.
- Previously assessed upstream: `9513b3d44f480fd83fe26fa55eaad77f582019ba`.
- Newly assessed upstream head: `7aa7e01482db892b023bb9aace9a40567ab5297a`.
- Three commits were assessed and applied individually to the existing intake
  branch. `dev` and `main` were not moved.

The important net change is removal, not addition: upstream reverted the
Step-5 Preview implementation one day after landing it because it severely
degraded hybrid prefill. Hybrid CPU/GPU and large MoE inference are primary
fork scenarios, and the local environment still has no Step-5 model with which
to establish a safe fork-specific alternative. The upstream revert is therefore
carried unchanged. The 2026-11-12 record remains an accurate account of the
earlier assessment, but its Step-5 integration and remaining-gate statements are
superseded by this record.

## Decisions

| Upstream SHA | Class | Decision and fork interaction |
|---|---|---|
| `59ca629891b79df87bf996932638a70020c02646` (#2904) | 1: unchanged | Use backend `get_tensor_async`/`set_tensor_async` for graph-split inputs when a direct async tensor copy is unavailable, synchronizing source backends once after the batch of reads. This changes transfer scheduling, not tensor placement, mmap ownership, MoE-cache accounting or benchmark output. It is relevant to the fork's graph-split and hybrid paths, but requires a GPU/RPC backend to exercise; CPU compilation and regression tests pass. |
| `4b5fdd06aba779a6cee940a11dff43e43c705743` (#2907) | 1: unchanged | Revert Step-5 Preview sparse-GQA/CSA/MTP/SWA/vision support because upstream measured a severe hybrid-prefill regression. Carrying the revert is fork-native risk control: keeping an unvalidated 600B-MoE path with a known regression would conflict with the fork's hybrid/out-of-RAM goal. The revert removes the Step-5 graph, architecture, converter and dedicated ggml ops while preserving Hy3 and the fork's pre-existing DSA/SWA/indexer controls. |
| `7aa7e01482db892b023bb9aace9a40567ab5297a` (#2911) | 1: unchanged | Clear complete DSV4 cache buffers directly when `n_stream == 1`, instead of uploading host zero vectors tensor by tensor. In the single-stream case that stream owns every row, so the operation preserves reset semantics while avoiding a multi-gigabyte host-to-device transfer. Multi-stream selective clearing is unchanged. It does not alter cache size, memory reporting, mmap or MoE placement. A real DSV4 device-cache fixture is unavailable locally. |

No new change required a fork-specific code adaptation, and none was excluded.
Step-5 support from `9513b3d44f48` is intentionally absent until upstream or a
measured fork-native implementation resolves the hybrid-prefill regression.

## Verification without Actions

Environment: Linux x86-64, GCC 14.2.0, CMake 4.4.4, Ninja 1.13.2, native CPU,
CUDA and CURL disabled. All build/model artefacts were kept outside tracked
source.

- Clean CPU Release shared-library build passed: **336/336 targets**.
- Complete CTest with the local model fixture: **44/46 passed**. The two
  failures are the existing Granite trailing-newline mismatch and the Hugging
  Face callback in a CURL-disabled build.
- Hy3 embedded-Jinja render, indexer top-k, NVFP4/import, analytical imatrix,
  quantize invariants, fused up/gate sizing, HC_PRE transpose, RTR parameters,
  MoE-cache shares and n-gram sidecar tests passed.
- Converter and GGUF Python sources compile successfully.
- Standard F32 CPU smoke generated eight tokens and reported
  `HAVE_FANCY_SIMD is defined`.
- CLI help retains SWA compression, indexer-cache type, MoE-cache,
  deferred-expert and speculative-stage controls.
- The Step-5 graph file and Step-5/CSA public symbols are absent after the
  revert; Hy3 model/template support and its focused test remain present.
- Smoke model SHA-256:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- `git diff --check` passed.

## Remaining risk and gate status

Keep PR #13 draft. The async graph-split transfer change needs real CUDA/RPC
source-to-host and host-to-device paths, including the fork's asynchronous
graph scheduling. The DSV4 reset optimization needs a real single-stream device
cache to confirm the latency improvement and reset behavior at large context.
Previously recorded CUDA/Blackwell and large out-of-RAM model gates also remain.

No force-push, upstream merge, `dev` update or `main` update is part of this
intake.
