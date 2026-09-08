# Clean Milestone Snapshot Plan - 2026-03-01

## Зачем нужен этот план

Текущее состояние форка уже usable, но рабочее дерево смешивает:

1. milestone-ready изменения;
2. experimental/research ветки;
3. benchmark artifacts и вспомогательные скрипты;
4. локальную инженерную лабораторию.

Задача этого плана:

- собрать аккуратный milestone snapshot;
- не потерять research layer;
- не смешивать validated baseline и эксперименты;
- подготовить состояние, которое можно уверенно коммитить, показывать и использовать как опорную точку.

## Целевой результат

После выполнения плана должно быть понятно:

1. что является текущим publishable baseline;
2. что остается experimental;
3. какие raw artifacts считаются canonical evidence;
4. чем именно можно пользоваться прямо сейчас без оговорок уровня "тут локальная лаборатория".

## Общий принцип

Не нужно:

- вычищать все эксперименты из репозитория;
- удалять instrumentation;
- делать вид, что research layer не существует.

Нужно:

- развести слои;
- зафиксировать scope;
- упаковать текущее состояние в ясный, согласованный snapshot.

## Шаг 1. Заморозить milestone scope

Нужно явно зафиксировать, что входит в milestone snapshot.

### Включить

1. `rtr auto`
2. mixed-path benchmark methodology
3. validated guidance для `Qwen3MoE`
4. validated guidance для `gpt-oss`
5. текущий safe baseline для `MiniMax`
6. dashboard как launcher + validated knowledge layer
7. tutorial/docs/release docs слой

### Не включать как milestone claims

1. prompt packed-QKV как public feature
2. packed presets как final policy
3. deep profiling envs как product features
4. большие MiniMax hot-expert budgets как recommendation
5. custom quantization claims без свежей верификации

Критерий завершения:

- список milestone scope закреплен в одном документе и не вызывает двусмысленности.

## Шаг 2. Разделить код на milestone-ready и research-only

Нужно пройти измененные файлы и распределить их по категориям.

### Группа A. Milestone-ready code

Кандидаты:

1. `common/common.cpp`
2. `common/common.h`
3. `include/llama.h`
4. `src/llama.cpp`
5. `examples/llama-bench/llama-bench.cpp`
6. `dashboard.html`
7. `dashboard.js`
8. `dashboard.css`
9. `dashboard_server.py`

Но только те части, которые:

- относятся к validated runtime policy;
- относятся к dashboard knowledge layer;
- не являются чисто исследовательскими knob'ами без user-facing роли.

### Группа B. Research-only code

Кандидаты:

1. prompt packed-QKV path
2. partial packing presets
3. arena/locality research helpers
4. deep trace envs
5. execution profiling helpers

Критерий завершения:

- по каждому крупному измененному файлу понятно, какие куски milestone-ready, а какие research-only.

## Шаг 3. Принять решение по research layer

После разделения нужно выбрать один из вариантов.

### Вариант 1. Оставить research layer в milestone snapshot

Условие:

- research paths clearly env-gated;
- docs явно говорят, что это experimental;
- dashboard не продвигает их как baseline.

Это наиболее вероятный и практичный путь.

### Вариант 2. Вынести часть research layer в отдельный subsequent snapshot

Условие:

- если какой-то участок слишком шумный, confusing или мешает clean packaging.

Критерий завершения:

- принято явное решение, что именно остается рядом с milestone, а что нет.

## Шаг 4. Нормализовать benchmark artifacts

Нужно убрать двусмысленность между:

- canonical raw evidence;
- историческими прогонами;
- техническим мусором.

### Что должно остаться как canonical

1. текущие family-specific current-status docs
2. raw runs, на которые эти docs реально ссылаются
3. corrected summaries рядом с важными MiniMax long-runs

### Что нужно проверить

1. нет ли дублей summary с противоречивыми выводами;
2. не остались ли временные quick-check артефакты как будто они equal to final truth;
3. не нужно ли часть вспомогательных логов считать purely engineering.

Критерий завершения:

- по каждому важному выводу можно быстро показать canonical raw evidence.

## Шаг 5. Нормализовать benchmark scripts

Сейчас scripts полезны, но их роль не до конца упакована.

Нужно разделить:

1. scripts, которые являются частью repeatable benchmark workflow;
2. scripts, которые были одноразовым engineering tooling.

### Скорее всего оставить как canonical

1. `scripts/bench-matrix-mixed.ps1`
2. `scripts/bench-minimax-hot-budget.ps1`

### Перепроверить на статус

1. `scripts/bench-advanced.ps1`
2. `scripts/bench-cpu-topology.ps1`
3. `scripts/bench-moe.ps1`
4. `scripts/bench-thread-scaling.ps1`

Критерий завершения:

- понятно, какие scripts являются частью milestone workflow, а какие нет.

## Шаг 6. Проверить согласованность кода, dashboard и docs

Это критично, потому что сейчас проект уже опирается на knowledge layer.

Нужно проверить:

1. кодовая runtime policy;
2. benchmark current-status docs;
3. dashboard warnings/presets;
4. tutorial guidance;
5. release-facing claims.

Особенно по:

1. `rtr off/on/auto`
2. `MiniMax hot expert budget`
3. `SER`
4. validated vs experimental badges

Критерий завершения:

- нет важных противоречий между кодом, dashboard и docs.

## Шаг 7. Сформировать clean milestone narrative

Нужно получить короткий и честный публичный срез:

1. что уже работает;
2. что benchmark-backed;
3. чем можно пользоваться;
4. что остается experimental.

Практически это уже почти готово, но нужно довести до одной версии правды.

Опора:

1. `CURRENT_STATUS_2026-02-28.md`
2. `CODEBASE_HEALTH_2026-03-01.md`
3. `RELEASE_CANDIDATE_INVENTORY_2026-02-28.md`
4. `VALIDATED_SCOPE_2026-02-28.md`
5. `STABLE_VS_EXPERIMENTAL_2026-02-28.md`

Критерий завершения:

- один инженер, открыв release docs, быстро понимает текущее usable state без противоречий.

## Шаг 8. Сформировать clean commit/snapshot plan

Последний шаг уже организационный.

Нужно подготовить:

1. какой набор файлов/изменений относится к milestone snapshot;
2. что остается вне него;
3. какой commit order логичен;
4. что должно попасть в changelog.

Если делать это аккуратно, получится:

- чистый milestone branch/snapshot;
- без потери research layer;
- без ощущения "один giant local diff на всё подряд".

## Рекомендуемый порядок выполнения

Если делать это practically, порядок такой:

1. заморозить milestone scope;
2. разметить измененные файлы на milestone-ready vs research-only;
3. нормализовать scripts и benchmark artifacts;
4. проверить согласованность code/docs/dashboard;
5. собрать clean milestone narrative;
6. подготовить clean commit/snapshot plan.

## Что не нужно делать в рамках этого плана

1. не запускать новые большие benchmark passes;
2. не открывать новый optimization cycle;
3. не переписывать research layer ради красоты;
4. не пытаться сделать polished final release.

Это packaging/normalization plan, а не performance plan.

## Что будет хорошим финалом этого плана

Хороший результат выглядит так:

1. текущий форк можно показать как аккуратный engineering milestone;
2. usable baseline отделен от experimental research;
3. dashboard, docs и code говорят одно и то же;
4. следующая работа продолжается уже с clean snapshot, а не из mixed dirty tree.
