# Logical Milestone Snapshot - 2026-03-01

## Назначение

Это логически собранный milestone snapshot текущего состояния проекта.

Он нужен для варианта A:

- без жесткой git-операционки;
- без вырезания research layer;
- без попытки сразу собрать финальный clean branch.

Этот документ отвечает на вопрос:

- что считать текущим основным usable milestone state прямо сейчас.

## Короткий вердикт

Текущий logical snapshot уже существует.

Его правильная формулировка:

- usable engineering milestone;
- practical technical preview;
- с сохраненным рядом research layer.

## Git anchor for code

Кодовая часть `ik_llama.cpp` уже заякорена в git:

- branch: `milestone/2026-03-01-logical-snapshot`
- commit: `05b28d1a1`

Важно:

- это относится только к `ik_llama.cpp`, потому что `project_docs/` лежит вне git;
- docs-layer этого snapshot остается filesystem-layer truth в текущем корне проекта.

## 1. Что считать основным milestone state

В основной logical snapshot входят три слоя:

1. `Runtime Core`
2. `Dashboard Product Layer`
3. `Documentation / Navigation Layer`

Именно это сейчас является usable baseline.

## 2. Runtime Core

### Что входит

1. `ik_llama.cpp/include/llama.h`
2. `ik_llama.cpp/common/common.cpp`
3. `ik_llama.cpp/common/common.h`
4. `ik_llama.cpp/examples/llama-bench/llama-bench.cpp`
5. milestone-ready части:
   - `ik_llama.cpp/src/llama.cpp`
   - `ik_llama.cpp/src/llama-model.h`
   - `ik_llama.cpp/ggml/src/ggml.c`
   - `ik_llama.cpp/ggml/include/ggml.h`

### Что считается частью usable baseline

1. `rtr auto`
2. benchmark-visible runtime policy
3. MiniMax-specific `rtr auto` bugfix
4. practical MiniMax runtime plumbing
5. effective repack reporting

### Что не входит в stable runtime claims

1. prompt packed-QKV
2. deep trace envs
3. large MiniMax hot-expert budgets as recommendation

## 3. Dashboard Product Layer

### Что входит

1. `ik_llama.cpp/dashboard.html`
2. `ik_llama.cpp/dashboard.css`
3. `ik_llama.cpp/dashboard.js`
4. `ik_llama.cpp/dashboard_server.py`

### Что считается частью usable baseline

1. launcher
2. knowledge layer
3. family-aware guidance
4. validated vs experimental separation
5. user-facing MiniMax/Qwen3MoE/gpt-oss guidance

### Что важно

Dashboard может знать про advanced knobs, но это не делает его research-only.

Он уже usable как продукт.

## 4. Documentation / Navigation Layer

### Что входит

1. `project_docs/release/*.md`
2. `project_docs/strategy/*.md` для current state / roadmap / handoff
3. `project_docs/benchmarks/current/*.md`
4. `project_docs/tutorial/*.md`
5. `project_docs/dashboard/*.md`
6. `project_docs/llm/*.md`
7. `project_docs/README.md`
8. `project_docs/START_HERE_BY_GOAL.md`

### Что считается частью milestone state

1. source-of-truth navigation
2. release/current-status narrative
3. human tutorial layer
4. LLM bootstrap layer

Именно этот слой делает состояние проекта воспроизводимым и понятным без новой раскопки контекста.

## 5. Что оставить рядом, но не считать основным milestone baseline

Это остается частью дерева, но относится к соседним слоям snapshot, а не к его центральному usable baseline.

### A. Research Layer

Включает:

1. `IK_LLAMA_PG_TRACE`
2. `IK_LLAMA_PG_TRACE_DECODE_WINDOW`
3. `IK_LLAMA_LAYER_SCORE_TRACE`
4. `IK_LLAMA_EXEC_LAYER_TRACE`
5. `IK_LLAMA_LOCALITY_TRACE`
6. prompt packed-QKV
7. packed presets
8. packed arena
9. MiniMax hot-expert trace
10. MiniMax hot-expert budget overrides

Статус:

- оставить в дереве;
- не считать частью stable claims;
- использовать как engineering lab layer.

### B. Artifacts / Tooling

Включает:

1. `ik_llama.cpp/bench_results/`
2. `ik_llama.cpp/scripts/*.ps1`
3. `ik_llama.cpp/dashboard_server.sh`

Статус:

- operational/supporting layer;
- не core milestone code.

### C. Historical / Auxiliary

Включает:

1. `ik_llama.cpp/docs/FORK_CHANGES.md`
2. `ik_llama.cpp/docs/development/qwen3next-handoff.md`

Статус:

- context/history;
- не source of truth.

## 6. Что сейчас считается истиной для этого snapshot

### Общий статус

- `project_docs/release/CURRENT_STATUS_2026-02-28.md`
- `project_docs/release/CODEBASE_HEALTH_2026-03-01.md`

### Stable vs experimental

- `project_docs/release/STABLE_VS_EXPERIMENTAL_2026-02-28.md`
- `project_docs/release/VALIDATED_SCOPE_2026-02-28.md`

### Qwen3MoE

- `project_docs/benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`

### gpt-oss

- `project_docs/benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`

### MiniMax

- `project_docs/benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- `project_docs/benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`
- `project_docs/models/MINIMAX_M2_5_RUNTIME.md`

### Handoff / next session

- `project_docs/strategy/CURRENT_HANDOFF_2026-03-01.md`

## 7. Что сейчас можно честно утверждать в рамках snapshot

1. кодовой базой уже можно пользоваться;
2. `rtr auto` уже является реальной feature;
3. dashboard уже usable;
4. docs уже собраны в нормальную navigation/source-of-truth систему;
5. research layer не потерян и не выпилен, а живет рядом;
6. MiniMax usable как huge-model target, но его final `off vs auto` closure еще не завершена.

## 8. Что сейчас нельзя объявлять завершенным

1. headline architecture-specific engine win
2. final MiniMax policy closure
3. final clean git snapshot / milestone branch
4. final custom quantization results

## 9. Что означает Variant A как завершенный

Variant A можно считать закрытым, если выполняются такие условия:

1. есть один документ, который задает current logical snapshot;
2. понятно, что входит в usable baseline;
3. понятно, что относится к research/tooling/history;
4. docs, dashboard и runtime claims не противоречат друг другу;
5. следующая сессия может продолжить работу от этого snapshot, а не от хаотичного дерева.

Этот документ вместе с release/docs map и handoff уже дает такую опору.

## 10. Что будет следующим шагом после стабилизации Variant A

Следующий шаг уже относится к варианту B:

- реально собрать clean milestone snapshot на уровне дерева/commit groups.

Но до этого момента текущий logical snapshot уже можно использовать как:

1. рабочую точку продолжения;
2. основу для внутреннего milestone narrative;
3. опору для следующей сессии без повторного переисследования.
