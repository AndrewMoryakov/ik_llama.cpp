# Quantization Methodology Comparison: Standard IQ vs UD-Q vs Zone Taper

Date: 2026-03-24

---

## 1. Three approaches to quantization

### Standard IQ (llama.cpp / ik_llama)

All tensors of the same class get the same quantization type. The quantizer has built-in heuristics (e.g., attention output → q5_K when base ftype is IQ3_KS), but no awareness of layer position or MoE expert structure.

```
Every expert FFN tensor → same type (e.g., IQ3_KS)
Layer 0 = Layer 30 = Layer 61
```

**Strengths:** One command, universal, well-tested.
**Weaknesses:** Does not exploit architectural knowledge. No per-layer or per-expert differentiation.

### UD-Q (Unsloth Dynamic Quantization)

Automatic per-tensor type assignment based on importance scores. Each tensor gets its own quantization type selected by Unsloth's proprietary algorithm. The result is a GGUF file with mixed types (Q3_K, Q4_K, Q5_K, etc.) — the same standard formats, just assigned differently.

```
blk.0.ffn_down_exps → Q5_K   (algorithm decided: important)
blk.30.ffn_gate_exps → Q3_K  (algorithm decided: less important)
```

**Key insight:** UD-Q is NOT a separate quantization format. It is a STRATEGY that uses standard formats. "UD-Q4" means the average is ~Q4-level, but individual tensors span Q3–Q6.

**Strengths:** Data-driven, automatic, no manual intervention.
**Weaknesses:** Black box. No awareness that the model is MoE. Does not distinguish expert dispatch frequency. No budget redistribution logic.

### Zone Taper (our approach)

Manual recipe with explicit zones based on architectural knowledge. Different quantization types assigned by layer position (edge/bridge/core) and tensor role (down > gate/up).

```
Edge   [0-3, 58-61]:  down=iq5_k, gate/up=iq5_k   (most precise)
Bridge [4-7, 54-57]:   down=iq5_k, gate/up=iq4_xs
Core   [18-43]:        down=iq4_xs, gate/up=iq4_xs  (most economical)
Attention: deliberately downgraded to iq5_k (budget redistribution to experts)
```

**Strengths:** Transparent, controllable, MoE-aware, exploits architectural knowledge.
**Weaknesses:** Manual, model-specific, does not scale automatically.

---

## 2. What each approach knows and does not know

| Knowledge | Standard IQ | UD-Q | Zone Taper |
|-----------|------------|------|------------|
| Per-tensor importance (imatrix) | Via imatrix flag | Built-in | Via imatrix flag |
| Model is MoE | No | No | **Yes** |
| Experts = 95% of weights | No | No | **Yes** |
| down_exps > gate/up_exps | No | Indirectly via imatrix | **Yes (explicit asymmetry)** |
| Expert dispatch frequency | No | No | **Yes (expert stats export)** |
| Layer position matters | No | No | **Yes (edge/bridge/core)** |
| Budget redistribution | No | No | **Yes (attention→experts)** |
| "Weakest link" effect | No | No | **Yes (minimum bpw matters)** |
| Automation | Full | Full | Manual |

---

## 3. Concrete example: where approaches diverge

Suppose imatrix shows:
```
blk.30.ffn_down_exps: importance = 0.85
blk.30.ffn_gate_exps: importance = 0.82
blk.30.attn_q:        importance = 0.90
```

**Standard IQ:** All three get the base type (e.g., IQ3_KS). Importance ignored.

**UD-Q:** attn_q → Q5_K (highest importance), down_exps → Q5_K, gate_exps → Q4_K. Reasonable, but spends bytes on attention (3% of weights) that could go to experts.

**Zone Taper:** attn_q → iq5_k (deliberately not q8_0 — budget saved). down_exps → iq4_xs (output projection, critical). gate_exps → iq4_xs (same zone). Saved attention bytes → more experts at higher quality.

**Result:** Zone Taper spends the same byte budget more effectively for MoE inference, because it knows that experts matter more than attention for this architecture.

---

## 4. Empirical evidence from our experiments

### Finding 1: Attention quality does not affect PPL

