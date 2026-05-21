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
3. Reasonable defaults for the P+E hybrid core layout (recommended
   `-t 8` starting point; sweep needed to confirm).

Target models on this profile:

- Generic 7B Q4_K_M (comfortable in-RAM)
- Generic 13B Q4_K_M (comfortable, snug at high context)
- Gemma-4-E4B (small dense, comfortable)
- Gemma-4-26B-A4B (MoE 26B, 4B active — borderline at 14-15 GiB on disk)
- Qwen3.6-35B-A3B (MoE 35B, 3B active — swap-bound, `-rtr auto`
  expected to DISABLE)
- GLM-4.7-Flash (size/quant TBD by the human)

## 3. Current state (as of last commit)

Three commits on the branch:

```
5caf59653  docs: laptop bench protocol with workstation reference numbers
a5d622f66  build: add GGML_AVX_VNNI option + fix laptop scaffolding review findings
3280d53eb  feat: scaffolding for i7-1360p / 16 GB laptop CPU-only profile
```

Branched off `dev` at `b226021fc`. Pushed to `personal` remote
(`AndrewMoryakov/ik_llama.cpp`, mirror), NOT to `fork` remote
(`AndrewMoryakov/ik_llama-pr`).

What is **DONE**:

- Build script `build_raptor_lake.bat` works from any clone location
  (uses `%~dp0` with trailing-slash stripped). Sets `GGML_AVX2=ON`,
  `GGML_AVX_VNNI=ON`, `GGML_CUDA=OFF`. Builds with `-j 8`
  parallelism.
- CMake option `GGML_AVX_VNNI` declared in
  `ggml/CMakeLists.txt:93` and wired in `ggml/src/CMakeLists.txt`
  for both MSVC (adds `__AVXVNNI__` macro via
  `add_compile_definitions`) and GCC/Clang (adds `-mavxvnni`
  flag). Default `OFF`, so existing workstation and CI builds are
  unaffected. **Verified on the workstation**: clean build with
  `HAVE_FANCY_SIMD is defined` still present, no regression on
  the AVX-512 path.
- Hardware profile doc `project_docs/hardware/RAPTOR_LAKE_LAPTOP.md`
  describes the chip, expected `-rtr auto` decisions per target
  model, recommended starting flags (`-t 8 -fa 1 -rtr auto -ctk
  q8_0`), thread-sweep placeholder, bench baseline placeholder.
- Bench protocol doc `project_docs/hardware/LAPTOP_BENCH_PROTOCOL.md`
  describes the step-by-step procedure for the first laptop bench
  session. Includes a workstation reference table populated with
  three models bench'd on 2026-05-21:

  | Model                       | Size      | PP512   | TG32   |
  |-----------------------------|-----------|---------|--------|
  | Phi-4-reasoning-plus Q4_K_M | 8.43 GiB  | 110.94  | 7.90   |
  | Qwen3-30B-A3B Q4_K_M        | 17.35 GiB | 409.52  | 32.58  |
  | gpt-oss-20b MXFP4           | 11.27 GiB | 447.31  | 26.02  |

  Use these as cross-machine anchors when laptop results come in.
- Dashboard preset `laptop_raptor_lake_16gb` in
  `dashboard/evidence-layer.js` with `validation: 'research'`,
  `confidence: 'low'`, `threads: 8` placeholder. Pin the winning
  thread count after the laptop sweep.
- Bench results placeholder
  `bench_results/2026-05-20_raptor_lake_baseline/README.md` with
  empty matrix to fill in.

What is **PENDING**:

- First build on the actual laptop. We do not have access to the
  laptop from the workstation session.
- Runtime verification that AVX-VNNI 256-bit is active:
  - `llama-cli` `system_info` line shows `AVX_VNNI = 1` and
    `AVX512 = 0`.
  - `objdump -d build/bin/llama-cli.exe | grep -c vpdpbusd` returns
    > 100.
- Smoke matrix bench on the six target models.
- Thread sweep (`-t 4 / 8 / 12 / 16`) on a small reference model
  to pick the winning thread count.
- Bandwidth/compute regime diagnostic (TG at winning `-t` on 3 size
  classes, classifies bound regime).
- Populate `RAPTOR_LAKE_LAPTOP.md` tables with real numbers.
- Pin the winning `-t` in the dashboard preset.
- Optional: bump `validation` from `'research'` to `'partial'` once
  numbers exist.

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

bench_results/2026-05-20_raptor_lake_baseline/README.md
    Placeholder matrix file. After the laptop bench, capture raw
    output here and link to RAPTOR_LAKE_LAPTOP.md summary.
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

From the auto-memory `settled-facts.md`:

- **#11**: CCD pinning on the workstation hurts. Not directly
  relevant to laptop (single unified L3 on Raptor Lake), but the
  underlying principle applies — let the OS scheduler distribute
  threads.
- **#20**: Fork's own `_mm_prefetch` attempts gave 0%. Do not add
  more.
- **#22**: rtr-auto v2 validated on six model classes including
  multi-shard. The v3 logic in main `dev` extends this for the
  laptop's needs.
- New laptop-specific facts will accrue here after the first bench.

Architectural facts not yet in settled-facts:

- DDR5-5200 dual-channel on i7-1360p: ~83 GB/s theoretical, mobile
  reality 50-70 GB/s achievable. For a 14B dense Q4_K_M model
  reading the full model per token, that caps TG at ~7-8 tok/s
  (matches our workstation Phi-4 reference; workstation has
  similar DRAM ceiling for that size class).
- L3 on i7-1360p is 18 MB unified. Workstation has 64 MB
  aggregate across two CCDs. Per-layer working set for a 13B model
  (~10-12 MB for a single weight matrix) almost fits laptop L3 but
  not comfortably. Larger models suffer more from cache misses.
- E-core L2 is shared across 4 E-cores in one cluster (4 MB).
  Putting multiple inference threads on E-cores in the same
  cluster can thrash that L2. This is the main reason `-t 8`
  (P-cores plus HT) is the recommended starting point.

## 9. What to do next (decision tree)

**You are an agent reading this for the first time, you have no
specific instruction yet.**

→ Ask the human if they want to: (a) run the laptop bench now (they
have laptop access), (b) refine docs further (no laptop access), or
(c) wait until they get to the laptop. Do nothing until told.

**The human says "I am at the laptop, let us start."**

→ Walk them through `LAPTOP_BENCH_PROTOCOL.md` section by section.
Stop at each section to capture results before moving to the next.
Help interpret numbers using the ceilings in section 5.

**The human says "the laptop build fails with X."**

→ Match X against section 6b of this brief. If still unclear, ask
for exact error text plus `build\CMakeCache.txt` excerpt.

**The human says "the laptop bench numbers are populated, what
now?"**

→ Execute section 6c. Commit the populated tables, push to
`personal`. Optionally propose a settled-fact addition if
something surprising was learned.

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
