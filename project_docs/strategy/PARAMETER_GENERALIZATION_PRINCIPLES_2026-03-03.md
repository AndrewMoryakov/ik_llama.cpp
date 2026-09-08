# Parameter Generalization Principles - 2026-03-03

## Зачем нужен этот документ

Этот документ фиксирует не текущее состояние отдельных knobs, а фундаментальные правила, по которым в форке дальше должна вестись работа над параметрами `ik_llama`.

Он нужен, чтобы не возвращаться каждый раз к одним и тем же вопросам:

1. Когда параметр надо отвязывать от одной модели и расширять на класс моделей.
2. Когда параметр должен остаться architecture-specific.
3. Что именно должны означать badges и статусы в `dashboard`.
4. Почему experimental knobs не нужно скрывать только потому, что мы их еще мало тестировали.
5. Как сочетать class-level support и family-specific defaults.

---

## Главная идея

Нужно различать не одну, а несколько независимых осей:

1. `Applicability`
- для какого класса моделей knob вообще имеет смысл по механике

2. `Runtime support today`
- где текущий код реально уже включает этот path

3. `Validation`
- где у нас есть benchmark-backed signal

4. `Confidence`
- насколько уверенно можно ожидать practical value именно на уже протестированных моделях и режимах

Если смешивать эти оси, получается плохая и лживая семантика:

- параметр подходит классу моделей, но UI показывает его как model-only
- параметр wired в runtime, но выглядит как будто он validated everywhere
- параметр tested на одной модели, и его ошибочно трактуют как universal default

---

## Principle 1. Applicability не равно validation

Если knob по механике относится к классу моделей, его нельзя концептуально держать как knob одной модели.

Примеры:

- `Hot Expert Selection`
- `Tail Window`
- `Hot Expert Budget`
- `Prompt Packed QKV`

Их нельзя объяснять пользователю так, будто они “принадлежат” только `MiniMax`, `Qwen3MoE` или `gpt-oss`.

Правильно:

- `Hot Expert Selection / Tail Window / Budget` -> `MoE / huge-MoE`
- `Prompt Packed QKV` -> `Split-QKV`

Но это не означает, что они уже validated на всем классе.

---

## Principle 2. Validation всегда уже, чем applicability

То, что knob подходит классу моделей, не означает, что practical benefit уже подтвержден на всем классе.

Например:

- `Prompt Packed QKV` подходит классу `Split-QKV`
- но practical value сейчас заметно отличается между:
  - `gpt-oss-120b`
  - `gpt-oss-20b`
  - `Qwen3-30B-A3B`

Значит UI и docs должны говорить так:

- knob доступен шире по классу моделей
- уверенная practical usefulness claim делается только для конкретных tested model/regime combinations

---

## Principle 3. Runtime support today должен быть честным

Нельзя делать вид, что knob “работает везде”, если runtime today реально еще уже, чем theoretical applicability.

Правильная модель:

- knob может быть class-applicable
- runtime support today может быть partial
- validation может быть еще уже

Отсюда правило:

- если knob подан на совместимый класс, но path еще не fully wired, runtime должен честно логировать limitation или fallback
- запрещать knob только потому, что support partial, не нужно

---

## Principle 4. Experimental layer не должен блокировать совместимые модели

Experimental knobs не нужно отключать только потому, что:

1. мы еще не тестировали конкретную модель
2. у нас пока слабый signal
3. на другой модели той же family signal был нейтральный или слегка отрицательный

Причины:

1. сообщество и пользователь могут протестировать knob в другой среде
2. у них может быть другой host regime
3. появятся новые модели того же класса
4. если UI разрешает knob только тем моделям, которые протестировали мы, форк быстро превращается в узкий allow-list

Следствие:

- compatible-class knobs должны быть доступны шире
- но рядом должна быть честная метка confidence/tested-on

---

## Principle 5. Family-specific defaults сохраняются

Generalized support не должен ломать существующие tuned defaults.

Если в оригинальном `ik_llama` или в уже подтвержденной линии форка есть family-specific default, он сохраняется.

Это означает:

- class-level availability не равна class-level default
- family-specific auto-policy может оставаться узкой
- family-specific preset может оставаться узким

Пример:

- `Prompt Packed QKV` может быть доступен всему `Split-QKV` классу
- но `auto` policy может оставаться tuned для `Qwen3MoE` или `gpt-oss`

