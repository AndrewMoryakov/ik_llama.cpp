# Dashboard Post-Merge Audit — 2026-05-02

После merge'а 190 upstream-коммитов (commit `afaa7e04d`) проведена ревизия dashboard
на consistency. Этот документ — фиксация результата + backlog для будущей сессии.

## Сводный статус: ✅ работает корректно, есть gap для расширения

Dashboard функционален без регрессий. Все автотесты проходят, Python-сервер
компилируется. Расхождение с upstream — только в том, что новые CLI-флаги ikawrakow'a
не отражены в evidence-layer (dashboard их просто не предлагает пользователю,
но и не падает на их отсутствии).

---

## Что проверено

### Vitest test suite — 123/123 ✅

```
test/modular.test.js         14 tests
test/helpers.test.js         31 tests
test/command.test.js         19 tests
test/rules.test.js           34 tests
test/auto-config.test.js     12 tests
test/data-integrity.test.js  13 tests
                            ───────────
                             123 tests passed (429ms)
```

В MEMORY (Phase 5 snapshot) фигурировало «121 тест» — за время с тех пор добавилось
2. Никаких failing/skipped тестов нет.

### Python syntax — ✅

`dashboard_server.py` и `live_metrics.py` проходят `py_compile.compile(..., doraise=True)`
без ошибок. Это не runtime-тест, но гарантирует отсутствие синтаксических регрессий
от любых правок последней сессии.

### Evidence-layer структура — ✅

В `evidence-layer.js` зарегистрировано **27 knob-applicabilities** (через
`applicability` key). Структура цельная, тесты `data-integrity` подтверждают
что все references разрешаются.

---

## Расхождение: 5 upstream-флагов вне dashboard knowledge

Поиск имён флагов в `dashboard/*.js` дал 0 матчей для:

| Флаг | Источник (upstream PR) | Что даёт | Класс | Evidence-entry |
|------|------------------------|----------|-------|----------------|
| `--minilog` | #1468, #1477 | Минимизирует log-spam в `llama-server` | server / runtime | ✅ `minilog` |
| `--dry-run` | #1462 | Загружает модель без inference (validation) | runtime / load | ✅ `dry_run` |
| `--n-cpu-moe` | #1464 (Better...) | Улучшенное распределение MoE-слоёв на CPU | runtime / arch | ✅ `n_cpu_moe` |
| `--defer-experts` | upstream | Отложенная загрузка экспертов (memory bound) | memory / huge-moe | ✅ `defer_experts` |
| `params.ncmoe` | upstream loader | Принимается в `llama_model_loader::load` constructor | low-level (auto) | — internal alias of `--n-cpu-moe` |

**Update 2026-05-02 (этой же сессии)**: 4 evidence-entries добавлены в
`EXPERIMENTAL_KNOB_EVIDENCE` в `evidence-layer.js`. Все entries помечены
`validation: 'research'` или `'helper'` (нет benchmark-данных), `risk: 'low'/'medium'`.
123 vitest теста проходят после добавления — структура data-integrity цельная.

**Что ещё осталось** (для UI surfacing, отдельная сессия):
1. **`dashboard-command.js`** — handlers генерации CLI-аргументов:
   - `if (s.n_cpu_moe > 0) args.push('--n-cpu-moe', s.n_cpu_moe);`
   - `if (s.defer_experts) args.push('--defer-experts');`
   - `if (s.dry_run) args.push('--dry-run');`
   - `if (s.minilog) args.push('--minilog');`
2. **UI controls** в `dashboard.html` (или в experimental-knob-form блоке): новые поля
   ввода, чекбоксы, числовые слайдеры
3. **`dashboard-i18n.js`** — RU/EN тексты labels и descriptions
4. **`test/`** — расширить command.test и rules.test на новые knobs

---

## Backlog для отдельной сессии (≈1–2 часа)

Если будем расширять dashboard под пост-merge upstream:

### Файлы, которые нужно тронуть

1. **`evidence-layer.js`** — добавить 4–5 новых knob entries с полным набором meta:
   - `applicability` — на каких архитектурах работает
   - `runtimeSupport` — какие mode-mapping'и поддерживаются
   - `validation` — статус (validated / experimental / unverified)
   - `confidence` — уровень уверенности
   - `risk` — потенциальные регрессии
   - `testedOn` — модели, на которых проверено
   - `failureMode` — что происходит если применить неверно

2. **`dashboard-rules.js`** — правила валидации новых флагов
   (например, `--defer-experts` несовместим с `--mlock`?)

3. **`dashboard-i18n.js`** — RU/EN тексты help-tooltip'ов

4. **`dashboard-command.js`** — генерация CLI-строк с новыми флагами

5. **Новые presets**:
   - `runtime-default-with-minilog` (для server use-case)
   - `validation-dry-run` (для проверки что модель загружается)
   - `huge-moe-defer-experts` (memory-conserving variant)

6. **`test/`** — расширить data-integrity и rules-тесты на новые knobs

### Не делается в этой сессии

- Не относится к merge-validation. Делается в работе над dashboard напрямую.
- Требует benchmark-данные на каждый новый knob (на каком сценарии validate'ить).
- `--minilog` и `--dry-run` могут быть просто client-side помощниками без
  performance-семантики — для них достаточно simple option, не full evidence-entry.

---

## Источник checks

```bash
# Vitest
cd dashboard && npx vitest run

# Python syntax
python3 -c "import py_compile; py_compile.compile('dashboard/dashboard_server.py', doraise=True)"
python3 -c "import py_compile; py_compile.compile('dashboard/live_metrics.py', doraise=True)"

# Flag-coverage scan
for flag in minilog dry-run n-cpu-moe defer-experts ncmoe; do
  echo "$flag: $(grep -l "$flag" dashboard/*.js | wc -l) files"
done

# Knob count in evidence-layer
grep -c "applicability" dashboard/evidence-layer.js
```

Все три проверки можно выполнить за <30 секунд при следующем audit'е.
