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

## Status (2026-05-05)

PR #1738 submitted, pre-submit cleanup applied, **post-submit bug found
and fixed** (force-pushed `0115ace21`). Awaiting maintainer review.

- ✅ In-RAM не регрессирует — verified empirically
- ✅ Auto-disable triggers correctly на swap-bound — verified
- ✅ Graceful probe failure fallback — verified
- ✅ Removed MINIMAX_M2 legacy branch — done in initial commit
- ✅ macOS RAM detection — added (`sysctl(HW_MEMSIZE)`)
- ✅ GPU offload false positive — handled (`n_gpu_layers > 0` skip)
- ✅ mmap regression on `-rtr 0` / `-rtr auto` — **post-submit fix**
- ⏳ Linux test — code review only, runtime not exercised

См. ANALYSIS.md «Pre-submit cleanup checklist» и POST_SUBMIT_BUG.md
«Recommended pre-submit checklist для behavioural-change PRs».
