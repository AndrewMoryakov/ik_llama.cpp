# Supported And Validated Matrix

## Host

Primary validation host:

- AMD Ryzen 9 7950X
- Zen4
- 96 GB RAM
- Windows

## Families In The Active Validated Loop

| Family | Representative | Regime | Current validated take |
|---|---|---|---|
| `Qwen3MoE` | `Qwen3-30B-A3B-Q4_K_M` | in-RAM MoE | `rtr=auto` is a strong starting policy; `flash_attn` matters for `pg` |
| `gpt-oss` | `gpt-oss-20b-MXFP4` | compute-oriented MoE | active validated line; `pg` and `tg` must be treated separately |
| `gpt-oss` | `gpt-oss-120b-MXFP4` | huge-model / memory-pressure subset | `rtr=auto` is throughput-first; `Prompt Packed QKV back-half` is confirmed useful with medium confidence |

## Benchmark Modes Considered Validated

| Mode | Purpose |
|---|---|
| `pp512` | prompt-path baseline |
| `tg128` | decode-only baseline |
| `pg512,128` | mixed-path baseline |

## Validated Runtime Findings

| Topic | Current validated statement |
|---|---|
| `flash_attn` | materially important for validated mixed-path runs |
| `rtr=auto` | good starting point for validated `Qwen3MoE` and `gpt-oss` |
| `pg vs tg` | `pg` cannot be inferred from `tg` alone |
| `Prompt Packed QKV` | model/regime-specific; not a family-wide default even inside `Split-QKV` |

## Supported But Not In Tight Public Validation

| Family | Status | Reason |
|---|---|---|
| `MiniMax M2.5` | supported, active research line | `off vs auto` closeout is done, but the line remains research-heavy and no new generalized hot-expert baseline was promoted |

## Canonical Family Truth

- `../benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `../benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
