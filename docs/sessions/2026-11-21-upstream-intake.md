# Intake through 3ed960ed3b9d

Assessed 2026-11-21 for existing draft PR #13 into dev.
Read live dev AGENTS.md and FORK_WORKFLOW.md before editing. Both dev and main
remain at `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
The previous published intake head is `cec5ed31b1b93672d19ecbb306f1fed01e845a17`,
with last assessed upstream `093e74cb0590eaf462a04516ba1bab8c6b6637bc`.
The isolated worktree descends from that head and current dev. Recovered the
unpublished Nov19 preparation into this new worktree without discarding it.
Checked current branches and open PRs; reuse PR #13 to avoid duplicates.
Earlier upstream incorporation is documented in snapshot tags and the prior
upstream-sync history/records. No dev/main update or upstream merge was performed.

## Decisions

22 assessed SHAs: 20 class 1 (including one already incorporated), one class 2,
one class 3. Twenty upstream patches were ported with -x attribution.

| Upstream SHA | Class | Intent, implementation and fork interaction |
| --- | --- | --- |
| `5f2126c144a64e600f1ccceced9c0654f6101fa6` | 1 | Fix #2921 (#2948). Synchronize graph input copies; superseded in this batch by #2955/#2962. Retain the fork scheduler fallback whenever a MoE-cache callback is active. |
| `e589ae56cd31ed02a300ac22a5854eb0438abebe` | 1 | cuda: do not elide the fused MoE intermediate when another node reads it (#2947). Only elide the CUDA fused MoE intermediate when its data/IDs match and it has a single reader. Output/fanout guards remain active. |
| `ac6b22ac0cbdba8a4419767cbefdb5da60d0804a` | 1 | CUDA FA: stage q8_0/q4_0 KV tiles in MMA decode (#2946). Stage Q8_0/Q4_0 KV tiles for MMA decode. Changes CUDA shared-memory/copy scheduling, without changing cache ownership or mmap. |
| `fe435a9c4c88c5bce3896533b9c5a7c8ed811e77` | 1 | iqk : fix the odd-block tail of the NEON Q2_0 x Q8_0 GEMM (#2944). Handle the odd-block tail of NEON Q2_0 x Q8_0 GEMM. ARM numerical parity is an outstanding platform gate. |
| `40b968d36846adf0644dd20451928686917a37ce` | 1 | llama : do not reuse the graph that re-pools every QSA block (#2943). Do not save/reuse a graph that re-pools all QSA blocks. Retain the fork warmup discriminator in reusable graph metadata. |
| `092496d1428b2d2f33e07578fb3969eb929f2d9d` | 1 | llama : copy recurrent state rows by their own width in build_s_copy (#2941). Copy recurrent state rows using the actual s_l tensor width, including PLE tail storage. Real hybrid sequence-copy parity remains a gate. |
| `08d2477ff7979f83649cbad756973d29d31ec3d8` | 1 | MoE cache: periodically refresh GPU experts at CPU share 1.0 (#2938). Refresh full GPU expert banks every two completed decode tokens at CPU share 1.0. Observe CPU routes, protect current routes, limit copies to 40 MiB/device, synchronize before slot-map publication. Focused policy/completion tests cover protected victims, replacement and failed/ineligible submissions; real GPU transfer/cache accounting remains a gate. |
| `3a49e0bc23c0605ca40dc1a816860e358ad983d6` | 1 | Nemotron-H (Nemotron 3.5) and Mamba-2 support (#2850). Add Nemotron-H dense/MoE and Mamba2, with explicit qnext-layout discrimination, separate rolling convolution/SSM storage, memory estimates and checkpoint serialization. Restrict to one sequence and decline incompatible per-step snapshots. Retain the fork ggml allocation overflow guard and existing mmap/import validation. Upstream test-mamba2 covers CPU chunk/token, snapshot/resume and convolution window parity. Existing recurrent session files change format; regenerate them for this intake. |
| `f18b3082a229b3ffd86dfd92da4a07d82bc4851b` | 1 | Improve Nemotron-H long context performance (#2949). Dispatch Nemotron GQA ratio 5 to the new CUDA MMA route for decode and prefill. GPU long-context correctness/performance is unmeasured. |
| `ecc288f7da01996cd5d2df66c85a741aeeff4731` | 2 | Help scheduler with offloads (#2933). Expose opt-in --force-expert-offload-device / -feod, default false. Adapt the scheduler to validate the one-based device hint before subtracting or indexing; malformed/CPU-only hints use ordinary fallback. CPU scheduler regression covers 0, -1, INT_MIN, 1 and INT_MAX; parser/API defaults and aliases are covered. |
| `06a141f3bdb59a634ed2021760446522e2e8fe9d` | 1 | llama : per-step speculative restore must not move KV cell seq_id of a hybrid cache (#2942). Only update recurrent KV seq_id position during speculative per-step restore for fully recurrent caches. Hybrid attention token positions remain untouched. |
| `b7c809880961b95b0dd27fdf28e4edc732a74ea1` | 1 | Avoid duplication of merged layers (#2950). Count/copy merged up-gate expert tensors once rather than also collecting the old split aliases. This directly reduces duplicate cache storage while preserving down-expert inclusion. |
| `55f045c41d78944814bdb48dd493d5a21221bf07` | 1 | CUDA FA: expand q8_0/q4_0 KV tiles in place in MMA decode (#2954). Expand quantized Q8_0/Q4_0 KV tiles in place in the new MMA decode route. CUDA template compilation is partial evidence; on-device parity remains required. |
| `a209e5b49583b4a07be285bcd798f8837fa118d3` | 1 | gemma4: make the per-layer inputs contiguous again (#2952). Make Gemma4 per-layer inputs contiguous before CUDA fused unary reads, fixing multi-token row selection. |
| `b1e78c235385a58c1764319d7a4afe8c8e02dff9` | 1 | Do not use ggml_cont when not necessary for Gemma4. Avoid the Gemma4 contiguity copy when the view is already contiguous; retain the fix for strided views. |
| `a1ffbaf46fdc7ed6b5aa1472578f3931737bc83e` | 1 | Yet another fix for copy_all_inputs (#2955). Synchronize CUDA copy stream after graph-input/event-dependent copies; preserve fork MoE-cache fallback and bounded padding clears. |
| `876846478335ba91e0dcb64c5948f1421ff158fc` | 1 | bugfixes: dup_same_cont byte count; K-shift with -khad; quantized V overrides without flash attention (#2958). Copy contiguous quantized tensors by byte extent, undo/reapply Hadamard around K-shift RoPE, and reject quantized V overrides without flash attention. Added exact-byte quantized copy regression; model K-shift and V configuration checks remain required. |
| `e5cee784fd51163d9606ee64dcf0ae0e4c1b1a76` | 3 | Retire GGML_TYPE_Q4_0_4_4, GGML_TYPE_Q4_0_4_8, GGML_TYPE_Q4_0_8_8 (#2960). Do not retire Q4_0_4_4 / Q4_0_4_8 / Q4_0_8_8 or remove their ARM source and public enum values in this intake. The fork has Android/ARM consumers; there is no migration evidence proving compatibility can be dropped. Retain loader/quantizer behavior; any retirement needs a separate compatibility decision and ARM tests. |
| `7c00f8788e303bfba2886138e288effb0fd5fbbf` | 1 | Fused multi-add, mul-unary, scale op (#2957). Use a dedicated sigmoid-times-up / multi-add / scale op in Qwen4Exp, with CPU and CUDA implementations and RPC protocol bump. Test numerical scalar-reference parity for 64/128/192-wide outputs, 1/3 rows, 2/4 streams, three worker threads. CPU kernel requires width divisible by 64. Mixed-version RPC endpoints require rebuilding together. |
| `2ecf12ddc5cc50bbfcafdc126fea300cb3d0b4fa` | 1 | Raon-1 nano: load again after #2850, stable CUDA results at ubatch > 1, and working MTP drafts on CUDA (#2962). Restore Raon1-nano qnext state layout, finish host-intermediate CUDA copies before scheduler reuse, and use converted src1 strides for batched cuBLAS. Preserve cache callback fallback. Raon model/MTP CUDA runs remain required. |
| `13b44efd2799509c7fa64f09d549c3c278f10679` | 1 | CUDA: use && in the bound check of the MULTI_ADD+SCALE fusion (#2966). Already incorporated semantically by the fork fusion eligibility helper: graph-tail bounds are checked before reading the next node, with additional shape/output/fanout/device guards. No duplicate patch. Existing structural regression exercises terminal node, explicit output and second consumer. |
| `3ed960ed3b9debf22e4e833f492a275b593072b0` | 1 | qwen35: keep result_norm alive for MTP draft heads (#2965). Keep post-norm Qwen3.5 dense/MoE MTP hidden states alive as graph outputs, including normalized chained drafts. This prevents allocator reuse before MTP consumption; actual Hadamard/MTP acceptance remains a model gate. |

## Fork invariants

Retain RTR policy and pinned-memory caps, deferred-expert/mmap ownership,
NVFP4/FP8 sidecar duplicate validation, guarded CUDA simple GEMM, bounded expert
padding clears, MoE-cache scheduler fallback, warmup graph key, and ATTN=2/GRAPH=3.
No benchmark schema change: the fork still uses test_v3. No speed or out-of-RAM
improvement is claimed without measurements. The periodic cache update changes
GPU residency only in the existing explicit CPU-share=1.0 mode, not its default.

## Verification

- Clean Linux x86-64 GCC 14.2 Release shared-library build passed all 358
  initial build steps. Native CPU enabled; CUDA/CURL disabled. The final rebuild
  registered the added mixer test. Temporary CMake/Ninja, Python dependencies
  and CUDA 13.5 tools were provisioned in the execution environment.
- CTest: 55 of 57 passed; no new failures. The known Granite trailing-newline assertion and
  eval-callback download without libcurl are the baseline failures. An initial
  Python ABI mismatch (3.12 NumPy versus the CTest 3.13 interpreter) was corrected
  by provisioning matching dependencies before the final full run.
- New C++ checks passed: actual CPU scheduler fallback for malformed one-based
  offload hints, parser/API opt-in defaults and aliases, protected LRU/ClassLRU
  victims and replacement publication after CPU observation, TG completion state,
  exact-byte Q4_0 copying with three threads, and 12 fused mixer scalar-reference
  cases (64/128/192 output width, 1/3 rows, 2/4 streams, three threads).
- Upstream Mamba2 CPU convolution window, chunk/token scan and prefix snapshots /
  resumed decode checks passed, including d_state 96; observed scan differences
  were zero. This is shared-op evidence, not full-model validation.
- CUDA 13.5 compiled for sm_80: ggml-cuda.cu, ssm-conv-m2.cu, ssm-scan.cu,
  multiadd.cu, fattn-new-mma.cu, f8.cu and the 1x8 MMA template instance.
  The new-MMA compile required the standard --extended-lambda option; it emitted
  the existing #endif-label warning. No GPU execution or full CUDA link is claimed.
- Eight-token CPU generation passed and printed HAVE_FANCY_SIMD. Token timing
  contained a header, eight interval records and an end record. Benchmark JSON
  produced pp4/tg4 rows. Help retained RTR/auto, MoE-cache share/policy, deferred
  experts/PLE and SWA controls, and added the offload-device control.
- Fixture SHA-256: 270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d.
- git diff --check passed. CLI push credentials were unavailable. Publication
  uses connector blobs/tree/commit and expected head cec5ed31b1b93672d19ecbb306f1fed01e845a17.
  Large upstream ggml.c was fetched by blob SHA 57454efea3b05fc2162eb9f6794b45bca5d64974
  and its created blob SHA verified. The fork blob ba6959bb527839ada7d59d98f7bc4ef10c3040cd
  was created and verified, retaining legacy ARM types and the overflow guard.
  The published tree is required to equal the local tested source tree.

## Remaining gates

Keep PR #13 draft. No GPU or ARM execution hardware is available. Run CUDA
Q8/Q4 KV FA parity and tails, Nemotron-H convolution/scan (including SSD/cuBLAS
stream path), full Nemotron model prefill/decode/session restore, MoE periodic
refresh with real weights and multi-GPU slot ownership, opt-in offload device
placement, Raon1-nano multi-token and MTP, Qwen3.5 Hadamard MTP acceptance,
Qwen4Exp mixer, Gemma4 PLE, and NEON odd-block GEMM. Check recurrent sequence-copy
and speculative rollback with real hybrid models and existing sessions regenerated.
Earlier FP8/ModelOpt, Blackwell, RPC, DeltaNet, DSV4 vision/device state,
large-context QSA and large out-of-RAM model gates remain open.
GitHub Actions is unavailable and was not used.
