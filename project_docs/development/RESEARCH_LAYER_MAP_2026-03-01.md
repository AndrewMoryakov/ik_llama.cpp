# Research Layer Map - 2026-03-01

## Зачем нужен этот документ

Этот документ фиксирует исследовательский слой текущего дерева:

1. что именно относится к research layer;
2. что каждая ветка делает;
3. зачем она была добавлена;
4. какой у нее текущий статус;
5. как с ней обращаться при сборке clean milestone snapshot.

Нужен для того, чтобы:

- не путать validated baseline и экспериментальный код;
- не разбирать заново по `git blame`, что является текущим research layer;
- понимать, что оставлять в дереве, а что не продвигать в milestone scope.

## Общий вывод

Текущий research layer состоит из двух типов вещей:

1. уже закоммиченный historical MiniMax research;
2. текущий незакоммиченный engineering research, добавленный в рамках этой линии работы.

Это не “мусор” и не “пустые заглушки”.

В основном это:

- instrumentation;
- env-gated experimental paths;
- policy knobs для controlled A/B.

## 1. Historical MiniMax runtime research

### Где живет

- `ik_llama.cpp/src/llama.cpp`
- `ik_llama.cpp/ggml/src/ggml.c`

Основные участки:

- shared tensor locking
- one-shot hot expert locking after prompt
- MiniMax-oriented swap-bound memory handling

### Что делает

1. пытается удерживать shared tensors в RAM;
2. собирает prompt-side expert statistics;
3. один раз lock-ит top-N hot experts;
4. избегает dynamic lock/unlock during decode.

### Зачем

Это попытка улучшить huge swap-bound MoE через:

- locality;
- paging behavior;
- working set management.

### Кто делал

По `git blame` это уже существующая часть форка, в основном от `AndrewMoryakov`.

### Текущий статус

- оставить в дереве;
- считать частью active MiniMax runtime line;
- не считать “грязью”.

### В milestone scope

- оставить;
- но формулировать осторожно, без обещания финально закрытой MiniMax policy.

## 2. PG transition trace

### Где живет

- `ik_llama.cpp/src/llama.cpp`
- `ik_llama.cpp/src/llama-build-context.cpp`

### Env knobs

- `IK_LLAMA_PG_TRACE`
- `IK_LLAMA_PG_TRACE_DECODE_WINDOW`

### Что делает

1. логирует prompt call;
2. логирует first decode и расширенное decode window после prompt;
3. разбивает время на:
   - build
   - alloc
   - inputs
   - compute
   - reset
4. помогает понять, где реально теряется время в `pg`.

### Зачем

Нужно было проверить гипотезу:

- bottleneck `pg` находится в `prompt -> decode` transition
или
- он сидит глубже в compute-side path.

### Что дало

Позволило отвергнуть слишком сильную гипотезу, что главный bottleneck — это graph/scheduler boundary.

### Текущий статус

- useful internal engineering tool;
- не user-facing feature.

### В milestone scope

- оставить в дереве;
- не продвигать как public feature;
- маркировать как research tooling.

## 3. Static layer scoring

### Где живет

- `ik_llama.cpp/src/llama-build-context.cpp`

### Env knob

- `IK_LLAMA_LAYER_SCORE_TRACE`

### Что делает

1. считает structural per-layer delta;
2. логирует:
   - packed/split
   - размеры Q/K/V
   - rough projection MAC cost
   - graph deltas по attention/QKV subgraph

### Зачем

Нужно было понять:

- какие слои вообще выглядят выгодными кандидатами для packed-QKV;
- можно ли объяснить observed behavior только структурой графа.

### Что дало

Показало, что одного static scoring недостаточно:

- он не объясняет полностью, почему у `Qwen` и `gpt-oss` лучшие диапазоны packing разные.

### Текущий статус

- diagnostic tool;
- исследовательская опора для prompt attention work.

### В milestone scope

- не включать как feature;
- оставить как engineering tool.

## 4. Execution-side layer profiling

### Где живет

- `ik_llama.cpp/ggml/src/ggml.c`

### Env knob

- `IK_LLAMA_EXEC_LAYER_TRACE`

### Что делает

1. coarse wall-time profiling по слоям;
2. раскладывает execution-side attention cost по слоям;
3. помогает сравнивать structural vs runtime picture.

### Зачем

Нужно было перейти от graph-shape reasoning к runtime reasoning.

### Что дало

Подтвердило, что чистой структуры графа недостаточно и нужно смотреть на locality/runtime behavior.

### Текущий статус

- useful engineering profiler;
- не user-facing behavior.

### В milestone scope

- не включать как feature;
- оставить как hidden research helper.

## 5. Prompt packed-QKV path

### Где живет

- `ik_llama.cpp/src/llama.cpp`
- `ik_llama.cpp/src/llama-build-context.cpp`
- `ik_llama.cpp/src/llama-model.h`

### Env knobs

- `IK_LLAMA_PROMPT_PACKED_QKV`
- `IK_LLAMA_PROMPT_PACKED_QKV_PRESET`
- `IK_LLAMA_PROMPT_PACKED_QKV_RANGE`

### Что делает

1. создает prompt-only packed QKV path;
2. пытается убрать overhead split `wq/wk/wv` в prompt/mixed path;
3. поддерживает full/front-half/back-half/auto/explicit-range.

### Зачем

Это была попытка получить measurable `pg` gain на split-QKV attention families:

- `Qwen3MoE`
- `gpt-oss`

### Что дало