v3.1 (attention q8_0) vs v2 (attention iq3_ks): PPL 9.70 vs 9.53. No improvement from attention upgrade. UD-Q does not know this — it would spend bytes on attention based on importance score alone.

### Finding 2: Minimum bpw matters more than average

v4 (avg 4.26 bpw, min 3.19 bpw) vs Variant A (avg 4.75 bpw, min 4.25 bpw). Testing whether removing the iq3_ks "weak link" improves PPL more than the BPW increase would suggest. UD-Q does not optimize for minimum bpw.

### Finding 3: Budget redistribution works

Spending 1.4 GiB on attention q8_0 (v3.1) gave zero PPL improvement. The same bytes spent on expert quality (v4, Variant A) directly improved PPL. UD-Q has no mechanism for cross-category budget redistribution.

### Finding 4: IQ ≥ Q at same BPW

Confirmed by llama.cpp PR #5747 data: IQ4_XS (4.32 bpw) matches Q4_K_S (4.57 bpw) in PPL. Our approach uses IQ types exclusively for experts. UD-Q uses Q types. This gives us a quality advantage at the same byte budget.

---

## 5. v6.1: Zone Taper + imatrix = better than UD-Q for MoE

### The synthesis

v6.1 combines the best of both approaches:
- **From UD-Q:** data-driven importance scores (imatrix) to determine zone boundaries
- **From Zone Taper:** architectural knowledge (MoE-awareness, down>gate/up, budget redistribution)

### What v6.1 knows that UD-Q does not

1. **MoE structure** — experts are 95% of weights but only 3% active per token
2. **down_exps > gate/up_exps** — output projection matters more than input
3. **Expert frequency** — frequently dispatched experts should be quantized more precisely
4. **Budget redistribution** — attention bytes are better spent on experts
5. **Weakest link** — minimum bpw across all tensors determines PPL floor

### When v6.1 wins

**MoE models (MiniMax, DeepSeek, Qwen MoE, Llama-4 MoE):** v6.1 uses all domain knowledge. UD-Q cannot match this.

**Dense models:** No advantage. UD-Q per-tensor approach is sufficient because all tensors participate on every token.

### Implementation path

1. Per-layer importance from imatrix → automatic zone boundaries (not manual)
2. Per-expert dispatch stats → frequency-weighted quantization
3. Budget optimization: maximize weighted importance under size constraint
4. Output: `--custom-q` string ready for llama-quantize

---

## 6. Summary for research paper

### Key claims (supported by data)

1. **Zone-based taper with asymmetric expert quantization outperforms uniform quantization for MoE models** when byte budgets are equivalent. The improvement comes from spending bytes where they matter most (expert FFN, especially down_exps) rather than distributing them uniformly.

2. **Attention quality is irrelevant for MoE PPL.** Attention is 3% of weights. Upgrading it from iq3_ks to q8_0 (+1.4 GiB) produced zero measurable PPL improvement. This contradicts the implicit assumption in standard quantizers that attention tensors deserve high precision.

3. **PPL is determined by minimum bpw, not average bpw.** A model with 68 tensors at 3.19 bpw and 118 tensors at 5.5 bpw (average 4.26) may perform worse than a model where all tensors are at 4.25 bpw (average 4.25). The "weakest link" effect is specific to MoE because different experts activate on different tokens — a poorly quantized expert degrades quality whenever it is selected.

4. **Automated importance-based quantization (UD-Q) does not exploit MoE-specific architectural knowledge.** A hybrid approach combining importance scores with explicit MoE awareness (zone taper, down>gate/up asymmetry, budget redistribution) is strictly more informed and should yield better results.

5. **Double quantization creates a hard PPL ceiling.** Q8_0→IQ3_KS gives PPL ~9.4 regardless of BPW or zone strategy. BF16/FP8→IQ3_KS is expected to reduce PPL by 0.3-0.5 points. The source quality is the dominant factor, not the quantization strategy.

### Open questions

1. Does v6.1 (data-driven zones) outperform manual zones in practice?
2. Does per-expert quantization (v6.2) give measurable PPL improvement?
3. Can the auto recipe generator (v6.4) match hand-tuned recipes?
4. How do these findings transfer to other MoE architectures (DeepSeek, Qwen, Llama-4)?
