# Dashboard Product Guide

Этот документ описывает `dashboard` как продукт и рабочий инструмент.

Он не заменяет учебный трек из `../tutorial/`. Его задача другая:

1. быстро понять, что именно умеет dashboard;
2. понять, где в коде живет каждая часть поведения;
3. понять, как обновлять knowledge layer без расхождения с benchmark truth.

## Что такое dashboard

`dashboard` это локальный launcher и guidance-layer для `ik_llama`.

Он решает две задачи:

1. помогает собрать и запустить корректную команду без ручного набора десятков флагов;
2. объясняет пользователю, какие настройки выглядят безопасными, рискованными или экспериментальными.

Практически это не просто форма для запуска `llama-cli`, а интерфейс, который учитывает:

- семейство модели;
- примерный размер модели;
- режим памяти (`in-RAM` или `swap-bound`);
- тип нагрузки (`PP`, `TG`, `PG`);
- текущий validated vs experimental слой знаний.

## Что dashboard умеет

На текущем слое продукт умеет:

1. запускать `llama-cli` и `llama-server`;
2. показывать локальный статус процесса и лог вывода;
3. определять системные параметры хоста;
4. оценивать размер модели по пути к `gguf`;
5. сканировать каталоги с моделями;
6. подбирать стартовые настройки через `Auto-configure`;
7. показывать предупреждения и подсказки по опасным комбинациям;
8. различать validated baseline и experimental knobs;
9. прокидывать trace/debug env overrides и передавать runtime-safe experimental knobs через repeatable CLI `--experimental key=value`;
10. применять экспериментальные пресеты, в том числе model-aware bundles для `MiniMax`, `Qwen3MoE` и `gpt-oss`;
11. по выбору пользователя связывать экспериментальный preset с validated-настройками, если bundle требует конкретного baseline.
12. показывать live inference view:
- фазы `prompt -> first decode -> decode tail`
- текущую активность `MoE` экспертов по trace-данным runtime
13. показывать replay ранее сохраненных trace-run:
- читать логи из `bench_results/`
- пошагово проигрывать фазы и MoE activity без повторного запуска модели
14. переключать live observability между:
- `Learn`
- `Inspect`
15. показывать replay/live traces на более легких MoE-моделях как быстрые demo-кейсы, не упираясь каждый раз в тяжелый `MiniMax` run

## Как читать experimental knobs

Для experimental-параметров dashboard теперь явно разводит четыре разные оси:

1. `Applicability`
- для какого класса моделей knob вообще имеет смысл по механике
- пример:
  - `MoE / huge-MoE`
  - `Split-QKV`
  - `MLA`

2. `Runtime support`
- где текущий код реально уже умеет этот knob включать не как пустой no-op, а как содержательный runtime path
- пример:
  - идея относится к классу `MoE / huge-MoE`,
  - но текущий runtime-path fully wired сегодня прежде всего на `MiniMax`

3. `Validation`
- где уже есть benchmark-backed сигнал
- это не то же самое, что applicability и не то же самое, что runtime support

4. `Confidence`
- насколько уверенно можно ожидать practical value именно на уже протестированных моделях и режимах
- это не блокировка knob, а только честная степень уверенности

Ключевое правило для dashboard:

- `applicability` не означает `validated`
- `validated` не означает `universal`
- `runtime support today` может быть уже, чем theoretical applicability, или уже шире validation
- `confidence` относится только к уже протестированным model/regime combinations и не должна блокировать experiment на других совместимых моделях

Отдельное правило для defaults:

- class-level experimental availability не отменяет family-specific defaults
- если у family уже есть tuned baseline/default, dashboard должен сохранять его
- generalized knobs открываются шире для совместимого класса моделей, но это не значит, что они автоматически становятся default для всех

Canonical matrix for this layer:

- `../strategy/EXPERIMENTAL_KNOB_MATRIX_2026-03-02.md`
- `../strategy/PARAMETER_GENERALIZATION_PRINCIPLES_2026-03-03.md`
- `../strategy/DATA_DRIVEN_EVIDENCE_LAYER_2026-03-03.md`

## Data-Driven Evidence Layer

`Dashboard` больше не должен хранить benchmark semantics как набор разрозненных `if/else`.

