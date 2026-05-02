# Current Handoff - 2026-03-01

> **Update 2026-05-02**: post-merge state. См. `docs/PERF_ATTRIBUTION_2026-05-02.md`
> для слоистого анализа источников производительности; коммиты `afaa7e04d` (upstream
> sync, 190 коммитов), `e8444f2ad` (tail-blend + expert-stats), `f22565a99`
> (Tapered-RAM scripts + research) — пост-handoff история.

## Зачем этот документ

Короткая точка входа для следующей сессии.

Нужен, чтобы не поднимать заново весь контекст по:

- цели форка
- текущему реальному состоянию
- MiniMax
- следующему benchmark-циклу

## Куда сейчас реально стремимся

Не к абстрактному "ускорить всё", а к следующему набору практических результатов:

1. получить честный и воспроизводимый huge-model baseline для `MiniMax M2.5`
2. не продвигать ложные оптимизации в код, дашборд и документацию
3. довести форк до состояния инженерного milestone, который можно показывать без ощущения "сырого черновика"

Главная стратегическая цель форка сейчас:

- большие MoE-модели на CPU-only
- включая модели, которые не помещаются в RAM целиком
- с фокусом на runtime policy, locality, paging behavior и expert access

## Что уже твердо зафиксировано

### 1. Qwen3MoE / gpt-oss

- `rtr=auto` уже является сильным стартовым режимом для `Qwen3MoE` и `gpt-oss`
- `flash_attn` важен для `mixed (PG)`
- `pg` нельзя выводить только из `tg`

Source of truth:

- `project_docs/benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `project_docs/benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `project_docs/strategy/PHASE2_KNOB_BACKLOG_2026-03-03.md`

### 2. MiniMax M2.5

- `MiniMax` является одним из главных huge swap-bound targets форка
- старый плохой результат `rtr=auto` оказался policy bug
- MiniMax-specific fix уже внесен: `auto` теперь отключает repack в huge-model case
- `hot expert budget` действительно влияет на поведение
- но первый более длинный controlled run **не подтвердил** повышение MiniMax default выше legacy `16`
- узкий closeout `off vs auto` уже завершен на fixed tree

Практический вывод на текущем дереве:

1. `TG-only`: safest baseline все еще `rtr=off`
2. mixed path: `rtr=auto` теперь уже валидная и лучшая в closeout ветка
3. `IK_LLAMA_HOT_EXPERT_BUDGET` в обычном запуске не задавать
4. большие бюджеты пока считать `research-only`

Source of truth:

- `project_docs/benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- `project_docs/benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`
- `project_docs/benchmarks/current/MINIMAX_LOCALITY_TAIL_WINDOW_2026-03-02.md`
- `project_docs/models/MINIMAX_M2_5_RUNTIME.md`

### 3. Fresh March 3 runtime refreshes

#### MiniMax locality confirm

The larger confirm run did not promote `tail-window=16` to a new baseline.

Fresh result:

- `TG128`: `1.332637 -> 1.282882` (`baseline -> tail-window=16`)
- `PG512,128` mixed: `3.991484 -> 4.030163`

Practical meaning:

1. `tail-window=16` remains research-only
2. the short `pg32,4` signal did not turn into a strong practical win on larger workloads
3. the next MiniMax line should move toward smarter locality ideas, not promote this knob as default

#### gpt-oss fresh runtime refresh

Fresh current-tree runs now exist for both family regimes:

- `gpt-oss-20b`: fresh `rtr=auto` baseline
- `gpt-oss-120b`: fresh `off vs auto` packaging refresh

Key numbers:

- `gpt-oss-20b`
  - `TG128`: `23.707807`
  - `PG512,128 mixed`: `90.283185`

- `gpt-oss-120b`
  - `TG128`: `14.134468 -> 16.657064` (`off -> auto`)
  - `PG512,128 mixed`: `59.089030 -> 60.177522` (`off -> auto`)

Practical meaning:

1. `gpt-oss-20b` now has a fresh baseline for the next decode-side line
2. `gpt-oss-120b` now clearly leans toward `rtr=auto` as the throughput-first mode on the current tree
3. `off` remains relevant mainly for startup-sensitive or more conservative huge-model packaging

### 4. Phase 3 without MiniMax is now closed

Raw artifacts:

- `ik_llama.cpp/bench_results/2026-03-03_162813_phase3_validation`

Practical results:

1. `gpt-oss-20b hot experts / tail-window=16`
- positive but weak signal
- not baseline-changing

2. `gpt-oss-20b prompt-packed back-half`
- prompt-side gain confirmed
- mixed-path practical value still neutral/slightly negative

3. `gpt-oss-120b prompt-packed back-half`
- strong initial practical signal
- dedicated confirm kept it positive, but at moderate strength
- current honest status: confirmed useful, medium confidence

4. `Qwen3-30B-A3B prompt-packed front-half`
- prompt-side gain confirmed
- mixed-path practical value still weak

Practical meaning:

1. do not broadly promote `Prompt Packed QKV` as a family-wide default
2. continue it specifically as a confirmed-useful, medium-confidence huge-model branch for `gpt-oss-120b`
3. for `gpt-oss-20b`, the next mainline technical priority remains decode-side optimization, not more prompt-packed tuning

### 5. Data-driven evidence layer

The dashboard/product layer now has a canonical evidence registry:

- `dashboard/evidence-layer.js`

It already covers:

1. experimental knobs
2. experimental presets
3. standard dashboard presets
4. runtime profiles / family-regime auto-config guidance

This means new findings should now be integrated by updating the evidence registry rather than adding new hardcoded `if/else` semantics across `dashboard.js`.

Canonical follow-up for this unfinished tail:

- `project_docs/strategy/PHASE3_VALIDATION_PLAN_2026-03-03.md`

## Что уже отброшено

### MiniMax hot-expert default > 16

Короткий quick check раньше намекал на `24/32`, но первый длинный controlled run этого не подтвердил.

Это значит:

- не пытаться снова продвигать `24/32` как новую рекомендацию
- не возвращать их в dashboard как "лучшие кандидаты" для пользователя

## Зачем еще нужны бенчмарки

Не ради красивой цифры.

Они нужны для решений:

1. отделить реальную оптимизацию от шума
2. не сломать user-facing guidance
3. понимать, куда копать дальше: в `rtr/policy` или уже в `expert locality / paging`

`MiniMax` уже показал, что без этого легко продвинуть ложный default.

## Какие бенчмарки сейчас реально имеют смысл

Узкий MiniMax pass уже закрыт.

### Результат закрытого pass

`tg32`

- `off`: `0.618850 tok/s`
- `auto`: `0.553629 tok/s`

`pg32,4`

- `off`: `1.277317`
- `auto`: `1.316512`

Практический смысл:

1. `TG-only` все еще тяготеет к `off`
2. mixed path уже нельзя сводить к `off`; `auto` теперь реальная MiniMax branch
3. следующий шаг теперь не повторять этот policy question, а идти в `expert locality / paging`

### Первый locality сигнал

На ветке `feature/minimax-locality` уже есть первый узкий A/B:

- baseline `full-prompt`
- `tail-window=16`

Короткий результат на `PG32,4`:

- `baseline`: `1.244988`
- `tail-window=16`: `1.260103`
- delta: `+1.21%`

Короткий результат на `TG128`:

- `baseline`: `1.160309`
- `tail-window=16`: `1.141644`
- delta: `-1.61%`

Практический смысл:

1. `tail-window=16` выглядит как живая mixed-path гипотеза
2. поддержки для `TG-only` пока нет
3. это все еще `research-only`, не новый default

### Locality confirm on larger workloads

The larger confirm run is now also closed.

Result:

- `tail-window=16` did **not** become a practical new baseline
- mixed path stayed only slightly positive
- `TG128` and prompt-side larger-workload behavior regressed

Практический смысл:

1. не продвигать `tail-window=16`
2. оставить его как `research-only`
3. следующую MiniMax runtime-line двигать в сторону smarter locality ideas instead

## Какие бенчмарки сейчас не нужны

Пока не нужно:

1. новая широкая матрица `hot expert budget`
2. `rtr=on`
3. `SER`
4. новые многопараметрические комбинации
5. повторное открытие уже закрытого MiniMax `off vs auto` вопроса без новой гипотезы
6. повторное открытие `tail-window=16` как нового baseline без новой smarter-locality гипотезы

Причина простая:

- сначала нужно закрыть `off vs auto`
- все остальное сейчас хуже по ROI

## Оценка времени следующего узкого MiniMax pass

По уже полученным логам на этом хосте:

- `tg32`: примерно `45-50` минут на один режим
- `pg32,4`: примерно `2ч 25м - 2ч 40м` на один режим

То есть `off vs auto` для `tg32 + pg32,4` это ориентировочно:

- `6.5 - 8` часов с техническим запасом

## Что уже приведено в порядок

1. docs hub
2. MiniMax source-of-truth notes
3. dashboard knowledge layer
4. corrected long-run summary рядом с raw logs
5. roadmap по будущим family-specific presets
6. logical milestone snapshot for Variant A:
   - `project_docs/release/LOGICAL_MILESTONE_SNAPSHOT_2026-03-01.md`
7. code-side git anchor for Variant B start:
   - repo: `ik_llama.cpp`
   - branch: `milestone/2026-03-01-logical-snapshot`
   - commit: `05b28d1a1`
8. current branching model:
   - `project_docs/release/GIT_BRANCHING_MODEL_2026-03-02.md`

Практически сейчас:

- active integration branch: `dev`
- frozen reference snapshot: `milestone/2026-03-01-logical-snapshot`
- release-facing branch: `main`

## Где смотреть в первую очередь

### Общая стратегия

- `project_docs/strategy/FORK_GOAL_AND_SCOPE_2026-02-28.md`
- `project_docs/strategy/ROADMAP_2026-02-28.md`
- `project_docs/strategy/CURRENT_HANDOFF_2026-03-01.md`

### Benchmarks

- `project_docs/benchmarks/current/QWEN3MOE_CURRENT_STATUS_2026-02-28.md`
- `project_docs/benchmarks/current/GPT_OSS_CURRENT_STATUS_2026-02-28.md`
- `project_docs/benchmarks/current/MINIMAX_CURRENT_STATUS_2026-02-28.md`
- `project_docs/benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md`

### Raw MiniMax artifacts

- `ik_llama.cpp/bench_results/2026-02-28_minimax_quick_verify`
- `ik_llama.cpp/bench_results/2026-02-28_minimax_hot_budget_matrix`
- `ik_llama.cpp/bench_results/2026-02-28_225841_minimax_hot_budget_long`
- `ik_llama.cpp/bench_results/2026-03-01_221624_minimax_hot_budget_long`
- `ik_llama.cpp/bench_results/2026-03-01_223439_minimax_hot_budget_long`
- `ik_llama.cpp/bench_results/2026-03-01_224347_minimax_policy_closeout`

### Human tutorial + dashboard

- `project_docs/tutorial/README.md`
- `project_docs/dashboard/ROADMAP_2026-02-28.md`
- `dashboard/dashboard.js`
- `dashboard/dashboard.html`

## Коротко: с чего продолжать в новой сессии

1. считать текущим MiniMax baseline:
- `TG-only`: `rtr=off`
- mixed: сравнивать `rtr=off` и `rtr=auto`, причем `auto` теперь уже валидный кандидат
- hot budget unset

2. не возвращаться к идее нового MiniMax default `24/32`

3. если есть время на дорогой прогон:
- не переоткрывать `off vs auto` без новой гипотезы
- не продвигать `tail-window=16` как baseline без новой гипотезы
- идти в `expert locality / paging`

4. если такого времени нет:
- не трогать MiniMax policy
- переходить к следующей содержательной optimization line
- для `gpt-oss` использовать свежие March 3 baselines, а не February-only numbers

## Текущий фундаментальный приоритет: Phase 1

Сейчас перед следующими runtime-generalization шагами есть один обязательный фундаментальный этап.

Это `Phase 1`:

1. для каждого experimental knob развести три разные оси:
   - `applicability`
   - `runtime support today`
   - `validation`
2. перестать путать:
   - "подходит этому классу моделей по механике"
   - "уже реально wired в текущем runtime"
   - "уже подтверждено benchmark-ами"

### Что уже сделано

В `dashboard` уже начат и частично реализован этот слой:

- class-based applicability labels
- `--experimental` runtime-safe plumbing
- более честная semantic model для `Tail Window`, `Hot Expert Selection`, `Prompt Packed QKV`

### Статус Phase 1

`Phase 1` теперь закрыта как semantic/product layer.

Что это означает:

1. three-axis model уже есть в dashboard:
   - `applicability`
   - `runtime support`
   - `validation`
2. canonical matrix зафиксирован отдельно:
   - `project_docs/strategy/EXPERIMENTAL_KNOB_MATRIX_2026-03-02.md`
3. дальнейшие фазы теперь должны опираться на эту матрицу как на source of truth

Что это не означает:

- runtime generalization еще не сделана
- class-wide support еще не расширен автоматически
- дальше нужна уже `Phase 2`, а не новая semantic rework

### Почему это важно

Если перепрыгнуть дальше без этого, начнут смешиваться:

- UI semantics
- runtime support reality
- validation truth

А это особенно опасно именно для community testing и class-based rollout experimental knobs.

### Что делать после закрытия Phase 1

1. `Hot Expert Selection / Tail Window` generalization
2. затем `Prompt Packed QKV` generalization

### Текущий статус после закрытия Phase 1

`Phase 2` теперь закрыта как bounded runtime-generalization milestone.

Текущая рабочая ветка:

- `feature/runtime-generalization`

Уже сделан первый bounded runtime-slice:

- commit `b60461556`
- `Runtime: add hot-expert selection capability logging`

Что именно это дало:

1. runtime теперь явно различает:
   - `default`
   - `full-prompt`
   - `tail-window`
2. `Tail Window` больше не выглядит как молчаливо универсальный path
3. runtime честно логирует:
   - где path реально активен
   - где идет fallback
   - где идея class-applicable, но current runtime support still limited

Это еще не full generalization.
Но это уже правильная база для нее.

Уже сделан второй bounded runtime-slice:

- commit `29e4fa3ff`
- `Runtime: generalize hot-expert tail-window to MoE path`

Что именно это дало:

1. `Tail Window` больше не привязан к одной family только по имени архитектуры
2. hot-expert `tail-window` path теперь включается по совместимому `MoE / huge-MoE` runtime path
3. validation не расширялась автоматически:
   - `MiniMax` остается первой подтвержденной линией

Практический смысл:

- `Phase 2` уже перешла от honest logging к реальному class-based runtime widening

Уже сделан третий bounded runtime-slice:

- manual `Prompt Packed QKV` generalized from family-first path to capability-based `Split-QKV` path

Что именно это дало:

1. manual prompt-packed path теперь может активироваться на совместимых `Split-QKV` моделях вне `Qwen3MoE / gpt-oss`
2. `auto` policy остается family-tuned:
   - лучше всего развита для `Qwen3MoE / gpt-oss`
3. smoke validation уже есть на:
   - `Qwen3-1.7B`
   - `Mistral-7B`

Уже сделан четвертый bounded runtime-slice:

- `Hot Expert Budget Mult` promoted from env-only control to first-class `--experimental` runtime knob

Что именно это дало:

1. `hot_expert_budget_mult` теперь проходит через:
   - CLI
   - dashboard
   - docs / knob matrix
2. `hot experts` line теперь завершена как единый class-based experimental block:
   - `Hot Expert Budget`
   - `Hot Expert Budget Mult`
   - `Hot Expert Selection`
   - `Tail Window`
3. semantic layer `Phase 1` и runtime layer `Phase 2` теперь согласованы по этой линии end-to-end

Практический смысл:

- `Phase 2` теперь имеет три реальные generalized runtime slices:
  - `Hot Expert Selection / Tail Window`
  - `Prompt Packed QKV` manual path
  - `Hot Expert Budget Mult` as a first-class class-level experimental runtime control
- validation по-прежнему уже, чем runtime support
- это уже достаточная stopping point для перехода в `Phase 3`

### Важное правило после Phase 2

Class-based support не должен ломать family-specific defaults.

Правильная политика теперь такая:

1. если у конкретной family уже есть tuned default в оригинальном `ik_llama` или в подтвержденной линии форка, этот default сохраняется
2. generalized runtime path лишь делает knob доступным более широкому классу моделей
3. `auto`-policy, baseline presets и validated defaults могут оставаться family-specific
4. class-level availability не равна class-level default

## Полная фазная цепочка после текущего этапа

Чтобы не терять нить, текущая последовательность фаз сейчас такая:

1. `Phase 1`
- semantic layer для experimental knobs
- applicability / runtime support / validation

2. `Phase 2`
- runtime generalization
- закрыта на bounded scope:
  - `Hot Expert Selection / Tail Window`
  - `Hot Expert Budget / Budget Mult`
  - `Prompt Packed QKV` manual path
- следующий шаг уже не новая semantic rework и не бесконечное widening, а `Phase 3` targeted validation

Canonical plan for the next step:

- `project_docs/strategy/PHASE3_VALIDATION_PLAN_2026-03-03.md`

Canonical principles for the whole parameter-generalization task:

- `project_docs/strategy/PARAMETER_GENERALIZATION_PRINCIPLES_2026-03-03.md`

### Текущий active Phase 2 slice

Сейчас mainline работа уже прошла два первых bounded slices:

1. `Hot Expert Selection / Tail Window`
2. `Prompt Packed QKV` manual path

В правильном порядке:

1. capability logging и honest fallback behavior
2. потом runtime widening from `MiniMax-first` toward class-based `MoE / huge-MoE`
3. затем runtime widening from family-first prompt-packed support toward class-based `Split-QKV`
4. потом targeted short A/B

3. `Phase 3`
- targeted validation
- короткие и длинные A/B для новых generalized paths

4. `Phase 4`
- architecture-specific optimization
- `MiniMax locality`
- `gpt-oss-20b decode-side`
- split-QKV prompt/decode work

5. `Phase 5`
- productization layer
- dashboard, presets, tutorial, replay/live demos

6. `Phase 6`
- release-facing stabilization
- validated/experimental matrix
- claims
- clean milestone snapshots

Это текущая рабочая дорожка к финальной цели.

## Secondary research line: prompt-tail rewrite and expert-prediction research

Отдельно от mainline фаз теперь зафиксирована еще одна исследовательская гипотеза:

- `prompt-tail rewrite`

Смысл:

- использовать маленькую auxiliary-модель
- не для генерации основного ответа
- а для контролируемой переработки конца prompt
- чтобы улучшить locality signal для early decode на huge MoE

Это не mainline optimization line и не `Phase 2` blocker.

Правильный статус:

- `research/*`
- secondary line
- только с жесткими safety rules и честным cost accounting

Source docs:

- `project_docs/research/expert-selection/HOT_EXPERTS_RUNTIME_FOUNDATION_2026-03-02.md`
- `project_docs/research/expert-selection/PROMPT_TAIL_REWRITE_2026-03-02.md`
- `project_docs/research/expert-selection/AUX_EXPERT_PREDICTOR_2026-03-02.md`
- `project_docs/research/expert-selection/NEXT_IDEAS_2026-03-02.md`

## Следующие architecture-specific линии

### 2A. MiniMax: `off vs auto` benchmark closeout

Статус: `closed`.

Итог:

1. `TG-only` favors `off`
2. mixed path now has a real `auto` branch after the fix
3. старый broken-policy `auto` result больше нельзя использовать как финальное summary

### 2B. MiniMax: next real optimization line

Если `off vs auto` закрыт или не дает нового practical режима, следующий сильный кандидат для `MiniMax`:

- expert locality
- paging behavior
- quality of hot-expert selection

Это уже не про новый флаг, а про memory/runtime-side improvement.

### 2C. `gpt-oss-20b`: decode-side architecture-specific line

Если нужен следующий вероятный engine win вне `MiniMax` policy work, strongest candidate сейчас:

- `gpt-oss-20b` decode-side mixed-path optimization

Смысл:

- это более compute-oriented и менее noisy target, чем huge `MiniMax`
- у него уже есть signal, что следующий meaningful win лежит в decode-side path

## Dashboard live / replay note

Для следующих UX/live/replay итераций не использовать `MiniMax` как основной smoke-test по умолчанию.

Предпочтительный быстрый demo-набор:

1. `gpt-oss-20b`
2. `Qwen3-30B-A3B`
3. более легкие локальные `Qwen3 / Qwen3MoE` варианты

Причина:

- они быстрее дают trace-данные;
- на них удобнее полировать `Learn / Inspect`, replay и heatmap;
- `MiniMax` лучше оставлять для проверки huge-model behavior и swap-bound observability.

## Data-driven evidence layer

Для dashboard теперь введен отдельный semantic/product слой:

- `project_docs/strategy/DATA_DRIVEN_EVIDENCE_LAYER_2026-03-03.md`

Executable source of truth для UI:

- `dashboard/evidence-layer.js`

Роль этого слоя:

1. хранить evidence semantics для experimental knobs и presets;
2. развести:
- `Applicability`
- `Runtime support`
- `Validation`
- `Confidence`
- `Risk`
- `Tested on`
- `Failure mode`
3. дать возможность добавлять новые benchmark findings как data updates, а не как новые hardcoded ветки в `dashboard.js`.

Это нужно держать в голове при следующих dashboard/product changes:

- benchmark truth обновляется первым;
- evidence layer вторым;
- user-facing wording третьим.
