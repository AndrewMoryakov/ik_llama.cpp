# Mixed Path Step 13: PG Decode Window Trace

## Goal

Step 12 showed:

- prompt-side locality improved
- prompt-side per-layer runtime improved
- end-to-end `pg` still did not improve

The next question was:

- where exactly does the mixed path absorb the saved prompt-side time

## Change

The `pg` trace was extended from:

- `prompt`
- `first_decode_after_prompt`

to:

- `prompt`
- first `N` decode calls after prompt

New env:

```powershell
$env:IK_LLAMA_PG_TRACE='1'
$env:IK_LLAMA_PG_TRACE_DECODE_WINDOW='8'
```

Default remains:

- `1`

So old behavior is preserved if the new env var is not set.

## Artifacts

- `ik_llama.cpp/bench_results/2026-02-28_pg_window_trace/qwen_pg_window8_base.log`
- `ik_llama.cpp/bench_results/2026-02-28_pg_window_trace/qwen_pg_window8_arena.log`
- `ik_llama.cpp/bench_results/2026-02-28_pg_window_trace/gptoss_pg_window8_base.log`
- `ik_llama.cpp/bench_results/2026-02-28_pg_window_trace/gptoss_pg_window8_arena.log`

## What Was Confirmed

## 1. Qwen: prompt and early decode both got slightly better

Using the `pp512+tg128` section of the trace:

- prompt:
  - base: about `1641.75 ms`
  - packed+arena: about `1641.81 ms`
  - effectively flat

- first decode window:
  - base:
    - index 0: about `36.88 ms`
    - indices 1..7: roughly `34.83 .. 37.34 ms`
  - packed+arena:
    - index 0: about `36.57 ms`
    - indices 1..7: roughly `34.86 .. 36.76 ms`

Interpretation:

- `Qwen` does not lose its packed/locality gain in the first decode window
- the effect is small, but the early decode window is not worse

This matches the practical result:

- `Qwen` smoke `pg` is roughly flat-to-slightly-better
- `Qwen` `r=3` stays effectively near baseline

## 2. gpt-oss-20b: prompt improved, decode window stayed almost the same

Using the `pp512+tg128` section of the trace:

- prompt:
  - base: about `1736.52 ms`
  - packed+arena: about `1736.57 ms`
  - effectively flat in the mixed run

- first decode window:
  - base:
    - index 0: about `44.32 ms`
    - indices 1..7: roughly `42.93 .. 44.56 ms`
  - packed+arena:
    - index 0: about `44.61 ms`
    - indices 1..7: roughly `42.44 .. 44.56 ms`

Interpretation:

- the first decode window is also basically flat
- the packed/locality path does not create a visible post-prompt collapse here

This matches the practical result:

- `gpt-oss-20b` end-to-end `pg` remains almost unchanged

## Main Conclusion

The saved prompt-side work is not being lost in:

1. graph rebuild/reset
2. first decode token only
3. the first few decode tokens after prompt

So the next likely explanation is higher-level:

- the total `pg` metric is dominated by a larger decode tail where prompt-side savings are too small to matter
- or the current packed-QKV improvement is simply below the threshold needed to move end-to-end mixed throughput in a stable way

## Practical Implication

The next step should not be:

- more tracing of the same first-token boundary
- more allocator-only tuning

The next step should be one of:

1. stronger prompt-path optimization than the current packed-QKV incremental gain
2. targeted decode-side optimization if `pg` remains decode-dominated at the chosen `512,128` workload
3. explicit accounting of prompt contribution vs decode tail in the mixed benchmark

## Recommended Next Target

The most rational next target is:

- quantify prompt-share vs decode-share in `pg512,128`

That will tell us whether the project should:

- continue pushing prompt-path gains
- or switch the next optimization cycle to decode-side mixed-path work
