# Mixed Path Step 8: Partial Prompt-Packed QKV

## Goal

Step 7 made full prompt-packed QKV cheap enough at load time to be a realistic experiment.

The next question was narrower:

- can partial packing preserve most of the mixed-path gain while using less extra RAM than packing all layers

## Mechanism

The experimental path now supports layer-range selection:

```powershell
$env:IK_LLAMA_PROMPT_PACKED_QKV='1'
$env:IK_LLAMA_PROMPT_PACKED_QKV_RANGE='start:end'
```

Range semantics:

- zero-based
- `start` inclusive
- `end` exclusive

Examples:

- `0:24` on a 48-layer model packs the first half
- `24:48` on a 48-layer model packs the second half

## Benchmarks

Host:

- Ryzen 9 7950X
- Windows
- `-t 16 -fa 1 -rtr auto`

Scenarios:

- smoke `pg512,128` for wall-clock comparison
- stable `pg512,128`, `r=3`

Artifacts:

- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_packed_half0_smoke.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_packed_half1_smoke.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_packed_half0_pg_r3.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_packed_half1_pg_r3.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_packed_half0_smoke.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_packed_half1_smoke.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_packed_half0_pg_r3.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_packed_half1_pg_r3.log`

## Results

### Qwen3-30B-A3B-Q4_K_M

Baseline:

- model size: `17.35 GiB`
- `pg512,128`: `103.63 t/s`
- smoke wall-clock: about `15.97 s`

Full packed:

- model size: `17.84 GiB`
- `pg512,128`: `104.57 t/s`
- smoke wall-clock: about `17.26 s`

First half only (`0:24`):

- model size: `17.60 GiB`
- `pg512,128`: `104.62 t/s`
- smoke wall-clock: about `16.48 s`

Second half only (`24:48`):

- model size: `17.60 GiB`
- `pg512,128`: `103.39 t/s`
- smoke wall-clock: about `16.69 s`

Interpretation:

- on current Qwen validation, first-half packing slightly beats full packing
- second-half packing is not useful here
- the best current Qwen tradeoff is therefore partial front-half packing, not full packing

### gpt-oss-20b-MXFP4

Baseline:

- model size: `11.27 GiB`
- `pg512,128`: `88.73 t/s`
- smoke wall-clock: about `16.98 s`

Full packed:

- model size: `11.62 GiB`
- `pg512,128`: `88.94 t/s`
- smoke wall-clock: about `17.24 s`

First half only (`0:12`):

- model size: `11.44 GiB`
- `pg512,128`: `88.59 t/s`
- smoke wall-clock: about `17.07 s`

Second half only (`12:24`):

- model size: `11.44 GiB`
- `pg512,128`: `89.05 t/s`
- smoke wall-clock: about `17.06 s`

Interpretation:

- on current gpt-oss-20b validation, second-half packing slightly beats full packing
- first-half packing is not useful here
- the best current gpt-oss-20b tradeoff is therefore partial back-half packing, not full packing

## Main Conclusion

Full prompt packing is not the right general rule.

Current evidence says:

1. partial packing can match or slightly beat full packing
2. the best layer range is architecture-sensitive
3. packing every layer is not justified as a universal default

## Practical Meaning

This changes the engineering direction.

The next rational target is no longer:

- "make full packed QKV the default"

The next rational target is:

- selective packed-QKV policy
- architecture-aware layer selection
- possibly later dynamic or profile-guided selection

## Compatibility

This does not change model compatibility.

It remains:

- runtime-only
- env-gated
- prompt-only
- disabled when LoRA adapters are active

No `Q`, `IQ`, `UD-Q` compatibility is removed.
