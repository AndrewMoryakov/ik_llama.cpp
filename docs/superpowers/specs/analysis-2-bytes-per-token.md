# Analysis 2 — Wall 2: Reduce Bytes/Token (MiniMax M2.7, CPU-only, ik_llama.cpp)

Expansion of **Wall 2** ("Стена 2 — Полоса RAM") in `docs/superpowers/specs/2025-moe-ssd-inference-speedup.md`. All code claims grounded at HEAD with file:line; unverifiable points marked **[UNVERIFIED]**.

## 0. Framing: bytes/token is a *residency* problem, not a linear-shave problem

Recipe ~**115 GB** vs **96 GB** RAM (minus OS/KV/compute → ~85–90 GB usable page cache) → **the model does not fit resident**; we `mmap`-page experts from the 970 (Gen3) every token.

| Path | Bandwidth | 4.9 GB/tok → t/s |
|------|-----------|------------------|
| 970 Gen3 NVMe (paged) | ~3.5 GB/s | **~1.4** ← matches observed 1.5–2 |
| DDR5 dual-channel AM5 | **measure (AIDA64/mbw)**; ~40–50 GB/s | ~8–10 |

Observed 1.5–2 t/s ≈ the SSD-bound prediction → **we are disk-bound now**, not RAM-bandwidth-bound. Therefore the dominant lever is crossing **115 GB → ≤ ~85 GB resident** (a ~14× step, not a linear bpw shave). This resolves the hot-expert tension: **prune the cold/dead tail to shrink total; keep the hot set resident at higher bpw** — complementary, not competing.

**Accounting model:** active ≈ 9.8 B params/token; with **no shared experts** almost all of it is 8 routed experts × 62 layers (attention @ hidden 3072, GQA 48q/8kv, + routers = small fixed cost). Bytes/token = `Σ (params_tensor × bpw_tensor/8)` — **compute from the real per-tensor recipe**; flat-4 (~4.9 GB) is a floor (attention kept at Q8 doubles its share).

## 1. Expert-temperature measurement (per-domain)

