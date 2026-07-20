# Analysis 2 — Wall 2: Reduce Bytes/Token (MiniMax M2.7, CPU-only, ik_llama.cpp)

Expansion of **Wall 2** in `2025-moe-ssd-inference-speedup.md`. Code-path
claims were checked against the tree; hardware, residency, quality and
throughput remain hypotheses until the target MiniMax Step0 run.

## 0. Framing: bytes/token is a *residency* problem, not a linear-shave problem

The ~115 GB artifact cannot be wholly resident together with OS, KV and runtime
allocations in 96 GB RAM. This creates pressure, but does not prove physical SSD
bytes/token or the bottleneck.

| Scenario input | Illustrative value | Status |
|---|---:|---|
| Sequential SSD ceiling | ~3.5 GB/s | device spec, not mmap-fault measurement |
| Estimated active weights | ~4.9 GB/token | logical recipe estimate; compute from GGUF |
| DDR5 bandwidth | ~40–50 GB/s | estimate; measure on target |

Unit correction: `4.9/3.5 = 1.4 s/token = 0.71 t/s`, not 1.4 t/s.
Therefore the observed 1.5–2 t/s does **not** prove disk-bound behavior. Step0
must distinguish SSD/page-fault, RAM-bandwidth and mixed regimes. Crossing a
measured residency cliff may be nonlinear, but neither the cliff nor its speedup
is known yet.

**Accounting model:** active ≈ 9.8 B params/token; with **no shared experts** almost all of it is 8 routed experts × 62 layers (attention @ hidden 3072, GQA 48q/8kv, + routers = small fixed cost). Bytes/token = `Σ (params_tensor × bpw_tensor/8)` — **compute from the real per-tensor recipe**; flat-4 (~4.9 GB) is a floor (attention kept at Q8 doubles its share).

## 1. Expert-temperature measurement (per-domain)