Для этого введен отдельный `data-driven evidence layer`:

1. executable registry для UI:
- `../../dashboard/evidence-layer.js`

2. canonical architectural explanation:
- `../strategy/DATA_DRIVEN_EVIDENCE_LAYER_2026-03-03.md`

Роль этого слоя:

1. хранить `Applicability`, `Runtime support`, `Validation`, `Confidence`, `Risk`, `Tested on` и `Failure mode`;
2. хранить standard presets и их confidence/validation как данные, а не как hardcoded bundles в `dashboard.js`;
3. хранить family/runtime guidance и auto-config profiles как registry, а не как ad-hoc policy ветки в `dashboard.js`;
4. позволять добавлять новые benchmark findings как данные, а не как новые ad-hoc ветвления в `dashboard.js`;
5. держать product semantics согласованной с benchmark truth и handoff docs;
6. формировать `Overview` family/validation summaries из того же registry, а не из отдельной product-логики в `dashboard.js`;
7. формировать `Overview -> Next actions` из того же registry, а не из отдельного hardcoded product-flow в `dashboard.js`.

Операционное правило:

- сначала обновляется benchmark truth;
- затем evidence registry;
- только после этого user-facing wording.

Именно поэтому `Tail Window` и похожие knobs теперь должны читаться так:

- по механике это knob класса `MoE / huge-MoE locality`
- по текущему runtime-path это сегодня уже generic `MoE / huge-MoE hot-expert path`
- по validation это сейчас подтверждено на `MiniMax` и частично на `gpt-oss-20b`
- по confidence:
  - `MiniMax`: medium
  - `gpt-oss-20b`: low
  - остальные совместимые `MoE`: knob доступен, но без сильной benchmark-backed уверенности

И `Prompt Packed QKV` теперь нужно читать в той же логике:

- по механике это knob класса `Split-QKV`
- по текущему runtime-path manual path уже может включаться на совместимых split-QKV моделях
- `auto` policy и benchmark-backed validation сегодня все еще лучше всего развиты на `Qwen3MoE / gpt-oss`
- при этом свежий `Phase 3` показал, что practical value внутри одной family тоже может различаться:
  - `gpt-oss-120b`: confirmed-useful, moderate branch
  - `gpt-oss-20b`: prompt-side gain but weak mixed-path value
- по confidence:
  - `gpt-oss-120b`: medium
  - `gpt-oss-20b`: low
  - `Qwen3MoE`: low
  - другие совместимые `Split-QKV` модели: knob доступен, но уверенность пока не claim-ится

И `Hot Expert Budget Mult` теперь нужно читать так же:

- по механике это knob класса `MoE / huge-MoE`
- по текущему runtime-path это generic `MoE / huge-MoE hot-expert path`
- по validation это пока `research-only`

## Из каких частей он состоит

### 1. `dashboard/dashboard.html`

Содержит:

- структуру интерфейса;
- формы и controls;
- блоки help/popover;
- контейнеры для warnings, badges и generated command.

Менять здесь нужно:

- расположение полей;
- новые controls;
- текстовые блоки, если они относятся именно к UI-структуре.

### 2. `dashboard/dashboard.css`

Содержит:

- стили интерфейса;
- состояние badges;
- оформление warnings, tips, help-панелей.

Менять здесь нужно:

- визуальное состояние validated / experimental / warnings;
- layout и читаемость интерфейса.

### 3. `dashboard/dashboard.js` (2491 строки, после модульного рефакторинга)

**Статус: модульный рефакторинг завершён (2026-03-06).**

dashboard.js теперь читает логику из модулей через window.DashboardXxx.
Здесь остались только DOM-зависимые вещи:

- state + Proxy
- syncToDOM, evaluate, renderWarnings, renderModelBadges
- localStorage persistence
- server API (apiGet/apiPost)
- launch/stop, CLI terminal, server chat
- theme, workspace nav, init()

Модули (загружаются через `<script>` до dashboard.js):

- `dashboard-i18n.js` — LANG, t(), setCurrentLang/getCurrentLang
- `dashboard-help.js` — HELP, GLOSSARY
- `dashboard-data.js` — PROFILES, DEFAULTS, TOGGLE_PARAMS
- `dashboard-rules.js` — RULES, PARAM_APPLICABILITY, PARAM_CONTROL_MAP, helper functions
- `dashboard-command.js` — buildExperimentalCliArgs, buildCommandString, buildArgsArray
- `dashboard-autoconfig.js` — computeOptimalParams

