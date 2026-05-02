# Документация По Целям

Это главная человеческая точка входа в документацию.

Если документов слишком много и непонятно, куда смотреть, начинайте отсюда.

Важно:

- этот файл для людей
- если документ читает LLM-агент, ему лучше идти в `llm/`

## Как пользоваться этой картой

1. Сначала выберите свою цель.
2. Возьмите минимальный набор документов для этой цели.
3. Не открывайте весь `project_docs` подряд.
4. Если после минимального набора вопрос не закрыт, переходите к разделу "Что читать дальше".

## Что обычно не нужно читать в начале

В начале обычно не нужны:

1. `archive/`
2. старые benchmark-отчеты без current-status notes
3. `llm/`, если вы человек

---

## Цель 1: Быстро понять, что это за проект и в каком он состоянии

Когда это ваша цель:

- вы только открыли проект
- хотите понять, чем занимается форк
- хотите понять, это уже релиз, исследование или черновик

Читайте:

1. `../docs/PROJECT_ANALYSIS.md`
- полный технический анализ: что даёт ikawrakow (IQK, MoE, flash attention) и что добавлено нами (hot experts, VirtualLock, dashboard)
- цепочка наследования ggerganov → ikawrakow → наш форк
- сводка всех изменений с числами

2. `strategy/FORK_GOAL_AND_SCOPE_2026-02-28.md`
- что именно является целью форка
- почему главный фокус сейчас на huge swap-bound MoE

3. `release/CURRENT_STATUS_2026-02-28.md`
- текущее общее состояние
- что уже сильное
- что еще мешает считать состояние полноценным публичным milestone

4. `strategy/ROADMAP_2026-02-28.md`
- куда реально движется проект
- что short-term, mid-term и long-term

Что вы получите:

- общее понимание проекта за короткое время
- понимание, что форк уже не сырой хаос, но еще не финальный polished release

Что читать дальше, если нужно глубже:

- `release/VALIDATED_SCOPE_2026-02-28.md`
- `release/STABLE_VS_EXPERIMENTAL_2026-02-28.md`

---

## Цель 2: Понять, что уже подтверждено измерениями, а что пока только гипотеза

Когда это ваша цель:

- вы не хотите читать догадки вместо фактов
- вам нужны только benchmark-backed выводы
- вы хотите отделить validated от experimental

Читайте:

1. `benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- текущая truth-layer по `Qwen3MoE`

2. `benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- текущая truth-layer по `gpt-oss`

3. `benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- текущая truth-layer по `MiniMax`

4. `release/VALIDATED_SCOPE_2026-02-28.md`
- что уже можно считать validated scope на уровне релизного слоя

5. `benchmarks/SUMMARY_ALL.md`
- один краткий документ со всеми актуальными benchmark-цифрами и практическими выводами

Что вы получите:

- актуальную benchmark-картину без необходимости вычитывать старые notes
- понимание, где результаты уже подтверждены, а где еще research-only

Что читать дальше, если нужен raw evidence:

1. `benchmarks/INDEX.md`
2. `ik_llama.cpp/bench_results/`

---

## Цель 3: Просто запустить модель через дашборд и не сделать глупость

Когда это ваша цель:

- вы новичок
- хотите быстро запустить модель
- хотите понимать, что делает dashboard

Читайте:

1. `tutorial/START_HERE.md`
- как запустить dashboard
- какой порядок действий в интерфейсе

2. `tutorial/MINI_TUTORIAL.md`
- базовая предметная область простым языком
- почему один и тот же параметр может помочь одной модели и навредить другой

3. `tutorial/RECIPES_AND_ANTI_PATTERNS.md`
- готовые стартовые рецепты
- типовые ошибки, которые делают чаще всего

Что вы получите:

- безопасный старт без ручного разбора десятков флагов
- понимание, как не переносить настройки между разными моделями автоматически

Что читать дальше, если нужен полный справочник:

- `tutorial/PARAMETER_REFERENCE.md`

Если нужно понять сам dashboard как продукт, а не только научиться им пользоваться:

- `dashboard/PRODUCT_GUIDE.md`

---

## Цель 4: Понять, как настраивать параметры и что будет, если настроить их неправильно

Когда это ваша цель:

- вы уже запускаете модели
- вам нужно осознанно крутить параметры
- вам важны последствия неверной настройки

Читайте:

1. `tutorial/PARAMETER_REFERENCE.md`
- что делает каждый параметр
- когда его трогать
- что пойдет не так при плохой настройке

2. `runbooks/MOE_RUNTIME_PROFILES.md`
- practical runtime-логика
- как мыслить в терминах `in-RAM` / `swap-bound`, `pp/tg/pg`, `rtr`

3. `benchmarks/RTR_POLICY.md`
- что сейчас известно про `rtr off/on/auto`

Что вы получите:

- не просто список параметров, а логику их выбора
- понимание, где ошибка ударит по throughput, где по startup, где по RAM behavior

---

## Цель 5: Понять, как сейчас запускать конкретную модельную семью

Когда это ваша цель:

- у вас уже есть конкретная модель
- вы хотите не общий theory layer, а актуальную family-specific правду

### Если это `Qwen3MoE`

Читайте:

1. `benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
2. `runbooks/MOE_RUNTIME_PROFILES.md`

Что получите:

- текущий validated baseline
- что уже полезно
- что пока только эксперимент

### Если это `gpt-oss`

Читайте:

