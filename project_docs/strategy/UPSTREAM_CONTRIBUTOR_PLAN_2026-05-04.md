# Upstream Contributor Plan — 2026-05-04

План контрибьюций в `ikawrakow/ik_llama.cpp` после успеха PR #1729.

## Текущее состояние

- ✅ **PR #1729 merged** (2026-05-03): `docs : add AVX-512 build flags reference for Zen4 / Sapphire Rapids+`
- ikawrakow **invited follow-up** в финальном комментарии: «sure, go back to the original version. Or perhaps... offer the original version at the beginning and note that... they can use GGML_ARCH_FLAGS in that way»
- Fork для PRs: `AndrewMoryakov/ik_llama-pr` (proper fork, isFork=true)
- Local remote: `fork` → `https://github.com/AndrewMoryakov/ik_llama-pr.git`

## Приоритеты — пирамида от простого к серьёзному

Идея: каждый merged PR строит trust → maintainer привычно подписывает наши PRs → можно идти в более ambitious feature work.

---

## Tier 1 — Quick wins (завершить эту неделю)

### Item 1.1 — v3 hybrid docs (~15 минут)
**Status**: invited by maintainer  
**Risk**: 🟢 минимальный  
**File**: `docs/build.md` (наша existing section)

**Изменения**:
- Recommended path **first**: `-DGGML_AVX512=ON -DGGML_AVX512_VBMI=ON -DGGML_AVX512_VNNI=ON -DGGML_AVX512_BF16=ON -DGGML_NATIVE=ON`
- Note про fallback: «If your build does not produce `HAVE_FANCY_SIMD is defined` at runtime, or if you are cross-compiling for ARM where `-march=native` may not propagate flags, use the lower-level `GGML_ARCH_FLAGS` approach instead»
- Сохранить existing `GGML_ARCH_FLAGS` example как fallback
- Добавить кратко **HAVE_VNNI256** (отдельный path для AVX2+VNNI, AVX2-only CPUs)

**Acceptance**: PR opened от branch `pr/docs-zen-cpu-build-v2` off `origin/main`. ikawrakow approves & merges.

---

### Item 1.2 — Cross-platform build scripts (~30 минут)
**Status**: ready to start  
**Risk**: 🟢 минимальный  
**Files**: новые `scripts/build-zen.sh`, `scripts/build-zen.bat`

**Содержание**:
- `build-zen.sh`: bash, для Linux/macOS, full Zen-aware flags + reasonable defaults
- `build-zen.bat`: Windows MSVC equivalent (~ наш `build_zen4.bat` cleaned up)
- Опционально detect Zen3 vs Zen4 (`/proc/cpuinfo` или `wmic`)
- README link: «AMD Zen3/4 users: see `scripts/build-zen.{sh,bat}` for one-command build with optimal flags»

**Acceptance**: PR opened, скрипты успешно собирают баynaries в clean checkout, README обновлён.

---

### Item 1.3 — README cross-link (~5 минут)
**Status**: trivial  
**Risk**: 🟢 zero  
**File**: `README.md` секция «Build for CPU»

