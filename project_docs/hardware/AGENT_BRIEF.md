# Agent brief — `feature/raptor-lake-laptop` (i7-1360p / 16 GB CPU-only profile)

Bootstrap for LLM agents (and for the human after `/compact`) who need
to pick up the laptop adaptation work. Copy the relevant sections at
the start of a new session.

This document is the **single entry point** for the laptop work. Read
it first; the other files in `project_docs/hardware/` are referenced
from here.

---

## 1. What this branch is

`feature/raptor-lake-laptop` adapts the ik_llama.cpp workstation
project (main hardware: Ryzen 9 7950X, 96 GB) to a secondary laptop:

- Intel Core i7-1360p (13th gen Raptor Lake mobile)
- 4 P-cores with HT (8 logical) + 8 E-cores (no HT) = 16 threads total
- 16 GB DDR5
- No discrete GPU. CPU-only inference.
- **No AVX-512** (Intel removed it from consumer chips since Alder
  Lake). AVX2 + AVX-VNNI present.

The branch is **local-only**. We do NOT push it to the upstream PR
fork remote. It is dev integration material for the human's own
laptop use, and the `GGML_AVX_VNNI` CMake option we added is
potentially shareable upstream later but not in this PR.

## 2. Why this exists

Target use case: run the human's chosen laptop models on the i7-1360p
without paying the runtime-repack swap-thrash trap that swap-bound
models can fall into. The `-rtr auto` v3 policy (shipped in PR #1738
on the main `dev` branch) handles the auto-disable correctly on this
class of hardware, but the build itself needs:

1. CPU-only configuration (no CUDA).
2. AVX-VNNI 256-bit code path activated — the chip's main quantized
   GEMM acceleration is AVX-VNNI, not AVX-512. Without this path the
   build falls back to plain AVX2 and loses significant performance.
3. Correct thread default for the P+E hybrid core layout: **`-t 4`**
   (P-cores only, confirmed by thread sweep 2026-05-21 — monotonic
   degradation from t=4 to t=16 due to OpenMP sync overhead).

Target models on this profile:

- Generic 7B Q4_K_M (comfortable in-RAM)
- Generic 13B Q4_K_M (comfortable, snug at high context)
- Gemma-4-E4B (small dense, comfortable)
- Gemma-4-26B-A4B (MoE 26B, 4B active — borderline at 14-15 GiB on disk)
- Qwen3.6-35B-A3B (MoE 35B, 3B active — swap-bound, `-rtr auto`
  expected to DISABLE)
- GLM-4.7-Flash (size/quant TBD by the human)

## 3. Current state (as of last commit)

Branch fully measured and documented. Last commit: `191e879d`.
Pushed to `origin` (= `AndrewMoryakov/ik_llama.cpp`).

```
191e879d  docs: user quickstart for i7-1360p laptop (EN + RU)
1b0741c0  bench: VNNI isolation GLM-9B (+52% TG, +5% PP); Qwen3-30B PP512 crash note
7e59a9ec  bench: phi-4 PP512=10.36 tok/s; Section 5 measured vs predicted PP note
765ccc93  build: switch NMake -> Ninja in build_raptor_lake.bat; bench: Section 5 measured vs theoretical
8b155830  bench: i7-1360p smoke matrix (2026-05-21)
0b6f7346  bench: bandwidth diagnostic + thermal throttle finding (2026-05-21)
3f5f43db  bench: i7-1360p thread sweep + update docs (2026-05-21)
bfff3fb7  fix: MSVC AVX-VNNI VEX vs EVEX intrinsic mismatch on Raptor Lake
```

What is **DONE**:

- **MSVC AVX-VNNI fix** (`ggml/src/iqk/iqk_config.h`): added
  `#define _mm256_dpbusd_epi32 _mm256_dpbusd_avx_epi32` alias under
  `_MSC_VER && __AVXVNNI__ && !__AVX512VNNI__`. Without this, all
  models crashed with STATUS_ILLEGAL_INSTRUCTION (EVEX opcode on a
  chip without AVX-512).