Если нужно поменять смысл dashboard:
- Knob evidence / presets: `evidence-layer.js`
- Параметры и профили: `dashboard-data.js`
- Rules и warnings: `dashboard-rules.js`
- Команда сборки: `dashboard-command.js`
- Auto-configure логика: `dashboard-autoconfig.js`
- Строки локализации: `dashboard-i18n.js`
- DOM и запуск: `dashboard.js`

### 4. `dashboard/dashboard_server.py`

Это локальный stdlib-only сервер для UI.

Он:

- раздает `dashboard.html`, `dashboard.css`, `dashboard.js`;
- отдает `system-info`;
- смотрит размер файла модели;
- сканирует каталоги;
- открывает native file/directory picker;
- запускает `llama-cli` или `llama-server`;
- передает env overrides в процесс;
- возвращает статус, лог, умеет stop/stdin/output.

Если меняется launch behavior, env plumbing или server-side API, менять нужно здесь.

### 5. `dashboard/dashboard-live.js`

Это отдельный UI-модуль live observability.

Здесь живет:

- polling `/api/live-metrics`
- визуализация фаз inference
- summary по активности `MoE` экспертов
- история последних фазовых событий
- история стадий `hot experts`
- replay mode по сохраненным benchmark/log run directories
- split `Learn / Inspect` для beginner-facing и engineering-facing представления

### 6. `dashboard/dashboard-live.css`

Содержит стили только для live observability слоя.

### 7. `dashboard/live_metrics.py`

Это server-side parser, который превращает runtime trace lines в компактный JSON snapshot для UI.

Он парсит:

- `pg-trace`
- `hot experts trace`
- `hot experts: locked ... top-8 ...`

И дополнительно:

- строит replay frames из сохраненных `.log` файлов в `bench_results/`

## Как dashboard принимает решения

Упрощенная схема такая:

1. пользователь выбирает модель, workload и параметры;
2. `dashboard.js` определяет family модели;
3. UI оценивает memory regime по размеру модели и RAM хоста;
4. knowledge layer подбирает стартовый профиль;
5. rules добавляют warnings и badges;
6. builder собирает CLI args и env overrides:
- validated и runtime-safe experimental knobs идут в CLI;
- trace/debug layer остается в env overrides;
7. `dashboard_server.py` запускает процесс и показывает статус.

То есть dashboard не просто рисует форму, а делает runtime reasoning поверх текущей benchmark truth.

## Какие семейства сейчас реально учитываются

Сейчас knowledge layer отдельно различает:

1. `Qwen3MoE`
2. `gpt-oss`
3. `MiniMax M2.5`
4. generic dense / unknown families

Это важно, потому что у проекта уже есть подтвержденные различия:

- `Qwen3MoE` и `gpt-oss` сейчас ближе к validated `rtr=auto` in-RAM path;
- `MiniMax` это huge swap-bound линия с отдельной осторожной policy;
- неизвестные модели нельзя притворно вести как validated families.

## Что считается source of truth для dashboard

Dashboard не должен жить своей жизнью.

Для его knowledge layer source of truth лежит не в UI, а в docs/bench layer:

