# Post-submit bug — `-rtr 0` and `-rtr auto` mmap regression

**PR**: #1738 (`runtime : add --run-time-repack auto mode for swap-bound MoE safety`)  
**Date discovered**: 2026-05-05 during a deep self-review session  
**Date fixed**: 2026-05-05 (commit `0115ace21`, force-pushed over `f9e49b2c0`)  
**Time-in-the-wild**: ~12 часов в submitted-but-not-merged состоянии

## Summary

Парсер `-rtr` в `common/common.cpp` устанавливал `params.use_mmap = false`
**unconditionally** перед разбором значения. Это leaked в двух сценариях:

1. `-rtr 0` (явное отключение repack) — mmap тоже становился false как side-effect.
2. `-rtr auto` на swap-bound моделях — `use_mmap` оставался false даже когда
   auto-policy disabled repack. Loader получал `use_mmap=false` для модели
   которая не помещается в RAM → catastrophic OOM или fail. **Это был
   именно тот сценарий который feature должна была спасать.**

Фикс: парсер теперь определяет финальное состояние repack/auto **до** того
как касается mmap, и форсит `use_mmap=false` только когда repack гарантированно
будет работать (legacy `-rtr` / `-rtr 1`). В load logic дополнительно: если
auto **keeps repack enabled** → set `use_mmap=false` (legacy alignment); если
auto **disables repack** → leave `use_mmap` untouched.

## The buggy code (commit `f9e49b2c0`)

```cpp
if (arg == "-rtr" || arg == "--run-time-repack") {
    params.repack_tensors = true;
    params.repack_tensors_auto = false;
    params.use_mmap = false;       // ← BUG: unconditional, before parsing value

    if (i + 1 < argc) {
        std::string v = argv[i + 1];
        // ... parse "0" / "1" / "auto" ...
        if (is_mode_token) {
            ++i;
            if (v == "0" || v == "off") {
                params.repack_tensors = false;
                // params.use_mmap = false уже set выше — НЕ переоткатывается
            }
            // ... other branches ...
        }
    }
    return true;
}

if (arg == "-rtra" || arg == "--run-time-repack-auto") {
    params.repack_tensors = true;
    params.repack_tensors_auto = true;
    params.use_mmap = false;       // ← same bug pattern
    return true;
}
```

## Affected scenarios

| Команда | До fix | После fix |
|---------|--------|-----------|
| `-rtr 0` | repack=false, **mmap=false** 🐛 | repack=false, mmap=true ✓ |
| `-rtr auto` (in-RAM) | repack=true, mmap=false | repack=true, mmap=false (set in load) ✓ |
| `-rtr auto` (swap-bound) | repack=false (auto), **mmap=false** 🐛 → OOM | repack=false, mmap=true (default) ✓ |
| `-rtra` (== `-rtr auto`) | same as `-rtr auto` | same as `-rtr auto` ✓ |
| `-rtr 1` (legacy) | repack=true, mmap=false | unchanged ✓ |
| (no `-rtr`) | repack=false, mmap=true | unchanged ✓ |

Самый опасный сценарий — №3: feature **спасала** swap-bound MoE от
−50% TG регрессии, но баг превращал её в OOM-fail. То есть fixing one
problem (rtr thrashing) introduced a worse one (loader cannot allocate
huge model without mmap).

## Why pre-submit verification missed it

В `project_docs/rtr-auto/ANALYSIS.md` test plan был:

- ✅ in-RAM Qwen3-30B: бенч `-rtr auto` vs `-rtr 1` дают идентичные числа
- ✅ swap-bound 123 GiB: log message «disabled (MoE model 123.6 GiB > 90% of RAM 95.1 GiB)»
- ✅ probe failure: graceful fallback с warning

Ни один из этих чек **не проверяет конечное состояние `params.use_mmap`
после auto-policy решения**. Я измерил **видимое** поведение (log lines,
bench numbers) но не **невидимое** state (mmap value passed to loader).