- **Build script** (`build_raptor_lake.bat`): switched from NMake to
  Ninja so `-j 8` actually parallelises. VS2022 Community default
  path. Run once, get all binaries in `build\bin\`.
- **Thread sweep** (2026-05-21, GLM-Z1-9B, r=3): winner is `-t 4`.
  Monotonic degradation t4 > t8 > t12 > t16. t8 already -15% PP /
  -24% TG vs t4.
- **Bandwidth diagnostic** (t=4, r=1 with cooldown): GLM-9B ~28 GB/s
  effective (DRAM-bound), phi-4 ~13 GB/s (thermal-limited below
  floor), Qwen3-30B ~3 GB/s (NVMe disk-bound).
- **Smoke matrix** (5 models): GLM-9B and phi-4 → KEEP; Qwen3-30B /
  Qwen3-42B / ERNIE-21B → DISABLE via MoE total-size gate
  (`MoE model X GiB > 90% of RAM 15.7 GiB`, threshold ~14.1 GiB).
- **VNNI isolation** (GLM-9B, rtr=0 vs rtr=2, r=2): TG +52%,
  PP +5% (within noise). TG benefit is the main gain.
- **Dashboard** (`dashboard/evidence-layer.js`): preset
  `laptop_raptor_lake_16gb` updated to `validation: 'validated'`,
  `confidence: 'high'`, threads=4, cache_type_k/v='f16' (q8_0 not
  supported in CPU-only builds).
- **Docs**: `RAPTOR_LAKE_LAPTOP.md` fully populated; bench protocol
  sections 1-5 filled with measured data; quickstart guides
  `QUICKSTART_RAPTOR_LAKE.md` (EN) and `QUICKSTART_RAPTOR_LAKE_RU.md`
  (RU) created.

What is **PENDING** (non-blocking, fills in when models become available):

- Bench baseline TBD rows: Generic 7B Q4_K_M, Generic 13B Q4_K_M,
  Gemma-4-E4B, Gemma-4-26B-A4B, Qwen3.6-35B-A3B, GLM-4.7-Flash.
  Follow bench protocol section 2 when these are downloaded.

## 4. File map

Relative to the repo root, all on this branch:

```
build_raptor_lake.bat
    CPU-only build entry point. Self-contained (uses %~dp0). Sets
    GGML_AVX2=ON, GGML_AVX_VNNI=ON, GGML_CUDA=OFF. Run on the
    laptop after cloning the branch.

ggml/CMakeLists.txt
    Adds option(GGML_AVX_VNNI ... OFF) on line 93. Opt-in, so OFF
    means default behaviour unchanged everywhere else.

ggml/src/CMakeLists.txt
    MSVC AVX2 branch: when GGML_AVX_VNNI, add_compile_definitions(
    __AVXVNNI__) for C and CXX. GCC/Clang branch: appends -mavxvnni
    to ARCH_FLAGS. This is the new code that closes the gap where
    MSVC could not previously activate the IQK HAVE_VNNI256 path
    on Alder Lake / Raptor Lake without AVX-512.

dashboard/evidence-layer.js
    New STANDARD_PRESET_EVIDENCE entry `laptop_raptor_lake_16gb`.
    Currently validation=research, confidence=low. After the laptop
    bench, raise validation, update threads from placeholder 8 to
    the winning sweep value.

project_docs/hardware/AGENT_BRIEF.md
    This file. Single entry point for the branch.

project_docs/hardware/RAPTOR_LAKE_LAPTOP.md
    Hardware profile and tuning notes. Reading reference for what
    the chip is, what fits, what to expect from -rtr auto. Will
    eventually hold the populated bench tables.

project_docs/hardware/LAPTOP_BENCH_PROTOCOL.md
    Step-by-step procedure to follow at the laptop. Sections 0-7,
    plus workstation reference numbers in section 6. The human or
    agent reads this on the laptop and follows top to bottom; no
    improvisation needed.

project_docs/hardware/QUICKSTART_RAPTOR_LAKE.md
    User-facing one-page guide (English): build, flags, model table,
    known issues. No internal detail.

project_docs/hardware/QUICKSTART_RAPTOR_LAKE_RU.md
    Same guide in Russian.

bench_results/2026-05-20_raptor_lake_baseline/README.md
    Placeholder matrix file. Raw llama-bench output lives here
    when captured.
