# Custom Quant Benchmark Plan (A/C/D/E/F)

Date: 2026-02-26
Target host: Ryzen 9 7950X, 96 GB RAM
Purpose: compare custom MoE quantization variants from `../strategy/TASK.md` under one fixed runtime baseline.

---

## 1. Fixed runtime baseline

- `-t 16`
- `-fa 1`
- `-ctk q8_0`
- no affinity pinning
- SMT enabled

---

## 2. Required tests per variant

For each variant (`A`, `C`, `D`, `E`, `F`):

1. `tg32`
2. `tg128`
3. `pp512`
4. `pg512,128`

Core commands:

```bash
llama-bench -m <variant.gguf> -t 16 -fa 1 -ctk q8_0 -p 0   -n 32  -r 3
llama-bench -m <variant.gguf> -t 16 -fa 1 -ctk q8_0 -p 0   -n 128 -r 3
llama-bench -m <variant.gguf> -t 16 -fa 1 -ctk q8_0 -p 512 -n 0   -r 3
llama-bench -m <variant.gguf> -t 16 -fa 1 -ctk q8_0 -pg 512,128   -r 1
```

---

## 3. A/B flags policy

- `rtr`:
  - Run both `-rtr 0` and `-rtr 1` only for RAM-bound / swap-sensitive variants.
  - For clearly in-RAM variants, keep baseline `-rtr 1` unless regression observed.

- `muge`:
  - Enable only where memory overhead is acceptable and model path benefits from it.
  - If swap growth is significant, keep `-muge 0`.

---

## 4. Metrics to record

For each run collect:
- avg t/s
- stddev t/s
- model size (GiB)
- peak commit / swap
- wall time
- flags used

---

## 5. Storage convention

Recommended directory per batch:
- `bench_results/custom_quant_<date>_<host>/`

Recommended filenames:
- `<variant>_tg32_t16_fa1_ctkq80_r3.json`
- `<variant>_tg128_t16_fa1_ctkq80_r3.json`
- `<variant>_pp512_t16_fa1_ctkq80_r3.json`
- `<variant>_pg512_128_t16_fa1_ctkq80_r1.json`

And one normalized summary table:
- `SUMMARY_CUSTOM_QUANTS_<date>.md`

---

## 6. Acceptance criteria for a winning variant

- Better or equal `pg512,128` throughput vs current practical baseline.
- No unacceptable degradation in `tg128`.
- Lower RAM/swap pressure at comparable quality target.
- Stable results (stddev controlled in repeated runs).
