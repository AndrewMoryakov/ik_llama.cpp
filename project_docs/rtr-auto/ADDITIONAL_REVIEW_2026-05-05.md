# Additional review notes — independent confirmation and small items

Date: 2026-05-05
PR: https://github.com/ikawrakow/ik_llama.cpp/pull/1738
Reviewed snapshot: `0115ace21eaee3853f015f5e703ffef2ec2a8acc`

This file is a short companion to `DEEP_REVIEW_2026-05-05.md` and
`FOLLOWUP_REVIEW_2026-05-05.md`. It records two things only:

1. Independent code-inspection that arrived at the same verified-clean
   outcomes those two reviews already documented. Useful as a second
   pair of eyes confirmation, not as new information.
2. Two small items that did not appear in either prior review and
   should fold into the eventual minimal patch.

For the full structured analysis of bugs, architecture options, and
maintainer questions, see DEEP_REVIEW (F1-F7, C1-C5) and FOLLOWUP_REVIEW
(D1-D9, options A/B/C).

## Independent confirmation of DEEP_REVIEW C-section

Re-inspection of the relevant source confirmed each of DEEP_REVIEW's
verified-clean items via the same chain of reasoning:

- C1 multi-shard GGUF size accounting: confirmed at
  `src/llama-model-loader.cpp:349-394` (shard discovery via `n_split`)
  and line 423 (`n_bytes` accumulation across all weights).
- C2 probe does not mmap tensor data: probe constructor passes
  `repack_tensors=false`, no tensor loading path is exercised.
- C3 probe resource lifetime: `llama_model_loader probe(...)` and
  `llama_model probe_model;` are stack-local with RAII; no leak path.
- C4 threshold math: walked through `phys_ram` from 0 to 2 TiB,
  `uint64_t` arithmetic safe, `size_t` cast benign on 64-bit targets.
- C5 concurrency: no static state in our additions, `format()` uses
  local `va_list`, `LLAMA_LOG_*` thread-safe per upstream contract.

No additional concerns surfaced beyond what DEEP_REVIEW already states.

## Probe failure exception coverage (separate from C-section)

DEEP_REVIEW's verified-clean section does not explicitly enumerate
exception types thrown from the probe codepath. Confirmed by inspection
that every `throw` statement in `src/llama-model-loader.cpp`,
`src/llama-load-tensors.cpp`, `src/llama-build-context.cpp`, and
`src/llama.cpp` reachable from probe is `std::runtime_error`.
Standard library throws (`std::bad_alloc`, `std::ios_base::failure`)
all derive from `std::exception`. The `catch (const std::exception &)`
in `llama_rtr_auto_should_disable` covers them all. No bare `throw 42`
or `throw "..."` patterns to slip past the catch.

This addresses one open thread from `TASK_DEEP_REVIEW_2026-05-05.md`
section 7 that DEEP_REVIEW left implicit.

## Small items for the minimal patch (path 1)

These are not in DEEP_REVIEW or FOLLOWUP_REVIEW. They are trivial but
easy to forget when changing the metric from total to available memory.

### Help text wording

`common/common.cpp` currently says:

```
for swap-bound MoE (model > 90%% of RAM)
```

After the dmaivel fix the metric flips from total physical RAM to
available memory. The text should follow:

```
for swap-bound MoE (model > 90%% of available memory)
```

### PR description Validation table row

The current PR body has a row demonstrating the `n_gpu_layers > 0`
skip:

```
| Qwen3-30B with `-rtr auto -ngl 1` | keep enabled (GPU offload skip path) | logs `keeping repack enabled` |
```

After removing the skip, this row no longer demonstrates the design.
Replace with a row that mirrors dmaivel's case:

```
| Qwen3-30B with `-rtr auto -ngl 99 -ot exps=CPU` and undersized RAM | auto-disable | available memory triggers the threshold |
```

Or close paraphrase. Point: prove that `-ot exps=CPU` keeping experts
on CPU is now correctly caught.

## Open question for the maintainer (echoes FOLLOWUP D5)

FOLLOWUP_REVIEW's D5 raised "probe failure currently means keep repack,
which is not safety-first". This is a real design choice:

- Permissive default (current): probe exception leaves user's `-rtr`
  setting alone. Performance-first.
- Safety-first default: probe exception disables repack, prints WARN.
  Conservative.

Worth surfacing alongside the path-1-vs-path-2 question if
ikawrakow's reply does not cover it implicitly.

## Combined open-issues snapshot after this pass

Same as DEEP_REVIEW + FOLLOWUP_REVIEW would yield, restated for clarity:

- Critical bugs to fix immediately if path 1 is chosen: 2 (F1, F2 from
  DEEP_REVIEW, equivalently the n_gpu_layers skip and the total RAM
  metric).
- Architecture decisions on the maintainer: 3 (path 1 vs 2 vs 3,
  probe-failure default, cgroup-awareness expectations).
- Small fixes to absorb into whatever patch ships: 2 (help text
  wording, PR description Validation table).
- Verified clean: ~6-7 categories (C1-C5 plus probe-exception
  coverage; FOLLOWUP did not contradict any of these).

## Stop rule (matches DEEP_REVIEW and FOLLOWUP_REVIEW)

Hold all code changes until ikawrakow chooses the architecture. The
minimal F1+F2 patch is small but should not preempt the larger
architectural choice.
