# PPL Results — Tapered-RAM — 2026-03-21

## Parameters
- Model: D:\MiniMax-M2.5-TaperedRAM.gguf (89.6 GiB, 3.366 BPW)
- Dataset: wikitext-2-raw/wiki.test.raw
- Context: 512 tokens
- Chunks: 8
- Batch: 512
- Threads: 16, Flash Attention: ON
- Flags: --no-mmap (mmap causes segfault on this model with perplexity tool)
- Speed: ~12 t/s prompt eval, ~78 sec/chunk

## Results

Per-chunk progression:
```
[1] 4.3677
[2] 5.8310
[3] 6.4352
[4] 6.7076
[5] 6.9378
[6] 7.5222
[7] 8.2232
[8] 9.5328
```

**Final: PPL = 9.53 ± 0.66**

## Context

Recipe estimates from TASK.md:
- Variant A (89 GiB, similar size): ~8.72
- Variant F (87 GiB, speed-first): ~8.75-8.85

Measured PPL 9.53 is **higher (worse) than estimated** ~8.72.

Possible reasons:
1. **Attention bug** — attn_q quantized to iq3_ks instead of q8_0 (v3.1 fix pending)
2. **No imatrix** — IQ quants work suboptimally without importance matrix
3. **Source was Q8_0** — double quantization (Q8_0 → IQ3_KS) loses more than BF16 → IQ3_KS
4. **Only 8 chunks** — not fully converged (PPL was still rising)
5. **Estimates may have been optimistic**

## Notes
- PPL with mmap enabled crashes (segfault after tensor loading). --no-mmap works but slower to load (~7 min).
- More chunks needed for reliable estimate but this gives directional signal.
- Compare with UD-Q5 PPL when available.
