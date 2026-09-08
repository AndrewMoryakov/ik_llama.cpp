# Speed Optimization Notes (Zen4 / 7950X)

Validated on: 2026-02-27
Hardware: Ryzen 9 7950X (16C/32T), 96 GB DDR5, Windows
Reference commit: `1ee50255a`

---

## 1. Current baseline profile (recommended default)

Use this as the starting point for all MoE benchmarks:

```bash
llama-bench -m <model.gguf> -t 16 -fa 1 -rtr auto -ctk q8_0
```

For current validated in-RAM runs, add scenario-specific commands:

```bash
# Qwen3-30B-A3B Q4_K_M
llama-bench -m <qwen.gguf> -t 16 -fa 1 -rtr auto -muge 0 -p 512 -n 0 -r 3
llama-bench -m <qwen.gguf> -t 16 -fa 1 -rtr auto -muge 0 -p 0 -n 128 -r 3
llama-bench -m <qwen.gguf> -t 16 -fa 1 -rtr auto -muge 0 -pg 512,128 -r 3

# gpt-oss-20b MXFP4
llama-bench -m <gptoss.gguf> -t 16 -fa 1 -rtr auto -p 512 -n 0 -r 3
llama-bench -m <gptoss.gguf> -t 16 -fa 1 -rtr auto -p 0 -n 128 -r 3
llama-bench -m <gptoss.gguf> -t 16 -fa 1 -rtr auto -pg 512,128 -r 3
```

---

## 2. What is confirmed on this machine

- `t=16` is the safest current default.
- Manual CCD pinning hurts performance on this host.
- SMT must stay enabled.
- `rtr auto` is the best current general default.
- `pg` must be measured separately from `tg`.

---

## 3. Current `rtr` behavior

Current measured direction:
- in-RAM throughput: `auto` or `on` beat `off`
- swap-bound throughput: `auto` or `on` beat `off` in current tested large-model run
- swap-bound startup/load time: `off` can be much faster than `auto/on`

Implication:
- use `auto` as the default
- keep `off` for startup-sensitive scenarios and A/B testing

---

## 4. Quantization strategy (project direction)

- UD-Q / IQ / Q support remains.
- Active R&D is shifting to new custom quantization variants (see `../strategy/TASK.md`).
- Optimization target is not only raw TG, but practical MoE throughput under RAM pressure.

Required benchmark set for each new quant variant:
- `tg32`
- `tg128`
- `pp512`
- `pg512,128`

Fixed runtime profile for comparability:
- `t16 fa1 ctk=q8_0`

---

## 5. Do not use these outdated assumptions

- "`-t 8` (one CCD) is faster" -> outdated for this host.
- "`rtr off` is always safer for huge models" -> false in throughput terms.
- "single TG test is enough" -> false; include mixed prompt+generation.

---

## 6. Canonical result docs

- `MOE_RUNTIME_PROFILES.md`
- `../benchmarks/RTR_POLICY.md`
- `../benchmarks/current/SUMMARY_CURRENT_2026-02-27.md`
- `../benchmarks/SUMMARY_ALL.md`
- `../benchmarks/INDEX.md`
