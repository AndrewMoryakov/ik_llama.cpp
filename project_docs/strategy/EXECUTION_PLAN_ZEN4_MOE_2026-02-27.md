# Execution Plan: Zen4 MoE Performance Program (2026-02-27)

## 1) Objective
Deliver measurable performance gains for MoE inference on CPU-only Zen4 (Ryzen 9 7950X class), including cases where model size exceeds physical RAM.

Primary target:
- Improve practical throughput and stability for `tg` and especially `pg` paths.
- Keep full compatibility with existing quant families (`Q`, `IQ`, `UD-Q`) while developing new custom quantization workflows.

## 2) Why This Program Exists
Current constraints:
- RAM cost and availability pressure make hardware scaling less viable.
- Swap-bound inference is a real operating mode, not an edge case.
- TG-only optimization is insufficient; mixed path (`-pg`) behaves differently and must be tuned separately.

Expected value:
- Higher effective tokens/sec on existing hardware.
- Better predictability under RAM pressure.
- Cleaner operational playbooks (which flags to use in which scenario).

## 3) Scope (What Will Be Done)
The execution is split into four tracks.

### Track A: Benchmark Ground Truth
What:
- Build and run a unified benchmark matrix for:
  - `rtr`: `off/on/auto`
  - paths: `pp/tg/pg`
  - thread sets: `8/16/24/32`
  - classes: `in-RAM` and `swap-bound`
  - fixed runtime profile (`fa`, `muge`, etc.) per run

Why:
- Decisions must come from reproducible data, not one-off measurements.

What this gives:
- A stable decision surface for runtime defaults and presets.

Constraints:
- Full swap-bound matrix is expensive in wall-clock time and can require staged execution.

### Track B: Runtime Policy Extraction
What:
- Convert benchmark output into explicit rules:
  - when default is `rtr=auto`
  - when force `on`
  - when force `off`
- Keep separate policy rows for `tg-only` vs `pg`.

Why:
- Mixed path and TG-only can have different optimal settings.

What this gives:
- Operationally safe default behavior and clearer CLI recommendations.

Constraints:
- Policy must be versioned by commit + hardware profile.

### Track C: Engine Changes (Post-Decision)
What:
- Introduce profile separation in runtime behavior (`tg_profile`, `pg_profile`).
- Optimize mixed hot path (remove avoidable repack/copy/layout transitions).
- Improve swap-bound memory behavior (fault pressure, locality, load path stability).

Why:
- Most practical latency/throughput pain is on the mixed path and in memory pressure regimes.

What this gives:
- Real throughput improvement where users actually operate.

Constraints:
- Changes must preserve correctness and avoid regressions in non-MoE or non-swap scenarios.

### Track D: Regression Guardrail
What:
- Keep matrix script as repeatable regression suite.
- Add pass/fail thresholds for key scenarios (`tg`, `pg`, load-time).

Why:
- Prevent future changes from silently degrading performance.

What this gives:
- Sustainable iteration speed with less risk.

## 4) Backward Compatibility Impact
Compatibility target: **preserve user-facing compatibility by default**.

Expected compatibility status:
- `Q`, `IQ`, `UD-Q` support remains.
- Existing `-rtr` forms stay valid; `auto` is additive behavior.
- Existing model files remain loadable.

Potential behavior shifts:
- If `rtr auto` policy is used, runtime may choose different internals by RAM/model regime.
- This is intended optimization behavior, not API breakage.

Non-goals:
- No forced migration away from current quant families.
- No removal of legacy runtime flags in this phase.

## 5) Risk Register
1. Overfitting to a single model/workload.
- Mitigation: at least one in-RAM and one swap-bound representative, plus `tg` and `pg`.

2. Unstable conclusions from low repetition counts.
- Mitigation: decision runs at `reps >= 3`.

3. Load-time overhead and throughput trade-off uncertainty.
- Mitigation: dedicated load-probe rows included in benchmark suite.

4. Runtime profile complexity growth.
- Mitigation: codify profile presets and document decision table.

## 6) Acceptance Criteria
Program is considered successful when all are true:
1. Benchmarks:
- Reproducible matrix completed with artifacts:
  - `results.jsonl`, `results.json`, `results.csv`, `summary.md`, `run_info.json`
2. Policy:
- Written rules for `rtr off/on/auto` by class + path.
3. Engine:
- At least one mixed-path optimization merged and benchmark-verified.
4. Regression:
- Re-run suite confirms no critical regressions in target scenarios.

## 7) Operational Notes
- Report every benchmark result with:
  - commit hash
  - CPU
  - RAM
  - exact command/script parameters
- Avoid comparing runs with changed profile knobs unless explicitly labeled A/B.
