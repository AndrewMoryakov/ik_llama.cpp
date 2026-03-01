# Qwen3-Next Bring-Up (ik_llama.cpp) - Handoff Notes

Last updated: 2026-02-11

## Goal

Add working (CPU-first) support for Qwen3-Next GGUF models in this `ik_llama.cpp` fork, focusing on correctness first (may be slow), then iterate on performance.

Target hardware context (user):
- AMD Ryzen 9 7950X (Zen4), CPU-only (no discrete GPU)
- 96 GB DDR5 (tuned), Windows build with AVX-512 enabled
- Main interest: Qwen3-Next 80B-A3B (IQ4/6/8), GPT-OSS 120B (IQ4/6/8)

## Repo State

Base commit (upstream in this workspace):
- `33308908d` (Merge PR #1211)

Working tree:
- Dirty with local changes related to Qwen3-Next bring-up + one CLI flag parsing fix (`-muge`).
- Untracked files exist in repo root (`GUIDE.md`, `MODELS.md`, `SPEED_OPTIMIZATION.md`, `test_write.txt`) and are unrelated to the core Qwen3-Next code changes.

## What Was Implemented

### 1. New architecture ID: `LLM_ARCH_QWEN3NEXT`

Files:
- `src/llama-arch.h`: add enum entry.
- `src/llama-arch.cpp`:
  - register architecture name `"qwen3next"`.
  - accept common variants `"qwen3-next"` and `"qwen3_next"` in `llm_arch_from_string()` for GGUFs that use punctuation variants.

### 2. Tensor name mapping for Qwen3-Next GGUF

File:
- `src/llama-model.cpp`: add per-arch tensor name map for `LLM_ARCH_QWEN3NEXT`.

Notable tensor patterns:
- Full-attn layers:
  - `blk.%d.attn_q`, `blk.%d.attn_q_norm`, `blk.%d.attn_k`, `blk.%d.attn_k_norm`, `blk.%d.attn_v`, `blk.%d.attn_output`
- Linear-attn (hybrid SSM / delta-net) layers:
  - `blk.%d.attn_qkv`, `blk.%d.attn_gate`
  - `blk.%d.ssm_conv1d`, `blk.%d.ssm_dt` (bias), `blk.%d.ssm_a`, `blk.%d.ssm_ba`, `blk.%d.ssm_norm`, `blk.%d.ssm_out`
- MoE FFN (+ optional shared expert):
  - `blk.%d.ffn_gate_inp`, `blk.%d.ffn_gate_exps`, `blk.%d.ffn_up_exps`, `blk.%d.ffn_down_exps`
  - `blk.%d.ffn_gate_inp_shexp`, `blk.%d.ffn_gate_shexp`, `blk.%d.ffn_up_shexp`, `blk.%d.ffn_down_shexp`

### 3. HParams extensions for Qwen3-Next hybrid SSM

Files:
- `src/llama-hparams.h`:
  - add `ssm_n_group` (used as `n_k_heads` for the delta-net part).
  - add `recurrent_layer_arr[]` and helpers:
    - `n_embd_r()` and `n_embd_s()` for recurrent state dimensions (separate from classic Mamba state dims).
    - `is_recurrent(il)` to mark linear-attn layers.
- `src/llama-hparams.cpp`:
  - load Qwen3-Next keys:
    - `ssm_d_conv`, `ssm_d_inner`, `ssm_d_state`, `ssm_dt_rank`, `ssm_n_group`
    - `full_attention_interval` (defaults to 4 if absent)
  - mark recurrent layers as "all layers except every Nth" where N = `full_attention_interval`.
  - increase expert cap:
    - `LLAMA_MAX_EXPERTS` bumped to 1024 (Qwen3-Next can use 512 experts).
  - fix an unrelated correctness issue:
    - `operator!=` comparison bug for `n_swa_pattern` (was comparing wrong field).

### 4. Tensor loading for Qwen3-Next

File:
- `src/llama-load-tensors.cpp`:
  - add `create_qwen3next_tensors()` and wire it into the loader switch.
  - allocate the correct tensors for:
    - full-attn layers (including Q/K norms)
    - linear-attn layers (qkv projection + gate projection + conv + delta-net params)
    - MoE FFN tensors + shared expert tensors

File:
- `src/llama-model.h`:
  - add missing layer tensor pointers needed by Qwen3-Next:
    - `wqkv_gate`
    - `ssm_beta_alpha`
    - `ssm_norm`

### 5. Recurrent state cache (`kv_state`) for Qwen3-Next

Motivation:
- Qwen3-Next has both classic KV cache (for full-attn layers) and a second stateful cache (for linear-attn delta-net state).

Files:
- `src/llama-context.h`: add `llama_kv_cache kv_state;`
- `src/llama.cpp`:
  - implement `llama_kv_cache_init_state()`:
    - always F32 (required by the `ggml_ssm_conv` custom op in this fork).
    - allocates only for recurrent layers; non-recurrent layers keep null pointers.
  - in `llama_init_from_model()`:
    - initialize `kv_state` when `model->arch == LLM_ARCH_QWEN3NEXT`.
    - log approximate state-cache size (R and S parts).

### 6. Graph builder: `build_qwen3next()` (CPU correctness path)

Files:
- `src/llama-build-context.h`: declare `build_qwen3next()`.
- `src/llama-build-context.cpp`:
  - add switch case to call it for `LLM_ARCH_QWEN3NEXT`.
  - implement `llm_build_context::build_qwen3next()`:
    - Current design is autoregressive-focused and asserts `n_tokens == 1`.
    - Full-attn layers:
      - Wq contains `[Q | gate]`; gate is `sigmoid(gate)` and applied to the attention output before `Wo`.
      - Uses Q/K RMS norms and RoPE like upstream.
    - Linear-attn layers:
      - Uses `ggml_ssm_conv` + autoregressive delta-net update.
      - Uses `kv_state` tensors as the persistent state buffers.
      - Implements missing math ops as small subgraphs:
        - `softplus(x) = -log(sigmoid(-x))`
        - `l2_norm` using `sqr` + `sum_rows` + `sqrt`
      - This fork does not expose `ggml_exp()`, so `exp(g)` is computed via sigmoid identity:
        - `sigmoid(-g) = 1/(1+exp(g))` => `exp(g) = 1/sigmoid(-g) - 1`
    - FFN:
      - MoE via existing `llm_build_moe_ffn()`.
      - Optional shared expert branch is added and gated.

### 7. Runtime wiring to make the graph usable

File:
- `src/llama.cpp`

Key changes:
- Force `ubatch=1` for Qwen3-Next in `llama_decode_internal()` so prompt processing does not build multi-token graphs.
- Ensure `kv_state` allocates a slot (`llama_kv_cache_find_slot(lctx.kv_state, u_batch)`) when decoding.
- Ensure `inp_s_mask` / `inp_s_seq` is populated for the active recurrent cache:
  - if `kv_self.recurrent` (Mamba), use `kv_self`
  - else if `kv_state.recurrent` (Qwen3-Next), use `kv_state`
- Worst-case graph reservations:
  - In scheduler reservation paths, force `n_tokens=1` for Qwen3-Next, otherwise `build_qwen3next()` asserts.
- Graph reuse safety:
  - Extend `llama_context::Prev` with `kv_state_head` and block reuse if `kv_state.head` changed.
- KV cache API:
  - `llama_kv_cache_clear(ctx)` and `llama_kv_cache_seq_rm(ctx, ...)` now also operate on `ctx->kv_state` when active.
  - Other KV ops are not yet mirrored to `kv_state` (see TODOs).

### 8. `-muge` / merge-up-gate-exps parsing fix

Motivation:
- Launcher/bench presets use `-muge` and there have been multiple spellings of the long flag in the wild.

Files:
- `common/common.cpp`
- `examples/llama-bench/llama-bench.cpp`

Change:
- Accept `-muge` plus aliases:
  - `--merge-up-gate-exps`
  - `--merge-up-gate-experts`
  - legacy typo `--merge-up-gate-expsrts`

## Build Status

Windows build:
- `.\build_zen4.bat` succeeds after replacing `ggml_exp()` usage (this fork does not provide it).

## Known Limitations / Caveats

- `build_qwen3next()` currently requires `n_tokens == 1`:
  - prompt prefill is supported by forcing `ubatch=1`, but it is not optimized.
- `n_seq` is currently hardcoded to 1 inside the Qwen3-Next graph:
  - parallel sequences / `--parallel > 1` are not supported for Qwen3-Next yet.
- Only `kv_state` clear and `seq_rm` are wired through public KV APIs:
  - other KV ops do not touch `kv_state` yet (seq_cp/keep/add/div/pos_max/defrag).
- `exp(g)` is implemented via a sigmoid identity:
  - likely OK but should be validated against a known-good reference for numerical behavior on real Qwen3-Next GGUF.

## Next Steps (Recommended)

1. Validate with a real Qwen3-Next GGUF:
   - confirm `general.architecture` and per-layer tensor names match what the loader expects.
   - run a tiny generation smoke test (`-n 32`) to ensure no NaNs/crashes.
2. Tighten constraints / warnings:
   - for Qwen3-Next, explicitly warn or error on `--parallel > 1` until multi-seq is implemented.
3. Performance work (after correctness):
   - implement a prompt/prefill path for linear-attn layers (`n_tokens > 1`) or add missing ggml ops used upstream (tri/cumsum/solve style ops).
4. Mirror remaining KV operations to `kv_state`, or document that they are unsupported for Qwen3-Next for now.

## Quick Commands (Windows)

Inspect GGUF metadata:
```powershell
cd Z:\files\projects\ik_llama.cpp
.\build\bin\llama-gguf.exe C:\models\Qwen3Next.gguf
```

Simple smoke test:
```powershell
.\build\bin\llama-cli.exe -m C:\models\Qwen3Next.gguf -p "test" -n 32 -t 16 --conversation
```

Benchmark:
```powershell
.\build\bin\llama-bench.exe -m C:\models\Qwen3Next.gguf -p 0 -n 256 -t 8,16,32 -fa 0,1 -muge 0,1 -r 5 -o json > bench.json
```