На swap-bound я остановил test после log line «disabled (...)» — **до**
того как loader actually пытался load model. Если бы дождался полного
load — увидел бы fail/hang/OOM.

В терминах паттернов:

> Pre-submit testing focused on positive case (новая фича работает),
> miss-fail на boundary где новая фича переплетается с existing legacy code
> (parser side-effect на mmap).

## Timeline

| Время | Событие |
|-------|---------|
| 2026-05-04 14:30 | Initial commit `f9e49b2c0` pushed to fork |
| 2026-05-04 14:35 | PR #1738 opened |
| 2026-05-04 23:25 | Community comment from @Ph0rk0z (UX, не bug) |
| 2026-05-05 ~10:00 | User инициировал deep self-review |
| 2026-05-05 ~11:00 | Bug found via systematic 12-scenario walk-through |
| 2026-05-05 ~11:30 | Fix amended into commit `0115ace21`, force-pushed |
| 2026-05-05 ~11:35 | Self-review comment posted explaining the bug + fix |

## Fix details

### `common/common.cpp` — определять final state до mmap-side-effect

```cpp
if (arg == "-rtr" || arg == "--run-time-repack") {
    bool repack      = true;       // default if no value
    bool repack_auto = false;

    if (i + 1 < argc) {
        std::string v = argv[i + 1];
        // ... lowercase, check is_mode_token ...
        if (is_mode_token) {
            ++i;
            if (v == "0" || v == "off")     { repack = false; repack_auto = false; }
            else if (v == "1" || v == "on") { repack = true;  repack_auto = false; }
            else /* "auto" */               { repack = true;  repack_auto = true;  }
        }
    }

    params.repack_tensors      = repack;
    params.repack_tensors_auto = repack_auto;

    // Only force use_mmap=false когда repack actually runs unconditionally
    // (legacy `-rtr` / `-rtr 1`). For -rtr 0 (disable) и -rtr auto (may
    // disable at load) leave use_mmap alone.
    if (repack && !repack_auto) {
        params.use_mmap = false;
    }
    return true;
}

if (arg == "-rtra" || arg == "--run-time-repack-auto") {
    params.repack_tensors      = true;
    params.repack_tensors_auto = true;
    // Same reasoning — auto policy may disable repack at load.
    return true;
}
```

### `src/llama.cpp` — handle mmap при auto-decision

```cpp
if (params.repack_tensors && params.repack_tensors_auto) {
    std::string reason;
    if (llama_rtr_auto_should_disable(fname, params, reason)) {
        // Auto policy turns repack off — leave use_mmap as the user
        // configured it (default true, или whatever --no-mmap chose).
        params.repack_tensors = false;
        LLAMA_LOG_INFO("...auto: disabled (%s)\n", reason.c_str());
    } else {
        // Auto keeps repack enabled — match the legacy `-rtr 1` coupling
        // и force use_mmap=false so the repack pass can write back into
        // the tensor buffers.
        params.use_mmap = false;
        LLAMA_LOG_INFO("...auto: keeping repack enabled\n");
    }
}
```

## Verification после fix

12-scenario matrix walk-through (см. ANALYSIS.md sections after this discovery)
показал что все пути теперь consistent. Empirically retested:
- in-RAM Qwen3-30B `-rtr auto`: log «keeping repack enabled», bench numbers
  match `-rtr 1` ✓
- 123 GiB VariantA `-rtr auto`: log «disabled (MoE model 123.6 GiB > 90%
  of RAM 95.1 GiB)», loader proceeds with default mmap=true ✓
- `-rtr 0`: not testable empirically через standard logs (use_mmap не
  печатается в default verbosity), но code review confirms fixed

## Root-cause categorization

**Pattern**: «behavioural-change PR introduces parser side-effect that
contradicts the new behaviour's intended semantics».

Specifically:
- Original `-rtr` legacy form had `params.use_mmap = false` as legitimate
  side-effect (rtr requires mmap=false для tensor write-back).
- New `-rtr 0` and `-rtr auto` modes don't *necessarily* run repack →
  side-effect leaks past intended scope.
