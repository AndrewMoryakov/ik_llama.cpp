# Task: deep critical review of PR #1738

Этот файл — конкретная задача для агента. Перед началом прочитай
`AGENT_BRIEF.md` целиком (он содержит весь контекст: статус PR, что
уже найдено, guardrails, стилистику). После этого выполни задачу
ниже и выдай отчёт.

## Цель

Найти то, что мы упустили. На PR уже было найдено два бага:
`use_mmap` regression (self-review) и `n_gpu_layers > 0` skip плюс
total vs available RAM (dmaivel). Маинтейнер ikawrakow ещё не
смотрел. Цель этой сессии — провести глубокое независимое ревью
текущего состояния PR (commit `0115ace21` на ветке
`pr/rtr-auto-mode`) с фокусом на категории, которые предыдущие
ревью не покрывали или покрывали поверхностно.

## Целевой коммит

```
git checkout pr/rtr-auto-mode
git log -1
```

Должен быть `0115ace21 runtime : add --run-time-repack auto mode for
swap-bound MoE safety`. Если HEAD другой, остановись и спроси.

## Направления для проверки (искать новые баги в каждой)

### 1. Multi-shard GGUF behavior

`Qwen3.5-397B-A17B-IQ2_XS-00001-of-00004.gguf` (модель которую
тестировал dmaivel) — это четыре shard'а. Наш `probe.n_bytes`
возвращает размер чего: одного shard'а или всех? Если только
первого, то на multi-shard модели наш check недооценит реальный
размер и feature не сработает. Проверить через код
`llama_model_loader` constructor: как он обрабатывает multi-shard
GGUF, что попадает в `n_bytes`, нужно ли нам что-то ещё считать.

### 2. Memory safety в probe

Probe создаёт `llama_model_loader` instance, потом вызывает
`llm_load_arch` и `llm_load_hparams`. Что если внутри них
аллоцируются ресурсы, которые освобождаются только при
`llama_model_load_internal`? `llama_model probe_model;` локальный,
но если он держит handles на mapping или file descriptors —
утечка при probe может оставить ресурс. Проверить destructor
`llama_model` и есть ли там зависимости от полного load flow.

### 3. mmap'd file lifetime

После того как probe выходит из scope, его mmap'инг file должен
быть освобождён. Что если real load открывает тот же файл
снова — есть ли interaction? На некоторых FS double-mmap одного
файла OK, на других может быть проблема. На Windows file
sharing semantics строже.

### 4. ABI/API compatibility