1. `../benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
2. `../benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
3. `../benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
4. `../models/MINIMAX_M2_5_RUNTIME.md`
5. `../release/STABLE_VS_EXPERIMENTAL_2026-02-28.md`
6. `../strategy/ROADMAP_2026-02-28.md`
7. `ROADMAP_2026-02-28.md`

Сначала обновляется benchmark truth, потом dashboard knowledge layer.

Не наоборот.

## Какие модели удобнее для live/replay demo

Для быстрых интерактивных демонстраций и UX-проверок не нужно каждый раз гонять `MiniMax`.

Практический следующий набор:

1. `gpt-oss-20b`
2. `Qwen3-30B-A3B`
3. более легкие `Qwen3` / `Qwen3MoE` варианты, если они уже подготовлены локально

Почему:

1. они быстрее дают trace-данные;
2. на них проще проверять `Learn / Inspect`, replay и heatmap;
3. `MiniMax` лучше оставлять для проверки huge-model поведения, а не для каждого UI smoke-test.

## Что уже зафиксировано в knowledge layer

На текущем слое в dashboard уже отражены такие принципы:

1. `rtr=auto` не должен подаваться как универсальная магия;
2. `SER` остается experimental knob;
3. `Qwen3MoE` и `gpt-oss` нельзя смешивать с `MiniMax`;
4. `MiniMax` сейчас должен подаваться как huge-model baseline case;
5. `Hot Expert Budget` для обычного MiniMax запуска не должен продвигаться как validated default;
6. `validated baseline` и `experimental knobs` должны быть видны явно.
7. live observability должен оставаться отдельным UI/debug слоем, а не обязательным benchmark baseline.

## Где менять конкретные вещи

### Нужно поменять рекомендации по family

Менять:

- `dashboard/evidence-layer.js` (family guidance, autoconfig, presets)
- `dashboard/dashboard-rules.js` (family warnings)

Проверять против:

- `../benchmarks/current/*.md`

### Нужно добавить новый control

Менять:

- `dashboard/dashboard.html`
- `dashboard/dashboard-data.js` (TOGGLE_PARAMS, DEFAULTS, PROFILES)
- `dashboard/dashboard-rules.js` (PARAM_APPLICABILITY, PARAM_CONTROL_MAP)
- `dashboard/dashboard.js` (DOM binding)

Если control влияет на запуск процесса:

- `dashboard/dashboard-command.js` (buildCommandString, buildArgsArray)
- `dashboard/dashboard_server.py`

### Нужно добавить новый env override

Менять:

- `dashboard/dashboard-command.js` (buildCommandString, buildArgsArray)
- `dashboard/dashboard_server.py`

### Нужно обновить help/popover/glossary

Менять:

- `dashboard/dashboard-help.js` (HELP, GLOSSARY)
- при необходимости `dashboard/dashboard.html`

### Нужно поменять внешний вид badges/warnings

Менять:

- `dashboard/dashboard.css`

## Как безопасно обновлять dashboard

Рекомендуемый порядок:

1. Обновить benchmark truth или current-status docs;
2. Обновить нужный модуль (`evidence-layer.js`, `dashboard-rules.js` и т.д.);
3. Синхронизировать `tutorial/` и `dashboard/` docs;
4. Запустить тесты: `cd dashboard && npm test` (121 тест, Vitest);
5. Smoke-test в браузере через `python dashboard_server.py`.

Если сначала менять UI-claims, а benchmark truth отстает, knowledge layer начнет врать пользователю.

### Тестирование dashboard

```bash
cd dashboard
npm install   # только первый раз
npm test      # запуск 121 теста (Vitest + vm-sandbox)
```

Тесты находятся в `dashboard/test/*.test.js`.
Адаптер `test/_adapter.js` загружает модули в Node.js vm-sandbox с browser API stubs.

## Data-driven evidence layer

Сейчас `dashboard` берет из `dashboard/evidence-layer.js` не только:

1. experimental knob evidence;
2. experimental presets;
3. standard presets;
4. runtime profiles;
5. overview summaries и next-actions;

но и:

6. `model badges/status line`
   - family
   - memory/path regime
   - workload emphasis
   - validation status
   - experimental-active state

Практическое правило:

- product semantics живут в registry;
- `dashboard.js` только рендерит текущий state и делает live DOM-routing.

## Что dashboard не должен делать

Dashboard не должен:

1. объявлять experimental knobs validated defaults;
2. переносить выводы между разными model families без benchmark-опоры;
3. давать абсолютные claims там, где есть только host-specific или preliminary data;
4. скрывать, что рекомендация относится только к определенной family или memory regime.

## Как соотносятся `tutorial/` и `dashboard/`

Используйте:

- `../tutorial/` если цель обучить человека предметной области и настройке;
- `dashboard/` если цель понять сам продукт dashboard и поддерживать его как часть проекта.

Иначе говоря:

- `tutorial/` отвечает на вопрос "как этим пользоваться и как это понимать";
- `dashboard/` отвечает на вопрос "что это за продукт и как он устроен внутри проекта".
