# Tapered-RAM Baseline Benchmark — 2026-03-21

## Model
- File: `D:\MiniMax-M2.5-TaperedRAM.gguf`
- Quant: Custom Tapered-RAM (v2), base IQ3_KS, edge iq5_k/iq4_xs, bridge iq4_xs/iq3_ks
- Size: 89.612 GiB (3.366 BPW)
- Source: Q8_0 (Unsloth), without imatrix, --allow-requantize
- Known issue: attention tensors quantized by base ftype (attn_q → iq3_ks, attn_output → q5_K) instead of intended q8_0

## Host
- CPU: AMD Ryzen 9 7950X, 16 cores
- RAM: 95.1 GiB
- OS: Windows 11
- Build: 174 (5595ee178), MSVC 19.41.34120.0

## Parameters
- Threads: 16
- Flash Attention: ON
- RTR: off
- Merge Up Gate: OFF
- KV cache: f16 (llama-bench default)
- Reps: 1, Warmup: 1

## Results

| Test | Tokens/s |
|------|----------|
| tg32 | 3.822 |
| tg128 | 4.109 |
| pp512 | 22.305 |
| pg32:4 (pp32+tg4) | 7.010 |

## Comparison with UD-Q5_K_XL (from 2026-03-01 closeout)

| Test | UD-Q5 (151 GiB) | Tapered-RAM (91 GiB) | Speedup |
|------|-----------------|---------------------|---------|
| tg32 | 0.619 t/s | 3.822 t/s | **6.2x** |
| pg32:4 | 1.277 t/s | 7.010 t/s | **5.5x** |

## Notes
- Tapered-RAM is borderline in-RAM (~91 GiB model + ~0.5 GiB KV on 95 GiB host)
- UD-Q5 is heavily swap-bound (151 GiB, ~63 GiB in swap)
- The speedup is primarily due to reduced swap pressure, not quant type differences
- Quality comparison (PPL, live tasks) not yet performed
- Attention bug (v3.1 in ROADMAP) may be degrading quality
