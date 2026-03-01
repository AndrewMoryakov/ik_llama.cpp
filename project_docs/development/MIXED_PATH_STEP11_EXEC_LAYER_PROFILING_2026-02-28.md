# Mixed Path Step 11: Execution-Side Layer Profiling

## Goal

Step 10 showed that static layer structure is not enough to explain the current best packed-QKV ranges.

The next question was:

- does real execution-time distribution across prompt attention layers explain more than static graph structure

## Instrumentation

Added an execution-side trace:

```powershell
$env:IK_LLAMA_EXEC_LAYER_TRACE='1'
```

Current design:

- CPU execution path
- wall-time aggregation in `ggml` executor
- grouped by attention-layer node names
- intended for prompt profiling runs such as `pp512`

The trace records, per layer:

- `total_us`
- `qkv_us`
- `attn_us`
- node counts for the aggregated groups

This is intentionally coarse-grained.

It is not a full per-op profiler.

## Measurement Method

To avoid mixing prompt and decode:

- use `pp512`, not full `pg`

Validated models:

- `Qwen3-30B-A3B-Q4_K_M`
- `gpt-oss-20b-MXFP4`

Artifacts:

- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_exec_layer_base.txt`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_exec_layer_auto.txt`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_exec_layer_base.txt`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_exec_layer_auto.txt`

## Main Findings

### 1. Qwen matches the earlier practical result

Using max-per-layer entries as the main pass estimate:

- `Qwen base`
  - front half avg total: about `9953 us`
  - back half avg total: about `10093 us`
- `Qwen auto`
  - front half avg total: about `9516 us`
  - back half avg total: about `10181 us`

Delta vs base:

- front half: about `-438 us/layer`
- back half: about `+87 us/layer`

Interpretation:

- on current `Qwen`, packed front-half really does reduce prompt runtime where it is applied
- this aligns with the previously observed throughput result

### 2. gpt-oss-20b is more complicated

Using the same max-per-layer estimate:

- `gpt-oss-20b base`
  - front half avg total: about `19552 us`
  - back half avg total: about `12284 us`
- `gpt-oss-20b auto`
  - front half avg total: about `15451 us`
  - back half avg total: about `12371 us`

Delta vs base:

- front half: about `-4101 us/layer`
- back half: about `+87 us/layer`

Interpretation:

- the runtime effect is not local in the simplistic sense
- packed back-half does not simply make only back-half layers cheaper
- the observed benefit appears to involve broader execution behavior, not just direct layer-local graph reduction

## What This Means

This is the strongest result of the step:

- execution-side profiling confirms that runtime behavior explains more than static graph structure
- the current packed-QKV effect is at least partly a locality / scheduling / global execution effect

That is why:

- static layer size and `mul_mat` count were not enough
- simple architecture presets are useful but not explanatory enough

## Practical Conclusion

The next optimization target should not be:

1. more static scoring
2. more preset-table hardcoding

The next optimization target should be:

1. execution-locality analysis
2. prompt-path memory behavior
3. understanding why packed ranges change overall prompt execution shape differently across architectures

In short:

- we now have enough evidence to move from structural heuristics to runtime-behavior optimization
