# Implementation Checklist - 2026-03-01

## Назначение

Это финальный рабочий checklist для сборки clean milestone snapshot.

В отличие от остальных release cleanup документов, он отвечает не на вопрос:

- “как устроено текущее состояние?”

а на вопрос:

- “что именно практически делать дальше?”

## Общий принцип

Работать пакетами.

Не пытаться:

1. привести в порядок весь dirty tree одним действием;
2. одновременно чистить runtime, dashboard, docs, scripts и research layer;
3. превращать cleanup в новый optimization cycle.

## Пакет 1. Runtime Core

### Цель

Собрать usable runtime baseline как главный milestone слой.

### Входит

1. `ik_llama.cpp/include/llama.h`
2. `ik_llama.cpp/common/common.cpp`
3. `ik_llama.cpp/common/common.h`
4. `ik_llama.cpp/examples/llama-bench/llama-bench.cpp`
5. milestone-ready subsections из:
   - `ik_llama.cpp/src/llama.cpp`
   - `ik_llama.cpp/src/llama-model.h`
   - `ik_llama.cpp/ggml/src/ggml.c`
   - `ik_llama.cpp/ggml/include/ggml.h`

### Что должно быть включено

1. `rtr auto`
2. MiniMax-specific `auto` bugfix
3. practical MiniMax runtime plumbing
4. effective repack reporting

### Что не должно быть продвинуто как stable feature

1. `IK_LLAMA_PG_TRACE*`
2. `IK_LLAMA_PROMPT_PACKED_QKV*`
3. `IK_LLAMA_LOCALITY_TRACE`
4. `IK_LLAMA_HOT_EXPERT_TRACE`
5. `IK_LLAMA_HOT_EXPERT_BUDGET*` как recommendation

### Критерий завершения

После этого пакета можно честно сказать:

- usable runtime baseline собран;
- stable claims по runtime не смешаны с research layer.

## Пакет 2. Dashboard Product Layer

### Цель

Собрать usable dashboard как milestone product layer.

### Входит

1. `ik_llama.cpp/dashboard.html`
2. `ik_llama.cpp/dashboard.css`
3. `ik_llama.cpp/dashboard.js`
4. `ik_llama.cpp/dashboard_server.py`

### Что проверить

1. `rtr off/on/auto` guidance соответствует current truth
2. `MiniMax` guidance соответствует current truth
3. `SER` остается experimental
4. `Hot Expert Budget` не подается как validated default
5. dashboard различает validated vs experimental

### Критерий завершения

Dashboard можно включать в milestone narrative как usable launcher и guidance layer.

## Пакет 3. Documentation / Navigation Layer

### Цель

Сделать docs слоем, который объясняет milestone без противоречий.

### Входит

1. `project_docs/release/*.md`
2. `project_docs/strategy/*.md` по current state / roadmap / handoff
3. `project_docs/benchmarks/current/*.md`
4. `project_docs/tutorial/*.md`
5. `project_docs/dashboard/*.md`
6. `project_docs/llm/*.md`
7. `project_docs/README.md`
8. `project_docs/START_HERE_BY_GOAL.md`

### Что проверить

1. docs не противоречат dashboard
2. docs не противоречат runtime behavior
3. `MiniMax` current truth везде одна и та же
4. stable vs experimental разведены одинаково

### Критерий завершения

Один инженер может открыть docs и быстро понять:

1. чем уже можно пользоваться;
2. что еще experimental;
3. что за baseline у `Qwen3MoE`, `gpt-oss`, `MiniMax`.

## Пакет 4. Research Layer

### Цель

Оставить research layer в дереве, но не смешивать его со stable claims.

### Входит

1. deep profiling envs
2. prompt packed-QKV path
3. packed presets
4. packed arena
5. MiniMax hot-expert trace
6. MiniMax hot-expert budget overrides

### Что сделать

1. оставить код в дереве
2. не выдавать его за stable layer
3. убедиться, что docs и dashboard маркируют его как experimental

### Критерий завершения

Research layer:

- не потерян;
- не мешает milestone snapshot;
- не маскируется под validated baseline.

## Пакет 5. Artifacts / Tooling

### Цель

Отделить raw evidence и tooling от core milestone code.

### Входит

1. `ik_llama.cpp/bench_results/`
2. `ik_llama.cpp/scripts/*.ps1`
3. `ik_llama.cpp/dashboard_server.sh`

### Что сделать

1. зафиксировать, какие raw runs canonical
2. зафиксировать, какие scripts canonical
3. не смешивать их в release claims

### Критерий завершения

Artifacts/tooling:

- сохранены;
- понятны по роли;
- не мешают core narrative.

## Пакет 6. Historical / Auxiliary

### Цель

Не дать historical docs вмешиваться в current truth.

### Входит

1. `ik_llama.cpp/docs/FORK_CHANGES.md`
2. `ik_llama.cpp/docs/development/qwen3next-handoff.md`

### Что сделать

1. не использовать как source of truth
2. не опираться на них в release claims

### Критерий завершения

Исторические документы остаются как context, но не участвуют в baseline guidance.

## Проверка перед тем как считать snapshot clean

### Runtime

1. `rtr auto` описан и работает как milestone feature
2. MiniMax-safe baseline не противоречит docs

### Dashboard

1. dashboard guidance совпадает с current status docs
2. experimental knobs не promoted в defaults

### Docs

1. release/current-status/source-of-truth notes согласованы
2. human и LLM навигация согласованы

### Research layer

1. оставлен в дереве
2. явно отделен в claims

### Tooling

1. raw artifacts не потеряны
2. benchmark scripts не перепутаны с core feature set

## Минимальный usable milestone snapshot

Если нужно выбрать минимальный usable snapshot прямо сейчас, в него должны войти:

1. `Runtime Core`
2. `Dashboard Product Layer`
3. `Documentation / Navigation Layer`

Research/tooling можно оставить рядом отдельными пакетами.

## Следующий практический шаг после этого checklist

После этого checklist уже есть две реальных опции:

### Option A. Documentation-first freeze

Использовать этот checklist как финальную упаковку текущего состояния без новых code changes.

### Option B. Cleaner technical freeze

На базе checklist реально собирать snapshot/commit groups по пакетам:

1. runtime core
2. dashboard
3. docs
4. research
5. tooling

Для текущего состояния проекта Option B выглядит наиболее аккуратной.