1. structural effect подтвержден;
2. prompt-side effect подтвержден;
3. end-to-end user-facing gain оказался слабым.

### Текущий статус

- implemented;
- benchmarked;
- still research-only.

### В milestone scope

- оставить в дереве;
- явно держать как experimental path;
- не рекламировать как stable optimization.

## 6. Packed-QKV preset policy

### Где живет

- `ik_llama.cpp/src/llama.cpp`

### Что делает

1. задает presets:
   - `auto`
   - `full`
   - `front-half`
   - `back-half`
2. привязывает их к architecture-specific heuristics.

### Зачем

Нужно было избежать грубого правила “pack all layers” и получить более точечный engineering path.

### Что дало

Показало, что:

- full-pack не универсален;
- architecture-specific selection действительно имеет значение.

### Текущий статус

- heuristic research policy;
- не final runtime policy.

### В milestone scope

- не продвигать как готовую public policy;
- оставить как исследовательский слой.

## 7. Packed-QKV arena / locality cleanup

### Где живет

- `ik_llama.cpp/src/llama.cpp`

### Связанный env knob

- использует тот же `IK_LLAMA_PROMPT_PACKED_QKV`

### Что делает

1. переводит packed-QKV storage в contiguous arena;
2. улучшает locality packed tensors;
3. убирает часть allocator fragmentation/pathology.

### Зачем

Нужно было проверить, не пропадает ли packed-QKV gain из-за allocator/locality issues.

### Что дало

1. locality улучшилась;
2. prompt-side traces улучшились;
3. end-to-end `pg` это существенно не спасло.

### Текущий статус

- useful cleanup inside research branch;
- не превращено в release win.

### В milestone scope

- не выносить как отдельное достижение;
- оставить как часть research branch.

## 8. MiniMax hot-expert budget overrides

### Где живет

- `ik_llama.cpp/src/llama.cpp`
- `ik_llama.cpp/dashboard.js`
- `ik_llama.cpp/dashboard_server.py`

### Env knobs

- `IK_LLAMA_HOT_EXPERT_BUDGET`
- `IK_LLAMA_HOT_EXPERT_BUDGET_MULT`

### Что делает

1. позволяет переопределять budget hot experts;
2. дает controlled A/B без переписывания default policy;
3. связан с dashboard advanced control.

### Зачем

Нужно было быстро проверить, стоит ли продвигать MiniMax budget выше legacy `16`.

### Что дало

1. quick checks дали signal;
2. long-run не подтвердил новый default;
3. practical baseline вернулся к legacy/default behavior.

### Текущий статус

- useful research knob;
- ordinary user baseline: не задавать.

### В milestone scope

- оставить в коде и dashboard как advanced/research path;
- не продвигать как validated recommendation.

## 9. MiniMax hot-expert trace

### Где живет

- `ik_llama.cpp/src/llama.cpp`
- `ik_llama.cpp/ggml/src/ggml.c`
- `ik_llama.cpp/ggml/include/ggml.h`

### Env knob

- `IK_LLAMA_HOT_EXPERT_TRACE`

### Что делает

1. показывает locked vs unlocked rows/dispatches;
2. логирует before-commit / after-commit / post-commit-decode;
3. помогает понять, реально ли locked experts участвуют в decode.

### Зачем

Нужно было получить evidence, а не гадать по самому факту наличия budget knob.

### Что дало

Помогло понять, что:

- short quick checks могут быть обманчивыми;
- budget tuning надо проверять более длинными run'ами.

### Текущий статус

- internal diagnostic tool.

### В milestone scope

- не user-facing feature;
- оставить как internal research helper.

## 10. MiniMax-specific `rtr auto` bugfix

### Где живет

- `ik_llama.cpp/src/llama.cpp`
- `ik_llama.cpp/examples/llama-bench/llama-bench.cpp`
- `ik_llama.cpp/include/llama.h`
- `ik_llama.cpp/src/llama-model.h`

### Что делает

1. исправляет old broken `auto` behavior для huge `MiniMax`;
2. заставляет `auto` корректно отключать harmful repack в huge-model case;
3. исправляет reporting effective repack state.

### Зачем

Это уже не просто instrumentation, а correction of runtime policy.

### Что дало

1. старый bad `auto` result больше нельзя считать финальной truth;
2. появился новый узкий benchmark question: `MiniMax off vs auto` after fix.

### Текущий статус

- practical code fix;
- относится скорее к milestone-ready слою, а не к research-only.

### В milestone scope

- включать;
- это не нужно скрывать как эксперимент.

## Что делать с research layer в cleanup snapshot

### Оставить

Оставить в дереве:

1. весь profiling/tracing слой
2. prompt packed-QKV line
3. packed presets
4. packed arena
5. MiniMax hot-expert research knobs

Причина:

- это полезная инженерная лаборатория;
- она уже дала реальные решения;
- она не мешает baseline, если корректно помечена.

### Не продвигать как stable

Не продвигать как stable/public features:

1. prompt packed-QKV
2. packed presets
3. locality/prompt arena gains
4. MiniMax larger hot-expert budgets
5. profiling envs

### Явно включать в milestone-ready

В milestone-ready слой относить:

1. `rtr auto`
2. MiniMax-specific `auto` bugfix
3. validated dashboard knowledge layer
4. family-specific current-status docs

## Короткий итог

Research layer сейчас:

- осмысленный;
- полезный;
- partly historical, partly наш текущий;
- не должен быть удален;
- но должен быть явно отделен от stable baseline.
