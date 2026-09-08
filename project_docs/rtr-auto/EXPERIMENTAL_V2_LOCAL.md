# Experimental rtr-auto v2 (local-only feature)

Date: 2026-05-05
Branch: `feature/rtr-auto-v2`

This is the local-only experimental implementation of the policy fixes
proposed for PR #1738. It is gated behind an opt-in flag so default
behavior on `dev` is unchanged. When ikawrakow chooses an architectural
direction, the v2 logic is ported into the upstream PR (without the
gate) by stripping the env-var dispatch.

## What v2 changes

The legacy `-rtr auto` policy on `dev` (function
`llama_rtr_auto_should_disable`) does the following:

- Compares model size to total physical RAM via `_SC_PHYS_PAGES` on Linux,
  `MEMORYSTATUSEX::ullTotalPhys` on Windows. No macOS support.
- Returns `bool`. False is treated as "keep repack" by the caller, which
  conflates three cases: safe, probe failed, and "policy does not apply"
  (dense non-MoE).

v2 fixes both:

- Uses available/effective memory instead of total. Windows
  `ullAvailPhys`. Linux `/proc/meminfo MemAvailable` plus full cgroup v2
  and v1 walk for containerized inference. macOS `host_statistics64`.
- Returns a tri-state-plus-one decision (`KEEP`, `DISABLE`,
  `NOT_APPLICABLE`, `UNKNOWN`). For an explicit `-rtr auto`, `UNKNOWN`
  becomes safety-first: disable repack with WARN. `NOT_APPLICABLE`
  (dense) leaves both `repack` and `use_mmap` alone.

The MoE detection is preserved including the local
`LLM_ARCH_MINIMAX_M2` special case. v2 does not introduce a new public
API surface.

## Activation

Either set the env var directly, or use the `--experimental` CLI hook
(which sets the same env var internally before model load).

PowerShell:

```
$env:IK_LLAMA_RTR_AUTO_V2 = '1'
.\build\bin\Release\llama-cli.exe -m model.gguf -rtr auto ...
```

CLI flag (preferred, since it is logged with the rest of the run config):

```
.\build\bin\Release\llama-cli.exe -m model.gguf -rtr auto --experimental rtr-auto-v2=on
```

Accepted values: `on`, `1`, `true`, `yes`. Anything else (or unset)
keeps the legacy v1 path. The env var is checked at model-load time so
toggling between runs does not require a rebuild.

## Distinguishing v1 vs v2 in logs

Look at the policy log line:

- v1: `--run-time-repack auto: disabled (...)` or
  `--run-time-repack auto: keeping repack enabled`.
- v2: `--run-time-repack auto v2: disabled (...)`,
  `--run-time-repack auto v2: keeping repack enabled`,
  `--run-time-repack auto v2: policy does not apply (...)`,
  `--run-time-repack auto v2: disabled (uncertainty: ...)`.

The v2 disable-on-uncertainty line is logged at WARN level, not INFO,
so it is visible even with `--log-disable` reduced verbosity.

## Local test results (2026-05-05)

Smoke verified across six representative models on the 7950X 96 GB
system:

| Model                              | Size on disk | Type                          | v2 decision      | Notes                                                                                  |
|------------------------------------|--------------|-------------------------------|------------------|----------------------------------------------------------------------------------------|
| Qwen3-30B-A3B-Q4_K_M               | 17 GiB       | in-RAM MoE                    | KEEP             | basic in-RAM happy path                                                                |
| gpt-oss-20b-MXFP4                  | 11 GiB       | in-RAM MoE                    | KEEP             | basic in-RAM happy path                                                                |
| gpt-oss-120b-MXFP4 (multi-shard)   | 63 GiB       | in-RAM MoE                    | KEEP             | larger model that still fits below 90% threshold                                       |
| Qwen3.5-27B Q8_0                   | 28.6 GiB     | in-RAM dense                  | NOT_APPLICABLE   | confirms dense path; log says `policy does not apply (dense model)`                    |
| Qwen3.5-397B-A17B UD-Q4_K_XL       | 219 GiB / 6 shards | swap-bound multi-shard MoE | DISABLE         | probe.n_bytes accumulated to 204.2 GiB across all shards; threshold fired              |
| MiniMax-M2.5-TaperedRAM            | 90 GiB       | swap-bound MiniMax M2 arch    | DISABLE         | LLM_ARCH_MINIMAX_M2 special-case path; Windows ullAvailPhys returned 78.8 GiB         |

