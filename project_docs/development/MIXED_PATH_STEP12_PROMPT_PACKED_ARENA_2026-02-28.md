# Mixed Path Step 12: Prompt Packed-QKV Arena

## Goal

Step 11 showed that prompt packed-QKV behavior is influenced by execution locality, not only by graph structure.

The next question was:

- does replacing per-layer packed weight buffers with one contiguous arena improve real mixed-path throughput

## Change

The experimental prompt packed-QKV path was changed from:

- one backend buffer per packed layer tensor

to:

- one shared contiguous backend buffer for packed prompt weights
- one shared contiguous backend buffer for packed prompt biases

Implementation details:

- arena offsets use `ggml_backend_buft_get_alloc_size(...)`
- each packed tensor keeps its own metadata, but `tensor->buffer` points to the shared arena
- `tensor->data` points to `arena_base + offset`
- arena buffers are now owned by `model.bufs`, so their lifetime is tied to the model

This also fixes a practical issue in the previous experimental path:

- per-layer prompt-packed buffers were not part of `model.bufs`

## Instrumentation

The locality trace was extended to log:

- source tensor `data` addresses
- packed arena base
- packed tensor data address
- inter-tensor packed gap

Useful env vars:

```powershell
$env:IK_LLAMA_PROMPT_PACKED_QKV='1'
$env:IK_LLAMA_PROMPT_PACKED_QKV_PRESET='auto'
$env:IK_LLAMA_LOCALITY_TRACE='1'
$env:IK_LLAMA_EXEC_LAYER_TRACE='1'
```

## Artifacts

- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv_arena/qwen_pp_locality_exec_arena.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv_arena/gptoss_pp_locality_exec_arena.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv_arena/qwen_pg_auto_arena_r3.json`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv_arena/gptoss_pg_auto_arena_r3.json`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv_arena/qwen_pg_base_current_r3.json`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv_arena/gptoss_pg_base_current_r3.json`

## What Was Confirmed

### 1. Locality is now truly contiguous

`Qwen` packed front-half:

- layer 0 starts at arena base
- every next packed layer has `packed_gap=0`

`gpt-oss-20b` packed back-half:

- same result: `packed_gap=0` across packed layers

This confirms that the old fixed allocator gap between packed layers is gone.

### 2. Prompt-side per-layer runtime improved

Using the same coarse max-per-layer method as step 11:

- `Qwen auto` before arena:
  - front avg about `9515.67 us`
  - back avg about `10180.62 us`
- `Qwen auto` with arena:
  - front avg about `9428.71 us`
  - back avg about `9987.33 us`

- `gpt-oss-20b auto` before arena:
  - front avg about `15451.42 us`
  - back avg about `12370.58 us`
- `gpt-oss-20b auto` with arena:
  - front avg about `13261.92 us`
  - back avg about `12277.08 us`

Interpretation:

- the arena layout improves prompt-side execution locality
- this effect is visible even outside the packed half on `gpt-oss-20b`

### 3. End-to-end `pg` did not improve on same-build A/B

Same build, same flags, only prompt-packed env toggled:

- `Qwen3-30B-A3B-Q4_K_M`
  - base: `104.40 t/s`
  - packed auto + arena: `104.16 t/s`
  - delta: about `-0.23%`

- `gpt-oss-20b-MXFP4`
  - base: `88.97 t/s`
  - packed auto + arena: `88.70 t/s`
  - delta: about `-0.31%`

Prompt-only `pp512` moved in the expected direction:

- `Qwen`: `310.25 -> 314.19 t/s`
- `gpt-oss-20b`: `278.27 -> 289.49 t/s`

But the mixed-path aggregate still did not benefit.

## Practical Conclusion

The packed arena is a valid locality improvement, but current evidence says:

- it is not enough to improve end-to-end `pg`
- prompt-side gains are being diluted or canceled elsewhere in the mixed path

Therefore:

1. keep the arena implementation as internal experimental infrastructure
2. do not promote it to default behavior
3. do not spend the next cycle on more allocator-only tuning

## What This Means For The Next Step

The next bottleneck is likely not:

- per-layer packed allocation overhead
- simple packed tensor placement

The next bottleneck is more likely:

- prompt-to-mixed execution interaction after prompt attention becomes cheaper
- another compute-side section that now dominates after prompt-QKV cleanup
- or mixed-path-specific overhead outside prompt attention itself

So the next rational phase is:

- instrument the mixed path above prompt attention locality
- measure where the saved prompt-side time is being absorbed in `pg`