```

## 5. Reading order for a new agent

Coming in cold:

1. `AGENTS.md` at the repo root — general repo bootstrap.
2. The auto-memory `MEMORY.md` (loads automatically) — overall
   project state, including a one-line pointer to this branch in
   the "Active branches" section.
3. This file — laptop work context.
4. `project_docs/hardware/RAPTOR_LAKE_LAPTOP.md` — what is special
   about this hardware and what we expect.
5. `project_docs/hardware/LAPTOP_BENCH_PROTOCOL.md` — the actual
   "what to run" instructions.

Skip the deep `project_docs/rtr-auto/` bundle unless the user is
asking specifically about `-rtr auto` policy correctness on the
laptop. That work is on `dev`, already shipped to PR #1738 upstream,
and the laptop just consumes the policy via the inherited binary.

## 6. Workflow

### 6a. If you are on the workstation (no laptop access)

Preparation work only. You cannot runtime-verify anything that
needs i7-1360p hardware. Useful things to do:

- Read code in `ggml/src/iqk/` to understand the kernels that will
  benefit from AVX-VNNI 256-bit (`iqk_gemm_*.cpp`, see
  `iqk_config.h:52` where `HAVE_VNNI256` is defined).
- Refine the protocol doc if you spot gaps.
- Run additional workstation reference benches if the human wants
  more cross-machine anchors.
- Patch the build script or CMake further if a real issue is
  found in static review (not speculation).
- **Do NOT** run benches on the workstation under the assumption
  they predict laptop numbers precisely. They are anchors, not
  predictions. SIMD-width difference, DDR speed difference, cache
  size difference all matter, and the ratio is noisy.

### 6b. If you are on the laptop

Follow `project_docs/hardware/LAPTOP_BENCH_PROTOCOL.md` top to
bottom. The doc is self-contained.

Key decision points during the bench session:

- **Build fails at configure step**: check VS path in
  `build_raptor_lake.bat`. Adjust if installed in non-default
  location.
- **Build fails at compile step**: report the exact error. The
  ARCH_FLAGS handling for `GGML_AVX_VNNI` should be active on
  MSVC; if it is not, check `build\CMakeCache.txt` for
  `GGML_AVX_VNNI:BOOL=ON`.
- **`AVX_VNNI = 0` in `system_info`**: the macro did not propagate.
  Clean rebuild (`rmdir /s build`, rerun). If still wrong, verify
  CMake actually picked up our changes (we are on the right
  branch).
- **Crash on `vpdpbusd` instruction**: the macro was defined but
  the running chip does not have AVX-VNNI. Should not happen on
  i7-1360p but possible if the binary is being run on a different
  older laptop. Rebuild with `-DGGML_AVX_VNNI=OFF`.
- **TG matches predicted DRAM-bound ceiling**: this is the expected
  regime for in-RAM dense models. Not a problem. Document the
  number and move on.
- **TG much slower than ceiling on small in-RAM model**: thread
  contention or cache thrash. Look at thread sweep results.
- **TG very slow on Qwen3.6-35B-A3B**: expected. The model is
  swap-bound (~20 GiB disk vs ~10 GiB available memory). `-rtr
  auto` should log DISABLE; the load should still succeed via mmap
  streaming, just at 1-3 tok/s.

### 6c. After the bench session

Single follow-up commit on this branch:

```
git checkout feature/raptor-lake-laptop
# edit RAPTOR_LAKE_LAPTOP.md with the populated tables
# edit dashboard/evidence-layer.js — update threads value, raise validation
# add bench_results/<date>_raptor_lake_baseline/* with raw logs
git add -A
git commit -m "bench: i7-1360p first laptop baseline (YYYY-MM-DD)"
git push personal feature/raptor-lake-laptop
# DO NOT push to fork remote
```

If a surprising finding emerges (e.g., winning thread count
significantly different from the architectural prediction, cache
behaviour unexpected, AVX-VNNI not helping as much as predicted),
add a settled-fact line to the auto-memory `settled-facts.md` so
future sessions know.

## 7. Stop rules

1. **Do not push to `fork` remote.** That remote backs the
   upstream PR `pr/rtr-auto-mode`. This branch is local-only.
2. **Do not merge this branch into `dev` casually.** The dashboard
   preset adds a new entry tied to specific hardware; merging
   without runtime validation could confuse future readers.
3. **Do not propose `GGML_AVX_VNNI` upstream as a separate PR yet.**
   It is a useful general addition (fills a real gap in upstream's
   CMake for Alder Lake / Raptor Lake on MSVC), but doing so
   alongside the still-open PR #1738 would dilute attention.
   Defer until #1738 lands or stalls.
4. **Do not make code-level cache tuning changes (tile sizes,
   prefetch patterns) without profiling data.** Settled fact #20:
   the fork's own `_mm_prefetch` attempts in IQK gave 0%. Repeating
   that mistake is easy.
5. **Do not assume workstation bench numbers predict laptop
   numbers.** They are anchors only.

## 8. Key facts to remember (do not re-discover)

**Laptop-specific settled facts (measured 2026-05-21):**

- **`-t 4` is the winning thread count.** Monotonic degradation from
  t=4 to t=16. HT already hurts at t=8 (-15% PP, -24% TG). Root
  cause: OpenMP barrier overhead dominates over bandwidth gains for
  9B-class GEMM block sizes. Do not sweep again unless the model
  class changes dramatically (30B+ dense).
- **VNNI repack gives +52% TG, +5% PP** on GLM-9B (rtr=0 vs rtr=2).
  TG is weight-read bottleneck → VNNI helps. PP is compute/batching
  → VNNI negligible.
- **`-ctk q8_0` fails in CPU-only builds.** Causes "failed to create
  context". Never set this flag on this machine.
- **MoE DISABLE threshold is ~14.1 GiB** (90% of total RAM 15.7 GiB),
  not 90% of available RAM. Log: `MoE model X GiB > 90% of RAM 15.7 GiB`.
- **Thermal throttle is severe.** Under sustained load (r=3 bench),
  a 14B model averages 2-3× below its r=1 number. Always use r=1
  with 30 s cooldown for meaningful benches on this chip.
- **MSVC EVEX/VEX mismatch fix** is in `iqk_config.h`. Without it,
  all models crash with STATUS_ILLEGAL_INSTRUCTION. The fix is a
  preprocessor alias; it is guarded by `_MSC_VER && __AVXVNNI__ &&
  !__AVX512VNNI__` so it does not affect GCC/Clang or workstation
  (which has AVX-512).
- **Qwen3-30B PP512 crashes** with access violation when MoE virtual
  memory prefetch is enabled. Use short prompts with disk-bound MoE.

From the repo-wide `settled-facts.md`:

- **#11**: CCD pinning on the workstation hurts. Single L3 on Raptor
  Lake is less susceptible, but the principle holds.
- **#20**: Fork's own `_mm_prefetch` gave 0%. Do not add more.
- **#22**: rtr-auto v3 validated on six model classes; laptop
  consumes it correctly via `-rtr auto`.

## 9. What to do next (decision tree)

**You are an agent reading this for the first time, you have no
specific instruction yet.**

→ The branch is fully measured and documented. Ask the human what
they want to do: run more models as they become available, use
the laptop for inference, or something else.

**The human asks "how do I run a model?"**

→ Point them to `QUICKSTART_RAPTOR_LAKE.md` (or the RU version).
Key: `-t 4 -fa 1 -rtr auto`, no `-ctk q8_0`.

**The human downloads a new model and wants to bench it.**

→ Follow bench protocol section 2 (smoke matrix). Record rtr
decision, load time, PP, TG. Update `RAPTOR_LAKE_LAPTOP.md` bench
baseline table. Commit and push to origin.

**The human says "the laptop build fails with X."**

→ Match X against section 6b of this brief. Common:
- STATUS_ILLEGAL_INSTRUCTION → MSVC EVEX fix in `iqk_config.h` is
  missing; verify branch is correct.
- "failed to create context" → remove `-ctk q8_0`.
- Crash with MoE model at PP → avoid PP512 bench for MoE > 14 GiB.

**The human says "propose GGML_AVX_VNNI upstream."**

→ This is a real opportunity. Pull `pr/rtr-auto-mode-v2` work
status first (check `gh pr view 1738`). If PR #1738 is merged or
clearly stalled, OK to draft a small separate upstream PR with
just the two CMake hunks. If PR #1738 is in active review, defer.

**The human asks about cache efficiency or profiling on the
laptop.**

→ See section 8 facts. Honest answer: we have no cache profile
data. Profiling on Raptor Lake requires Intel VTune (not AMD uProf).
Without measurements, only architectural reasoning is available.
Useful diagnostic without profiling: section 4 of
`LAPTOP_BENCH_PROTOCOL.md` (effective DRAM bandwidth from TG
divided by model bytes).

## 10. Style notes

- Project language: Russian with the human; English in repo
  artifacts (code, comments, docs, PR text).
- Avoid LLM-style markers in upstream-facing text and in repo
  artifacts: no em-dashes, arrows (→), emoji, "I'd argue",
  "happy to", excessive markdown tables. This is repo-wide
  convention, not laptop-specific.
- Russian text in user-facing dashboard descriptions is OK (we
  already have ru/en pairs in the existing presets).

## 11. Backup info

- Local branches: `dev` is the integration branch;
  `feature/raptor-lake-laptop` is this branch.
- Remote `personal` =
  `https://github.com/AndrewMoryakov/ik_llama.cpp.git` (mirror,
  not a GitHub fork).
- Remote `fork` =
  `https://github.com/AndrewMoryakov/ik_llama-pr.git` (proper
  GitHub fork, used for upstream PR `pr/rtr-auto-mode`). Never
  push laptop-branch content here.
- `origin` = `https://github.com/ikawrakow/ik_llama.cpp.git`
  (upstream). Never push to origin.