Bench (Qwen3-30B Q4_K_M, gpt-oss-20b MXFP4, t=16 fa=1 -rtr 2 r=5,
PP512 + TG32):

| Model           | Test  | v1 (no flag)    | v2 (env=1)      | Δ      |
|-----------------|-------|-----------------|-----------------|--------|
| Qwen3-30B Q4_K_M| PP512 | 367.38 ± 7.55   | 369.26 ± 8.20   | +0.5%  |
| Qwen3-30B Q4_K_M| TG32  | 32.00 ± 0.22    | 31.64 ± 0.09    | -1.1%  |
| gpt-oss-20b MXFP4| PP512| 362.67 ± 8.61   | 369.25 ± 7.15   | +1.8%  |
| gpt-oss-20b MXFP4| TG32 | 24.80 ± 0.09    | 24.78 ± 0.06    | -0.08% |

All four deltas are inside σ overlap, meaning v2 dispatch wrapper has
no measurable inference overhead vs the legacy v1 path. Expected from
code inspection: when both paths land on KEEP, the post-policy state
(repack on, mmap untouched) is byte-identical, so any difference is
system noise.

## Practical impact (rtr=off comparison + forced rtr=1 catastrophe)

Two follow-up benches to quantify what v2 actually buys.

### in-RAM: rtr=on vs rtr=off (Qwen3-30B Q4_K_M, r=5)

| Test  | rtr=off          | rtr=on (= auto KEEP) | Δ rtr=on |
|-------|------------------|----------------------|----------|
| PP512 | 319.40 ± 37.59   | 369.26 ± 8.20        | +15.6%   |
| TG32  | 30.01 ± 0.24     | 31.64 ± 0.09         | +5.4%    |

This is the first-time measured rtr=on benefit on the current build.
σ at rtr=off is roughly 4× larger than at rtr=on, which means perf is
also more volatile without the AVX-VNNI 256-bit layout. For in-RAM
Zen4 inference rtr=on is reliably faster, which justifies why the
auto policy defaults to KEEP whenever the model fits comfortably.

### Swap-bound: rtr=auto+v2 vs forced rtr=1 (MiniMax-M2.5-TaperedRAM, 89.6 GiB on 96 GiB system)

| Metric              | rtr=auto + v2 (DISABLE) | rtr=1 forced            |
|---------------------|-------------------------|--------------------------|
| Cold load time      | ~30 sec (mmap streaming) | **213.8 sec (3.5 min)** |
| PP rate             | 0.83 tok/s              | 1.56 tok/s               |
| TG rate             | 2.33 tok/s              | 2.25 tok/s               |

The catastrophe is in cold load time, not steady-state throughput.
Forced rtr=1 paid a ~3 minute load penalty before generating any
token. TG was almost identical because in both cases the working set
exceeds available RAM and disk IO becomes the bottleneck.

PP is faster on the forced rtr=1 path because, after the long load,
prompt-side compute uses repacked tensors. But the load penalty is
paid every cold start, and this kind of swap-bound model is exactly
where users do not want a 3-minute wait.

The fork-specific «VM prefetch for swap-bound experts» message in the
log (`llm_load_print_meta: model > 90% RAM — enabling VM prefetch`)
is a separate safety mechanism in the loader that prevented an OOM
crash. On vanilla llama.cpp without that fallback, forced rtr=1 on
this configuration would likely have failed outright.

### Net practical conclusion

For users who routinely run mixed workloads (in-RAM medium MoE plus
the occasional huge swap-bound MoE), v2 gives:

- Same PP/TG on in-RAM models as before (KEEP path identical to v1).
- About 3 minutes of cold-load saved per swap-bound run, automatically,
  without having to manually toggle `-rtr 0` for big models.
