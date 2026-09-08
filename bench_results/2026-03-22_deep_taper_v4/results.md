# Deep-Taper v4 Results — 2026-03-22

## Model
- File: D:\MiniMax-M2.5-DeepTaper-v4.gguf (114 GiB)
- BPW: 4.262
- Recipe: 5-zone taper, attention redistributed (attn_q=iq5_k, attn_output=q5_K)
- Imatrix: ubergarm BF16 (497 entries, 796 chunks)
- Source: Q8_0 (Unsloth), --allow-requantize

## PPL
- **PPL = 9.42 ± 0.23** (64 chunks, n_ctx=512)
- Speed: 11.04 t/s prompt eval, ~54 sec/chunk
- Note: full dataset (552 chunks) crashed due to memory issues; 64 chunks gives reliable estimate

## Speed (from llama-bench)
- tg8: 0.021 t/s (heavily swap-bound, 114 GiB on 95 GiB RAM)

## Comparison: All Versions

| Version | Size | BPW | PPL | Chunks | Speed tg32 |
|---------|------|-----|-----|--------|-----------|
| v2 Tapered-RAM | 90 GiB | 3.37 | 9.53 ± 0.66 | 8 | 3.82 t/s |
| v3.1 Tapered-RAM | 92 GiB | 3.46 | 9.70 ± 0.08 | 552 | ~3.8 t/s |
| **v4 Deep-Taper** | **114 GiB** | **4.26** | **9.42 ± 0.23** | 64 | 0.02 t/s |
| UD-Q5 (reference) | 151 GiB | ~5.0 | not measured | — | 0.62 t/s |

## Key Finding

+0.8 BPW (3.46 → 4.26) improved PPL by only 0.28 points (9.70 → 9.42). The cost:
- +22 GiB size (92 → 114 GiB)
- Speed collapsed: 3.8 → 0.02 t/s (swap-bound)
- Model unusable for interactive work

## Conclusion

Deep-Taper v4 at 114 GiB is **not practical** on 95 GiB RAM:
- PPL improvement is marginal (9.70 → 9.42)
- Speed is 190x slower than Tapered-RAM due to swap
- The model fits only the PPL testing use case, not interactive inference

Tapered-RAM v3.1 (92 GiB) remains the practical choice for this hardware.