- Easy to miss because legacy code preserved unchanged at top of parser
  (`params.repack_tensors = true; params.use_mmap = false;`) и feels safe.

## What would have caught this

### Не существующие в проекте (test infrastructure gaps)

1. **Unit test для `gpt_params_find_arg`**: parameterized test taking
   argv arrays и asserting final `gpt_params` field values. Would have
   immediately caught `params.use_mmap = false` after `-rtr 0`.
   ```cpp
   TEST(GptParams, RtrZeroPreservesMmap) {
       gpt_params p;
       parse_argv(p, {"-rtr", "0"});
       EXPECT_TRUE(p.use_mmap);  // would have failed
   }
   ```
2. **Integration test**: mock-loader test что simulating end-to-end
   `parse_argv → common_model_params_to_llama → llama_model_load` and
   asserting on final `llama_model_params` state. Would have caught the
   auto-disable + mmap-already-false interaction.

3. **CI run on a swap-bound model**: not realistic for upstream CI but
   self-imposed pre-submit "boot the actual model not just check log"
   discipline would have caught it.

### Существует в проекте

`tests/` directory: backend-ops, tokenizer, chat, grammar, JSON. **Нет**
тестов на CLI parser. **Нет** integration tests на load flow. **Нет**
infrastructure для verifying parser side-effects.

Это типичная gap для C++ inference projects — CLI surface считается
manually-tested. У ggerganov/llama.cpp the same.

## Lessons learned

1. **Visible vs invisible state**: log messages != actual final state.
   Pre-submit verification must include checking **all** params after
   parse → load chain, not just observable side-effects (logs, perf).

2. **Parser side-effects на existing fields**: any time a CLI parser
   touches `params.X` для new flag, audit ALL other code paths that
   downstream depend on `params.X`. Side-effect that's safe in legacy
   path is dangerous in new modes.

3. **End-to-end empirical test**: actually load the model, не stop at
   log line. For swap-bound case, even loading until OOM/fail tells
   more than reading a log message.

4. **Self-review window matters**: bug found несколько часов после
   submission, после "cooler" review. Pre-submit verification immediately
   after writing code suffers from author bias («I just tested this,
   it works»).

5. **Walk-through всех scenarios systematically**: 12-scenario matrix
   table (включая edge cases like `--no-mmap` order, multiple rtr flags,
   garbage values) caught the issue. Spot-checking a few main scenarios
   isn't sufficient.

6. **Document the matrix**: a matrix of (input flags) × (final state)
   would have been useful as a pre-submit document. The walk-through
   that found the bug essentially built this matrix retroactively.
   Можно сделать в following PRs.

## Recommended pre-submit checklist для behavioural-change PRs

(For future similar work — `-rtr auto` это not last cross-cutting feature).

```
[ ] List all CLI flags affected by new feature
[ ] Build matrix: every input flag combination × every final state field
[ ] For each matrix cell — manually verify expected value of final state
[ ] Verify visible behavior (logs, perf) AND invisible state (params)
[ ] End-to-end load test, не stop at first log line indicating success
[ ] Test edge cases: order of flags, garbage values, multiple of same flag
[ ] If feature interacts with pre-existing flags — review their parsers
    for side effects that contradict new mode semantics
[ ] Diff parser carefully — search for unconditional `params.X = ...`
    before optional value parsing
[ ] Self-review with 2+ hour gap (cooler view) before pushing
```

## References

- Initial PR commit: `f9e49b2c0`
- Fix commit: `0115ace21`
- Self-review comment: https://github.com/ikawrakow/ik_llama.cpp/pull/1738#issuecomment-4376149155
- Analysis doc (pre-submit): [`ANALYSIS.md`](ANALYSIS.md)
- Project plan: [`../strategy/UPSTREAM_CONTRIBUTOR_PLAN_2026-05-04.md`](../strategy/UPSTREAM_CONTRIBUTOR_PLAN_2026-05-04.md)