Verified — imatrix already counts per-expert activations. `examples/imatrix/imatrix.cpp`: stats hold `std::vector<int> counts; int ncall; int n_as` (`n_as = src0->ne[2]` = #experts); arrays sized `src1->ne[0]*n_as`; loop increments `counts[e_start+j]` **only when that expert is selected**. Never-used experts already flagged as `bad_experts`. Router `ffn_gate_inp {n_embd,n_expert}` (`llama-load-tensors.cpp:540`) → `logits [n_expert,n_tokens]` (`llama-build-context.cpp:1040`), **rows 1:1 to experts**.

**Gap (verified):** `save_imatrix` writes `values[i]/counts[i]*ncall` — it **folds counts into the floats and does not persist raw per-expert counts**. So the on-disk `.imatrix` doesn't expose temperature.

**Path:** add a sidecar with `{tensor/layer, expert_idx, selected_count,
total_token_opportunities}` and optional scores/logits. The denominator is the
sum of token opportunities observed for that tensor, **not** `ncall×tokens`.
Keep calibration and holdout separate by documents/sessions. Counts nominate
candidates; safety is evaluated for the complete removal mask, not by an
independent per-expert threshold. Command: `llama-imatrix -m
M2.7-<recipe>.gguf -f user_domain.txt --chunks 200 -c 512 -ngl 0 -o
user_domain.imatrix`.

## 2. Tiered-quant by temperature — granularity is the wall

**Hard constraint (verified): per-expert quant is NOT expressible.** Experts = **one merged 3D tensor per layer, single `ggml_type`**: `llama-load-tensors.cpp:542/544/545` `ffn_{gate,down,up}_exps {…,n_expert}`; per-expert names are only **views** (`create_tensor_as_view(..., nb[2]*x)`, L563–567) sharing storage+type. `--custom-q regex=type` (`quantize.cpp:167`) matches the **tensor name** first-hit (`llama-quantize.cpp:315–326`) → **per-layer granularity max**. Splitting the 3D tensor to tier individual experts breaks the fused `GGML_OP_MUL_MAT_ID` path → out of scope.

Verified bpw: IQ4_K 4.5 (L86), IQ4_KS 4.25 (L71), IQ3_K 3.44 (L83), IQ2_K 2.375 (L76), IQ2_KS 2.1875 (L78), IQ1_KT 1.75 (L79); `*_R4` = same bpw, CPU row-interleave repack. Role flags exist for output/token-embd/router/attn/ffn (`quantize.cpp:164–180`).

| Strategy | expert bpw | estimated logical GB/tok | residency candidate | throughput |
|---|---|---|---|---|
| Flat IQ4_K (~now) | 4.5 | ~5.1 | no (~115 GB) | measure |
| Flat IQ3_K | 3.44 | ~3.9 | borderline (~88 GB) | measure |
| Flat IQ2_K + attn/router hi-bpw | ~2.6 | ~3.0 | plausible (~67 GB) | measure |

Per-expert temperature cannot drive quantization while experts remain one 3D
tensor. The available knob is sensitivity-guided per-layer/per-tensor quant:
sweep a layer or group by one quant step, measure ΔNLL/logit divergence and
kernel t/s, then optimize bytes saved versus quality loss. Do not assume later
layers are automatically less sensitive, and quantize candidates from a
high-precision source rather than requantizing an already lossy GGUF.

## 3. Structured pruning — high-upside artifact experiment

**Mechanically plausible, not end-to-end confirmed.** Per layer choose a retained
set with common cardinality `n_kept`; slice dim-2 of
`ffn_{gate,up,down}_exps`, the matching expert dimension of `ffn_gate_inp`, and
the required MiniMax `ffn_exp_probs_b`. Update `minimax-m2.expert_count`.
Retained IDs may differ by layer, but the current global metadata requires the
same count. Prototype quantized slicing/re-quantization, remapping and loader
compatibility on a small MoE before treating the artifact rewrite as proven.

| Keep | recipe-scaled model size | residency hypothesis | throughput |
|------|-----------|-----------|-----|
| 256 | ~115 GB | no | user-observed baseline 1.5–2 |
| 224 (−12.5%) | recompute from GGUF | likely still paging | measure |
| 208 (−18.8%) | recompute from GGUF | test for cliff | measure |
| 192 (−25%) | ~87 GB | borderline | measure |
| 176 (−31%) | ~80 GB | candidate; verify OS/KV headroom | measure |

Select a complete mask on calibration data and evaluate it on an independent
holdout/critical set. Report aggregate token-layer intersections with original
top-8, removed normalized routing mass, replacement margins and per-domain/layer
tails. A separate `<0.1%` rule for every expert is unsafe because risks compound.
Once any removed expert intersects the selected set, only a full masked-runtime
or rewritten-model run captures downstream hidden-state and routing changes.

## 4. `-ser` — currently inert; real mechanism

**Verified inert at HEAD.** Parsed at `common/common.cpp:1446–1452`, copied
through `common/common.cpp:3699–3700` and `src/llama.cpp:6585–6586`, and logged
at `src/llama.cpp:6693`. The live MiniMax path calls the common MoE builder from
`src/graphs/build_minimaxm2.cpp:241–251`.
```cpp
//selected_experts = ggml_top_k_thresh(ctx, selection_probs, n_expert_used,
//        lctx.cparams.min_experts, lctx.cparams.thresh_experts);
selected_experts = ggml_top_k(ctx, selection_probs, n_expert_used);
```
`ggml_top_k_thresh` has **zero active callers repo-wide** (decl `ggml.h:2398`, def `ggml.c:10127`, one commented line) → inert for **all** archs. M2 does route here: `build_minimaxm2()` (`llama-build-context.cpp:2443`) → `llm_build_moe_ffn` (L1012, contains L1089).

**Mechanism:** threshold is relative to the maximum selection probability. The
first `min_entries` survive; later entries below `max_value*thresh` become `-1`
in the fixed-width top-k result, and the CPU MoE path skips/zeros those slots.
This reduces the logical selected-expert fraction; physical I/O must be measured.

| avg active experts/token | logical selected-expert fraction vs top-8 |
|---|---|
| 8.0 | 1.00× |
| 7.0 | 0.875× (−12.5%) |
| 6.0 | 0.75× (**−25%**) |

Do **not** reactivate SER as an unconditional one-line uncomment. Preserve the
fused top-k path when SER is off; validate parameter ranges, `-1` IDs, zeroed
weights, normalization/no-NaN and identical baseline logits. Benchmark threshold
sort/fusion overhead. Compare SER with fixed top-k at the same measured average
experts/token and log the full expert-count distribution plus removed mass.

## 5. Perplexity / quality validation (on REAL tasks)

Use disjoint calibration and domain holdout sets. Report per-domain NLL/PPL with
confidence intervals, code/math/tool/JSON task success, multilingual and
long-context slices, lost routing mass, gap `k/k+1`, logit-KL and top-1 token
flips. The old +2/+5% PPL thresholds are provisional heuristics, never the sole
gate. Re-run physical bytes/token, RSS, t/s and routing trace after every
candidate. Order: Step0 → fixed top-k 8/7/6 → routing instrumentation → safe SER
experiment → staged full pruning artifacts → sensitivity quant if needed.

## Status / remaining uncertainties
- Exact `n_ff_exp`/intermediate size of M2.7 → GB/token figures are recipe-scaled approximations; compute from real GGUF tensor sizes.
- DDR5 bandwidth → must measure (AIDA64/mbw).
- MiniMax requires `ffn_exp_probs_b`, which pruning must remap; there is no
  shared-expert branch to rewrite.
- Current metadata/loader requires one global expert cardinality; retained IDs
  may differ per layer, cardinality may not.
- That a sliced/re-quantized merged-expert tensor loads cleanly → prototype required.
- Empirical PPL of any tier/prune/`-ser` → unknowable without running §5.

## 5-line summary

1. The 115/96 GB mismatch makes paging plausible, not proven; Step0 must identify SSD-, RAM- or mixed-bound behavior.
2. **`-ser` is inert at HEAD** and safe reactivation needs gating, correctness tests, observability and benchmarking—not a blind uncomment.
3. **Per-expert tiered quant is NOT expressible** — experts are one merged 3D tensor per layer with a single type; `--custom-q` granularity is per-*layer*, so hot experts can't be selectively protected via quant.
4. Task-specific pruning is a high-upside, high-risk staged experiment; it must also slice `ffn_exp_probs_b` and validate a complete rewritten artifact.
5. Gate candidates with aggregate routing-tail metrics, domain task quality and real physical I/O/residency measurements; PPL alone is insufficient.
