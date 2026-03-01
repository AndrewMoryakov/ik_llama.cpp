# Milestone File Classification - 2026-03-01

## Зачем нужен этот документ

Этот документ разметывает текущее измененное дерево по практическим категориям:

1. `milestone-ready`
2. `mixed: milestone + research`
3. `research-only`
4. `artifacts / tooling`
5. `historical / auxiliary`

Это не теоретическая классификация.

Это рабочая карта для clean milestone snapshot:

- какие файлы можно включать в publishable usable snapshot;
- какие файлы нужно оставить, но явно пометить как experimental;
- какие файлы не должны участвовать в release-facing packaging.

## Текущее измененное дерево

По `git -C ik_llama.cpp status --short` сейчас затронуты:

### Modified

1. `ik_llama.cpp/common/common.cpp`
2. `ik_llama.cpp/common/common.h`
3. `ik_llama.cpp/dashboard.css`
4. `ik_llama.cpp/dashboard.html`
5. `ik_llama.cpp/dashboard.js`
6. `ik_llama.cpp/dashboard_server.py`
7. `ik_llama.cpp/examples/llama-bench/llama-bench.cpp`
8. `ik_llama.cpp/ggml/include/ggml.h`
9. `ik_llama.cpp/ggml/src/ggml.c`
10. `ik_llama.cpp/include/llama.h`
11. `ik_llama.cpp/src/llama-build-context.cpp`
12. `ik_llama.cpp/src/llama-context.h`
13. `ik_llama.cpp/src/llama-model.h`
14. `ik_llama.cpp/src/llama.cpp`

### Untracked

1. `ik_llama.cpp/bench_results/`
2. `ik_llama.cpp/dashboard_server.sh`
3. `ik_llama.cpp/docs/FORK_CHANGES.md`
4. `ik_llama.cpp/docs/development/qwen3next-handoff.md`
5. `ik_llama.cpp/scripts/bench-advanced.ps1`
6. `ik_llama.cpp/scripts/bench-cpu-topology.ps1`
7. `ik_llama.cpp/scripts/bench-matrix-mixed.ps1`
8. `ik_llama.cpp/scripts/bench-minimax-hot-budget.ps1`
9. `ik_llama.cpp/scripts/bench-moe.ps1`
10. `ik_llama.cpp/scripts/bench-thread-scaling.ps1`

## 1. Milestone-ready

Это файлы, которые уже относятся к usable baseline или к release-facing knowledge layer.

### A. Runtime/API/CLI support

1. `ik_llama.cpp/include/llama.h`
2. `ik_llama.cpp/common/common.cpp`
3. `ik_llama.cpp/common/common.h`
4. `ik_llama.cpp/examples/llama-bench/llama-bench.cpp`

Почему:

- здесь живет `rtr auto` как реальная feature;
- это часть validated runtime/API/CLI layer;
- это уже benchmark-backed и docs-backed линия.

### B. Dashboard product layer

1. `ik_llama.cpp/dashboard.html`
2. `ik_llama.cpp/dashboard.css`
3. `ik_llama.cpp/dashboard.js`
4. `ik_llama.cpp/dashboard_server.py`

Почему:

- dashboard уже является usable launcher;
- knowledge layer приведен в соответствие с текущими выводами;
- MiniMax/Qwen3MoE/gpt-oss guidance уже оформлены;
- validated vs experimental уже разведены.

Важно:

- внутри `dashboard.js` есть support для advanced/research knobs;
- но в целом файл относится к milestone-ready product layer, а не к чисто research-only.

### C. MiniMax-specific `rtr auto` bugfix path

1. `ik_llama.cpp/src/llama.cpp`
2. `ik_llama.cpp/src/llama-model.h`

Почему:

- здесь есть исправление MiniMax-specific `auto` policy;
- это correction of runtime behavior, а не просто исследовательская ветка.

Важно:

- сами файлы `src/llama.cpp` и `src/llama-model.h` в целом mixed;
- milestone-ready здесь только часть изменений.

## 2. Mixed: milestone + research

Это самые важные файлы для cleanup.

Их нельзя целиком считать ни чисто milestone-ready, ни чисто research-only.

### A. `ik_llama.cpp/src/llama.cpp`

Почему mixed:

в нем одновременно живут:

1. milestone-ready вещи:
- `rtr auto`
- MiniMax-specific `auto` fix
- hot expert baseline logic
- practical runtime behavior

2. research-only вещи:
- `IK_LLAMA_PG_TRACE`
- `IK_LLAMA_PG_TRACE_DECODE_WINDOW`
- `IK_LLAMA_PROMPT_PACKED_QKV`
- `IK_LLAMA_PROMPT_PACKED_QKV_PRESET`
- `IK_LLAMA_PROMPT_PACKED_QKV_RANGE`
- `IK_LLAMA_LOCALITY_TRACE`
- `IK_LLAMA_HOT_EXPERT_TRACE`
- `IK_LLAMA_HOT_EXPERT_BUDGET`
- `IK_LLAMA_HOT_EXPERT_BUDGET_MULT`

Вывод:

- файл остается в milestone snapshot;
- но research subsections должны быть явно осознаны как hidden experimental layer.

### B. `ik_llama.cpp/src/llama-build-context.cpp`

Почему mixed:

1. содержит реальный architecture-specific builder context;
2. содержит research instrumentation:
- `IK_LLAMA_PG_TRACE`
- `IK_LLAMA_LAYER_SCORE_TRACE`

