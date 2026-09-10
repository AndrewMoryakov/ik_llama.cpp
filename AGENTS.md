> **Status note added 2026-09-08, when this file was brought into `dev`.**
>
> What follows is a snapshot of **2026-05-05**, kept for its map of
> `project_docs/`. It is **not** the current entry point: the branch model and
> the workflow live in [FORK_WORKFLOW.md](FORK_WORKFLOW.md).
>
> Superseded below:
> - the "local-only, do not push" rule for `feature/raptor-lake-laptop` - its
>   assets are now in `dev`, and the branch model says where the rest belongs;
> - the PR #1738 timing ("silence threshold ~2026-05-12") - **the PR was closed
>   on 2026-09-08**; upstream never took the feature and has since removed the
>   RTR auto files. The fork keeps its own implementation, which is the promoted
>   v2 without the environment gate;
> - the memory-directory path, which is specific to one machine;
> - any build instruction here that omits `GGML_AVX512_VNNI` and its siblings:
>   on MSVC that silently produces a build without `HAVE_FANCY_SIMD`, i.e.
>   without the IQK Zen4 kernels. See `FORK_WORKFLOW.md` gate 1.
> - the "Current Best Next Work" section below: Step0 has since made MiniMax
>   bytes per token the active direction. See the 2026-09-08 session index.
>
> **Где текущее состояние (обновлено 2026-09-10).**
>
> - `FORK_WORKFLOW.md` — модель ветвления, гейты, итог по PR в upstream;
> - `docs/sessions/2026-09-08-upstream-merge/00-INDEX.md` — результаты слияния
>   с upstream и пройденного рунбука Step0, шестнадцать документов доказательств
>   с измерениями и границами;
> - `docs/sessions/2026-09-08-upstream-merge/HANDOFF-doc-review-2026-09-10.md` —
>   ревью документации: что устарело, где точки входа ведут не туда, и что уже
>   исправлено, чтобы не делать работу дважды.
>
> Направление работ выбрано измерениями, а не предположениями: нагрузка упирается
> в объём чтения, три направления оптимизации отвергнуты прогонами. Прежде чем
> предлагать префетч по маршруту, закрепление горячих экспертов или ускорение
> вычислений, прочитайте `evidence-8` §6.
>
> Dates inside the text are left as written. Treat every status claim as of
> 2026-05-05 unless verified against live state.

# AGENTS.md

## Purpose

Machine-oriented bootstrap for future LLM agents working in this repo.

This file is not a user tutorial.

Its job is to reduce re-discovery cost and point the agent at the current source-of-truth layer quickly.

## Latest State (2026-05-05)

The auto-memory system loads `MEMORY.md` from the user's
`.claude/projects/Z--files-projects-ik-llama-proj/memory/` directory
at the start of every session. That file is the always-on entry
point. It carries the current `dev` HEAD, settled-facts pointer,
active priorities, and topic-file index. Everything below assumes
that file already loaded.

Active upstream contributor work as of 2026-05-05:

- PR #1738 (`-rtr auto`) submitted, awaiting maintainer architectural
  direction. Path A patch is preassembled on the `pr/rtr-auto-mode-v2`
  branch, ready to force-push when the maintainer picks path A or
  the silence threshold (~2026-05-12) hits.
- Issue #1740 (JSON variant of `/metrics`) posted, awaiting
  maintainer reaction. Code is not written until the maintainer
  signals interest.

For continuation of the rtr-auto thread (most active surface area
right now), use:

- `project_docs/rtr-auto/AGENT_BRIEF.md` — full bootstrap including
  what was already done, what not to do (specifically: do not push
  `pr/rtr-auto-mode-v2` to the `fork` remote without explicit
  approval), reading order across the eleven rtr-auto bundle docs,
  active threads with `gh` refresh commands.
- `project_docs/rtr-auto/INDEX.md` — navigation across the eleven
  rtr-auto bundle docs.

For broader strategy and upstream track:

- `project_docs/strategy/UPSTREAM_CONTRIBUTOR_PLAN_2026-05-04.md` —
  Tier 1/2/3 items with current status of each.
- `project_docs/strategy/POST_MERGE_BACKLOG_2026-05-02.md` — four
  follow-ups after the 2026-05-02 upstream sync. Item 3 (eval
  framework commit) is done; the other three are open.

For laptop adaptation (i7-1360p / 16 GB CPU-only profile, on branch
`feature/raptor-lake-laptop`, local-only — do not push to `fork`):

- `project_docs/hardware/AGENT_BRIEF.md` — single entry point for
  laptop work. Branch state, file map, workflow, decision tree,
  stop rules.
- `project_docs/hardware/RAPTOR_LAKE_LAPTOP.md` — hardware profile
  and tuning notes.
- `project_docs/hardware/LAPTOP_BENCH_PROTOCOL.md` — step-by-step
  procedure for the first laptop bench session, with workstation
  reference numbers populated as anchors.

## Historical First Read Order (kept for context, not current)

The 2026-02 / 2026-03 era bootstrap pointed at:

1. `project_docs/llm/PROJECT_STATE_FOR_AGENTS_2026-03-04.md`
   (and `_2026-03-06.md` for the slightly newer snapshot)
2. `project_docs/llm/SESSION_BOOTSTRAP.md`
3. `project_docs/strategy/CURRENT_HANDOFF_2026-03-01.md`
4. `project_docs/release/CURRENT_STATUS_2026-02-28.md`

These remain useful for understanding how the project got to its
current shape (Phase model 1-5, prompt-packed productization,
Tapered-RAM quant work, dashboard refactor). They are no longer the
starting point for day-to-day work, which now centers on upstream
contribution and `-rtr auto` finalization.

