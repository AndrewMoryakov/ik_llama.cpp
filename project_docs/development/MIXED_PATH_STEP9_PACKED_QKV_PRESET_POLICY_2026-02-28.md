# Mixed Path Step 9: Experimental Packed-QKV Preset Policy

## Goal

Step 8 showed that partial prompt packing is better than full packing, but the best layer range depends on architecture.

That created a practical problem:

- range-based control works for engineering experiments
- but it is too manual to reuse consistently

The next step was therefore:

- add a small architecture-aware preset policy on top of the existing range mechanism

## Change

New env control:

```powershell
$env:IK_LLAMA_PROMPT_PACKED_QKV='1'
$env:IK_LLAMA_PROMPT_PACKED_QKV_PRESET='auto'
```

Supported preset values:

- `auto`
- `full`
- `front-half`
- `back-half`

Priority rules:

1. `IK_LLAMA_PROMPT_PACKED_QKV_RANGE` has priority if explicitly set
2. otherwise `IK_LLAMA_PROMPT_PACKED_QKV_PRESET` is used
3. if no preset is given, the old behavior remains `full`

Current `auto` mapping:

- `Qwen3MoE` -> `front-half`
- `OpenAI MoE` -> `back-half`

This is intentionally narrow and based only on currently validated results.

## Verification

Artifacts:

- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_packed_preset_auto_smoke.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/gptoss_packed_preset_auto_smoke.log`
- `ik_llama.cpp/bench_results/2026-02-28_prompt_packed_qkv/qwen_packed_preset_auto_override_smoke.log`

Observed smoke `pg512,128`:

- `Qwen auto`: `104.70 t/s`
- `gpt-oss-20b auto`: `88.67 t/s`
- `Qwen auto + explicit range 24:48`: `103.68 t/s`

Interpretation:

- `Qwen auto` behaves like the previously validated front-half profile
- `gpt-oss-20b auto` behaves like the previously validated back-half profile
- explicit range still overrides preset selection

## Practical Conclusion

This is the first reusable policy layer on top of the experimental packed-QKV path.

It does not make packed-QKV a general default.

What it does provide:

1. a reproducible `auto` preset for the currently validated architectures
2. a clean precedence model
3. a better default experiment than `pack all layers`

## Compatibility

This remains:

- env-gated
- runtime-only
- prompt-only
- additive

No existing `ik_llama` CLI behavior is removed.
No `Q`, `IQ`, `UD-Q` compatibility is affected.
