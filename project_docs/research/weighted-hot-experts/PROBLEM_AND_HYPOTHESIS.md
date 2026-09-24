# Weighted Hot Experts — Проблема и гипотеза

> **ИСТОРИЧЕСКАЯ ГИПОТЕЗА, ОПРОВЕРГНУТА STEP0.** Нормализованная энтропия
> маршрутизации 0.919 не оставляет малого стабильного горячего множества для
> этой схемы. Исходный 151 GB артефакт по указанному ниже пути отсутствует.
> Основание: [`evidence-8`](../../../docs/sessions/2026-09-08-upstream-merge/evidence-8-step0-locality-2026-09-09.md)
> §4 и §6.

## Целевой сценарий

Huge swap-bound MoE на CPU-only хосте:
- MiniMax M2.5: 151GB модель, 96GB RAM, ~55GB в swap
- n_expert_used = 8 (из default budget = 16 = n_expert_used × 2)
- n_expert >= 32 (точное число из GGUF metadata — нужна верификация при загрузке модели)
- budget = 16 locked (legacy default)
- Значительная часть модели — shared tensors (attention, embedding, router, norms), locked отдельно
- Остальное — expert weights, распределённые между n_expert экспертов

## Как работает текущая система

1. Во время prompt-фазы ggml kernel (`mul_mat_id`) атомарно аккумулирует `expert_hits[expert_id]` — сколько строк router направил каждому эксперту.
2. После prompt `llama_hot_expert_commit()` сортирует экспертов по hits, VirtualLock'ит top-N.
3. Locked эксперты обрабатываются первыми (dispatch reordering), пока OS подгружает unlocked.
4. Lock одноразовый — нет re-evaluation во время decode.

## Два крайних режима

### Full-prompt (default)
- Все токены промпта вносят одинаковый вклад в hot-expert selection.
- **Проблема**: для длинных промптов ранние токены (system prompt, контекст) могут доминировать, но они плохо предсказывают decode-фазу. System prompt активирует "generic" экспертов, тогда как decode часто идёт через более специфичные.

### Tail-window (IK_LLAMA_HOT_EXPERT_TAIL_WINDOW=N)
- В точке перехода `ggml_moe_reset_expert_hits()` обнуляет ВСЕ счётчики.
- Только последние N токенов накапливают хиты.
- **Проблема**: жёсткий cutoff теряет весь ранний сигнал. Если tail-window слишком мал — недостаточно данных. Если слишком велик — то же, что full-prompt.

## Гипотеза

**Мягкое смешивание (blend)** — масштабирование ранних хитов вместо обнуления — может дать hot-set, который лучше предсказывает decode-фазу, чем оба крайних варианта.

Логика:
- Поздние токены (пользовательский запрос) сильнее коррелируют с decode expert usage
- Но ранние токены (system prompt, контекст) всё ещё несут полезный сигнал о "фоновых" экспертах
- Blend сохраняет оба, но с правильным соотношением

## Почему не другие подходы

### Router-Confidence Weighting (Approach C)
- Теоретически привлекателен: вес hit = confidence роутера
- Практически невозможен без рефакторинга: `mul_mat_id` kernel не получает router probabilities (только expert indices)
- Потребовал бы изменения op definition и graph building — major refactor

### Multi-Segment Decay (Approach B)
- Generalized version of Approach A
- Если A покажет сигнал, B — естественное расширение через тот же API
- Не стоит строить complexity до валидации примитива

### Auxiliary Predictor
- Требует вторую модель → больше RAM на swap-bound хосте = усугубление проблемы
- Отложен как Tier 3

## Ожидаемый результат

- **Позитивный**: найден blend value, дающий higher locked_share и better TG, чем оба baseline
- **Negative (тоже ценный)**: blend не бьёт крайние варианты → значит, position of tail boundary важнее, чем blending, и research нужно направлять на adaptive window sizing

## Связь с Phase 4

Это первый конкретный research step для MiniMax decode-side optimization (Phase 4 roadmap). Если покажет результат, следующие шаги:
1. Multi-segment decay (Approach B) — тот же примитив, больше точек масштабирования
2. Early decode feedback — prompt lock + decode observation + dispatch reorder (без re-lock)
3. Layer-aware hot experts — разный бюджет по слоям