1. `benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
2. `runbooks/MOE_RUNTIME_PROFILES.md`

Что получите:

- разницу между `20b` и `120b`
- где compute-oriented режим, а где huge-model / memory-pressure режим
- почему `Prompt Packed QKV` нельзя трактовать как одинаково полезный для `20b` и `120b`

### Если это `MiniMax M2.5`

Читайте:

1. `models/MINIMAX_M2_5_RUNTIME.md`
- понятное человеческое объяснение, что происходит с MiniMax в этом форке

2. `benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- current source of truth по MiniMax

3. `benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`
- что произошло с `hot expert budget`
- почему большие бюджеты пока не promoted в default

Что получите:

- practical baseline для MiniMax
- понимание, почему MiniMax нельзя настраивать как `Qwen3MoE` или `gpt-oss`
- понимание, что `TG-only` сейчас тяготеет к `rtr=off`, а mixed path уже имеет реальную `auto` branch

---

## Цель 6: Понять, что уже можно показывать сообществу, а что еще рано

Когда это ваша цель:

- вы думаете о релизе, посте, статье, анонсе
- вам нужно честно понимать границу между stable и experimental

Читайте:

1. `release/MILESTONE_SUMMARY_2026-03-01.md`
- короткое описание того, что уже представляет собой текущий milestone

2. `release/RELEASE_FACING_CLAIMS_2026-03-01.md`
- что уже можно утверждать публично, а что пока нельзя

3. `release/SUPPORTED_VALIDATED_MATRIX_2026-03-01.md`
- что уже входит в validated scope

4. `benchmarks/SUMMARY_ALL.md`
- короткая factual summary по текущим цифрам, без чтения всех family notes

4. `release/EXPERIMENTAL_MATRIX_2026-03-01.md`
- что реально существует в коде, но пока не promoted в stable layer

5. `release/KNOWN_LIMITS_AND_OPEN_QUESTIONS_2026-03-01.md`
- что еще не закрыто

6. `release/STABLE_VS_EXPERIMENTAL_2026-02-28.md`
- что можно называть stable, а что пока нельзя

7. `release/RELEASE_CANDIDATE_INVENTORY_2026-02-28.md`
- что уже готово для milestone
- что еще блокирует красивую публикацию

Что вы получите:

- честную границу между publishable и research-only
- понимание, чего не стоит обещать сообществу раньше времени

---

## Цель 7: Продолжить инженерную работу по проекту

Когда это ваша цель:

- вы не просто пользователь
- вам нужно продолжать разработку, benchmarking или optimization work

Читайте:

1. `strategy/CURRENT_HANDOFF_2026-03-01.md`
- краткое текущее состояние
- что уже зафиксировано
- какой следующий benchmark имеет лучший ROI

2. `development/ARCHITECTURE_EXECUTION_MAPS_2026-02-28.md`
- карта по главным архитектурам

3. `strategy/ROADMAP_2026-02-28.md`
- куда движется проект на short/mid/long term

4. нужный family current-status note:
- `benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`

Что вы получите:

- правильную точку продолжения без повторного исследования уже пройденного

Если вы не человек, а LLM-агент:

- вместо этого раздела идите в `llm/`

---

## Цель 8: Понять, куда проект движется дальше и какие большие темы впереди

Когда это ваша цель:

- вас интересует не только текущее состояние
- вы хотите понять долгий вектор развития

Читайте:

1. `strategy/ROADMAP_2026-02-28.md`
- short / mid / long-term roadmap

2. `strategy/TASK.md`
- стратегические идеи
- в том числе линия по собственным квантизациям

3. `dashboard/ROADMAP_2026-02-28.md`
- какие family presets и knowledge layer планируются дальше

Что вы получите:

- понимание, какие большие темы еще впереди
- понимание, что уже backlog, а что еще даже не validated line

---

## Цель 9: Найти сырые результаты, старые прогоны и понять, где что лежит

Когда это ваша цель:

- вам нужен raw benchmark evidence
- вы хотите поднять старый прогон
- вам нужно понять, какие документы текущие, а какие исторические

Читайте:

1. `benchmarks/INDEX.md`
- карта прогонов
- active snapshot vs historical runs

2. `benchmarks/README.md`
- общий вход в benchmark docs

3. `ik_llama.cpp/bench_results/`
- сырые артефакты

Что вы получите:

- понимание, какой run текущий, а какой архивный
- где narrative truth, а где raw logs

---

## Самые короткие маршруты

Если совсем кратко:

### Хочу понять проект за 10 минут

1. `../docs/PROJECT_ANALYSIS.md`
2. `strategy/FORK_GOAL_AND_SCOPE_2026-02-28.md`
3. `release/CURRENT_STATUS_2026-02-28.md`
4. `strategy/ROADMAP_2026-02-28.md`

### Хочу просто начать пользоваться

1. `tutorial/START_HERE.md`
2. `tutorial/MINI_TUTORIAL.md`
3. `tutorial/RECIPES_AND_ANTI_PATTERNS.md`

### Хочу понять, что реально подтверждено

1. `benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
2. `benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
3. `benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
4. `benchmarks/SUMMARY_ALL.md`

### Хочу понять MiniMax

1. `models/MINIMAX_M2_5_RUNTIME.md`
2. `benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
3. `benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`

### Хочу продолжить разработку

1. `strategy/CURRENT_HANDOFF_2026-03-01.md`
2. `development/ARCHITECTURE_EXECUTION_MAPS_2026-02-28.md`
3. нужный family current-status note