Мы добавили поле `repack_tensors_auto` в struct
`llama_model_params` в `include/llama.h`. Это публичный API. Что
будет если клиент скомпилирован против старой версии header'а
(без нашего поля), а linked против новой shared library? Layout
struct'а изменился. Если клиент создаёт `llama_model_params` через
`llama_model_default_params()` это OK (default'ы там), но если
клиент сам zero-инициализирует или объявляет на стеке —
`repack_tensors_auto` может содержать garbage. Проверить
насколько serious этот ABI risk и есть ли в проекте конвенция как
такие изменения делать.

### 5. Compile warnings на разных компиляторах

Билдили только на MSVC 2022. Проверить mentally или через
ssh-доступ к Linux box (если есть в Docker), что код собирается
без warnings на:
- gcc (Linux)
- clang (Linux/macOS)
- MinGW

Особо подозрительные места:
- `(uint64_t) probe.n_bytes` — какой тип у `n_bytes`?
- `format("...%.1f...", model_bytes / 1073741824.0, ...)` —
  precision warnings?
- `mem_info = {}` zero-init MSVC vs GCC syntax compatibility?

### 6. Concurrency

`llama_model_load` обычно вызывается с одного thread'а. Но если
кто-то вызывает его из нескольких threads параллельно (например
batch worker), наш auto-policy probe — thread-safe? `format()`,
`LLAMA_LOG_INFO/WARN`, file mmap.

### 7. Probe возможные failure modes

Список exception path'ов через `llama_model_loader` constructor +
`llm_load_arch` + `llm_load_hparams`. Какие конкретно exceptions
можно ожидать? Catch-all `std::exception` правильно покрывает или
есть exception types которые могут проскочить?

Что если probe бросает не-std::exception (например `int` через
`throw 42` где-то в legacy code)? Наш try/catch не поймает.

### 8. Logging clarity

Сообщения «`-rtr auto: keeping repack enabled`» и
«`-rtr auto: disabled (MoE model X GiB > 90% of RAM Y GiB)`»
понятны пользователю?

- Какой log level? Пользователь который запускает llama-cli c
  `-q` (quiet) увидит это или нет? Для критичного решения
  «отключаем перформанс-flag» хочется чтобы было visible.
- Сообщение упоминает «90%», но пользователь не знает откуда это
  число. Стоит ли expose threshold?
- На probe failure WARN правильный level или должно быть ERROR?

### 9. Edge cases в integer arithmetic

Threshold computation:
```cpp
const uint64_t threshold = phys_ram - phys_ram / 10;
```
- Если `phys_ram` очень маленький (< 10 bytes), что с округлением?
- Если `phys_ram == 1`, threshold = 1 - 0 = 1. Model would have to be
  > 1 byte. Trigger.
- Если `phys_ram == UINT64_MAX`, overflow в `phys_ram / 10`? Нет,
  uint64 arithmetic safe.

`model_bytes` cast от `probe.n_bytes` — какой signedness? Может ли
быть negative if errors?

### 10. Help text / docs

Проверить что help text в `common.cpp` accurately describes
behavior после mmap fix. Также help text в llama-bench.

В docs/build.md или README — упоминание `-rtr` есть? Нужно ли
там обновить с новым `auto` режимом? Возможно отдельный PR.

### 11. Неизвестные unknowns

Если у тебя есть hunches — следуй им. Если что-то в коде
выглядит «странно», explore. Это deep review, не sanity check.

## Что НЕ делать

1. НЕ push в любую ветку.
2. НЕ force-push.
3. НЕ отправлять comments в PR.
4. НЕ закрывать PR.
5. НЕ переписывать feature.
6. НЕ пересобирать в фоне «на всякий случай» — только если задача
   явно требует verification через build.
7. НЕ изменять любые файлы кроме создания финального report.

## Что СДЕЛАТЬ перед report

1. Прочитай 4 предыдущих docs в rtr-auto/ полностью.
2. Прочитай diff PR через `git diff origin/main..HEAD --stat` и
   потом каждый файл целиком.
3. Прочитай существующий код вокруг модификаций (контекст).
4. Если нужен build для verification, спроси разрешение перед
   запуском (build long, ~10 минут).

## Формат отчёта

Структурированный markdown в файл
`project_docs/rtr-auto/DEEP_REVIEW_2026-05-05.md` с следующими
секциями:

1. **Methodology** — что прочитано, что проверено, какие подходы
   использованы.
2. **Findings** — список с severity (🔴 critical / 🟡 medium / 🟢
   low / ℹ informational). Каждый finding:
   - Что нашёл (краткое описание)
   - Где (file:line)
   - Что не так (root cause)
   - Severity reasoning
   - Рекомендация (что делать, не делая)
3. **Verified clean** — список проверенных категорий где ничего
   не нашёл. Это полезно maintainer'у видеть что было проверено.
4. **Conclusion** — общий verdict:
   - «Ready to ship as-is»
   - «Needs N fixes before maintainer review»
   - «Needs maintainer architectural input first»
   - С обоснованием.
5. **Не покрыто** — категории которые не успели проверить, чтобы
   будущая сессия знала где продолжать.

В конце — повторный summary: сколько critical, medium, low
findings; сколько уже известных (из предыдущих docs); сколько
новых.

## Когда закончишь

Не push, не commit. Скажи мне что отчёт готов, дай путь к нему.
Я прочитаю и решу что с этим делать.
