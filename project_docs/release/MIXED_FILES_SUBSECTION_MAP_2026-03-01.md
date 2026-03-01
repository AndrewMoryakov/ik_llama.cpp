# Mixed Files Subsection Map - 2026-03-01

## Зачем нужен этот документ

`MILESTONE_FILE_CLASSIFICATION_2026-03-01.md` разметил файлы целиком.

Этого недостаточно для clean snapshot, потому что самые важные файлы сейчас `mixed`:

- часть кода в них milestone-ready;
- часть относится к research-only layer.

Этот документ фиксирует разметку уже **внутри** таких файлов.

## 1. `ik_llama.cpp/src/llama.cpp`

Это самый важный mixed file.

### Milestone-ready subsections

#### A. `rtr auto` runtime policy

Ключевые участки:

- `ik_llama.cpp/src/llama.cpp:3219`
- `ik_llama.cpp/src/llama.cpp:3231`
- `ik_llama.cpp/src/llama.cpp:3233`

Что это:

- реальная runtime policy branch;
- включает MiniMax-specific `auto` fix;
- относится к usable baseline.

Статус:

- milestone-ready

#### B. Existing MiniMax runtime layer

Ключевые участки:

- `ik_llama.cpp/src/llama.cpp:2100`
- `ik_llama.cpp/src/llama.cpp:2185`
- `ik_llama.cpp/src/llama.cpp:2609`

Что это:

- shared tensor locking;
- one-shot hot expert commit after prompt;
- базовый huge-MoE runtime layer.

Статус:

- milestone-ready as part of active MiniMax line
- но без обещания, что MiniMax policy уже финально закрыта

### Research-only subsections

#### C. PG trace

Ключевые участки:

- `ik_llama.cpp/src/llama.cpp:148`
- `ik_llama.cpp/src/llama.cpp:159`

Env:

- `IK_LLAMA_PG_TRACE`
- `IK_LLAMA_PG_TRACE_DECODE_WINDOW`

Статус:

- research-only instrumentation

#### D. Prompt packed-QKV path

Ключевые участки:

- `ik_llama.cpp/src/llama.cpp:172`
- `ik_llama.cpp/src/llama.cpp:217`
- `ik_llama.cpp/src/llama.cpp:2938`
- `ik_llama.cpp/src/llama.cpp:2971`

Env:

- `IK_LLAMA_PROMPT_PACKED_QKV`
- `IK_LLAMA_PROMPT_PACKED_QKV_PRESET`
- `IK_LLAMA_PROMPT_PACKED_QKV_RANGE`

Статус:

- research-only

#### E. Locality trace

Ключевой участок:

- `ik_llama.cpp/src/llama.cpp:181`

Env:

- `IK_LLAMA_LOCALITY_TRACE`

Статус:

- research-only instrumentation

#### F. MiniMax hot-expert diagnostics and overrides

Ключевые участки:

- `ik_llama.cpp/src/llama.cpp:190`
- `ik_llama.cpp/src/llama.cpp:199`
- `ik_llama.cpp/src/llama.cpp:208`
- `ik_llama.cpp/src/llama.cpp:2126`
- `ik_llama.cpp/src/llama.cpp:2141`
- `ik_llama.cpp/src/llama.cpp:2747`

Env:

- `IK_LLAMA_HOT_EXPERT_TRACE`
- `IK_LLAMA_HOT_EXPERT_BUDGET`
- `IK_LLAMA_HOT_EXPERT_BUDGET_MULT`

Статус:

- research-only knobs/tooling
- ordinary baseline не должен на них опираться

### Практическое решение по файлу

Файл должен оставаться в milestone snapshot.

Но при упаковке milestone claims:

- включать `rtr auto` и practical MiniMax runtime layer;
- не продвигать trace/packed/hot-budget subsections как stable features.

## 2. `ik_llama.cpp/src/llama-build-context.cpp`

### Milestone-ready subsections

#### A. Базовый architecture-specific builder path

Весь основной builder path остается core runtime code.

Он нужен для:

- `Qwen3MoE`
- `gpt-oss`
- `MiniMax`

Статус:

- milestone-ready core code

### Research-only subsections

#### B. Build-side PG trace

Ключевые участки:

- `ik_llama.cpp/src/llama-build-context.cpp:14`
- `ik_llama.cpp/src/llama-build-context.cpp:4386`
- `ik_llama.cpp/src/llama-build-context.cpp:4443`
- `ik_llama.cpp/src/llama-build-context.cpp:7007`
- `ik_llama.cpp/src/llama-build-context.cpp:7520`
- `ik_llama.cpp/src/llama-build-context.cpp:9119`
- `ik_llama.cpp/src/llama-build-context.cpp:9178`

Env:

- `IK_LLAMA_PG_TRACE`

Статус:

- research-only instrumentation

#### C. Static layer scoring

Ключевые участки:

