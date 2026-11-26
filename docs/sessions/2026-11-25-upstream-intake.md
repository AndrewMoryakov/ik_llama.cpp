# Upstream intake through 16214732274e

Assessed 2026-11-25 after reading current dev AGENTS.md and FORK_WORKFLOW.md
(blobs 51c0405d0c8e0826cb8b16293adcea10344ec684 and
d0f7b8503bd1200693c672cf7f99bbf0bfbfb623; unchanged).
Last assessed: ad217a220962edae4023fe9951fd45c812138086, durable Nov24 record
on existing draft PR #13, head c0ff8bc970c88b7e6b754069c854d306e00df931.
Current dev/main: 9aea4daefc7f0043255d78f8cb47ea58179090f8. History and
pre-upstream snapshot tags confirm earlier integration; the Nov24 intake
records subsequent assessments. The remote upstream-sync ref is absent in this
checkout; no assumption that an integration branch name is current was made.
Only open intake PR is #13. Extend its dedicated branch based on current dev
in a clean isolated worktree; origin and ik-upstream are configured, tracking
removed. No blind merge, force push, main/dev update or auto-merge.

## Per-SHA assessment

Ten assessed commits: nine class 1, one class 2, none class 3 in this cycle.
Prior class-3 decisions (small softmax/control fusions, ARM quant retirement,
ATTN retirement) remain in force.

| SHA / author | Class | Intent, implementation and fork interaction |
|---|---|---|
| `7a5d90009b7ae55d3239cdd33244977c4eb10ff6` / Kawrakow | 1 | Inkling tokenizer ignores merges; scoped to inkling2 pretokenizer. No mmap/cache or benchmark change. |
| `3d9caf722307cfef76578f57d577e442fa5a655b` / Kawrakow | 1 | Extend relative-bias new MMA to F16 cache >=8192 rows and multi-tile bias addition. GPU tails/numerics remain a gate. |
| `d6854c826c50b5a22ccf5e1e1aa5b2ceb4755576` / Kawrakow | 2 | Convolution with per-head delta uses Mamba2 CPU/CUDA kernels; one RMSNorm over reshaped concatenated destination/message retains independent row norms. Resolve conflict by keeping the fork signature without the rejected control-fusion graph argument; do not reintroduce that fusion. Apply CPU/CUDA dispatch follow-ups below as one logical change. |
| `d99891fec1f8a679b91b08b43f0261d225e5d829` / Joel Farthing | 1 | DFlash2 Inkling vocab/padded codebooks, shared token norm, selector softcap mode, true feature positions and capture across micro-batches. Add per-step convolution windows/restore graphs for Inkling and LFM2; hash capture/offset/slot for graph reuse. CPU concat accepts transposed input. Existing CPU checkpoint fallback/replay remains. Device/model checkpoint parity is pending, not claimed. |
| `f420cce8e309c5f2db8cf91fa3da8a1fbd53302f` / mb8565 | 1 | Track used_max upper bound rather than probing padded block tails. Raise on allocation, lower after cell removal, preserve with checkpoint and state restore; prevents newest KV rows disappearing after multi-sequence rewind/context shift. |
| `d3be77ecf21f24120c5b8a12e4cb28bffbdc2406` / losewayy | 1 | Bind writable views to backing tensor backend before splitting. Preserve REDUCE and FAKE_CPY collective exceptions and MoE-cache scheduler callback fallback. Host ownership/mmap unchanged. |
| `50f619ddbbd01aeae7ddab037f3e873cbb7d0b90` / Joel Farthing | 1 | Move relative-bias dispatch predicate to fattn.cu, preserve cp_async/query/type/cache-size conditions and simplify launcher return type. |
| `313f3b62d5f51836c563abbf8c311c371878de7a` / eukhlg | 1 | Correct CPU SSM layout dispatch to src[3]; src[4] saved states are optional for legacy Qwen/LFM layout. Required follow-up to d685, not an independent feature. |
| `518bf9073583dcfb3a8939f0cf106acf2007996b` / Kawrakow | 1 | Same src[3] layout discriminator correction on CUDA. Required follow-up to d685. |
| `16214732274e07ae9e7c1cda30d52c5b7f5f8718` / Kawrakow | 1 | Install lld in CUDA container and use it for shared/executable linking. No workflow added. Container engine unavailable; full container build remains unrun. |

## Invariants and semantic review

Preserve RTR and pinned caps, deferred mmap ownership, sidecar duplicate
validation before scale consumption, scale refolding on every raw reread,
MoE-cache callbacks through the regular scheduler and bounded expert copies.
Keep generic GQA=3, GEMM/WMMA bounds/stride guards, legacy ARM quant types,
ATTN=2/GRAPH=3, benchmark test_v3 and unfused softmax/control graphs.
New conv snapshot allocation is opt-in for speculative per-step checkpoints
and grouped by buffer type. It adds history+max_tokens storage per recurrent
visit/slot; no large-model RSS or speed benefit is claimed. Restore graphs
synchronize the scheduler before copying state and are retained per slot/step.
DFlash feature positions use pos_base-1; other speculative modes retain their
position base. Inkling valid/padded vocab shapes and softcap ordering are
explicit. Combined RMSNorm reshapes to two rows per token before normalizing,
so it is not a joint norm across destination and message.

