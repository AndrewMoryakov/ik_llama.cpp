# Commit / Snapshot Grouping Plan - 2026-03-01

## Зачем нужен этот документ

К этому моменту уже есть:

1. milestone scope;
2. file classification;
3. mixed-files subsection map.

Следующий практический вопрос уже организационный:

- как именно собирать текущее состояние в clean milestone snapshot
- какими пакетами
- в каком порядке

Этот документ отвечает именно на это.

## Общий принцип

Не нужно собирать всё одним giant diff.

Правильнее делить на понятные смысловые пакеты:

1. runtime core
2. dashboard/product layer
3. documentation layer
4. research layer
5. artifacts/tooling

Тогда milestone snapshot получается:

- объяснимым;
- проверяемым;
- пригодным для публикации и дальнейшей работы.

## Целевой результат

В конце должна получиться структура, где:

1. usable baseline собран в ясный основной snapshot;
2. research layer либо остается отдельным пакетом, либо явно маркируется;
3. benchmark artifacts и scripts не смешиваются с core runtime story;
4. changelog и release docs соответствуют реальному содержимому snapshot.

## Рекомендуемые группы

## Group 1. Runtime Core

### Что входит

1. `ik_llama.cpp/include/llama.h`
2. `ik_llama.cpp/common/common.cpp`
3. `ik_llama.cpp/common/common.h`
4. `ik_llama.cpp/examples/llama-bench/llama-bench.cpp`
5. milestone-ready subsections из:
   - `ik_llama.cpp/src/llama.cpp`
   - `ik_llama.cpp/src/llama-model.h`
   - `ik_llama.cpp/ggml/src/ggml.c`
   - `ik_llama.cpp/ggml/include/ggml.h`

### Что это по смыслу

Это основной usable runtime layer:

1. `rtr auto`
2. benchmark-visible runtime policy
3. MiniMax-specific `auto` bugfix
4. practical MiniMax runtime plumbing

### Что не включать сюда как claim

Не смешивать в описании этой группы:

1. packed-QKV experiments
2. deep tracing envs
3. large MiniMax hot-budget experiments

### Почему эта группа первая

Потому что именно она отвечает на вопрос:

- чем вообще уже можно пользоваться на текущем milestone

## Group 2. Dashboard Product Layer

### Что входит

1. `ik_llama.cpp/dashboard.html`
2. `ik_llama.cpp/dashboard.css`
3. `ik_llama.cpp/dashboard.js`
4. `ik_llama.cpp/dashboard_server.py`

### Что это по смыслу

Это отдельный продуктовый слой:

1. launcher
2. knowledge layer
3. warnings / presets / family guidance
4. env plumbing for advanced paths

### Что важно

Даже если dashboard знает про experimental knobs, это все равно milestone-ready group.

Причина:

- сам продукт usable;
- он уже различает validated vs experimental.

## Group 3. Documentation / Navigation Layer

### Что входит

Весь текущий `project_docs/` слой, который уже собран в этой ветке работы.

Минимально важные документы:

1. `project_docs/release/*.md`
2. `project_docs/strategy/CURRENT_HANDOFF_2026-03-01.md`
3. `project_docs/strategy/FORK_GOAL_AND_SCOPE_2026-02-28.md`
4. `project_docs/benchmarks/current/*.md`
5. `project_docs/tutorial/*.md`
6. `project_docs/dashboard/*.md`
7. `project_docs/llm/*.md`
8. `project_docs/README.md`
9. `project_docs/START_HERE_BY_GOAL.md`

### Что это по смыслу

Это слой, который превращает форк из “dirty engineering tree” в:

- понятный проект;
- понятный milestone;
- проект, который можно продолжать не с нуля.

### Почему эта группа должна быть отдельной

Потому что documentation/navigation layer уже сам по себе является частью результата.

## Group 4. Research Layer

### Что входит

Research-only subsections из mixed files:

1. `IK_LLAMA_PG_TRACE`
2. `IK_LLAMA_PG_TRACE_DECODE_WINDOW`
3. `IK_LLAMA_LAYER_SCORE_TRACE`
4. `IK_LLAMA_EXEC_LAYER_TRACE`
5. `IK_LLAMA_LOCALITY_TRACE`
6. prompt packed-QKV path
7. packed presets
8. packed arena support
9. MiniMax hot-expert trace
10. MiniMax hot-expert budget overrides

Связанные файлы:

1. `ik_llama.cpp/src/llama.cpp`
2. `ik_llama.cpp/src/llama-build-context.cpp`
3. `ik_llama.cpp/src/llama-context.h`
4. `ik_llama.cpp/src/llama-model.h`
5. `ik_llama.cpp/ggml/src/ggml.c`

### Что это по смыслу

Это engineering lab layer:

- useful;
- benchmark-backed;
- but not part of current stable public baseline.

### Варианты обращения

#### Вариант A. Оставить рядом с milestone snapshot

Условие:

- явно задокументировано, что это experimental;
- dashboard не продает это как stable;
- release docs не выдают это за validated layer.

Это сейчас наиболее реалистичный вариант.

#### Вариант B. Отдельный follow-up snapshot

Условие:

- если нужен максимально узкий и чистый milestone.

## Group 5. Artifacts / Tooling

### Что входит

1. `ik_llama.cpp/bench_results/`
2. `ik_llama.cpp/scripts/bench-matrix-mixed.ps1`
3. `ik_llama.cpp/scripts/bench-minimax-hot-budget.ps1`
4. `ik_llama.cpp/scripts/bench-advanced.ps1`
5. `ik_llama.cpp/scripts/bench-cpu-topology.ps1`
6. `ik_llama.cpp/scripts/bench-moe.ps1`
7. `ik_llama.cpp/scripts/bench-thread-scaling.ps1`
8. `ik_llama.cpp/dashboard_server.sh`

### Что это по смыслу

Это не core product layer, а operational / benchmark tooling layer.

### Как с ним обращаться

1. не мешать его в runtime claims;
2. сохранить как repeatable engineering infrastructure;
3. отдельно решить, какие scripts canonical, а какие auxiliary.

## Group 6. Historical / Auxiliary

### Что входит

1. `ik_llama.cpp/docs/FORK_CHANGES.md`
2. `ik_llama.cpp/docs/development/qwen3next-handoff.md`

### Что это по смыслу

Исторические или auxiliary документы.

### Как с ними обращаться

1. не использовать как source of truth;
2. не включать в milestone claims;
3. оставить как context/history, если нужно.

## Рекомендуемый порядок сборки snapshot

Если собирать практический clean milestone snapshot, порядок такой:

1. `Runtime Core`
2. `Dashboard Product Layer`
3. `Documentation / Navigation Layer`
4. `Research Layer`
5. `Artifacts / Tooling`

Почему именно так:

- сначала фиксируется usable baseline;
- потом product layer;
- потом documentation truth;
- потом уже engineering lab layer;
- в конце infrastructure and artifacts.

## Какой snapshot можно считать “основным”

Если нужна одна главная usable точка, основным snapshot нужно считать:

1. `Runtime Core`
2. `Dashboard Product Layer`
3. `Documentation / Navigation Layer`

Это и есть practical milestone baseline.

### Что тогда делать с research layer

Лучший текущий вариант:

- оставить его рядом;
- но явным отдельным пакетом;
- не смешивать с baseline claims.

## Какой narrative получится после такой группировки

Тогда можно честно говорить так:

1. вот usable baseline;
2. вот product/dashboard layer;
3. вот docs and source-of-truth;
4. вот research layer, который остается в дереве и двигает следующие optimization cycles;
5. вот benchmark tooling и raw evidence.

Это уже похоже на собранный инженерный milestone, а не на один большой локальный diff.

## Следующий практический шаг

После этого grouping plan следующий шаг уже технический:

1. составить file-level or hunk-level implementation checklist;
2. решить, будет ли clean milestone snapshot:
   - single snapshot with explicit layers
   - or several logically separate commits/snapshots.