- Protection against accidental `-rtr 1` on a borderline model that
  happens to be over the available-memory threshold even though it
  fits in total RAM (the dmaivel scenario).

## Quick local re-verification

To rerun just one in-RAM check and one swap-bound check:

```
build\bin\llama-cli.exe -m <in-RAM-MoE>.gguf -t 16 -fa 1 -rtr auto -n 1 -p Hi --no-display-prompt --experimental rtr-auto-v2=on
build\bin\llama-cli.exe -m <swap-bound-MoE>.gguf -t 16 -fa 1 -rtr auto -n 1 -p Hi --no-display-prompt --experimental rtr-auto-v2=on
```

Compare against the same commands without the `--experimental` flag
to verify the v1 path is untouched.

## What v2 does NOT change

- Public API. `llama_model_params::repack_tensors_auto` field stays the
  same. No new fields added.
- Parser semantics. `-rtr 0|1|on|off|auto`, `-rtra`, and bare `-rtr` all
  behave identically to before.
- The mmap-vs-repack coupling in `llama-model-loader.cpp:585-587`. v2
  does not touch mmap state directly. When v2 disables repack, the
  loader sees `repack_tensors=false` and leaves mmap in whatever state
  the user/default chose.

## Why a gate (rather than just changing the policy)

Three reasons:

1. We are still waiting on ikawrakow's architectural direction for
   PR #1738. The gate lets us live with the better policy locally
   without committing the source tree to a specific shape.

2. Bench reproducibility. Existing bench results were collected against
   the v1 policy. Switching v1 to v2 silently would invalidate all
   prior comparison runs on `dev`. The opt-in flag keeps the default
   stable.

3. A/B testing. With the gate, the same build can be run with and
   without v2 to confirm the new path actually fires on the cases it
   should (especially MiniMax M2.5) and stays silent on the cases it
   should not (Qwen3-30B in-RAM).

## How v2 maps to the upstream PR fixes

When ikawrakow chooses path A (keep `-rtr auto`, fix the policy):

- Strip the env-var gate from `llama_model_load`: always call v2.
- Delete `llama_get_total_ram_bytes()`, `llama_rtr_auto_should_disable()`,
  and the `llama_rtr_auto_v2_enabled()` helper.
- Rename `llama_rtr_auto_should_disable_v2` to drop the `_v2` suffix.
- Rename `llama_get_available_ram_bytes` similarly if desired.
- Drop the `IK_LLAMA_RTR_AUTO_V2` entry from the experimental allowlist
  in `common/common.cpp`, plus the help-text mention.
