# Mixed Path Step 10: Static Layer Scoring

## Goal

After Step 9, the next question was:

- can we explain the best packed-QKV layer ranges with static per-layer structure alone

The point of this step was not to optimize yet.

The point was to answer whether a simple static scoring model would be enough for the next policy layer.

## Instrumentation

Added an experimental trace:

```powershell
$env:IK_LLAMA_LAYER_SCORE_TRACE='1'
```

Current hook:

- prompt-path only
- per attention layer inside `build_std_attention(...)`

For each prompt attention layer, the trace records:

- layer index
- packed vs split mode
- projection dimensions
- rough projection MAC count
- split vs packed weight size
- graph delta for the QKV stage
- graph delta for the rest of the attention subgraph

## Verified Models

- `Qwen3-30B-A3B-Q4_K_M`
- `gpt-oss-20b-MXFP4`

Artifacts:

- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_layer_score_base_only.txt`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_layer_score_auto_only.txt`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_layer_score_base_only.txt`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_layer_score_auto_only.txt`

## Main Findings

### 1. Base prompt attention layers are nearly uniform inside each model

`Qwen` base:

- all layers are split-QKV
- almost every layer has:
  - `qkv_mul_mat=3`
  - `attn_nodes=15`
  - `q_rows=4096`, `k_rows=512`, `v_rows=512`

`gpt-oss-20b` base:

- all layers are split-QKV
- almost every layer has:
  - `qkv_mul_mat=3`
  - `attn_nodes=13`
  - `q_rows=4096`, `k_rows=512`, `v_rows=512`

This means there is no strong static "obvious bad layer" signal in the base path.

### 2. Packed-QKV changes structure differently on the two architectures

`Qwen auto`:

- packed layers: `0..23`
- split layers: `24..47`
- packed layers show:
  - `qkv_mul_mat: 3 -> 1`
  - `attn_nodes: 15 -> 12`

So for `Qwen`, packed-QKV really simplifies the layer subgraph.

`gpt-oss-20b auto`:

- packed layers: `12..23`
- split layers: `0..11`
- packed layers show:
  - `qkv_mul_mat: 3 -> 1`
  - but `attn_nodes: 13 -> 17`
  - and `attn_mul_mat: 0 -> 1`

So for `gpt-oss-20b`, packed-QKV does not look like a simple structural reduction of the whole attention layer.

### 3. Static structure alone does not explain the best range choice

This is the most important result of the step.

Even though:

- `Qwen` front half works best
- `gpt-oss-20b` back half works best

the static per-layer scores inside each model are mostly uniform.

That means the best layer range is not explained well enough by:

- tensor sizes alone
- projection dimensions alone
- QKV `mul_mat` counts alone

## Conclusion

Static layer scoring is useful, but it is not sufficient as the next policy engine.

It tells us:

1. packed-QKV does change structure
2. the structural effect differs by architecture

But it does not tell us enough to predict:

- why front half wins on current `Qwen`
- why back half wins on current `gpt-oss-20b`

## Practical Implication

The next step should not be:

- more static heuristics
- more hand-written architecture presets

The next step should be:

- execution-side per-layer profiling
- especially prompt-path timing and locality-sensitive effects

That is the first path likely to explain the current results in a way that generalizes.