Один параграф:
> For AVX-512 capable CPUs (AMD Zen4, Intel Sapphire Rapids+), see [docs/build.md#cpu-build-flags-for-avx-512](docs/build.md#cpu-build-flags-for-avx-512-zen4--sapphire-rapids) for the full kernel activation flags. A vanilla `Release` build silently falls back to AVX2 paths.

Можно сделать вместе с **Item 1.1** одним PR.

---

## Tier 2 — Real features (1-2 недели)

### Item 2.1 — `-rtr auto` flag (2-3 часа)
**Status**: PR #1738 submitted 2026-05-04 (commit `0115ace21`). Community feedback (dmaivel) found two policy gaps. **v2 fix имплементирован локально на `dev` за experimental gate** (`feature/rtr-auto-v2`, merged 2026-05-05). **Path A patch подготовлен** на ветке `pr/rtr-auto-mode-v2` (off latest `origin/main`, HEAD `d336a4a23`).

**2026-05-06 update**: maintainer ответил с конкретным направлением — «consider actually available RAM, tensor overrides, и quantization types (use only the tensors that will get repacked when computing required memory)». Также pointed at offline `llama-quantize --repack` + mmap как alternative workflow. Эта обратная связь делает path A patch (v2 logic) **insufficient** — нужна v3 policy с placement+quant-aware accounting.

Posted v3 plan reply 2026-05-06 11:45 UTC: https://github.com/ikawrakow/ik_llama.cpp/pull/1738#issuecomment-4387595944. Flag'нули один architectural question: loader's `use_mmap=false` coupling может оставить KEEP-based-on-repackable-bytes уязвимым на huge total. Предложили AND-check total как secondary gate (path b). Awaiting maintainer ответ. После ответа → write v3 patch on `pr/rtr-auto-mode-v2` + force-push.

Force-push procedure описана в `project_docs/rtr-auto/EXPERIMENTAL_V2_LOCAL.md`.
**Risk**: 🟡 средний (cross-platform, behavioural change)  
**Value**: 🟢 высокая — решает known regression (-46-60% TG на swap-bound rtr=on)

**Файлы upstream** (для PR #1738 path A port):
- `common/common.cpp` — `-rtr auto` парсинг (есть в #1738)
- `common/common.h` — `repack_tensors_auto` flag (есть в #1738)
- `examples/llama-bench/llama-bench.cpp` — fields list (есть в #1738)
- `include/llama.h` — `repack_tensors_auto` member (есть в #1738)
- `src/llama.cpp` — заменить `llama_rtr_auto_should_disable` на v2 версию: available memory + tri-state + safety-first UNKNOWN

**v2 implementation details** (см. `project_docs/rtr-auto/EXPERIMENTAL_V2_LOCAL.md`):
- `llama_get_available_ram_bytes()` — Windows `ullAvailPhys`, Linux `/proc/meminfo MemAvailable` + cgroup v2/v1 walker, macOS `host_statistics64`
- `enum llama_rtr_auto_decision_v2 { KEEP, DISABLE, NOT_APPLICABLE, UNKNOWN }`
- `llama_rtr_auto_should_disable_v2()` returns enum; UNKNOWN → safety-first WARN + disable
- Validated на 6 model classes: Qwen3-30B (KEEP), gpt-oss-20b/120b (KEEP), Qwen3.5-27B Q8_0 dense (NOT_APPLICABLE), Qwen3.5-397B-A17B 6 shards 219 GiB (DISABLE через multi-shard accumulation), MiniMax M2.5 (DISABLE через MINIMAX_M2 special case)

**Bench data для PR description**:
- v2 dispatch overhead = 0 на Qwen3-30B и gpt-oss-20b (r=5, все дельты в σ overlap)
- rtr=on perf benefit на in-RAM Zen4: +15.6% PP / +5.4% TG vs rtr=off (Qwen3-30B Q4_K_M r=5)
- Forced rtr=1 на swap-bound = 213.8s cold load penalty vs ~30s для auto-disable (MiniMax 89.6 GiB / 88.2 GiB available)

**Prep work перед finalize PR (когда maintainer ответит)**:
- Strip experimental gate (`IK_LLAMA_RTR_AUTO_V2` env var dispatch)
- Strip `LLM_ARCH_MINIMAX_M2` special branch (нет в upstream tree)
- Rename `_v2` функции в canonical имена
- Test на Linux (cgroup walker не runtime-tested локально, только compile-tested)
- Run `tests/test-backend-ops`
- Update PR description Validation table с реальными цифрами

**Self-reported complexity**: Medium. PR template требует.

---

### Item 2.2 — Stable timings JSON endpoint (1-2 часа)
**Status**: issue #1740 posted 2026-05-05 (https://github.com/ikawrakow/ik_llama.cpp/issues/1740). Awaiting maintainer reaction. PR не пишем до согласия. Если ответ положительный, branch off `origin/main`, ~50 строк C++, smoke test через curl + running llama-server, submit. Если negative — drop, не воюем за этот item.
**Risk**: 🟢 низкий (additive, не ломает существующие endpoints)
**Value**: 🟢 средне-высокая для external tooling

**Мотивация**: текущий `slot print_timing:` text format нестабилен (поменялся в last upstream sync, поломал наш dashboard). Прометей-формат `/metrics` тоже text-based и предполагает Prometheus parser. Для прямого JSON consumers (dashboards, log aggregators) хочется stable JSON endpoint с теми же данными.

**Текущее upstream состояние** (после code review 2026-05-05):

- `/metrics` endpoint существует в `examples/server/server.cpp:2067` (handle_metrics, lines 800-905). Возвращает Prometheus text v0.0.4. Source data — `server_task_result` от `SERVER_TASK_TYPE_METRICS` task через server task queue.
- Per-request timings уже доступны через каждый completion response: `task_result.timings.to_json()` см. `examples/server/server-task.h:117-135` для `result_timings` struct и `examples/server/server-task.cpp:3` для `to_json()`. Структура содержит prompt_n/ms/per_token_ms/per_second + predicted_* + draft_* + n_ctx + n_past.
- `/health` со `?include_slots=1` и `/slots` тоже отдают per-slot data.
- Чего НЕ хватает: **server-wide aggregate metrics в JSON**. Сейчас агрегаты только в Prometheus text.

**Конкретное предложение**:

Новый GET endpoint `/v1/metrics/json` или `/metrics/json` — JSON-эквивалент текущего `/metrics`. Реиспользует тот же `SERVER_TASK_TYPE_METRICS` task source, форматирует JSON вместо Prometheus text.

Body shape:
```json
{
  "counters": {
    "prompt_tokens_total": 123456,
    "prompt_seconds_total": 12.34,
    "tokens_predicted_total": 78900,
    "tokens_predicted_seconds_total": 234.56
  },
  "gauges": {
    "prompt_tokens_per_second": 1023.4,
    "tokens_predicted_per_second": 23.5,
    "kv_cache_usage_ratio": 0.34,
    "kv_cache_tokens": 4096,
    "requests_processing": 1,
    "requests_deferred": 0
  },
  "process_start_time_unix": 1715002345
}
```

**Файлы upstream**:
- `examples/server/server.cpp` — новый handler рядом с `handle_metrics` (~50 строк), регистрация в svr->Get() near line 2067.
- `examples/server/README.md` — описание endpoint.

**Сложность**: Low. Pure additive. Reuses existing task type and data shape. Скорее всего ~50 строк C++ + ~10 строк docs.

**Подход**: 
1. Сначала **issue** в upstream — описать problem (Prometheus text не идеально для JSON consumers, dashboard tooling пишет дубликат parsing). Mention что наш fork dashboard hit this issue после last upstream sync.
2. Если ikawrakow agrees → branch `pr/server-metrics-json` off origin/main, implement, smoke test (curl против running llama-server), submit PR.
3. Если ikawrakow prefers keep Prometheus only → drop, document в strategy. Не борьба за этот item.

**Prep work перед issue**:
- Прочитать (готово, 2026-05-05): handle_metrics impl + result_timings + server task queue
- Подготовить small repro show разницу между Prometheus text parsing и JSON parsing для a hypothetical dashboard consumer (1 short example)
- Проверить нет ли уже open issue/PR на эту тему через `gh issue list --repo ikawrakow/ik_llama.cpp --search "json metrics"`

---

## Tier 3 — Discovery (паралельно)

### Item 3.1 — Open issues review

**2026-05-05 first pass: 0 quick wins из 45 open issues.**

Detailed inspection: #353 (Windows binaries — distribution issue, не fixable без maintainer CI investment), #1382 (Docker build — contributor mcm007 already on it, ikawrakow не считает bug), #361 (ARM CPU detection — нет hardware для testing), #199 (server slot/parallel state — too deep without prior code work), #1629 (merge_up_gate_shexp — maintainer explicitly said no).

Issue queue current shape: dominated by GPU/CUDA debugging (~10 issues), new model arch support (~7), tool-calling/Jinja internals (~3), multi-GPU hardware-specific (~4), ARM (~1), in-progress by others (~3). None match our CPU+build-docs+server-level scope without significant investment.

Repeat scan recommended: every 2-3 weeks, faster if we see issue activity from new contributors.

```
gh issue list --repo ikawrakow/ik_llama.cpp --state open --limit 30
```

Искать:
- «Would be nice if...» — мелкие feature requests
- Bug reports без assignee которые matchаются с нашим setup (Zen4, MSVC, Windows)
- Stale issues которые maintainer открытый закрыть с PR

Если найдём что-то actionable за < 1 часа — submit fix.

---

## Tier 4 — Strategic (long term)

### Item 4.1 — MOE architecture guide
**File**: новый `docs/moe-architecture.md`  
**Source**: наш `project_docs/tutorial/MOE_ARCHITECTURE.md` (130KB)  
**Effort**: 2-3 часа extraction + adaptation  
**Value**: общеобразовательный, повышает discoverability проекта

Extract upstream-relevant parts: MoE basics, expert routing, hot expert tracking concept (без наших specific implementations), quantization considerations для MoE.

Не делать без request от пользователей или maintainer'a — это speculation что нужна docs.

---

### Item 4.2 — Custom quantization recipes guide
**File**: новый `docs/custom-quants.md`  
**Source**: наш `docs/new_quants_minimax_m2.5/` (методология Tapered-RAM)  
**Effort**: 2-3 часа generalization  
**Value**: для пользователей с huge MoE на limited RAM

Generalize Tapered-RAM подход на любой huge MoE: layer-zone taper, ftype rules, imatrix integration, PPL validation. Audience: power users делающие custom quantization.

Не критично, но classy contribution для обширной образовательной библиотеки upstream.

---

## Sequencing

```
Week 1 (this week):
  Item 1.1 (v3 docs)           ─┐
  Item 1.3 (README link)        │ same PR
                                ─┘
  Item 1.2 (build scripts)        separate PR

  Item 3.1 (issues scan)          parallel discovery

Week 2:
  Item 2.1 (-rtr auto)            real feature PR
  
Week 3+:
  Item 2.2 (timings endpoint)     after issue discussion
  Item 4.x                        only if requested
```

**После 4 merged PRs** (Items 1.1, 1.2, 1.3 одним PR + 1 separate PR + 2.1 + потом feature) — у нас **established contributor status**, maintainer voice trust для более ambitious work.

## Принципы

1. **One PR = one focused change**. Maintainer's CONTRIBUTING.md: «<module> : <title>».
2. **Cross-platform first**. Любой code change должен работать Linux + Windows + (when possible) macOS.
3. **Test before submit**. `tests/test-backend-ops` для code changes; smoke bench для perf changes.
4. **Cite their code in PR description** — line refs из CMake/source демонстрируют что мы reading codebase, не просто guessing.
5. **Respond to feedback быстро** — review fresh in maintainer's mind. 1-час turnaround beats 1-week.
6. **PR branch off `origin/main`** (proper fork `AndrewMoryakov/ik_llama-pr`), не off our `dev` (иначе PR притащит наши 200+ коммитов).

## Что НЕ contribute'ить в upstream

- Hot-expert tracking PR04 — слишком sprawling, узкий use-case (swap-bound)
- Tail-blend feature — negative result, сами признали
- Tapered-RAM scripts as-is — model-specific (только MiniMax M2.5)
- VirtualLock + large pages — Windows-specific, узкая аудитория
- Dashboard — это наш отдельный проект
- VM prefetch — наш forks 0% gain finding, ikawrakow заменил на thread-splitting

## Tracking

| PR # | Item | Status | Date |
|------|------|--------|------|
| #1729 | Tier 1 #1 — initial AVX-512 docs | ✅ MERGED | 2026-05-03 |
| #1733 | Item 1.1 — v3 hybrid docs | ✅ MERGED | 2026-05-04 |
| #1734 | Item 1.2 — `scripts/build-zen.{sh,bat}` | ✅ MERGED | 2026-05-04 |
| #1735 | Item 1.3 — README cross-link | ✅ MERGED | 2026-05-04 |
| #1738 | Item 2.1 — `-rtr auto` | ⏳ Maintainer feedback received 2026-05-06; v3 plan posted, awaiting answer on mmap-coupling question | 2026-05-04 |
| #1740 | Item 2.2 — JSON metrics endpoint (issue) | 🟡 Lukewarm reaction from maintainer 2026-05-05 ("no feelings either way"); deferred — not invested without endorsement | 2026-05-05 |
| TBD | Item 2.2 — timings JSON endpoint | Not started | — |

Каждый раз когда PR merges — обновить эту таблицу + memory `MEMORY.md`.

### Branches на нашем `fork` remote (`AndrewMoryakov/ik_llama-pr`)
- `pr/docs-zen-cpu-build` — for #1729 (merged, can delete after grace period)
- `pr/docs-build-zen-cpu-v3` — for #1733
- `pr/scripts-build-zen` — for #1734
- `pr/readme-link-cpu-build-flags` — for #1735
- `pr/rtr-auto-mode` — for #1738 (first Tier 2 code-feature PR)
