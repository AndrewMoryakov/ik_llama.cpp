# MoE Runtime Profiles (Zen4 / 7950X)

## Purpose
This document explains, in practical terms:
- what runtime parameters matter for `ik_llama.cpp`
- why they matter
- how to combine them for different model classes and workloads
- what is currently recommended on this hardware

Target host for all recommendations here:
- CPU: AMD Ryzen 9 7950X (Zen4, 16C/32T)
- RAM: 96 GB
- OS: Windows
- Reference build area: `ik_llama.cpp`

These recommendations are **host-specific** and should not be blindly applied to other CPUs or memory configurations.

## Who This Is For
This is written for:
- engineers new to `ik_llama`
- users who understand models but not low-level runtime flags
- contributors who need a clear default starting point

## Core Idea
There is no single "best" runtime profile for all MoE inference.

Three axes matter:
1. Model class:
- `in-RAM`: model comfortably fits in physical RAM
- `swap-bound`: model exceeds practical RAM budget and causes paging/swap pressure

2. Workload path:
- `pp`: prompt processing only
- `tg`: token generation only
- `pg`: mixed prompt + generation

3. Hardware/runtime mode:
- thread count
- flash attention
- tensor repack mode (`rtr`)
- model-specific flags like `muge`

Because of this, `tg` results alone are not enough. `pg` must be benchmarked and tuned separately.

## Main Runtime Parameters

### `-t <N>`
What it is:
- CPU worker thread count.

Why it matters:
- It directly changes throughput, scheduling pressure, cache behavior, and cross-CCD traffic.

What it gives:
- Higher `-t` can improve throughput, but too high can reduce efficiency.

Current guidance on this host:
- Safe starting point: `-t 16`
- For in-RAM models, also test `24` and `32`
- For swap-bound models, do not assume more threads helps enough to justify the cost

Compatibility impact:
- None. This is a runtime tuning flag only.

### `-fa 1`
What it is:
- Flash attention enable flag.

Why it matters:
- It affects attention kernel behavior and often improves throughput on this machine.
- It is now confirmed to matter much more for mixed prompt+generation (`pg`) than TG-only on the current Zen4 host.

What it gives:
- Better baseline performance in current benchmark sets.
- On current `pg512,128` validation:
  - `Qwen3-30B-A3B-Q4_K_M`: about `94.27 -> 103.38 t/s` with `-fa 0 -> 1`
  - `gpt-oss-20b-MXFP4`: about `84.40 -> 88.89 t/s` with `-fa 0 -> 1`

Current guidance on this host:
- Use `-fa 1` as the standard benchmark and runtime baseline unless a test is specifically checking otherwise.
- For mixed-path work, do not treat `-fa` as a minor toggle. It is a first-order benchmark parameter.

Compatibility impact:
- None for model compatibility. Performance behavior only.

### `-rtr off|on|auto`
What it is:
- Run-time tensor repack mode.

Why it matters:
- Repack can materially change throughput.
- It can also change load-time behavior, especially for very large models.

What it gives:
- `off`: shortest startup in some cases, but often lower throughput
- `on`: explicit repack, often strong throughput
- `auto`: lets runtime decide using model/RAM-aware policy

Current guidance on this host:
- `auto` is the best default starting point for current MoE work
- `on` is still a valid A/B mode
- `off` is mainly for startup-sensitive or diagnostic runs

Compatibility impact:
- Backward compatible. Existing `rtr` workflows remain valid.
- `auto` is additive; it does not remove old modes.

### `-muge 0|1`
What it is:
- Controls merge-up-gate-experts behavior.

Why it matters:
- It can be model-sensitive and affects MoE execution layout.

Current guidance:
- Do not assume one value is universally best across all MoE families.
- For current validated profiles in these docs, recommendations are always written with the exact tested `muge` value.

Compatibility impact:
- Runtime behavior only.

## Recommended Starting Profiles

### A) In-RAM MoE, general default
Use this first:

```bash
llama-cli.exe -m model.gguf -t 16 -fa 1 --run-time-repack auto
```

If you benchmark:

```bash
llama-bench.exe -m model.gguf -t 16 -fa 1 -rtr auto -p 512 -n 0 -r 3 -o json
llama-bench.exe -m model.gguf -t 16 -fa 1 -rtr auto -p 0 -n 128 -r 3 -o json
llama-bench.exe -m model.gguf -t 16 -fa 1 -rtr auto -pg 512,128 -r 3 -o json
```

Why:
- Current in-RAM matrix shows `auto` best or effectively tied with `on`.
- `pg` especially benefits vs `off`.

### B) Swap-bound MoE, throughput-first
Use this first:

```bash
llama-cli.exe -m model.gguf -t 16 -fa 1 --run-time-repack auto
```

Benchmark set:

```bash
llama-bench.exe -m model.gguf -t 16 -fa 1 -rtr auto -p 0 -n 128 -r 1 -o json
llama-bench.exe -m model.gguf -t 16 -fa 1 -rtr auto -pg 512,128 -r 1 -o json
```

Why:
- Current swap-bound data still favors `auto` or `on` in throughput.

Important warning:
- Startup/load wall time can become much longer than `off`.
- If startup latency matters more than steady-state throughput, test `off`.

### C) Swap-bound MoE, startup-sensitive
Use this as a comparison mode:

```bash
llama-cli.exe -m model.gguf -t 16 -fa 1 --run-time-repack off
```

Why:
- Current load probes show much shorter startup on large swap-bound runs with `off`.

What you give up:
- Lower steady-state throughput in current measurements.

## What To Benchmark Before Making Claims
Minimum benchmark set for any serious comparison:
1. `pp512`
2. `tg128`
3. `pg512,128`
4. `rtr off/on/auto`

Why:
- A single TG number does not characterize MoE runtime behavior.

## Model-Specific Notes

### Qwen3-30B-A3B Q4_K_M
Observed pattern on this host:
- `rtr auto/on` clearly outperform `off`
- `pg` benefits strongly from repack-enabled modes
- `pg` also benefits materially from `-fa 1`; keep flash attention enabled in all default mixed-path profiles

Practical baseline:

```bash
llama-bench.exe -m <qwen.gguf> -t 16 -fa 1 -muge 0 -rtr auto -p 512 -n 0 -r 3
llama-bench.exe -m <qwen.gguf> -t 16 -fa 1 -muge 0 -rtr auto -p 0 -n 128 -r 3
llama-bench.exe -m <qwen.gguf> -t 16 -fa 1 -muge 0 -rtr auto -pg 512,128 -r 3
```

### gpt-oss-20b MXFP4
Observed pattern:
- `auto/on` are generally stronger than `off`
- PP can be noisy; repeated runs are important
- `pg` also benefits from `-fa 1`; the gain is smaller than Qwen but still material on this host

Practical baseline:

```bash
llama-bench.exe -m <gptoss20b.gguf> -t 16 -fa 1 -rtr auto -p 512 -n 0 -r 3
llama-bench.exe -m <gptoss20b.gguf> -t 16 -fa 1 -rtr auto -p 0 -n 128 -r 3
llama-bench.exe -m <gptoss20b.gguf> -t 16 -fa 1 -rtr auto -pg 512,128 -r 3
```

## Experimental Prompt-Packed QKV

There is now an experimental prompt-only optimization path:

```powershell
$env:IK_LLAMA_PROMPT_PACKED_QKV='1'
```

Optional partial range:

```powershell
$env:IK_LLAMA_PROMPT_PACKED_QKV_RANGE='start:end'
```

Optional preset policy:

```powershell
$env:IK_LLAMA_PROMPT_PACKED_QKV_PRESET='auto'
```

What it does:
- runtime-packs split `wq/wk/wv` into a prompt-only `qkv`
- affects prompt-like batches only
- does not change decode path
- is disabled when LoRA adapters are active

What current results say:
- `Qwen`:
  - `pp512`: about `+1.71%`
  - `pg512,128`: about `+1.47%`
- `gpt-oss-20b`:
  - `pg512,128`: about `+0.53%`
  - `pp512` is inconclusive/noisy

What it costs:
- more RAM:
  - `Qwen`: about `+480 MiB`
  - `gpt-oss-20b`: about `+337.5 MiB`