Verified — imatrix already counts per-expert activations. `examples/imatrix/imatrix.cpp`: stats hold `std::vector<int> counts; int ncall; int n_as` (`n_as = src0->ne[2]` = #experts); arrays sized `src1->ne[0]*n_as`; loop increments `counts[e_start+j]` **only when that expert is selected**. Never-used experts already flagged as `bad_experts`. Router `ffn_gate_inp {n_embd,n_expert}` (`llama-load-tensors.cpp:540`) → `logits [n_expert,n_tokens]` (`llama-build-context.cpp:1040`), **rows 1:1 to experts**.

**Gap (verified):** `save_imatrix` writes `values[i]/counts[i]*ncall` — it **folds counts into the floats and does not persist raw per-expert counts**. So the on-disk `.imatrix` doesn't expose temperature.

**Path:** (1) ~15-line patch to `imatrix.cpp` to dump `e.counts` to a sidecar (`{tensor,expert_idx,count,ncall}`); (2) run `llama-imatrix` over a corpus representing the user's real domains (one run/domain); (3) aggregate to per-expert hit rate `count/(ncall×tokens)`, band as hot / warm / dead (< ~0.1% over ≥100k tokens). Command: `llama-imatrix -m M2.7-<recipe>.gguf -f user_domain.txt --chunks 200 -c 512 -ngl 0 -o user_domain.imatrix`. **Honesty:** without the patch only the binary `bad_experts` (used/never) signal is obtainable.

## 2. Tiered-quant by temperature — granularity is the wall

**Hard constraint (verified): per-expert quant is NOT expressible.** Experts = **one merged 3D tensor per layer, single `ggml_type`**: `llama-load-tensors.cpp:542/544/545` `ffn_{gate,down,up}_exps {…,n_expert}`; per-expert names are only **views** (`create_tensor_as_view(..., nb[2]*x)`, L563–567) sharing storage+type. `--custom-q regex=type` (`quantize.cpp:167`) matches the **tensor name** first-hit (`llama-quantize.cpp:315–326`) → **per-layer granularity max**. Splitting the 3D tensor to tier individual experts breaks the fused `GGML_OP_MUL_MAT_ID` path → out of scope.

Verified bpw: IQ4_K 4.5 (L86), IQ4_KS 4.25 (L71), IQ3_K 3.44 (L83), IQ2_K 2.375 (L76), IQ2_KS 2.1875 (L78), IQ1_KT 1.75 (L79); `*_R4` = same bpw, CPU row-interleave repack. Role flags exist for output/token-embd/router/attn/ffn (`quantize.cpp:164–180`).

| Strategy (whole-expert band) | expert bpw | GB/tok | resident ≤~85 GB? | t/s if resident |
|---|---|---|---|---|
| Flat IQ4_K (~now) | 4.5 | ~5.1 | no (~115) | SSD ~1.4 |
| Flat IQ3_K | 3.44 | ~3.9 | close (~88) | near, risk↑ |
| Flat IQ2_K + attn/router hi-bpw | ~2.6 | ~3.0 | **yes (~67)** | **~8–10** |

**Tension (honest):** residency needs the *whole* expert pop at 2–3 bpw, degrading hot experts too — and we can't protect them within a layer. Keep attention + `ffn_gate_inp` at high bpw (tiny, quality-critical, cheap — verified expressible). Layer-tiering (later layers more compressed) is the only temperature-ish knob available and is **[UNVERIFIED]** for M2.7. **Lean on §3 pruning** for the residency step, since it *can* target individual cold experts.

## 3. Structured pruning of near-dead experts — the real lever

**Feasible & confirmed.** Router maps 1:1 to expert slots; experts are contiguous dim-2 slots. Offline GGUF rewrite, per layer: (1) **slice dim-2** of `ffn_{gate,up,down}_exps` to kept indices; (2) **drop matching rows of** `ffn_gate_inp {n_embd,n_expert}` (+ `ffn_gate_inp_b` if present — **[UNVERIFIED]** for M2.7); (3) **update** `minimax-m2.expert_count` (`gguf-py/gguf/constants.py:88` `EXPERT_COUNT="{arch}.expert_count"`). Tensor names in `tensor_mapping.py` (`FFN_{UP,GATE,DOWN}_EXP`, "merged"). Must keep `n_kept ≥ n_expert_used = 8`. **Constraint:** GGUF `expert_count` is single-valued → **[UNVERIFIED]** loader tolerance of per-layer-varying counts; in practice use a **uniform `n_kept`** across layers.

| Keep | model size | resident? | t/s |
|------|-----------|-----------|-----|
| 256 | ~115 GB | no | ~1.5 |
| 192 (−25%) | ~87 GB | borderline | partial→~5 |
| **176 (−31%)** | **~80 GB** | **yes** | **~8–10** |
| 160 (−37%) | ~73 GB | yes+headroom | ~8–10 |

Pruning ~30% of the never-hot tail reaches residency **while preserving hot experts at full bpw** — opposite trade-off from blunt tiering. **Risks:** an expert dead on the imatrix corpus but live on a real prompt → catastrophic mis-route; prune only hit-rate < ε over a large multi-domain corpus, keep a margin, validate per §5. New offline gguf-py tooling required (primitives exist); **[UNVERIFIED]** that a sliced merged tensor re-quantizes/loads — prototype on a tiny MoE first.

## 4. `-ser` — currently inert; real mechanism

**Verified inert at HEAD.** Parsed `common.cpp:1446` → `min_experts`/`thresh_experts`, copied to cparams (`common.cpp:3699`, `llama.cpp:6620`), logged `llama.cpp:6728`. But `llama-build-context.cpp:1089–1091`:
```cpp
//selected_experts = ggml_top_k_thresh(ctx, selection_probs, n_expert_used,
//        lctx.cparams.min_experts, lctx.cparams.thresh_experts);
selected_experts = ggml_top_k(ctx, selection_probs, n_expert_used);
```
`ggml_top_k_thresh` has **zero active callers repo-wide** (decl `ggml.h:2398`, def `ggml.c:10127`, one commented line) → inert for **all** archs. M2 does route here: `build_minimaxm2()` (`llama-build-context.cpp:2443`) → `llm_build_moe_ffn` (L1012, contains L1089).

**Mechanism (from `ggml.c:10127`):** threshold-based & **dynamic, not fixed 8→7/6** — `ggml_argsort_thresh(a, min_entries, thresh)` keeps experts above `thresh` with a `min_experts` floor → variable experts/token. Fewer selected → `ggml_get_rows`/`mul_mat_id` gather fewer slabs → fewer bytes.

| avg experts/tok | bytes vs top-8 |
|---|---|
| 8.0 | 1.00× |
| 7.0 | 0.875× (−12.5%) |
| 6.0 | 0.75× (**−25%**) |

Payoff = f(router peakedness) = exactly what §1 measures. **Activate:** uncomment `llama-build-context.cpp:1089–1090`, rebuild, sweep `-ser 6,0.05 … 7,0.02`, validate §5. Saves on the *resident-bandwidth* ceiling; stacks with, doesn't replace, pruning.

## 5. Perplexity / quality validation (on REAL tasks)

Baseline on current recipe: `llama-perplexity -m M2.7-baseline.gguf -f user_realtask_holdout.txt -c 512 -ngl 0` → `P0` (use **domain holdout**, not wikitext). Per candidate, same command; gate: **accept** ΔPPL ≤ +2%; **review** +2–5% (only if it crosses into residency + task spot-checks pass); **reject** > +5% or any qualitative real-task regression. **Pruning-specific:** via the §1 counts patch, require pruned-expert hit-rate on holdout **< 0.1%** (average PPL hides rare catastrophic routes). **`-ser`:** plot PPL vs measured avg-experts/token, pick the knee within +2%. **Order:** measure (§1) → prune tail (§3) → revalidate → `-ser` (§4) → layer-tier (§2) only if still not resident; re-gate after **each** step.

## Honesty ledger (not verifiable in code)
- Exact `n_ff_exp`/intermediate size of M2.7 → GB/token figures are recipe-scaled approximations; compute from real GGUF tensor sizes.
- DDR5 bandwidth → must measure (AIDA64/mbw).
- Router bias (`ffn_gate_inp_b`) / shared experts on M2.7 → check `llama-load-tensors.cpp:4099` (M2 branch).
- Loader tolerance of per-layer-varying `expert_count` → likely forces uniform prune budget.
- That a sliced/re-quantized merged-expert tensor loads cleanly → prototype required.
- Empirical PPL of any tier/prune/`-ser` → unknowable without running §5.

## 5-line summary

1. We are **SSD-bound** (4.9 GB/tok ÷ 3.5 GB/s ≈ 1.4 t/s ≈ observed); the real lever is making the hot working set **resident** (115 GB → ≤ ~85 GB) — a ~14× step, not a linear bpw shave.
2. **`-ser` is inert at HEAD** — parsed/logged but the `ggml_top_k_thresh` call is commented out (`llama-build-context.cpp:1089`, zero active callers repo-wide); it's threshold-based/dynamic, and activating it is a one-line uncomment + rebuild.
3. **Per-expert tiered quant is NOT expressible** — experts are one merged 3D tensor per layer with a single type; `--custom-q` granularity is per-*layer*, so hot experts can't be selectively protected via quant.
4. **Structured pruning of the never-hot tail is the primary lever**: slice dim-2 of `ffn_*_exps` + drop `ffn_gate_inp` rows + update `minimax-m2.expert_count`; pruning ~30% (256→~176) reaches ~80 GB → resident → ~8–10 t/s, preserving hot experts at full bpw.
5. Measure temperature via a small `imatrix.cpp` per-expert-`counts` dump on the user's real corpus, then gate every change with `llama-perplexity` on a **domain holdout** (+2% accept / +5% reject) plus a pruned-expert routing-coverage check (<0.1% hit-rate).