- `ik_llama.cpp/src/llama-build-context.cpp:23`
- `ik_llama.cpp/src/llama-build-context.cpp:70`
- `ik_llama.cpp/src/llama-build-context.cpp:10335`
- `ik_llama.cpp/src/llama-build-context.cpp:10405`

Env:

- `IK_LLAMA_LAYER_SCORE_TRACE`

Статус:

- research-only instrumentation

#### D. Prompt packed-QKV use-site

Ключевые участки:

- `ik_llama.cpp/src/llama-build-context.cpp:10328`
- `ik_llama.cpp/src/llama-build-context.cpp:10338`
- `ik_llama.cpp/src/llama-build-context.cpp:10347`

Статус:

- research-only path

### Практическое решение по файлу

Файл оставлять в milestone snapshot.

Но:

- builder core считать milestone-ready;
- trace/scoring/packed-QKV subsections считать research-only.

## 3. `ik_llama.cpp/ggml/src/ggml.c`

### Milestone-ready subsections

#### A. Existing MiniMax/MoE runtime counters and dispatch support

Ключевые участки:

- `ik_llama.cpp/ggml/src/ggml.c:279`
- `ik_llama.cpp/ggml/src/ggml.c:288`
- `ik_llama.cpp/ggml/src/ggml.c:306`
- `ik_llama.cpp/ggml/src/ggml.c:325`
- `ik_llama.cpp/ggml/src/ggml.c:334`

Что это:

- expert hit counters;
- dispatch count;
- locked/unlocked dispatch stats;
- locked expert ordering support.

Статус:

- active MiniMax runtime line;
- milestone-ready as part of practical huge-MoE path

### Research-only subsections

#### B. Execution-side layer trace

Ключевые участки:

- `ik_llama.cpp/ggml/src/ggml.c:68`
- `ik_llama.cpp/ggml/src/ggml.c:77`
- `ik_llama.cpp/ggml/src/ggml.c:26716`
- `ik_llama.cpp/ggml/src/ggml.c:26781`

Env:

- `IK_LLAMA_EXEC_LAYER_TRACE`

Статус:

- research-only instrumentation

### Практическое решение по файлу

Файл остается в milestone snapshot.

Но:

- dispatch/hit/locked support относится к active runtime;
- `EXEC_LAYER_TRACE` не продвигается как stable feature.

## 4. `ik_llama.cpp/ggml/include/ggml.h`

### Milestone-ready subsections

#### A. MoE runtime API needed by MiniMax line

Ключевые участки:

- `ik_llama.cpp/ggml/include/ggml.h:374`
- `ik_llama.cpp/ggml/include/ggml.h:376`
- `ik_llama.cpp/ggml/include/ggml.h:379`
- `ik_llama.cpp/ggml/include/ggml.h:383`

Что это:

- expert hits API;
- dispatch count API;
- locked stats API;
- locked expert API.

Статус:

- milestone-ready plumbing for active MiniMax runtime line

### Research-only subsections

Здесь research-only слой минимален.

Файл в основном служит plumbing header для того, что уже используется в runtime.

### Практическое решение по файлу

- относить ближе к milestone-ready plumbing

## 5. `ik_llama.cpp/src/llama-context.h`

### Research-only subsections

Ключевые участки:

- `ik_llama.cpp/src/llama-context.h:147`
- `ik_llama.cpp/src/llama-context.h:148`
- `ik_llama.cpp/src/llama-context.h:149`
- `ik_llama.cpp/src/llama-context.h:150`

Что это:

- mixed-path trace state

Статус:

- research-only state support

### Практическое решение по файлу

- файл small and harmless;
- можно оставить в snapshot;
- но его текущие добавления относятся именно к trace layer.

## 6. `ik_llama.cpp/src/llama-model.h`

### Milestone-ready subsections

#### A. Effective repack state/reporting plumbing

Часть изменений относится к корректному reporting и runtime state around `rtr auto`.

Статус:

- milestone-ready

### Research-only subsections

#### B. Prompt packed-QKV runtime tensors

Это полевая поддержка для prompt packed-QKV branch.

Статус:

- research-only

### Практическое решение по файлу

- mixed;
- practical repack reporting support включать;
- packed-QKV tensor support держать как research-only.

## Короткий итог

Самые важные выводы для snapshot planning:

1. `src/llama.cpp` и `src/llama-build-context.cpp` нужно паковать не “целиком stable” и не “целиком experimental”, а как mixed files.
2. `ggml/include/ggml.h` ближе к milestone-ready plumbing.
3. `ggml/src/ggml.c` mixed, но с сильным practical MiniMax runtime ядром.
4. `src/llama-context.h` почти полностью trace support.
5. `src/llama-model.h` mixed: repack reporting practical, packed-QKV support research-only.

## Следующий шаг

После этой карты уже можно делать:

1. clean commit grouping;
2. snapshot plan по слоям:
   - runtime core
   - dashboard/docs
   - research layer
   - artifacts/tooling.