- after load-path optimization, startup overhead is much smaller than in the first prototype:
  - `Qwen`: about `+9.6%`
  - `gpt-oss-20b`: about `+4.8%`

Recommendation:
- treat this as an engineering experiment, not as a default profile
- useful for targeted A/B investigation
- not recommended as a general user-facing default on current evidence, because throughput gain is still small

What partial packing changes:
- current evidence shows that packing only part of the layers can be a better tradeoff than packing all layers
- on current validated runs:
  - `Qwen3-30B-A3B-Q4_K_M`: front half (`0:24`) was slightly better than full pack for `pg512,128`
  - `gpt-oss-20b-MXFP4`: back half (`12:24`) was slightly better than full pack for `pg512,128`

Practical examples:

```powershell
$env:IK_LLAMA_PROMPT_PACKED_QKV='1'
$env:IK_LLAMA_PROMPT_PACKED_QKV_RANGE='0:24'
llama-bench.exe -m <qwen.gguf> -t 16 -fa 1 -muge 0 -rtr auto -pg 512,128 -r 3
```

```powershell
$env:IK_LLAMA_PROMPT_PACKED_QKV='1'
$env:IK_LLAMA_PROMPT_PACKED_QKV_RANGE='12:24'
llama-bench.exe -m <gptoss20b.gguf> -t 16 -fa 1 -rtr auto -pg 512,128 -r 3
```

Current interpretation:
- `pack all layers` is not a universal rule
- useful layer ranges are architecture-sensitive
- this path remains for engineering experiments and should not be surfaced as a general end-user default yet

Current experimental preset policy:
- if `IK_LLAMA_PROMPT_PACKED_QKV_RANGE` is set, it wins
- otherwise `IK_LLAMA_PROMPT_PACKED_QKV_PRESET` can be used
- supported preset values:
  - `auto`
  - `full`
  - `front-half`
  - `back-half`

Current `auto` mapping on validated architectures:
- `Qwen3MoE` -> `front-half`
- `OpenAI MoE` -> `back-half`

Practical examples:

```powershell
$env:IK_LLAMA_PROMPT_PACKED_QKV='1'
$env:IK_LLAMA_PROMPT_PACKED_QKV_PRESET='auto'
llama-bench.exe -m <model.gguf> -t 16 -fa 1 -rtr auto -pg 512,128 -r 3
```

```powershell
$env:IK_LLAMA_PROMPT_PACKED_QKV='1'
$env:IK_LLAMA_PROMPT_PACKED_QKV_PRESET='auto'
$env:IK_LLAMA_PROMPT_PACKED_QKV_RANGE='24:48'
llama-bench.exe -m <qwen.gguf> -t 16 -fa 1 -muge 0 -rtr auto -pg 512,128 -r 3
```

The second example is intentional:
- explicit range remains the override mechanism
- preset is the reusable default experiment
- range is the manual escape hatch

### Very large swap-bound MoE
Observed pattern in current 120b run:
- throughput: `auto ~= on > off`
- startup time: `off << on ~= auto`

This is the key tradeoff to remember.

## What Not To Do
1. Do not assume TG-only results are enough.
2. Do not assume `rtr off` is always safer just because model is large.
3. Do not assume startup-faster means total throughput-faster.
4. Do not copy Zen4 settings to another machine without measurement.
5. Do not compare benchmark runs if `t`, `fa`, `muge`, `rtr`, or scenario changed and you did not label it.
6. Do not disable `-fa` for mixed-path tuning unless the experiment is explicitly about attention-path A/B.

## Backward Compatibility
These runtime recommendations do **not** remove compatibility with:
- `Q`
- `IQ`
- `UD-Q`

What changes:
- only the recommended runtime policy and benchmark discipline

What does not change:
- model support direction
- CLI compatibility of old flags

## Canonical References
- `project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-27.md`
- `project_docs/benchmarks/INDEX.md`
- `project_docs/benchmarks/RTR_POLICY.md`
- `project_docs/strategy/EXECUTION_PLAN_ZEN4_MOE_2026-02-27.md`
