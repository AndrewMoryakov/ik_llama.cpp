# Intake through ad217a220962

Assessed 2026-11-24 after reading current dev AGENTS.md and FORK_WORKFLOW.md.
Last assessed upstream ac2169477c6f2ea2af1cf993f527af249bd94df2 is recorded
in the Nov23 intake on existing draft PR #13. Prior published intake head:
`ea73f3988e95aded2a0123afa1ebd972099b2f08`.
Current main/dev: `9aea4daefc7f0043255d78f8cb47ea58179090f8`.
Open PR/branch checks found only #13 for the intake. Use a clean isolated
worktree from its current head, descendant of current dev, with origin and
ik-upstream remotes and tracking removed. Earlier incorporation is covered
by upstream-sync history, pre-upstream snapshot tags and prior intake records.
Two reviewed patches applied cleanly with -x attribution. No main/dev update,
force push, blind merge or automatic PR merge.

## Decisions

Four assessed SHAs: one class 1, one class 2 and two class 3.

| Upstream SHA | Class | Intent, implementation, evidence and fork interaction |
| --- | --- | --- |
| `b8b9a32e1d1a55a49f2a26c0ba2bdb875ba9c94f` | 2 | ggml: scale quantized rows in place for per-expert folding (#2979). Generalize expert scale folding through ggml_type_can_scale_row / scales_exactly / scale_row_inplace, including block d+dmin offsets and a dequantize/requantize fallback. Preserve sidecar duplicate validation before scale consumption and the fork fix that refolds every fresh raw read. Adapt the row API to reject unsupported/out-of-range types before traits lookup or the unity-scale fast return; tests check rejection without mutation. Exact-layout rounding and approximate requantization are separate paths, not a claim of bit-exact scaling. mmap remains disabled when any expert folding is required; whole-tensor GPU staging/large-model RSS remain gates. |
| `d3490ef55480239fce3fe3faf5577228dcea31a8` | 1 | inkling2: faster relative bias in FA (#2982). Pad/cache the relative-bias weight and sink column once per graph rather than padding every generated table, fold sink subtraction into the matmul and reuse per-head zero vectors. CUDA reads bias by column, skips uniformly far tiles and adds relative bias to quantized q8_0/q4_0 new-MMA decode. CPU analytical tests cover padded rows, rank padding and sink subtraction; GPU tile/tail and layout numerical execution remains pending. |
| `6e654761978f80127aa4509a9bba3d07a857daa3` | 3 | ggml: compute each softmax row once in the CPU fused softmax small GEMM (#2984). Intentionally do not restore the excluded small-softmax/GEMM fusion. Computing each softmax row once is a performance change inside that helper, but it still reads the softmax output buffer before the softmax node executes and does not repair the previously recorded output/consumer/width safety problems. Retain ordinary softmax then matmul and the existing widths 1/3/7 reference regression. |
| `ad217a220962edae4023fe9951fd45c812138086` | 3 | Inklingy2: optimize the control computations (#2977). Intentionally retain the ordinary Inkling control graph. The new six-node fusion does not guard intermediate outputs or additional consumers, and the scalar exp(2*x) rational tanh expression can produce inf/inf at large positive inputs where ordinary tanh is finite. Its graph ordering exists to arrange the fusion and is unnecessary without it. Added unfused reference coverage with a retained keep output, a second consumer and large gates; a future fusion needs complete liveness checks and stable math. |

## Fork invariants and memory

Keep RTR policy, pinned caps, model/sidecar validation, mmap ownership, deferred
loading rules, MoE-cache scheduler callback fallback and expert padding/GEMM/
WMMA guards. Keep generic CPU FA for GQA=3, legacy ARM quant types,
ATTN=2/GRAPH=3 and benchmark test_v3. The bias cache is local to one graph;
its key is the immutable weight tensor, not a cross-context cache. It does
not change physical expert placement or cache routing. More scale types can
now require host materialization; no large-model RSS or speed gain is claimed.

## Verification

- Environment: writable `/tmp`, GCC 14.2 and native AMD EPYC CPU. Provisioned
  CMake 4.4.5/Ninja and Python 3.13-compatible NumPy/Jinja2 temporarily. A prior
  checkout's native library gave SIGILL on this worker; it was not used as a
  baseline. All reported checks use this run's fresh native build.
- Clean CPU Release, GGML_NATIVE=ON, GGML_CUDA=OFF, LLAMA_CURL=OFF:
  all 375 initial build steps and the final CMake regeneration/rebuild passed.
  Full CTest: **62/64 passed**, 24.68 seconds. Only the documented Granite
  chat-template trailing-newline assertion and eval-callback's attempted
  download without libcurl failed. They are not new passes or repaired here.
  test-ngram-cache and test-jinja-py passed; do not reclassify them as failures.
- New test-quant-scale passed: **43 round-trippable types, zero failures**,
  plus dedicated F32/F16/BF16 checks and unsupported/invalid-type rejection
  with a byte canary at unity and non-unity scale. Its scale 0.37 cases allow
  0.5% aggregate error for explicit scale layouts and 20% for the requantize
  fallback; this is not a perplexity or all-format claim.
- New test-inkling-bias-control passed: independently computed bias dot
  products minus sink for all padded rows (rank 5 padded to 8, extent 4 padded
  to 32, two heads/three queries), ordinary control outputs with a retained
  keep output and second consumer, and finite results at gate 100. Existing
  test-expert-scale-reload and test-cpu-intake-nov23 passed, preserving the
  two-expert repeated raw-read folding and GQA/clamp/softmax references.
- CUDA 13.5 compiled fattn-new-mma.cu, fattn.cu and the F16
  ncols1_1/ncols2_8 MMA template instance for sm_80. Only the pre-existing
  extra-token #endif warning appeared. This is translation-unit compilation,
  not a full CUDA link or GPU numerical run; no GPU device is present.
- Help includes -rtr, -rtra, --moe-trace and --token-timing. --help prints the
  full help and returns 1 by existing convention, so it was audited separately.
  Fresh eight-token CPU generation prints HAVE_FANCY_SIMD. Token timing is
  complete (header, seven intervals for eight generated tokens, end marker).
  Benchmark JSON contains pp4/tg4 with CPU/GPU-offload=0. These are tiny-model
  correctness smokes, not throughput comparisons. Model fixture SHA256:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- HTTP server regression passed three cycles: long prompt rejected with 400,
  slot returns idle, next short two-token request succeeds. No KV overflow.
- git diff --check passed. Logs are local nov24-{build,build-final,ctest,
  quant-scale,cuda,smoke,help,server-result}.log and timing/benchmark JSON.
  CLI push dry-run lacks credentials (terminal prompts disabled); publish
  reviewed blobs/tree/commit via connector with the expected branch head.
  The 737614-byte quant source was read by blob SHA and the created fork blob
  verified as `38fb1afe6cf974a6f2bc94bdd2f8bb5cd2012289`. No empty contents
  response was used. Publication requires the remote tree to equal the final
  local source tree and a non-forced expected-SHA update of the intake branch.

## Remaining gates

Keep #13 draft. Real Inkling quantized GGUF inference, COPY/repack, estimated
imatrix and approximate scale error/perplexity need model evidence. Test GPU
q8_0/q4_0 and F16 relative-bias MMA numerics, query/key tails, far/past/future
positions, strided bias and multi-GPU/pageable fallback. No GPU device is
available for execution. Looped state/checkpoint/MTP, generic GQA=3 cache
formats, CPU/GPU expert-scale staging and out-of-RAM scenarios remain open
with earlier platform/model gates. Rejected fusions require a separate,
complete safe implementation before reintroduction. GitHub Actions is
unavailable and was not used.
