# Current State Validation - 2026-02-27

## Context
- Repo: `ik_llama.cpp`
- Build commit: `1ee50255a`
- Host: Ryzen 9 7950X, 96 GB RAM, Windows
- Benchmark script: `ik_llama.cpp/scripts/bench-matrix-mixed.ps1`

Raw benchmark runs:
- `../../../ik_llama.cpp/bench_results/2026-02-27_1831` (in-RAM matrix, `reps=3`)
- `../../../ik_llama.cpp/bench_results/2026-02-27_1856` (swap-bound matrix, `reps=1`)

## What Was Executed

### A) In-RAM matrix (`2026-02-27_1831`)
- Models:
  - `Qwen3-30B-A3B-Q4_K_M`
  - `gpt-oss-20b-MXFP4`
- Threads: `8/16/24/32`
- Scenarios: `pp512`, `tg128`, `pg512,128`
- `rtr`: `off/on/auto`
- Fixed runtime profile: `fa=1`, `muge=0`, `ngl=0`
- Repetitions: `r=3`
- Load probe: enabled

### B) Swap-bound matrix (`2026-02-27_1856`)
- Model:
  - `gpt-oss-120b-MXFP4-00001-of-00002`
- Threads: `8/16`
- Scenarios: `tg128`, `pg512,128`
- `rtr`: `off/on/auto`
- Fixed runtime profile: `fa=1`, `muge=0`, `ngl=0`
- Repetitions: `r=1` (time-cost constrained)
- Load probe: enabled

## Key Results

### In-RAM aggregate medians (`reps=3`)
- `pp512`: `auto` best (median `328.14 t/s`), `on` very close (`323.98`), `off` lower (`278.65`)
- `tg128`: `on` best (`25.64 t/s`), `auto` practically tied (`25.62`), `off` lower (`23.53`)
- `pg512,128`: `auto` best (`101.89 t/s`), `on` close (`100.19`), `off` lower (`85.26`)

### Swap-bound aggregate medians (`reps=1`, indicative)
- `tg128`: `auto` best (`14.84 t/s`), `on` near (`14.81`), `off` much lower (`9.43`)
- `pg512,128`: `auto` best (`55.27 t/s`), `on` near (`54.76`), `off` lower (`46.97`)

### Load probe (wall time)
- In-RAM:
  - Qwen: `off 1.75s`, `on 3.77s`, `auto 3.96s`
  - gpt-oss-20b: `off 1.80s`, `on 1.90s`, `auto 2.11s`
- Swap-bound (120b):
  - `off 242.70s`, `on 452.47s`, `auto 457.70s`

Interpretation:
- Throughput winner in current runs is generally `auto` (or tied with `on`).
- `auto/on` carry measurable load-time cost versus `off`, especially on swap-bound 120b.

## Follow-up Mixed-Path Investigation - 2026-02-28

Additional targeted measurements were run after the matrix:

- Trace artifacts:
  - `../../../ik_llama.cpp/bench_results/pg_trace_qwen3_2026-02-28.log`
  - `../../../ik_llama.cpp/bench_results/pg_trace_gptoss20b_2026-02-28.log`
  - `../../../ik_llama.cpp/bench_results/pg_trace_qwen3_fa0_2026-02-28.log`
  - `../../../ik_llama.cpp/bench_results/pg_trace_gptoss20b_fa0_2026-02-28.log`
- Engineering note:
  - `../development/MIXED_PATH_STEP3_ATTENTION_TRACE_2026-02-28.md`

Key new findings:

1. Mixed-path transition overhead is not the main problem.
- `build/alloc/reset/input` costs are small relative to `compute`.

2. Current `pg` sensitivity is attention-side, not structural MoE-side.
- With `-fa 1`, prompt and first-decode graph shapes stay very close.
- MoE node counts remain effectively constant between phases.

3. `-fa 1` is materially important for `pg512,128` on this host:
- `Qwen3-30B-A3B-Q4_K_M`: about `94.27 -> 103.38 t/s` with `-fa 0 -> 1`
- `gpt-oss-20b-MXFP4`: about `84.40 -> 88.89 t/s` with `-fa 0 -> 1`

4. Disabling flash attention increases attention-side graph work:
- `Qwen3`: `mul_mat 241 -> 337`
- `gpt-oss-20b`: `mul_mat 121 -> 169`
- MoE fused-up-gate counts do not change accordingly

Practical consequence:
- for current Zen4 mixed-path guidance, `-fa 1` should be treated as part of the default profile, not as a secondary toggle
- the next engine optimization target is prompt-side attention path, not scheduler reset or MoE branch rewrites

## Experimental Prompt-Packed QKV - 2026-02-28

Engineering note:
- `../development/MIXED_PATH_STEP6_PROMPT_PACKED_QKV_2026-02-28.md`

Status:
- implemented as experimental env-gated path: `IK_LLAMA_PROMPT_PACKED_QKV=1`
- split-QKV prompt path only
- decode path unchanged

