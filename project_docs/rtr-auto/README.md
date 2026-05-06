# `rtr-auto` — research / pre-submit folder

Эта директория содержит analysis-материалы для CLI feature `-rtr auto`
(Tier 2 #1 в `../strategy/UPSTREAM_CONTRIBUTOR_PLAN_2026-05-04.md`).

## Зачем отдельная директория

Feature имеет behavioural change semantics — может скрытно изменять
runtime behavior (отключать `repack_tensors` под капотом). Перед submit'ом
upstream нужен thorough audit, верификация на нескольких platforms,
рассмотрение edge cases.

Эта работа — слишком большая чтобы жить только в commit messages или PR
description. Здесь — детальный analysis для:
- ретроспективы после reaction maintainer'a
- reference при подготовке cross-platform fixes
- тренинг для будущих behavioural-change PRs

> **Навигация**: для быстрого поиска по темам, статусу, reading order
> и decision tree «что прочитать если…» см. [`INDEX.md`](INDEX.md).
> Ниже — описания каждого файла в свободной форме.

## Files

- [`ANALYSIS.md`](ANALYSIS.md) — полный pre-submit анализ: problem context,
  current implementation walkthrough, verification results, cross-platform
  audit, edge cases, anticipated maintainer questions, pre-submit checklist,
  open questions, risk summary.
- [`POST_SUBMIT_BUG_2026-05-04.md`](POST_SUBMIT_BUG_2026-05-04.md) — post-mortem
  для bug которого pre-submit verification пропустил: `params.use_mmap = false`
  unconditionally в парсере, ломалось `-rtr 0` и `-rtr auto` (на swap-bound
  loader получал `mmap=false` после auto-disable → catastrophic OOM на
  модели которую feature должна была спасать). Включает root cause analysis,
  test infrastructure gaps, lessons learned, и рекомендованный pre-submit
  checklist для behavioural-change PRs.
- [`DMAIVEL_FEEDBACK_2026-05-05.md`](DMAIVEL_FEEDBACK_2026-05-05.md) — анализ
  feedback от community contributor dmaivel, который протестировал
  `-rtr auto` на реальной swap-bound конфигурации (Linux 64 GB + 120 GB
  модель + GPU offload + `-ot exps=CPU`). Зафиксировал две дыры: наш
  `n_gpu_layers > 0` skip ничего не знает про `tensor_buft_overrides`, и мы
  меряем total RAM вместо available. Документ содержит разбор причин,
  предложенный фикс (switch to available RAM, drop GPU skip), draft
  ответа, и обоснование почему мы holдим push до решения maintainer'а.
- [`AGENT_BRIEF.md`](AGENT_BRIEF.md) — bootstrap для LLM-агента в новой
  сессии, продолжающего работу над PR #1738. Содержит контекст, что
  прочитать в каком порядке, открытые проблемы, guardrails (что не
  делать), стилистику общения с upstream, и placeholder для конкретной
  задачи. Скопировать целиком в начало новой сессии плюс добавить
  конкретную задачу в конце.
- [`TASK_DEEP_REVIEW_2026-05-05.md`](TASK_DEEP_REVIEW_2026-05-05.md) —
  конкретная задача для агента: deep critical review текущего состояния
  PR с фокусом на категории, которые предыдущие ревью покрывали слабо
  (multi-shard GGUF, ABI compat, concurrency, edge cases в integer
  arithmetic, cross-compiler warnings, и др.). Содержит 11 направлений
  для investigation, формат отчёта, guardrails. Использовать вместе
  с `AGENT_BRIEF.md`.
- [`DEEP_REVIEW_2026-05-05.md`](DEEP_REVIEW_2026-05-05.md) — отчёт
  агента по `TASK_DEEP_REVIEW`. Структура: Methodology, Findings F1-F7
  с severity, Verified clean C1-C5, Conclusion, «Не покрыто». F1
  (n_gpu_layers skip) и F2 (total RAM) совпадают с тем что нашёл
  dmaivel; F3-F7 — новые medium/low findings (probe duplicate logs,
  ABI surface, cgroups, bench reporting, doc drift). Verdict: needs
  maintainer architectural input before fixes.
- [`FOLLOWUP_REVIEW_2026-05-05.md`](FOLLOWUP_REVIEW_2026-05-05.md) —
  следующая итерация ревью. 9 delta findings D1-D9, три варианта
  архитектуры (A keep auto / B self-protective `-rtr` / C
  placement-aware). Углубляет: cgroups для Linux available memory,
  `--fit` invisible to early probe, probe-failure default
  (permissive vs safety-first), observability (requested vs
  resolved RTR state). Stop rule: hold code changes until maintainer
  picks architecture.
- [`ADDITIONAL_REVIEW_2026-05-05.md`](ADDITIONAL_REVIEW_2026-05-05.md)
  — компактный cross-reference после DEEP и FOLLOWUP. Independent
  confirmation C1-C5, plus probe exception coverage (все throws
  std::runtime_error), plus два small items для minimal patch (help
  text wording после смены метрики, PR description Validation table
  row). Без новых архитектурных concerns.
- [`FINAL_REVIEW_2026-05-05.md`](FINAL_REVIEW_2026-05-05.md) — итоговый
  maintainer-facing synthesis: final verdict, blocking B1-B3,
  non-blocking issues, architecture paths A/B/C, recommended PR response,
  and exact next code path if Ivan says "keep auto" vs "make `-rtr`
  self-protective".
- [`EXPERIMENTAL_V2_LOCAL.md`](EXPERIMENTAL_V2_LOCAL.md) — описание
  local-only experimental v2 implementation на ветке
  `feature/rtr-auto-v2`. Gate: `--experimental rtr-auto-v2=on` или
  `IK_LLAMA_RTR_AUTO_V2=1`. Default behavior на dev unchanged.
  Содержит: что v2 меняет (available memory + tri-state с
  safety-first UNKNOWN), как активировать, smoke tests, как
  port'ить в upstream PR при разных архитектурных выборах, Linux
  cgroup detection notes.
- [`V3_DESIGN_2026-05-06.md`](V3_DESIGN_2026-05-06.md) — refined
  v3 design после maintainer feedback на PR #1738. Path A patch
  на `pr/rtr-auto-mode-v2` superseded — нужна placement+quant-
  aware policy. Decision enum упрощён (KEEP/DISABLE/UNKNOWN, no
  NOT_APPLICABLE). Placement resolver mirrors loader semantics
  exactly (regex_search, first match wins, host buft normalize).
  Complex modes (`--fit`, `-mqkv`, `-muge`, `-ncmoe`, partial GPU
  без override) → UNKNOWN → safety-first DISABLE. Implementation
  заморожена до ответа maintainer'a на mmap-coupling вопрос.

## Status (2026-05-05)

PR #1738 submitted, pre-submit cleanup applied, **post-submit bug found
and fixed** (force-pushed `0115ace21`). Awaiting maintainer review.
Three rounds of independent ревью записаны (DEEP, FOLLOWUP,
ADDITIONAL) плюс финальный synthesis (`FINAL_REVIEW`); всё указывает
на необходимость maintainer architectural input до code changes.

Pre-submit checks that still hold for the narrow scenarios tested:

- ✅ In-RAM не регрессирует — verified empirically
- ✅ Auto-disable triggered on the original synthetic swap-bound case —
  verified, but not sufficient after dmaivel's `-ngl 99 -ot exps=CPU`
  report
- ✅ Probe failure fallback returns without crashing — verified, but
  permissive-vs-safety-first semantics remain an open maintainer choice
- ✅ Removed MINIMAX_M2 legacy branch — done in initial commit
- ✅ macOS RAM detection — added (`sysctl(HW_MEMSIZE)`)

Current open issues:

- ❌ GPU offload false negative — текущий `n_gpu_layers > 0` skip
  пропускает `-ot exps=CPU` сценарий (dmaivel; DEEP F1; FOLLOWUP D3)
- ❌ Total vs available memory — текущая метрика total RAM, нужна
  available (dmaivel; DEEP F2; FOLLOWUP D6 + cgroups)
- ✅ mmap regression on `-rtr 0` / `-rtr auto` — **post-submit fix**
- ⏳ Linux test — code review only, runtime not exercised
- ⏳ Architectural choice — `-rtr auto` vs self-protective `-rtr` vs
  placement-aware (FOLLOWUP options A/B/C); awaiting maintainer

См. ANALYSIS.md «Pre-submit cleanup checklist» и POST_SUBMIT_BUG.md
«Recommended pre-submit checklist для behavioural-change PRs».
