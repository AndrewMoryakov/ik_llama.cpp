# PPL Results — Tapered-RAM v3.1 — 2026-03-22

## Model
- File: D:\MiniMax-M2.5-TaperedRAM-v3.1.gguf (92 GiB)
- Quant: Tapered-RAM v3.1
- Changes vs v2: attention q8_0 (fix), embeddings q8_0, imatrix (ubergarm BF16), ffn_gate_inp f32 (explicit)
- Source: Q8_0 (Unsloth), --allow-requantize
- Imatrix: imatrix-MiniMax-M2.5-BF16.dat (ubergarm, 497 entries, 796 chunks)

## PPL Test Parameters
- Dataset: wikitext-2-raw/wiki.test.raw
- Context: 512 tokens
- Chunks: 552 (full dataset)
- Batch: 512
- Threads: 16, Flash Attention: ON
- Flags: --no-mmap
- Total time: ~4.5 hours (16.5M ms)
- Speed: 17.18 t/s prompt eval

## Result

**PPL = 9.70 ± 0.08**

Convergence: stable from ~chunk 200 onward (range 9.2–9.7), final value well-converged.

## Comparison

| Version | PPL | Chunks | BPW | Size | Notes |
|---------|-----|--------|-----|------|-------|
| v2 (attention bug, no imatrix) | 9.53 ± 0.66 | 8 | 3.37 | 90 GiB | Unreliable (few chunks) |
| **v3.1** (attention fix + imatrix) | **9.70 ± 0.08** | 552 | 3.46 | 92 GiB | Full dataset, reliable |
| Recipe estimate (Variant A) | ~8.72 | — | — | 89 GiB | Theoretical |

## Analysis

v3.1 PPL did not improve vs v2 rough estimate. Possible reasons:

1. Imatrix from BF16 applied to Q8_0 source — weight distribution mismatch
2. Attention is ~3% of model weights — fix has limited PPL impact
3. Core expert FFN in iq3_ks is 95% of weights and the dominant error source at 3.4 bpw
4. v2 measurement was unreliable (8 chunks, ±0.66) — true v2 PPL was likely ~9.7 too
5. Recipe estimates (~8.72) may have been optimistic or assumed BF16 source + imatrix

## Conclusion

PPL ~9.7 appears to be the floor for this model at 3.4 bpw from Q8_0 source.
To significantly improve PPL, would need either:
- Higher bpw (more space for experts) — but then won't fit in 96 GB RAM
- BF16 source instead of Q8_0 — avoids double quantization
- Better imatrix matched to Q8_0 source