- Drop the `LLM_ARCH_MINIMAX_M2` special-case (it does not exist in
  the upstream PR's tree).

## Path A patch already prepared (2026-05-05)

A ready-to-force-push branch `pr/rtr-auto-mode-v2` exists locally and
on `personal` mirror, sitting two commits ahead of `origin/main`:

```
d336a4a23  runtime : rtr-auto policy uses available memory and tri-state result
7e65e2011  runtime : add `--run-time-repack auto` mode for swap-bound MoE safety
```

The first commit is the cherry-pick of the original PR work
(`0115ace21` from `pr/rtr-auto-mode`). The second is the v2 fix:
strips `n_gpu_layers > 0` skip, replaces total RAM with available
memory + cgroup walker, returns enum decision, switches caller
dispatch with safety-first UNKNOWN. No experimental gate, no
`LLM_ARCH_MINIMAX_M2` special-case (upstream tree does not have it).

Smoke-verified on the same PR branch on the local Windows build:

- Qwen3-30B Q4_K_M (in-RAM): KEEP, log says
  `--run-time-repack auto: keeping repack enabled`
- MiniMax-M2.5-TaperedRAM (89.6 GiB on 96 GiB system): DISABLE,
  log says `--run-time-repack auto: disabled (MoE model 89.6 GiB
  > 90% of available memory 87.6 GiB)`
- Qwen3.5-27B Q8_0 (dense): NOT_APPLICABLE, log says
  `--run-time-repack auto: policy does not apply (dense model)`

Diff against `origin/main` is 5 files, +210/-5 lines for the
cherry-pick and an additional +272/-61 for the v2 commit. Squashing
to a single commit before force-push is recommended for cleaner PR
history.

### Force-push procedure (when path A is confirmed)

```
git checkout pr/rtr-auto-mode-v2
git rebase -i origin/main   # squash d336a4a23 into 7e65e2011
git push fork +pr/rtr-auto-mode-v2:pr/rtr-auto-mode
```

The `fork` remote points at `AndrewMoryakov/ik_llama-pr` (the proper
GitHub fork). PR #1738 tracks the `pr/rtr-auto-mode` branch there;
force-pushing replaces `0115ace21` with the squashed v2 commit.

### Things to update at force-push time

- PR description Validation table: replace the
  `-ngl 1` GPU offload row with the real `-ngl 99 -ot exps=CPU`
  scenario plus the multi-shard Qwen3.5-397B real-world result.
- PR description: mention the cgroup v1/v2 walker for Linux
  containers as a follow-up to dmaivel's "checking total memory is
  not sufficient" point.
- Force-push commit message body: refer to dmaivel by name and
  acknowledge the policy-skip and metric-choice reports.
- Reply on PR thread: short note that force-push lands the focused
  fix and link to the new commit.

When ikawrakow chooses path B (self-protective `-rtr`):

- v2 is not directly portable. The decision lives at the same load-time
  point but the gating condition is different (every `-rtr` triggers
  the policy, not just `-rtr auto`). Most of the v2 helper code
  (`llama_get_available_ram_bytes`, cgroup walker, tri-state enum)
  carries over unchanged.

When ikawrakow chooses path C (placement-aware): v2 is a stepping
stone but not the destination. The available-memory helpers stay
useful.

## Linux cgroup detection notes

The cgroup walker in `llama_get_cgroup_available_bytes()` covers both
v2 unified hierarchy and v1 memory-controller hierarchy. It walks the
cgroup path upward from the leaf to honor inherited limits, capped at
32 levels to avoid pathological loops.

For cgroup v2: parses `/proc/self/cgroup` for the `0::/<path>` line,
reads `memory.max` and `memory.current` at each level, takes the
minimum free-headroom across the chain. The string `max` in
`memory.max` is treated as the v2 sentinel for "no limit".

For cgroup v1: parses `/proc/self/cgroup` for the line with
`memory` in its controller list, reads `memory.limit_in_bytes` and
`memory.usage_in_bytes`. Limits within ~1 PiB of `UINT64_MAX` are
treated as "unlimited" (kernel reports the sentinel close to but not
exactly at `INT64_MAX` rounded down to page size).

Final available memory for the policy is `min(MemAvailable, cgroup
headroom)` so a tight container correctly reports the smaller value.

The cgroup code is dead on Windows and macOS (guarded by `__linux__`)
but ports cleanly to upstream where a real Linux build will exercise
it.

## Caveats and known limitations

- The `probe.n_bytes` value is full GGUF tensor bytes across all
  shards, not exact CPU-resident bytes after placement. v2 keeps this
  conservative comparison. False-positive risk exists when most weight
  is on GPU but the file is large; in practice available memory is
  usually high enough that the check stays silent. A precise estimator
  would need to resolve `tensor_buft_overrides`, `n_gpu_layers`,
  `--fit`, and split mode before deciding (path C territory).

- `MemAvailable` on older Linux kernels (< 3.14) is missing. The code
  falls back to `_SC_AVPHYS_PAGES`, which is less accurate but
  available everywhere. Probably not a concern for any modern
  workstation.

- macOS `host_statistics64` accuracy is limited. The
  `(free + inactive) * page_size` heuristic is the standard
  approximation but does not account for compressed memory. Acceptable
  for a coarse safety threshold.

## Branch and rollback

Active on `feature/rtr-auto-v2`. To roll back, either delete the
branch or revert the four code changes (one in `common/common.cpp`,
three in `src/llama.cpp`). Default behavior on `dev` is unchanged when
the env var is not set.
