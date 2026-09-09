# MiniMax M2.5 — Custom Quantization Scripts

Two recipes for MiniMax M2.5 (62 layers, blk.0 — blk.61).

## Tapered-RAM (~91 GiB)
Daily-driver under 96 GB RAM. Two-step taper geometry.

```
./quantize_tapered_ram.sh <source.gguf> <output.gguf> [imatrix.dat]
```

## Deep-Taper 115 (~115 GiB)
Quality ceiling, ~20% RAM overflow. Five-zone ladder.

```
./quantize_deep_taper_115.sh <source.gguf> <output.gguf> [imatrix.dat]
```

## Requirements
- Built `llama-quantize` in `../../build/bin/`
- Source model: BF16 or Q8_0 GGUF (BF16 preferred for max quality)
- Optional: importance matrix (.dat) for IQ quants
