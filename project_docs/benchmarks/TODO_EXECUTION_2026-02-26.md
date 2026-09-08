# Benchmark And Optimization TODO (2026-02-26)

## Goal
Build a reproducible benchmark pipeline for Zen4 MoE that covers:
- `rtr`: `off/on/auto`
- paths: `pp/tg/pg`
- classes: `in-RAM` and `swap-bound`
- load-time overhead check for `rtr auto`

## Phase 1: Benchmark Pipeline
- [ ] Run unified matrix benchmark script (`bench-matrix-mixed.ps1`) in smoke mode.
- [ ] Validate artifact set: `results.jsonl`, `results.json`, `results.csv`, `summary.md`, `run_info.json`.
- [ ] Run full matrix with fixed repetitions (`r >= 3`) and fixed runtime profile.
- [ ] Confirm resume/restart behavior after interruption.

## Phase 2: Decision Extraction
- [ ] Determine best `rtr` mode per class (`in-RAM` vs `swap-bound`) for each path (`pp/tg/pg`).
- [ ] Quantify `rtr auto` load-time overhead vs `rtr off/on`.
- [ ] Produce explicit policy table:
  - default mode
  - override conditions
  - known bad combinations

## Phase 3: Engine Work After Benchmarks
- [ ] Introduce separate runtime presets for `tg-only` and `mixed (pg)`.
- [ ] Prioritize mixed-path hot spots in code path (`prompt+gen`) instead of TG-only tuning.
- [ ] Audit extra repacks/copies in MoE hot path and remove avoidable transitions.
- [ ] Tune CPU/NUMA thread placement with MoE-specific execution profile on Zen4.
- [ ] Add regression benchmark gate for `pp/tg/pg` + `rtr off/on/auto`.

## Deliverables
- [ ] Benchmark report with exact run date/commit/hardware.
- [ ] Final recommendation doc for CLI defaults and profile recipes.
- [ ] Changelog-style record of engine changes justified by measured deltas.
