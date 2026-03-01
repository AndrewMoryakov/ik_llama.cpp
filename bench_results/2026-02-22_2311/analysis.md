> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# Benchmark Analysis — ik_llama.cpp (commit bd387a279)

- **Date:** 2026-02-22
- **CPU:** AMD Ryzen 9 7950X 16-Core (Zen 4, 2 CCD, 96 GB DDR5)
- **OS:** Windows 11 Pro
- **Build:** MSVC 2022, AVX-512 (VBMI, VNNI, BF16), Release
- **Tests:** PP512 (prompt processing), TG128 (token generation)
- **Total results:** 88 (some Qwen3 muge+rtr combos crashed)

---

## Models Tested

| Model | Type | Quant | Size | Active Params |
|-------|------|-------|------|---------------|
| gpt-oss-20b | MoE | MXFP4 | ~10 GB | ~3B |
| Qwen3-30B-A3B | MoE | Q4_K_M | ~17 GB | ~3B |
| Meta-Llama-3.1-8B-Instruct | Dense | Q8_0 | ~8 GB | 8B |

---

## 1. gpt-oss-20b (MXFP4, MoE)

### Prompt Processing (PP512, t/s)

| Конфиг | t=8 | t=16 | Прирост t16 |
|--------|-----|------|-------------|
| base (fa=0, rtr=0, muge=0) | 150.6 | 232.2 | +54% |
| +fa | 173.4 | 278.0 | +60% |
| +fa +rtr | 174.4 | 273.0 | +57% |
| +fa +muge | 172.4 | 286.6 | +66% |
| **+fa +rtr +muge** | **175.8** | **289.5** | **+65%** |

### Token Generation (TG128, t/s)

| Конфиг | t=8 | t=16 | Прирост t16 |
|--------|-----|------|-------------|
| base (fa=0, rtr=0, muge=0) | 18.8 | 22.8 | +21% |
| +fa +rtr +muge | **19.7** | **24.2** | **+23%** |

### Flag Impact (gpt-oss)

| Flag | PP delta | TG delta | Note |
|------|----------|----------|------|
| fa 0→1 | +15-27% | ~0% | Big PP win, TG is bandwidth-bound |
| rtr 0→1 | +1-2% | +2-5% | Minimal — MXFP4 already well-packed |
| muge 0→1 | +3-5% | +1-3% | Small locality improvement |
| t=8→16 | +54-65% | +21-23% | PP scales well with threads |

### Best Config: `fa=1 muge=1 rtr=1 t=16` → PP 289.5 t/s, TG 24.2 t/s

---

## 2. Qwen3-30B-A3B (Q4_K_M, MoE)

### Prompt Processing (PP512, t/s)

| Конфиг | t=8 | t=16 | Прирост t16 |
|--------|-----|------|-------------|
| base (fa=0, rtr=0, muge=0) | 117.9 | 194.2 | +65% |
| +fa | 138.8 | 234.7 | +69% |
| **+fa +rtr** | **172.2** | **306.2** | **+78%** |
| +fa +muge | 143.7 | 244.9 | +70% |
| +fa +rtr +muge | CRASH | CRASH | GGML_ASSERT |

### Token Generation (TG128, t/s)

| Конфиг | t=8 | t=16 | Прирост t16 |
|--------|-----|------|-------------|
| base (fa=0, rtr=0, muge=0) | 26.0 | 27.2 | +5% |
| **+fa +rtr** | 27.8 | **29.9** | **+8%** |
| fa=0 +rtr | **28.9** | 29.7 | +3% |

### Flag Impact (Qwen3)

| Flag | PP delta | TG delta | Note |
|------|----------|----------|------|
| fa 0→1 | +18% | ~0% | PP-only improvement |
| **rtr 0→1** | **+24-30%** | **+5-10%** | **Key flag — huge impact on Q4_K_M** |
| muge 0→1 | +3-4% | +2-5% | Minimal gain |
| muge+rtr | CRASH | CRASH | Bug: type mismatch after merge+repack |
| t=8→16 | +65-78% | +3-8% | PP scales well, TG less so |

### Best Config: `fa=1 rtr=1 muge=0 t=16` → PP 306.2 t/s, TG 29.9 t/s

### Bug: muge=1 + rtr=1 → GGML_ASSERT failure

