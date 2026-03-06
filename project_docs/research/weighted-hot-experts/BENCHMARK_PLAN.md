# Weighted Hot Experts — План бенчмарков

## Модель

**MiniMax M2.5** (UD-Q5_K_XL, 151GB)
- Путь: `D:\ggufs\un\minimax2.5-m2\`
- n_expert_used = 8 (из default budget = 16 = n_expert_used × 2)
- n_expert >= 32 (точное число верифицировать при загрузке модели)
- Budget: 16 locked (legacy default)
- Swap-bound: ~55GB в swap при 96GB RAM

## Фиксированные параметры

```
-t 16 -fa 1 -rtr off -muge off -ctk q8_0 -ctv q8_0
```

- `rtr=off` — settled fact для swap-bound (см. MEMORY.md)
- `muge=off` — settled fact
- Workload: Mixed (PG) — `pg512,128` через llama-bench

## Trace

```
IK_LLAMA_HOT_EXPERT_TRACE=1
```

Это включит логирование:
- Per-layer top-8 экспертов
- locked_share (%)
- Commit summary (какие эксперты заблокированы)
- locked vs unlocked dispatch counts

## Матрица экспериментов

### Phase 1: Валидация baseline + blend sweep

| # | tail_window | blend | Ожидание |
|---|-------------|-------|----------|
| 1 | 0 (off) | — | Baseline: full-prompt selection |
| 2 | 16 | -1 (unset) | Baseline: hard reset (текущий) |
| 3 | 16 | 0.0 | Контроль: должен = hard reset |
| 4 | 16 | 0.1 | Слабый ранний сигнал |
| 5 | 16 | 0.3 | Умеренный blend |
| 6 | 16 | 0.5 | Сбалансированный blend |

### Phase 2: Если blend показал сигнал — tail-window size sweep

| # | tail_window | blend | Цель |
|---|-------------|-------|------|
| 7 | 32 | best_blend | Больший tail + blend |
| 8 | 64 | best_blend | Ещё больший tail + blend |
| 9 | 128 | best_blend | Проверка scaling |

### Phase 3: Если всё выглядит хорошо — multi-segment

Только после валидации Phase 1-2. Детали в IMPLEMENTATION_PLAN.md.

## Метрики

### Primary: locked_share

```
locked_share = locked_rows / (locked_rows + unlocked_rows) × 100%
```

Из `ggml_moe_get_locked_stats()`. Выше = лучше предсказание hot-set.

**Интерпретация:**
- 90%+ = отличное предсказание
- 70-90% = хорошее
- <70% = hot-set плохо предсказывает decode

### Secondary: TG (tok/s)

Decode throughput из llama-bench. Основной практический результат.

**Ожидаемый масштаб эффекта:**
- MiniMax на swap = 2-3 t/s baseline
- Даже 5-10% improvement (0.1-0.3 t/s) — значимо

### Tertiary: Expert ranking stability

Сравнить top-8 экспертов при commit между конфигурациями:
- Какие эксперты входят/выходят из locked set?
- Стабилен ли ranking при разных blend values?

## Промпты для тестирования

Использовать длинные промпты (512+ токенов), чтобы:
- Был значимый ранний сегмент (system prompt + context)
- Tail-window boundary реально срабатывал
- Разница между ранними и поздними токенами была заметна

**Минимум**: тот же промпт, что в предыдущих tail-window экспериментах (для сравнимости).

## Критерии успеха

### Позитивный результат
Существует blend value X такой, что:
1. `locked_share(blend=X)` > `locked_share(full-prompt)` AND
2. `locked_share(blend=X)` > `locked_share(hard-reset)` AND
3. `TG(blend=X)` >= `TG(best_of_full_hard)`

### Negative result (тоже ценный)
Ни один blend value не бьёт оба baseline → вывод:
- Position of tail boundary важнее, чем blending
- Следующий research → adaptive window sizing, не blending
- Документируем negative result для будущих сессий

## Формат записи результатов

```
bench_results/2026-XX-XX_weighted_hot_experts/
├── config_1_full_prompt.log
├── config_2_hard_reset.log
├── config_3_blend_0.0.log
├── config_4_blend_0.1.log
├── config_5_blend_0.3.log
├── config_6_blend_0.5.log
└── SUMMARY.md
```

Каждый `.log` содержит:
- Полную команду запуска
- hot expert trace output
- llama-bench результаты
- locked_share и top-8 experts

`SUMMARY.md` содержит:
- Таблицу сравнения
- Вывод и next step
