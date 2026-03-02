# Current Handoff - 2026-03-01

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
- `project_docs/models/MINIMAX_M2_5_RUNTIME.md`

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

## Какие бенчмарки сейчас не нужны

Пока не нужно:

1. новая широкая матрица `hot expert budget`
2. `rtr=on`
3. `SER`
4. новые многопараметрические комбинации
5. повторное открытие уже закрытого MiniMax `off vs auto` вопроса без новой гипотезы

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
- идти в `expert locality / paging`

4. если такого времени нет:
- не трогать MiniMax policy
- переходить к следующей содержательной optimization line

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