Topic-specific lookups (still current):

- `project_docs/benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `project_docs/benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `project_docs/models/MINIMAX_M2_5_RUNTIME.md`
- `project_docs/dashboard/ROADMAP_2026-02-28.md`

## Current Strategic Truth

The fork is currently optimized around:

1. large CPU-only MoE
2. swap-bound / out-of-RAM execution
3. Zen4-aware runtime policy
4. not just throughput, but memory behavior, locality, paging, and startup cost

Do not reduce the project goal to generic in-RAM speed.

## Current Main Families

Treat these as separate lines:

1. `Qwen3MoE`
2. `gpt-oss-20b`
3. `gpt-oss-120b`
4. `MiniMax M2.5`

Do not transfer conclusions mechanically between them.

## Current MiniMax Truth

MiniMax is a primary development line, not a side case.

Current practical baseline:

1. `rtr=off`
2. `IK_LLAMA_HOT_EXPERT_BUDGET` unset
3. larger hot-expert budgets are research-only

Important:

- old bad `rtr=auto` result was a policy bug
- that bug was fixed
- first longer controlled run rejected promoting MiniMax hot-expert default above legacy `16`

Read:

- `project_docs/benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`

## Current Best Next Work

The current mainline priority is no longer broad MiniMax policy benchmarking.

Current recommended order:

1. `gpt-oss-120b prompt-packed productization`
2. `gpt-oss-20b decode-side optimization`
3. return to `MiniMax` only with a new smarter locality hypothesis or a dedicated large benchmark window

## Do Not Re-Discover

These points are already settled enough to avoid repeating the same cycle blindly. The full numbered list (24 items as of 2026-05-05) lives in the auto-memory `settled-facts.md`; below is a representative subset:

1. `pg` must not be inferred from `tg` alone
2. `flash_attn` matters materially for mixed path on validated Zen4 profiles
3. `rtr=auto` is already a strong start for `Qwen3MoE` and `gpt-oss`
4. MiniMax hot-expert `24/32` is not a new default candidate on current evidence
5. CCD pinning hurts perf, SMT disable is catastrophic for TG (settled fact #11)
6. Forced `rtr=1` on swap-bound MoE = ~3.5 min cold-load penalty (settled fact #23)
7. rtr=on gives +15.6% PP / +5.4% TG vs rtr=off on in-RAM Zen4 (settled fact #21)
8. v2 auto-policy (available memory + tri-state) validated on 6 model classes (settled fact #22)

The full list is the source of truth. Always cross-check `settled-facts.md` before proposing experiments that look already-tested.

## MiniMax-Specific Expensive Benchmark With Good ROI

If there is time for only one expensive MiniMax pass, run only:

1. `tg32`: `rtr=off` vs `rtr=auto`
2. `pg32,4`: `rtr=off` vs `rtr=auto`
3. runtime default hot-expert budget
4. `t16 fa1 muge0 ngl0 r=1`

Purpose:

- determine whether fixed `rtr=auto` is viable for huge MiniMax

Status:

- this question is already closed on the current tree
- use this recipe only if MiniMax policy must be revalidated on a materially changed runtime

Do not spend hours first on:

1. `rtr=on`
2. wide hot-expert budget matrices
3. `SER`
4. multi-knob experiments

## Raw Data Rule

Narrative truth lives in `project_docs/`.

Raw benchmark truth lives in:

- `ik_llama.cpp/bench_results/`

If a run directory contains an old broken summary, prefer:

1. raw `.log`
2. corrected current-status / long-run note in `project_docs/benchmarks/current/`

## Dashboard Rule

Dashboard knowledge layer must follow benchmark-backed current truth.

Do not let dashboard guidance drift ahead of evidence.

Main files:

- `dashboard/dashboard.js`
- `dashboard/dashboard.html`
- `project_docs/dashboard/`

## Canonical LLM Docs

See:

- `project_docs/llm/README.md`
- `project_docs/llm/PROJECT_STATE_FOR_AGENTS_2026-03-04.md`
- `project_docs/llm/SESSION_BOOTSTRAP.md`
- `project_docs/llm/SOURCE_OF_TRUTH_MAP.md`

## Branching Rule

Current branch model:

1. `main`
- release-facing branch

2. `dev`
- default active integration branch

3. `milestone/*`
- frozen project snapshots

4. `feature/*`
- bounded implementation branches

5. `research/*`
- uncertain or hypothesis-driven experimental branches

6. `safety/*`
- mandatory temporary backup branches before specific risky operations

Practical rule:

- continue normal work from `dev`
- do not keep day-to-day development on `milestone/*`

## Safety Branch Rule

For LLM agents this is not discretionary.

Create a `safety/*` branch **before** any operation that can rewrite history, drop commits, or destroy local state.

Mandatory cases:

1. `git rebase`
2. `git reset --hard`
3. `git clean -fd` or stronger cleanup
4. force-push of a branch that already exists on a remote
5. replacing one integration line with another via reset/rebase instead of merge
6. risky upstream sync where local unpublished commits could become hard to recover mentally

Do **not** create `safety/*` for:

1. normal commits on `dev`
2. ordinary `feature/*` or `research/*` branches
3. normal merges that do not rewrite history
4. routine pushes

Naming rule:

- `safety/<reason>-YYYY-MM-DD`

Example:

- `safety/pre-rebase-2026-03-02`

Naming guideline:

- `feature/<area>-<goal>`
- `research/<area>-<hypothesis>`

Examples:

- `feature/minimax-locality`
- `feature/gptoss-decode-path`
- `research/minimax-expert-selection`
- `research/prompt-packed-qkv`