---

## Principle 6. Что обобщаем, а что нет

### Нужно generalize на класс моделей

Generalize нужно те knobs, которые по механике уже относятся к классу моделей, а не к одной family.

Current examples:

- `Hot Expert Selection`
- `Tail Window`
- `Hot Expert Budget`
- `Hot Expert Budget Mult`
- `Prompt Packed QKV`
- `Prompt Packed preset`
- `Prompt Packed range`

### Не нужно насильно generalize

Если knob реально architecture-specific, его надо так и оставлять.

Current examples:

- `MLA mode`
- `Merge QKV`
- family-specific `auto` policies
- family-specific tuned presets

То есть критерий должен быть не “хочется сделать шире”, а “это действительно knob класса моделей по механике”.

---

## Principle 7. Confidence model-regime specific

Confidence нельзя рисовать по одной family name.

Например, одной метки `gpt-oss` уже недостаточно.

Потому что:

- `Prompt Packed QKV` на `gpt-oss-120b` дал сильный practical signal
- на `gpt-oss-20b` дал prompt-side gain, но слабый mixed-path value

Значит confidence должен зависеть от:

1. конкретной модели
2. конкретного режима / workload

Правильная подача:

- `Applicability`: `Split-QKV`
- `Runtime support`: yes/partial
- `Validation`: tested on specific model/regime
- `Confidence`: `high / medium / low / none`
- `Tested on`: explicit model names

---

## Principle 8. Baseline changes требуют сильного сигнала

Experimental knob не становится baseline только потому, что:

- он generalized
- он conceptually elegant
- он улучшил один внутренний submetric

Baseline-worthy signal требует:

1. воспроизводимого benchmark effect
2. end-to-end practical value
3. отсутствия явного regression по соседним важным метрикам

Пример:

- `Prompt Packed QKV` улучшает prompt-side performance на нескольких моделях
- но не стал universal baseline, потому что mixed-path value не одинаково полезен везде

---

## Principle 9. Dashboard должен учить, а не скрывать

Роль `dashboard` в этой задаче не “спрятать опасные knobs”, а:

1. показать совместимые knobs по классу моделей
2. честно объяснить, что именно они меняют в runtime
3. показать current support state
4. показать tested-on / confidence
5. сохранить для пользователя свободу экспериментировать

То есть dashboard должен быть:

- не allow-list launcher
- а explainable experimentation layer

---

## Principle 10. Каждую новую линию проверяем на три вопроса

Для любого нового knob или generalized path задаем три вопроса:

1. Это knob класса моделей или knob конкретной архитектуры?
2. Runtime уже реально поддерживает его как class-level path или только частично?
3. Есть ли validation и confidence beyond one-family anecdotes?

Только после этого решаем:

- generalized support
- family-only support
- partial support with warning
- leave architecture-specific

---

## Practical operating rules

### Rule A
Если knob class-applicable, его можно и нужно показывать compatible class широко.

### Rule B
Если runtime support partial, не блокировать knob, а честно маркировать limitation.

### Rule C
Если validation узкая, не выдавать knob за universal winner.

### Rule D
Если у family already tuned default, не ломать его generalized support-ом.

### Rule E
Если knob architecture-specific по природе, не обобщать его только ради единообразия UI.

---

## Что это значит для текущей работы

На текущем этапе проект уже должен придерживаться следующего подхода:

1. `Phase 1`
- semantic layer
- closed

2. `Phase 2`
- runtime generalization
- generalized only those knobs that are class-appropriate by mechanism

3. `Phase 3`
- targeted validation generalized paths
- confidence/tested-on becomes model/regime specific

4. Following phases
- use the same semantic model everywhere:
  - runtime
  - docs
  - dashboard
  - presets
  - release-facing claims

---

## Canonical companion documents

This principles document should be read together with:

- `project_docs/strategy/EXPERIMENTAL_KNOB_MATRIX_2026-03-02.md`
- `project_docs/strategy/PHASE2_KNOB_BACKLOG_2026-03-03.md`
- `project_docs/strategy/PHASE3_VALIDATION_PLAN_2026-03-03.md`
- `project_docs/dashboard/PRODUCT_GUIDE.md`
- `project_docs/strategy/CURRENT_HANDOFF_2026-03-01.md`
