# Weighted Hot Experts — Research Line

> **HISTORICAL RESEARCH LINE. DO NOT IMPLEMENT THE PLAN BELOW.** Step0 measured
> normalized routing entropy 0.919 and found no small stable hot set. The
> current direction is reducing bytes per token. See
> [`evidence-8-step0-locality-2026-09-09.md`](../../../docs/sessions/2026-09-08-upstream-merge/evidence-8-step0-locality-2026-09-09.md)
> §4 and §6.

## Статус: план готов, реализация не начата (2026-03-06)

## Документы

1. `PROBLEM_AND_HYPOTHESIS.md` — постановка проблемы и гипотеза
2. `RUNTIME_ANALYSIS.md` — детальный анализ текущего hot-expert runtime
3. `IMPLEMENTATION_PLAN.md` — план реализации Soft Tail-Window Blend
4. `BENCHMARK_PLAN.md` — план бенчмарков и критерии успеха

## Суть

Текущая hot-expert система имеет два крайних режима: full-prompt (все токены весят одинаково) и tail-window (жёсткий cutoff). Weighted Hot Experts — мягкое смешивание: вместо обнуления ранних хитов масштабировать их, чтобы поздние токены доминировали, но ранний сигнал сохранялся.

## Связь с другими исследованиями

- Расширяет `expert-selection/NEXT_IDEAS_2026-03-02.md` (Tier 1: Weighted Hot Experts)
- Использует runtime foundation из `expert-selection/HOT_EXPERTS_RUNTIME_FOUNDATION_2026-03-02.md`
- Если покажет сигнал, открывает путь к Multi-Segment Decay (Approach B)