Key structural effect:
- `Qwen` prompt `mul_mat`: `241 -> 145`
- `gpt-oss-20b` prompt `mul_mat`: `121 -> 73`

Stable `r=3` results:
- `Qwen pp512`: `310.28 -> 315.60 t/s` (`+1.71%`)
- `Qwen pg512,128`: `103.63 -> 105.16 t/s` (`+1.47%`)
- `gpt-oss-20b pp512`: `284.17 -> 282.78 t/s` (`-0.49%`, noisy)
- `gpt-oss-20b pg512,128`: `88.73 -> 89.20 t/s` (`+0.53%`)

Important downside:
- large load-time penalty from runtime packing
- smoke measurements:
  - `Qwen`: `9.60s -> 17.34s`
  - `gpt-oss-20b`: `8.96s -> 12.77s`

Current interpretation:
- concept validated
- not ready as default runtime policy
- worth treating as experimental evidence, not production recommendation

## Prompt-Packed QKV Load Optimization - 2026-02-28

Engineering note:
- `../development/MIXED_PATH_STEP7_PROMPT_PACKED_QKV_LOAD_OPT_2026-02-28.md`

What changed:
- runtime packed-QKV quantization was parallelized across row chunks

What was confirmed:
- Step 6 startup cost was dominated by quantization, not dequantization
- on `Qwen`, traced quantization time dropped from about `7.7s` total to about `1.18s`

Updated load-time picture:
- `Qwen`: `9.60s -> 10.52s` (`+9.6%`)
- `gpt-oss-20b`: `8.96s -> 9.39s` (`+4.8%`)

Updated stable `pg512,128` `r=3` results:
- `Qwen`: `103.63 -> 104.57 t/s` (`+0.90%`)
- `gpt-oss-20b`: `88.73 -> 88.94 t/s` (`+0.23%`)

Interpretation:
- the large startup objection from Step 6 was mostly fixed
- however, the throughput gain remains modest
- this is now a technically credible experimental path, but still not a default recommendation

## Partial Prompt-Packed QKV - 2026-02-28

Engineering note:
- `../development/MIXED_PATH_STEP8_PARTIAL_PACKING_2026-02-28.md`

What changed:
- the experimental prompt-packed path now supports layer-range selection via:
  - `IK_LLAMA_PROMPT_PACKED_QKV=1`
  - `IK_LLAMA_PROMPT_PACKED_QKV_RANGE=start:end`

Current validated `pg512,128` `r=3` results:
- `Qwen`
  - base: `103.63 t/s`
  - full packed: `104.57 t/s`
  - first half only (`0:24`): `104.62 t/s`
  - second half only (`24:48`): `103.39 t/s`
- `gpt-oss-20b`
  - base: `88.73 t/s`
  - full packed: `88.94 t/s`
  - first half only (`0:12`): `88.59 t/s`
  - second half only (`12:24`): `89.05 t/s`

Effective model-size impact:
- `Qwen`
  - base: `17.35 GiB`
  - half-range packed: `17.60 GiB`
  - full packed: `17.84 GiB`
- `gpt-oss-20b`
  - base: `11.27 GiB`
  - half-range packed: `11.44 GiB`
  - full packed: `11.62 GiB`

Smoke wall-clock impact:
- `Qwen`
  - base: about `15.97 s`
  - half-range packed: about `16.48-16.69 s`
  - full packed: about `17.26 s`
- `gpt-oss-20b`
  - base: about `16.98 s`
  - half-range packed: about `17.06-17.07 s`
  - full packed: about `17.24 s`

Interpretation:
- partial packing can match or slightly beat full packing with lower RAM overhead
- the useful half depends on architecture:
  - current `Qwen`: front half helps
  - current `gpt-oss-20b`: back half helps
- therefore the correct next direction is selective packing policy, not full-packing default policy

## Packed-QKV Preset Policy - 2026-02-28

Engineering note:
- `../development/MIXED_PATH_STEP9_PACKED_QKV_PRESET_POLICY_2026-02-28.md`

What changed:
- the experimental path now supports:
  - `IK_LLAMA_PROMPT_PACKED_QKV_PRESET=auto|full|front-half|back-half`
- precedence:
  - explicit `IK_LLAMA_PROMPT_PACKED_QKV_RANGE` overrides preset
  - absent range + absent preset keeps old full-range behavior

Current `auto` mapping:
- `Qwen3MoE` -> front half
- `OpenAI MoE` -> back half

Smoke validation:
- `Qwen auto`: `104.70 t/s`
- `gpt-oss-20b auto`: `88.67 t/s`
- `Qwen auto + explicit range 24:48`: `103.68 t/s`

Interpretation:
- the preset layer is working as intended for currently validated architectures
- explicit range still wins when the user wants a manual override
- this is the first architecture-aware experimental policy above the raw packed-QKV mechanism

## Static Layer Scoring - 2026-02-28

