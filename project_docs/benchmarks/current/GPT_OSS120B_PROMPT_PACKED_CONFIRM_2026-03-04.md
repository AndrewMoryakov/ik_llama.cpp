# `gpt-oss-120b` Prompt Packed Confirm

Date: 2026-03-04

Run:
- `ik_llama.cpp/bench_results/2026-03-04_061657_gptoss120b_prompt_packed_confirm`

Model:
- `Z:\files\gguf\lmstudio-community\gpt-oss-120b-GGUF\gpt-oss-120b-MXFP4-00001-of-00002.gguf`

Config:
- `t=16`
- `fa=1`
- `rtr=auto`
- `muge=0`
- `ngl=0`
- `r=3`
- `w=1`

Compared:
1. baseline
2. `Prompt Packed QKV = on`
3. `Prompt Packed preset = back-half`

## Results

### `pp512`
- baseline: `161.103907`
- back-half: `165.294421`
- delta: `+2.60%`

### `pg512,128`
- `pp512`
  - baseline: `158.692960`
  - back-half: `164.162962`
  - delta: `+3.45%`

- `tg128`
  - baseline: `17.227059`
  - back-half: `17.240189`
  - delta: `+0.08%`

- `pp512+tg128`
  - baseline: `60.379250`
  - back-half: `60.740783`
  - delta: `+0.60%`

## Interpretation

1. The positive signal survives a dedicated confirm run.
2. The effect is still practical, but more modest than the earlier Phase 3 pass.
3. This supports treating `Prompt Packed QKV back-half` on `gpt-oss-120b` as:
- `confirmed useful`
- `medium confidence`
4. This is not strong enough to justify a family-wide default or an aggressive promotion to `high confidence`.

## Practical Meaning

1. `Prompt Packed QKV back-half` remains worth keeping as a `gpt-oss-120b` huge-model branch.
2. The branch is now better described as:
- positive
- moderate
- productizable only with care
3. The next step should be productization/guidance work, not another broad benchmark sweep.