## Verification

- Clean native CPU-only Release, GCC 14.2, CUDA/CURL off, shared libraries:
  **377/377 initial steps passed**, followed by successful final regeneration
  and rebuild of the new test targets. Writable /tmp was checked. Temporary
  CMake 4.4.5, Ninja and Python 3.12-compatible NumPy/Jinja2 were provisioned;
  Python3_EXECUTABLE points to that interpreter. No old native binary was used.
- Full CTest: **65/67 passed**, 23.74 seconds, no skipped tests. The failures
  are the documented Granite chat-template trailing-newline assertion and
  eval-callback attempting a Hugging Face download without libcurl. They are
  not repaired or represented as passed. ngram-cache and jinja-py pass.
- New test-conv-delta passed independent scalar comparisons for 128 channels,
  four heads, kernel 4, 1/2/31/32/33/65 tokens and 1/2/4/8 workers, including
  transposed concat and plain Mamba2 convolution. Its legacy kernel-3 test
  checks the src[3] layout with optional saved states present and absent.
- New test-kv-holes passed actual two-sequence decoding on a tiny model:
  interleave 160 cells, remove the odd sequence, decode again with both old
  block-tail probes empty, verify cell 158 stays in attention range, then
  clear and restore a serialized state and check used_max consistency.
- New test-inplace-backend passed actual scheduling with two CPU backend
  instances: backing storage explicitly assigned to the lower-priority
  backend, writable result assigned to the other one. Result placement follows
  storage and the original buffer receives scaled values. It does not prove
  cross-device copies. Updated bias/control test verifies separate five-wide
  row RMS norms after reshape. Existing Mamba2, repeated expert-scale reload,
  GQA/clamp/softmax and other intake regressions pass.
- Temporary CUDA 13.5 plus CCCL compiled ssm-conv-m2.cu, fattn-new-mma.cu,
  fattn.cu and ggml-cuda.cu for sm_80. Initial missing CCCL headers were
  provisioned before this successful run. Only the existing extra-token
  #endif warning remains. No full CUDA link or on-device execution is claimed;
  no GPU device is present. No docker/podman engine is installed.
- Converter Python syntax compiles. Help retains -rtr/-rtra, --moe-trace and
  --token-timing. CPU eight-token generation reports HAVE_FANCY_SIMD; timing
  has header, seven intervals, complete end marker. Benchmark JSON validates
  pp4/tg4. HTTP regression passes three long-prompt 400/idle/short-request
  cycles. Fixture SHA256:
  `270cba1bd5109f42d03350f60406024560464db173c0e387d91f0426d3bd256d`.
- git diff --check passes. Local logs: nov25-build.log, nov25-build-final.log,
  nov25-ctest.log, nov25-cuda.log, nov25-smoke.log, nov25-help.log,
  nov25-server-result.log and timing/benchmark JSON. These tiny-model runs are
  correctness smokes, not throughput or large-model memory measurements.
- CLI push dry-run fails for missing HTTPS credentials. Publish via connector
  with expected head c0ff8bc970c88b7e6b754069c854d306e00df931, non-forced.
  Large upstream ggml.c blob 35142b241836320602c390e519aa627c6be9fecd was
  fetched by SHA and its content compared exactly against Git. Changed fork
  blobs (including ggml.c) are created with SHA equality checks; publication
  must verify remote tree equals final local tested source. Empty contents
  responses were never used as file data.

## Remaining gates

Keep #13 draft. Real Inkling/DFlash2 conversion, logits/tokenization, selector
softcap before/after correction, multiple micro-batches and reject/accept/replay
parity are unrun. Validate conv checkpoint reuse across slots, history offsets,
shared visits, LFM2 per-step rejection, session restore and device placement,
including multi-GPU/pageable/unresolved backend paths. CUDA F16 relative bias
needs >=8192-row numerical parity, multi-tile/query/key tails and far positions.
CUDA delta convolution needs device numerical tests at <=32/>32 boundaries.
The two-CPU-backend scheduler test cannot establish real cross-device transfer
correctness; REDUCE/FAKE_CPY and MoE-cache GPU graphs still need device runs.
Container image build/link/start is unrun (no docker/podman engine). Earlier
platform/model/out-of-RAM gates remain, including approximate expert-scale
perplexity. Missing checks are not passed. GitHub Actions is unavailable and
was neither created nor used. No adaptive merge is authorized by this record.
