# Data-Driven Evidence Layer

## Что это

`Data-driven evidence layer` — это отдельный слой данных и правил интерпретации benchmark-результатов для `dashboard`.

Он отвечает не за запуск модели и не за сам runtime, а за вопросы:

1. для какого класса моделей knob вообще имеет смысл;
2. где текущий runtime реально поддерживает этот knob;
3. где уже есть benchmark-backed signal;
4. насколько высока practical confidence;
5. на каких моделях это основано;
6. какие failure modes уже известны.

Практически это означает:

- новые findings добавляются как данные в registry;
- UI больше не должен жить на наборе разрозненных `if/else`;
- docs и handoff опираются на те же сущности.

## Зачем это нужно

Без этого слоя project/product semantics быстро расползаются:

1. `dashboard` начинает говорить одно;
2. benchmark docs говорят другое;
3. runtime support расширяется быстрее, чем UI успевает это честно объяснить.

`Data-driven evidence layer` нужен, чтобы:

1. отделить `applicability` от `validation`;
2. отделить `runtime support today` от теоретической применимости;
3. не блокировать community experiments только потому, что мы еще мало что протестировали;
4. при этом не врать пользователю о practical usefulness.

## Что входит в evidence layer

Для каждого experimental knob фиксируются:

1. `Applicability`
- где knob имеет смысл по механике;

2. `Runtime support`
- где текущий код реально включает этот path содержательно, а не как no-op;

3. `Validation`
- где уже есть benchmark-backed signal;

4. `Confidence`
- насколько уверенно можно ожидать practical value на уже протестированных model/regime combinations;

5. `Risk`
- насколько опасно включать knob без отдельной A/B;

6. `Tested on`
- список моделей/режимов, на которых уже есть фактическая опора;

7. `Failure mode`
- что обычно идет не так, если knob включен неудачно.

Для experimental presets фиксируются те же оси плюс:

1. `experimentalChanges`
2. `linkedValidatedChanges`

Для validated/class-level presets фиксируются:

1. `Applicability`
2. `Validation`
3. `Confidence`
4. `values`

Для runtime guidance / family defaults теперь также фиксируются:

1. `family/regime matching`
2. `baseline defaults`
3. `reasons`
4. `family-specific policy notes`

Для overview action-hints теперь также фиксируются:

1. `title`
2. `body`
3. `label`
4. `pane`
5. `defaultParam`
6. `accent`

То есть evidence layer теперь покрывает не только research knobs, но и:

1. product-level preset bundles;
2. family/runtime guidance for auto-config;
3. standard preset definitions;
4. overview action-hints for the top-level product flow;
5. model badges/status line for the top-level product flow.

## Что не входит в evidence layer

Он не заменяет:

1. runtime capabilities;
2. benchmark raw artifacts;
3. release-facing claims;
4. низкоуровневую архитектурную логику `ik_llama`;

Иными словами:

- runtime truth живет в коде;
- benchmark truth живет в benchmark docs и raw results;
- evidence layer связывает это в usable product semantics для:
  - knobs
  - presets
  - family/runtime guidance.

## Где сейчас живет executable source of truth

Для `dashboard` канонический executable registry сейчас находится в:

- `dashboard/evidence-layer.js`

Именно этот модуль должен быть primary source of truth для:

1. experimental knob badges;
2. preset badges;
3. validation/confidence tooltips;
4. tested-on / failure-mode summaries;
5. standard preset definitions;
6. runtime profile defaults and family-guidance reasoning;
7. overview family/validation summaries and product-facing notes;
8. model badges for family/path/workload/status and experimental-active state.

Практическое следствие:

- `dashboard/dashboard.js` не должен держать параллельные hardcoded semantic tables для:
  - validation,
  - confidence,
  - runtime-support badges,
  - family-validation summaries,
  - overview family summaries,
  - overview validation summaries.

Если такой дублирующий слой появляется, его нужно либо удалить, либо заменить thin-wrapper вызовом в `evidence-layer.js`.

## Каноническая схема

### Knob entry

Каждый experimental knob должен иметь entry со следующими полями:

1. `id`
2. `applicability`
3. `runtimeSupport`
4. `validation`
5. `confidence`
6. `risk`
7. `testedOn`
8. `failureMode`

### Experimental preset entry

Каждый experimental preset должен иметь:

1. `id`
2. `title`
3. `scope`
4. `runtimeSupport`
5. `validation`
6. `confidence`
7. `risk`
8. `testedOn`
9. `experimentalChanges`
10. `linkedValidatedChanges`

### Standard preset entry

Каждый standard preset должен иметь:

1. `id`
2. `title`
3. `description`
4. `applicability`
5. `validation`
6. `confidence`
7. `values`

### Runtime profile entry

Каждый runtime profile / family guidance entry должен иметь:

1. `id`
2. `matches(...)`
3. `title`
4. `defaults`
5. `reasons`

### Overview summary entry

Каждый overview-oriented evidence entry должен уметь вернуть:

1. `value`
2. `note`
3. `tone`
4. при необходимости `status`

Это позволяет держать `Overview` как product-facing summary panel на том же registry-driven слое, а не в ad-hoc ветках `dashboard.js`.

Это тот слой, который позволяет держать:

- family-specific defaults
- regime-specific auto-config guidance

в registry, а не в ad-hoc ветках `dashboard.js`.

## Правила интерпретации

### 1. Applicability не равна Validation

Если knob помечен как:

- `MoE / huge-MoE`

это означает только то, что knob относится к этому классу моделей по механике.

Это **не означает**, что:

1. runtime уже одинаково хорошо поддерживает его на всех таких моделях;
2. knob уже validated на всех таких моделях;
3. knob надо включать по умолчанию.

### 2. Runtime support не равен default

Если knob runtime-supported today на совместимом классе моделей, это не означает:

- что он стал family default;
- что existing family-specific defaults надо отменять.

### 3. Confidence не блокирует experiments

Если confidence:

- `low`
- `none`

это не должно скрывать knob из UI для совместимого класса моделей.

Это только честный индикатор:

- насколько мы уже уверены в practical value.

### 4. Family defaults сохраняются

Даже если knob widened до класса моделей, family-specific tuned defaults сохраняются.

Правильная модель:

1. class-level availability;
2. family-specific defaults;
3. model/regime-specific confidence.

## Как обновлять evidence layer после новых benchmark runs

Порядок такой:

1. сначала обновляется benchmark truth:
- raw results
- current status docs
- summary docs

2. потом обновляется evidence registry:
- `testedOn`
- `validation`
- `confidence`
- `failureMode`, если появились новые отрицательные сигналы
- preset confidence/validation, если findings влияют на preset recommendation
- runtime profile guidance, если findings меняют family/regime baseline

3. затем, если нужно, обновляются:
- presets
- dashboard wording
- product guide

Важно:

- не наоборот.

Сначала benchmark truth, потом evidence layer, потом user-facing copy.

## Что это дает проекту

1. `dashboard` становится расширяемым;
2. новые модели и новые findings не требуют новых ad-hoc ветвлений по всему UI;
3. community testing можно открывать шире, не теряя честности;
4. runtime generalization, productization и release stabilization получают общий semantic base.

## Связанные документы

- `EXPERIMENTAL_KNOB_MATRIX_2026-03-02.md`
- `PARAMETER_GENERALIZATION_PRINCIPLES_2026-03-03.md`
- `PHASE2_KNOB_BACKLOG_2026-03-03.md`
- `PHASE3_VALIDATION_PLAN_2026-03-03.md`
- `../dashboard/PRODUCT_GUIDE.md`
