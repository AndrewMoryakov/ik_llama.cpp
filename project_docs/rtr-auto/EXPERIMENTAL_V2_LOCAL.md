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

## Testing locally

Two quick smoke checks:

1. **In-RAM Qwen3-30B**: should report
   `--run-time-repack auto v2: keeping repack enabled` when
   available memory is high relative to model size.
   ```
   .\build\bin\Release\llama-cli.exe -m Qwen3-30B-A3B-Q4_K_M.gguf -t 16 -fa 1 -rtr auto -n 16 --experimental rtr-auto-v2=on
   ```

2. **Swap-bound MiniMax M2.5**: should report
   `--run-time-repack auto v2: disabled (...)` with the threshold
   message naming MiniMax M2 model and the actual available memory.
   ```
   .\build\bin\Release\llama-cli.exe -m D:\ggufs\un\minimax2.5-m2\<file> -t 16 -fa 1 -rtr auto -n 16 --experimental rtr-auto-v2=on
   ```

Compare against the same commands without the `--experimental` flag to
verify v1 path is untouched.

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