Вывод:

- базовый builder path milestone-ready;
- trace/scoring layer research-only.

### C. `ik_llama.cpp/ggml/src/ggml.c`

Почему mixed:

1. здесь живет уже существующий MiniMax runtime layer;
2. здесь же добавлен `IK_LLAMA_EXEC_LAYER_TRACE`;
3. здесь же есть support для hot-expert locked stats.

Вывод:

- MiniMax-related runtime behavior оставлять;
- profiling helpers считать research-only.

### D. `ik_llama.cpp/ggml/include/ggml.h`

Почему mixed:

- содержит plumbing для hot-expert/trace support;
- часть этого нужна practical MiniMax line;
- часть purely diagnostic.

### E. `ik_llama.cpp/src/llama-context.h`

Почему mixed:

- содержит состояние под trace/instrumentation;
- не является самостоятельным user-facing feature file.

## 3. Research-only

Это вещи, которые полезно оставить в дереве, но не стоит включать в milestone claims.

### A. Prompt packed-QKV experimental path

Живет в:

1. `ik_llama.cpp/src/llama.cpp`
2. `ik_llama.cpp/src/llama-build-context.cpp`
3. `ik_llama.cpp/src/llama-model.h`

Статус:

- implemented;
- benchmarked;
- still research-only.

### B. Deep profiling env layer

Живет в:

1. `ik_llama.cpp/src/llama.cpp`
2. `ik_llama.cpp/src/llama-build-context.cpp`
3. `ik_llama.cpp/ggml/src/ggml.c`
4. `ik_llama.cpp/src/llama-context.h`

Статус:

- internal engineering tooling;
- не public product layer.

### C. MiniMax advanced budget tuning layer

Живет в:

1. `ik_llama.cpp/src/llama.cpp`
2. `ik_llama.cpp/dashboard.js`
3. `ik_llama.cpp/dashboard_server.py`

Статус:

- advanced research knob;
- не validated default.

Важно:

- product support в dashboard/server milestone-ready;
- сам смысл большого budget как recommendation — research-only.

## 4. Artifacts / tooling

Это не кодовая база как feature layer, а инженерный рабочий слой.

### A. Raw benchmark artifacts

1. `ik_llama.cpp/bench_results/`

Статус:

- canonical raw evidence частично нужен;
- как целый каталог это artifacts layer, а не milestone code layer.

### B. Benchmark scripts

1. `ik_llama.cpp/scripts/bench-matrix-mixed.ps1`
2. `ik_llama.cpp/scripts/bench-minimax-hot-budget.ps1`
3. `ik_llama.cpp/scripts/bench-advanced.ps1`
4. `ik_llama.cpp/scripts/bench-cpu-topology.ps1`
5. `ik_llama.cpp/scripts/bench-moe.ps1`
6. `ik_llama.cpp/scripts/bench-thread-scaling.ps1`

Статус:

- tooling layer;
- часть из них repeatable benchmark workflow;
- часть нужно еще нормализовать по роли.

Практически:

- не выдавать за core product code;
- но не терять, потому что это benchmark infrastructure.

### C. `ik_llama.cpp/dashboard_server.sh`

Статус:

- auxiliary launcher/tooling;
- не core milestone feature.

## 5. Historical / auxiliary

Это не текущий release-facing слой.

### A. `ik_llama.cpp/docs/FORK_CHANGES.md`

Статус:

- historical note;
- useful for context;
- не должен быть source of truth для current state.

### B. `ik_llama.cpp/docs/development/qwen3next-handoff.md`

Статус:

- development/handoff auxiliary doc;
- не milestone-facing source of truth.

## 6. Практическое решение по файлам

### Оставить в clean milestone snapshot как основные

1. `ik_llama.cpp/include/llama.h`
2. `ik_llama.cpp/common/common.cpp`
3. `ik_llama.cpp/common/common.h`
4. `ik_llama.cpp/examples/llama-bench/llama-bench.cpp`
5. `ik_llama.cpp/dashboard.html`
6. `ik_llama.cpp/dashboard.css`
7. `ik_llama.cpp/dashboard.js`
8. `ik_llama.cpp/dashboard_server.py`
9. `ik_llama.cpp/src/llama.cpp`
10. `ik_llama.cpp/src/llama-build-context.cpp`
11. `ik_llama.cpp/ggml/src/ggml.c`
12. `ik_llama.cpp/ggml/include/ggml.h`
13. `ik_llama.cpp/src/llama-context.h`
14. `ik_llama.cpp/src/llama-model.h`

Но:

- с явным пониманием, что часть этих файлов mixed и содержит research subsections.

### Не продвигать как milestone claims

Даже если код остается в snapshot, не продвигать как release claims:

1. prompt packed-QKV
2. packed presets
3. deep trace envs
4. large MiniMax hot-expert budgets

### Отдельно нормализовать как tooling/artifacts

1. `ik_llama.cpp/bench_results/`
2. `ik_llama.cpp/scripts/*.ps1`
3. `ik_llama.cpp/dashboard_server.sh`

### Не использовать как source of truth

1. `ik_llama.cpp/docs/FORK_CHANGES.md`
2. `ik_llama.cpp/docs/development/qwen3next-handoff.md`

## 7. Следующий практический шаг

После этой разметки следующий шаг уже конкретный:

1. пройти mixed files;
2. явно выписать в каждом:
- какой subsection milestone-ready;
- какой subsection research-only;
3. после этого собирать clean commit/snapshot plan.
