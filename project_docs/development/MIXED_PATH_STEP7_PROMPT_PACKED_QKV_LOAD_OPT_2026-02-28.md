# Mixed Path Step 7: Prompt-Packed QKV Load-Overhead Reduction

## Goal

Step 6 proved that prompt-packed QKV can reduce prompt graph work, but it had an unacceptable startup penalty.

The immediate question was:

- is the load penalty caused mainly by dequantization, by quantization, or by buffer/storage work?

## Confirmation

A traced Qwen smoke run confirmed the bottleneck.

Artifact:

- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_smoke_packed_confirm.log`

Per-layer timing summary before optimization:

- layers: `48`
- total dequantize: about `138.7 ms`
- total quantize: about `7713.3 ms`
- total store: about `21.6 ms`

Average per layer:

- dequantize: about `2.89 ms`
- quantize: about `160.69 ms`
- store: about `0.45 ms`

Conclusion:

- the load penalty was overwhelmingly in `q8_0` quantization
- dequantization was not the main issue
- buffer copy/store was negligible

## Change

The runtime prompt-packed-QKV builder now uses parallel row-chunk quantization instead of one large single-thread `ggml_quantize_chunk(...)` call.

Implementation:

- helper added in `ik_llama.cpp/src/llama.cpp`
- current path still keeps the same packed representation
- only the build-time quantization strategy changed

## Confirmed Results

### Qwen smoke

Artifact:

- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_smoke_packed_parallel.log`

Observed:

- total dequantize: about `129.7 ms`
- total quantize: about `1175.0 ms`
- total store: about `20.5 ms`

So quantization dropped from about `7713 ms` to about `1175 ms`.

That is the main confirmation that the change hit the real bottleneck.

### Load time impact

Compared against the base verbose smoke runs:

- `Qwen`
  - base: `9602.86 ms`
  - packed after load-opt: `10520.97 ms`
  - delta: about `+9.6%`

- `gpt-oss-20b`
  - base: `8957.88 ms`
  - packed after load-opt: `9387.16 ms`
  - delta: about `+4.8%`

This is a major improvement over Step 6:

- old Qwen penalty: about `+80.6%`
- new Qwen penalty: about `+9.6%`

- old gpt-oss penalty: about `+42.5%`
- new gpt-oss penalty: about `+4.8%`

## Throughput After Load Optimization

Stable `r=3` `pg512,128`:

- `Qwen`
  - base: `103.63 t/s`
  - packed: `104.57 t/s`
  - delta: `+0.90%`

- `gpt-oss-20b`
  - base: `88.73 t/s`
  - packed: `88.94 t/s`
  - delta: `+0.23%`

Interpretation:

- the structural prompt-graph win remains
- the startup penalty is now much smaller
- throughput gain is still modest

## Practical Conclusion

This makes the experimental packed-QKV path substantially more realistic:

1. load-time overhead is no longer the main blocker
2. the remaining issue is the size of the throughput gain

Current status:

- technically valid
- materially improved over Step 6
- still not strong enough yet to justify default-on policy

## Next Rational Step

The next decision point is no longer about startup overhead.

The next real question is:

- can we increase the prompt/mixed throughput gain beyond the current ~`0.2%` to `1.0%` range

The most likely directions:

1. cheaper packed formats than generic `q8_0`
2. architecture-specific packed kernels / layouts
3. partial packing with better speedup-to-RAM ratio
