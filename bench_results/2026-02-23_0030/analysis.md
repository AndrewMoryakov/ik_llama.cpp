> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# Benchmark Analysis — MiniMax-M2.5 (commit bd387a279)

- **Date:** 2026-02-23
- **CPU:** AMD Ryzen 9 7950X 16-Core (Zen 4, 2 CCD, 96 GB DDR5)
- **OS:** Windows 11 Pro
- **Build:** MSVC 2022, AVX-512 (VBMI, VNNI, BF16), Release
- **Tests:** PP512, TG128, fa=1 only, reps=1
- **Total time:** 223.3 min (~3.7 hours)

---

## Model

| Field | Value |
|-------|-------|
| Model | MiniMax-M2.5 |
| Type | MoE (~456B total params) |
| Quant | Q5_K_XL (UD) |
| Files | 5 parts |
| Total size | ~151 GB |
| RAM available | 96 GB |
| **Swap required** | **~55 GB** |

---

## Prompt Processing (PP512, t/s)

| Конфиг | t=8 | t=16 | Прирост t16 |
|--------|-----|------|-------------|
| base (rtr=0, muge=0) | 6.2 | 8.7 | +40% |
| +rtr | **9.1** | **11.2** | +23% |
| +muge | 7.1 | 10.9 | +54% |
| +muge +rtr | CRASH | CRASH | GGML_ASSERT |

### Flag Impact (PP)

| Flag | Delta | Note |
|------|-------|------|
| rtr 0→1 | +29-47% | Significant, same pattern as Qwen3 |
| muge 0→1 | +15-25% | Helpful for PP |
| t=8→16 | +23-54% | Scales but less than in-RAM models |

---

## Token Generation (TG128, t/s)

| Конфиг | t=8 | t=16 | Прирост t16 |
|--------|-----|------|-------------|
| **base (rtr=0, muge=0)** | **1.3** | **1.5** | +15% |
| +rtr | 0.7 | 0.6 | -14% |
| +muge | 0.7 | 0.7 | 0% |

### Flag Impact (TG)

| Flag | Delta | Note |
|------|-------|------|
| rtr 0→1 | **-46 to -60%** | **HARMFUL** — repack increases memory footprint, more swapping |
| muge 0→1 | **-46%** | **HARMFUL** — same reason: more memory pressure |
| t=8→16 | +15% | Minimal gain |

### Why rtr/muge HURT TG

Both flags increase effective memory footprint:
- `rtr=1` repacks tensors into row-interleaved layout (slight size increase + repack buffer)
- `muge=1` merges up+gate expert tensors (doubles contiguous allocation)

When the model already exceeds RAM by ~55 GB, any additional memory pressure pushes more pages to swap. TG reads weights sequentially per token → more swap I/O → massive slowdown.

For in-RAM models (gpt-oss-20b, Qwen3-30B), these flags help because they improve cache/SIMD utilization. For swap-bound models, the memory overhead dominates.

---

## Bug: muge+rtr crash (same as Qwen3)

```
llama.cpp:4510: GGML_ASSERT(l.ffn_up_gate_exps->type == l.ffn_up_exps->type
    && l.ffn_up_gate_exps->type == l.ffn_gate_exps->type) failed
```

Confirmed on third MoE model — this is a general MoE bug, not Qwen3-specific.

---

## Comparison with Other Models

| Model | Size | Fits RAM | PP best | TG best | Usable |
|-------|------|----------|---------|---------|--------|
| Qwen3-30B-A3B Q4_K_M | 17 GB | Yes | 306.2 t/s | 29.9 t/s | Excellent |
| gpt-oss-20b MXFP4 | 10 GB | Yes | 289.5 t/s | 24.2 t/s | Excellent |
| Llama-3.1-8B Q8_0 | 8 GB | Yes | 165.7 t/s | 8.2 t/s | Good |
| **MiniMax-M2.5 Q5_K_XL** | **151 GB** | **No (60% swap)** | **11.2 t/s** | **1.5 t/s** | **No** |

---

## Conclusions

1. **MiniMax-M2.5 Q5_K_XL is not usable on 96 GB RAM.** TG 1.5 t/s = ~1 word/sec, non-interactive.
2. **rtr and muge are counterproductive for swap-bound models** — they increase memory footprint and worsen swap pressure.
3. **Best TG config for swap-bound models: base flags only** (no rtr, no muge) — minimizes memory overhead.
4. **Minimum RAM for this model:** ~192 GB to fit entirely in memory. Alternatively, a lower quant (IQ2/IQ3) could reduce size to ~60-80 GB.
5. **Practical model size limit for this hardware:** ~80 GB for comfortable TG, ~60 GB for fast TG.
6. **muge+rtr crash confirmed on third MoE model** — general bug affecting all MoE architectures, not model-specific.

### Best Config (if running on this hardware despite limitations)

```bash
# MiniMax-M2.5 on 96 GB RAM (swap-bound, no rtr/muge!)
llama-cli -m model.gguf -t 16 -fa 1 -c 2048
```