```
llama.cpp:4510: GGML_ASSERT(l.ffn_up_gate_exps->type == l.ffn_up_exps->type
    && l.ffn_up_gate_exps->type == l.ffn_gate_exps->type) failed
```

Root cause: after merge_up_gate_exps fuses tensors, the repack (rtr) changes individual tensor types but the fused tensor type doesn't match. This is a code bug — the type check doesn't account for the merged layout after repacking.

---

## 3. Meta-Llama-3.1-8B-Instruct (Q8_0, Dense — Regression Baseline)

### Prompt Processing (PP512, t/s)

| Конфиг | t=8 | t=16 | Прирост t16 |
|--------|-----|------|-------------|
| base (fa=0, rtr=0) | 85.5 | 152.3 | +78% |
| +fa | 93.3 | 163.1 | +75% |
| **+fa +rtr** | **98.8** | **165.7** | **+68%** |

### Token Generation (TG128, t/s)

| Конфиг | t=8 | t=16 |
|--------|-----|------|
| all variants | 7.4-7.7 | 8.1-8.2 |

### Flag Impact (Dense)

| Flag | PP delta | TG delta | Note |
|------|----------|----------|------|
| fa 0→1 | +7-15% | ~0% | PP improvement only |
| rtr 0→1 | +2-6% | ~0% | Minimal for Q8_0 |
| muge 0→1 | ~0% | ~0% | N/A for dense models |
| t=8→16 | +68-78% | +8% | PP scales, TG barely |

### Note: TG ~8 t/s

Dense 8B Q8_0 reads all 8 GB per token. At ~67 GB/s DDR5 bandwidth: theoretical max = 67/8 = 8.4 t/s. We're at 96% of bandwidth limit. **No optimization can improve this** — it's pure memory bandwidth.

---

## Summary: Flag Recommendations

| Flag | PP Effect | TG Effect | Recommendation |
|------|-----------|-----------|----------------|
| **fa=1** | +9-27% | ~0% | **Always on** |
| **rtr=1** | +2-30% (model-dependent) | +0-10% | **Always on** |
| muge=1 | +3-5% | +1-3% | On for gpt-oss; **OFF for Qwen3** (crash with rtr) |
| t=16 | +54-78% | +3-23% | Use for PP-heavy workloads |
| t=8 | baseline | baseline | Use if TG latency matters more |

## Recommended Launch Commands

```bash
# gpt-oss-20b (all flags safe)
llama-cli -m model.gguf -t 16 -fa 1 -muge 1 -rtr 1 -c 8192

# Qwen3-30B-A3B (NO -muge with -rtr!)
llama-cli -m model.gguf -t 16 -fa 1 -rtr 1 -c 8192

# Dense models (muge irrelevant)
llama-cli -m model.gguf -t 16 -fa 1 -rtr 1 -c 8192
```

---

## Key Insight: MoE Bandwidth Efficiency

| Model | Total Params | Active Params | TG (best) | Relative |
|-------|-------------|---------------|-----------|----------|
| Llama-3.1-8B Q8_0 | 8B | 8B | 8.2 t/s | 1x |
| gpt-oss-20b MXFP4 | 20B | ~3B | 24.2 t/s | **3x** |
| Qwen3-30B-A3B Q4_K_M | 30B | ~3B | 29.9 t/s | **3.6x** |

MoE models with ~3B active parameters generate **3-4x faster** than a dense 8B model despite having 2.5-4x more total parameters. This is because TG is bandwidth-bound, and MoE only reads active expert weights per token.

---

## Bugs Found

1. **Qwen3 muge+rtr crash** — `GGML_ASSERT` type mismatch in `llama.cpp:4510`. Candidate for bugfix PR.

## Observations for Future Optimization (BACKLOG)

1. **High stddev at t=16**: PP results with t=16 show stddev 20-50 t/s (vs <4 at t=8). Likely dual-CCD scheduling variance. NUMA/CCD-aware pinning (PR06) could stabilize this.
2. **rtr is the biggest win for Q4_K_M**: +30% PP for Qwen3. IQK kernel audit (PR09) should verify optimal paths for other quant types.
3. **TG is bandwidth-bound across all models**: expert prefetching (PR03) may help MoE TG by overlapping memory reads with compute.
4. **muge benefit is small**: +3-5% on gpt-oss, crash on Qwen3. May not be worth the complexity unless the crash is fixed.



