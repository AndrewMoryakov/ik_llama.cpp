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

- [`ANALYSIS.md`](ANALYSIS.md) — полный анализ: problem context, current
  implementation walkthrough, verification results, cross-platform audit,
  edge cases, anticipated maintainer questions, pre-submit checklist, open
  questions, risk summary.

## Status (2026-05-04)

- ✅ In-RAM не регрессирует — verified empirically
- ✅ Auto-disable triggers correctly на swap-bound — verified
- ✅ Graceful probe failure fallback — verified
- ⏳ macOS RAM detection — нужно добавить
- ⏳ Remove MINIMAX_M2 legacy branch — cleanup
- ⏳ GPU offload false positive — нужно либо handle либо document
- ⏳ Linux test — code review only, нужен Docker prove

См. ANALYSIS.md secci «Pre-submit cleanup checklist» для actionable steps.