Engineering note:
- `../development/MIXED_PATH_STEP10_STATIC_LAYER_SCORING_2026-02-28.md`

What changed:
- added prompt-path per-layer structural trace via:
  - `IK_LLAMA_LAYER_SCORE_TRACE=1`

What was confirmed:
- inside each validated model, the base split-QKV layers are structurally very uniform
- `Qwen` packed layers reduce QKV-stage complexity in the expected way:
  - `qkv_mul_mat: 3 -> 1`
  - total layer attention subgraph also shrinks
- `gpt-oss-20b` packed layers also reduce QKV-stage `mul_mat`, but the whole attention layer does not simplify the same way

Main implication:
- static structure is not enough to explain why current best ranges are:
  - `Qwen`: front half
  - `gpt-oss-20b`: back half
- therefore the next research step should be execution-side per-layer profiling, not more static heuristics

## Execution-Side Layer Profiling - 2026-02-28

Engineering note:
- `../development/MIXED_PATH_STEP11_EXEC_LAYER_PROFILING_2026-02-28.md`

What changed:
- added coarse execution-side prompt attention profiling via:
  - `IK_LLAMA_EXEC_LAYER_TRACE=1`

Prompt-only profiling (`pp512`) confirms:

- `Qwen` packed front-half reduces runtime where it is applied
- `gpt-oss-20b` behaves less locally: the packed back-half result is not explained by a simple "only packed layers get cheaper" rule

Main implication:
- runtime behavior now clearly matters more than static graph shape alone
- the next optimization direction should focus on execution locality / memory behavior, not just structural graph reduction or preset-table growth

## Prompt Packed-QKV Arena - 2026-02-28

Engineering note:
- `../development/MIXED_PATH_STEP12_PROMPT_PACKED_ARENA_2026-02-28.md`

What changed:
- the experimental prompt packed-QKV path now places packed prompt weights in a contiguous shared arena instead of one backend buffer per layer
- locality trace now logs actual tensor data addresses and packed tensor offsets inside the arena

What was confirmed:
- packed prompt tensors are now contiguous:
  - `packed_gap=0` between consecutive packed layers on both validated models
- prompt-side per-layer runtime improved versus the pre-arena packed path

Same-build `pg512,128`, `r=3` A/B:
- `Qwen3-30B-A3B-Q4_K_M`
  - base: `104.40 t/s`
  - packed auto + arena: `104.16 t/s`
- `gpt-oss-20b-MXFP4`
  - base: `88.97 t/s`
  - packed auto + arena: `88.70 t/s`

Interpretation:
- allocator/locality cleanup is real and measurable on prompt-side traces
- but this by itself does not improve end-to-end mixed-path throughput
- therefore the next optimization phase should move above allocator-level tuning and focus on where `pg` absorbs the saved prompt-side time

## PG Decode Window Trace - 2026-02-28

Engineering note:
- `../development/MIXED_PATH_STEP13_PG_DECODE_WINDOW_TRACE_2026-02-28.md`

What changed:
- `IK_LLAMA_PG_TRACE` can now trace the first `N` decode calls after prompt via:
  - `IK_LLAMA_PG_TRACE_DECODE_WINDOW=<n>`

Window-8 result:
- `Qwen`
  - early decode window is slightly better or flat with packed+arena
  - no visible collapse after prompt
- `gpt-oss-20b`
  - early decode window is also essentially flat
  - no visible post-prompt regression in the first several decode tokens

Interpretation:
- current prompt-side savings are not being lost at the prompt boundary or in the first few decode steps
- therefore the mixed-path metric is either:
  - dominated by the larger decode tail
  - or the prompt-side gain is simply too small to move stable end-to-end `pg`

This narrows the next phase:
- quantify prompt-share vs decode-share in `pg512,128`
- then decide whether the next optimization cycle should stay on prompt-path or switch to decode-side work

## Policy Draft (Current Evidence)
1. In-RAM default:
- Use `rtr=auto` for mixed (`pg`) and prompt-heavy (`pp`) profiles.
- `tg` can use `on` or `auto` (difference is minor).

2. Swap-bound default:
- Throughput favors `auto`/`on` over `off` in this 120b sample.
- If startup latency is critical, `off` may still be preferable due to much shorter load probe.

3. Mixed path:
- Keep separate tuning policy for `pg`; do not infer from TG-only numbers.

## Limits Of Current Evidence
1. Swap-bound run uses `r=1` due high wall-clock cost.
2. Swap-bound class currently represented by `gpt-oss-120b`; MiniMax artifact not found locally.
3. Load probe is wall-time oriented and should be rechecked in multi-run mode for stricter confidence intervals.

## Next Required Runs
1. Swap-bound reliability run:
- same matrix subset with `r>=2` for `tg/pg` at least on `t=16`.

2. Thread scaling extension for swap-bound:
- add `t=24` if runtime budget allows.

3. Engine A/B after mixed-path optimization:
- rerun `pg512,128` matrix first, then full sanity (`pp/tg/pg`).
