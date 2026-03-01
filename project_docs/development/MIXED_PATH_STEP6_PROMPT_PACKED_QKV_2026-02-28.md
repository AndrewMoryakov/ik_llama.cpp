# Mixed Path Step 6: Experimental Prompt-Packed QKV

## What Was Implemented

An experimental prompt-only packed-QKV path was added for split-QKV CPU models:

- gated by env var `IK_LLAMA_PROMPT_PACKED_QKV=1`
- implemented only for:
  - `qwen3moe`
  - `openai_moe` / `gpt-oss`
- active only for prompt-like batches (`n_tokens > 1`)
- disabled automatically when LoRA adapters are active
- token-generation path is unchanged

Implementation shape:

1. During model load, before runtime repack, split `wq/wk/wv` tensors are:
- dequantized to `f32`
- concatenated into one logical `qkv`
- requantized to `q8_0` by default

2. During prompt graph build, `build_std_attention(...)` uses the packed runtime tensor instead of three separate prompt projections.

## Why

Step 4 and Step 5 showed that on current validated models:

- attention path dominates prompt graph work
- both target models use split `wq/wk/wv`
- prompt graph contains many attention projection `mul_mat`

The goal of this experiment was to reduce prompt-side projection count without changing decode behavior.

## Constraints

1. This is not a default runtime policy.
- It is experimental.
- It is env-gated only.

2. It increases memory usage.
- approximate extra runtime packed weights:
  - `Qwen3-30B-A3B`: about `480 MiB`
  - `gpt-oss-20b`: about `337.5 MiB`

3. It increases startup/load time.
- because runtime packed tensors are built on load

4. It currently targets only split-QKV prompt path.
- it does not cover fused-QKV models
- it does not optimize decode

5. Backward compatibility is preserved.
- no CLI breakage
- no format breakage
- no change to `Q / IQ / UD-Q` support

## Smoke Validation

Artifacts:

- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_smoke_base.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_smoke_packed.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_smoke_base.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_smoke_packed.log`

Key structural result:

- `Qwen` prompt graph `mul_mat`: `241 -> 145`
- `gpt-oss-20b` prompt graph `mul_mat`: `121 -> 73`

That is exactly the intended structural effect.

## Throughput Results

Stable runs used `r=3`, `t=16`, `-fa 1`, `-rtr auto`.

Artifacts:

- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_base_pg_r3.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_packed_pg_r3.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_base_pg_r3.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_packed_pg_r3.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_base_pp_r3.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_packed_pp_r3.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_base_pp_r3.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_packed_pp_r3.log`

### `pg512,128`

- `Qwen3-30B-A3B`:
  - baseline: `103.63 t/s`
  - packed: `105.16 t/s`
  - delta: `+1.47%`

- `gpt-oss-20b`:
  - baseline: `88.73 t/s`
  - packed: `89.20 t/s`
  - delta: `+0.53%`

### `pp512`

- `Qwen3-30B-A3B`:
  - baseline: `310.28 t/s`
  - packed: `315.60 t/s`
  - delta: `+1.71%`

- `gpt-oss-20b`:
  - baseline: `284.17 t/s`
  - packed: `282.78 t/s`
  - delta: `-0.49%`
  - noise is large here; this is not a clean win

### `tg128`

By design, decode path should stay effectively unchanged.
Observed one-shot runs stayed near-flat.

## Load-Time Cost

Verbose smoke runs show a large startup penalty:

- `Qwen` load time:
  - baseline: `9602.86 ms`
  - packed: `17344.91 ms`
  - delta: about `+80.6%`

- `gpt-oss-20b` load time:
  - baseline: `8957.88 ms`
  - packed: `12765.21 ms`
  - delta: about `+42.5%`

This is the main downside.

## Conclusion

This experiment is technically successful in one narrow sense:

- prompt graph work is reduced
- `pg` shows a small, repeatable improvement on both validated models

But it is not ready to be a default optimization because:

- speedup is small
- load-time penalty is large
- memory overhead is non-trivial

## Practical Interpretation

Current status:

1. Good as an experimental proof that split-QKV prompt packing can help.
2. Not good enough yet as a production default.

## Next Step

The next useful step is not "ship this as default", but:

1. reduce packed tensor load/build overhead
2. explore cheaper layouts than generic `q8_0`
3. test whether partial packing or architecture-specific packing gives a better speedup-to-RAM ratio
