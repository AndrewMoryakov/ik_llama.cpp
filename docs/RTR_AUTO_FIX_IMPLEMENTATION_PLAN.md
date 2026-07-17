# RTR Auto: план исправления и реализации

Дата: 2026-07-17  
Рабочая ветка: `feature/rtr-auto-review-fixes`  
Проверенный диапазон RTR: `45dfd803..78b48540`  
Статус: уточнён после внешней перепроверки фактического кода

## 1. Цель

Довести режимы `-rtr 1` и `-rtr auto` до состояния, в котором:

- forced RTR действительно выполняет repack;
- auto-policy безопасно принимает решение с учётом реального memory headroom;
- результаты `llama-bench` отражают фактические, а не только запрошенные параметры;
- SQL-вывод остаётся совместимым со штатными consumers;
- cgroup и Windows Job Object limits не приводят к ложному `AUTO_KEEP`;
- критические ветви покрыты автоматическими тестами.

## 2. Подтверждённые проблемы

### Проверено: forced RTR coupling уже работает в loader

Предыдущая оценка этого пункта как P1 была ошибочной: parser действительно сохраняет requested mmap, но `llama_model_loader` при `repack_tensors=true` устанавливает свой `use_mmap=false` в `src/llama-model-loader.cpp:581-592`. Поэтому для `-rtr`, `-rtr 1` и `-rtr on` условие repack pass `!ml.use_mmap && ml.repack_tensors` в `src/llama.cpp:3278-3289` истинно. Нужен regression test и accurate effective-state reporting, а не новая forced-coupling реализация.

### P1 / release blocker. SQL exporter несовместим со штатными consumers

`llama-bench` пишет только в `test_v2`, а `scripts/compare-llama-bench.py` и примеры в README продолжают читать `test`. Следствие — SQLite workflow на этой ветке сейчас неработоспособен, поэтому это release blocker.

### P2. Benchmark metadata не отражает effective mmap

`llama-bench` сохраняет `inst.use_mmap`, хотя loader может изменить итоговое значение после RTR auto-policy.

### P2. Cgroup mount resolution неполон

Пути `/sys/fs/cgroup` и `/sys/fs/cgroup/memory` захардкожены. Не учитываются mount point и mount root из `/proc/self/mountinfo`.

### P2. Windows Job Object limits могут приводить к ложному `AUTO_KEEP`

Цель — не немедленный точный accounting, а safety guarantee: если Job Object limit нельзя полностью и достоверно учесть, auto-policy должна вернуть `AUTO_UNKNOWN`, а не `AUTO_KEEP`.

### P2. Недостаточное тестовое покрытие

Текущий `test-rtr-params` проверяет только состояние parser и не исполняет loader policy, status lifecycle или exporters.

## 3. Этап 1: защитить существующий forced RTR coupling

### Реализация

1. Сохранить last-option-wins поведение parser: parser не должен необратимо изменять requested mmap.
2. Сохранить loader-side coupling `if (repack_tensors) use_mmap = false` в `llama_model_loader`; не дублировать его изменением `params.use_mmap` до конструктора.
3. Добавить regression test, проходящий parser → loader → repack loop с forced RTR и mmap по умолчанию.
4. Не менять в этой серии текущую platform-specific семантику `--defer-experts`: forced+defer configuration error требует отдельного решения о cross-platform контракте.

### Матрица состояний

| Запрос | Решение policy | Policy-enabled repack | Final loader mmap | Status |
|---|---|---:|---:|---|
| off | — | false | requested | `DISABLED` |
| forced | — | true | false | `ENABLED` |
| auto | keep | true | false | `AUTO_KEEP` |
| auto | disable | false | requested | `AUTO_DISABLE` |
| auto | unknown | false | requested | `AUTO_UNKNOWN` |

В этой таблице `Policy-enabled repack` означает только итоговое разрешение policy. Фактически выполненный repack и число изменённых тензоров учитываются отдельно на этапе 2.

### Критерии готовности

- `-rtr`, `-rtr 1` и `-rtr on` доходят до repack pass;
- `-rtr 1 -rtr auto` и `-rtr 1 -rtr 0` сохраняют last-option-wins;
- auto disable/unknown не выключают mmap, если пользователь отдельно этого не запросил;
- regression test подтверждает, что loader-side coupling не регрессирует.

## 4. Этап 2: recorded effective state

### Реализация

1. Развести четыре разных состояния RTR:
   - `repack_requested` — пользователь запросил forced/auto RTR;
   - `repack_policy_enabled` — policy оставила repack включённым;
   - `repack_pass_executed` — loader реально вошёл в repack pass;
   - `n_repacked` — количество тензоров, тип которых был изменён.
2. Определить `repack_effective` как `n_repacked > 0`. Не использовать этот термин для одного только policy decision.
3. Хранить в `llama_model`:
   - requested mode;
   - policy status и reason;
   - `repack_pass_executed`;
   - `n_repacked`;
    - финальный loader mmap mode, скопированный из `ml.use_mmap` до разрушения локального `llama_model_loader`;
   - наличие mmap-backed model buffers после загрузки.
4. Развести mmap-семантики:
   - `use_mmap_requested` — входной параметр;
   - `use_mmap_loader_enabled` — финальный `ml.use_mmap` после loader-side решений;
   - `has_mmap_backed_buffers` — фактическое наличие mmap-backed buffers в загруженной модели.
5. Не вводить единый неоднозначный mmap API. Добавить APIs с явным контрактом, например:

```cpp
LLAMA_API bool     llama_model_loader_mmap_enabled(const struct llama_model * model);
LLAMA_API bool     llama_model_has_mmap_buffers(const struct llama_model * model);
LLAMA_API bool     llama_model_repack_pass_executed(const struct llama_model * model);
LLAMA_API uint64_t llama_model_n_repacked(const struct llama_model * model);
```

6. Для `nullptr` query APIs возвращают безопасные нулевые значения; failed/cancelled model load не публикует частично достоверный effective state.
7. В `llama-bench` записывать все перечисленные requested/policy/executed поля отдельно.
8. Получать final mmap/backing state из `llm_load_tensors` и model mappings после setup, а не выводить его из RTR status.

### Критерии готовности

- forced и `AUTO_KEEP` показывают `use_mmap_loader_enabled=false`;
- `AUTO_DISABLE`/`AUTO_UNKNOWN` показывают сохранённый requested mmap;
- `repack_policy_enabled=true` не подменяет `repack_effective`;
- pass с нулём изменённых тензоров сообщает `pass_executed=true`, `n_repacked=0`, `repack_effective=false`;
- benchmark metadata совпадает с финальным состоянием loader и model mappings.

## 5. Этап 3: SQL compatibility (release blocker)

### Immediate consumer fix

1. Считать уже выпущенную `test_v2` immutable: не добавлять в неё новые колонки через повторный `CREATE TABLE IF NOT EXISTS` и не менять смысл `use_mmap` (это requested mmap).
2. Не делать raw dual-write в произвольную legacy-таблицу `test`: её schema не гарантированно совпадает с emitter, а без общего `run_id` нельзя строго устранить дубликаты.
3. Обновить `scripts/compare-llama-bench.py`: обнаруживать `test` и `test_v2` через фиксированный whitelist, валидировать обязательные колонки и строить явную общую projection вместо `SELECT *`.
4. Если обе таблицы совместимы, объединять их через `UNION ALL` только пока current writer не делает dual-write: это восстанавливает сравнение legacy baseline и v2 candidate. Введение dual-write обязано в том же изменении заменить union на deduplication по `run_id` из reviewed v3 manifest. Unknown RTR configuration legacy rows не должна match с known RTR configuration.
5. Обновить `examples/llama-bench/README.md`: новый workflow использует `test_v2`; устаревший SQL dump заменить командой `.schema test_v2`.

### Отложенная versioned schema работа

Перед добавлением effective mmap и прочих новых SQL полей создать reviewed manifest с полным ordered column set v3, `schema_version`, stable `run_id`, отдельными requested/effective полями и migration/deduplication контрактом. Только тогда допустимы `test_v3`, migration utility или dual-write projection.

### Критерии готовности immediate fix

- documented SQLite workflow работает на чистой `test_v2` БД;
- штатный compare script работает с legacy `test`, `test_v2` и mixed fixtures;
- mixed fixture не теряет history и не сопоставляет unknown legacy RTR configuration с known RTR run;
- отсутствие ожидаемой таблицы или обязательной колонки даёт controlled error;
- документация не утверждает, что новый writer пишет в `test`.

## 6. Этап 4: cgroup mount resolution

### Реализация

1. Выделить парсеры для:
   - `/proc/self/cgroup`;
   - `/proc/self/mountinfo`.
2. Для каждого cgroup mount определить:
   - filesystem type `cgroup` или `cgroup2`;
   - mount point;
   - mount root;
   - v1 controllers из super options после разделителя `-`.
3. Декодировать mountinfo escapes (`\040`, `\011`, `\012`, `\134`) до path mapping.
4. Сопоставить membership path с mount root только по границе path component, а не простым строковым prefix.
5. Явно поддержать два тестируемых случая membership:
   - host-relative path;
   - namespace-relative path.
6. Получить реальный leaf path относительно mount point и нормализовать его без выхода за mount root.
7. Обходить видимых родителей только внутри найденного mount.
8. Если `mount root != /` или namespace/bind mount скрывает предков, а отсутствие более строгого ancestor limit доказать нельзя, возвращать `UNKNOWN`. Не трактовать видимый unlimited root как доказательство отсутствия скрытого лимита.
9. При неоднозначности, invalid prefix, path traversal или ошибке возвращать `UNKNOWN`, а не host fallback.
10. Сделать parser и path mapping тестируемыми через injectable строки/roots.

### Обязательные сценарии

- стандартный unified cgroup v2;
- v1 memory controller;
- hybrid v1/v2;
- v1 co-mount `memory,cpuacct`;
- v2 на `/sys/fs/cgroup/unified`;
- bind mount;
- mount с root, отличным от `/`;
- host-relative и namespace-relative membership;
- escaped пробелы/backslashes в mount point;
- ложный строковый prefix без границы компонента;
- скрытый ограничивающий ancestor выше mount root;
- zero headroom;
- отсутствующий или повреждённый control file.

## 7. Этап 5: Windows Job Object memory limits

### Реализация

1. До production implementation создать отдельный WinAPI feasibility harness для:
   - process memory limit;
   - job-wide memory limit;
   - nested jobs;
   - отсутствующей видимости parent job.
2. Проверить `IsProcessInJob`.
3. Запросить limits через `JobObjectExtendedLimitInformation`, но не использовать peak usage как current usage.
4. Получить текущее потребление:
   - process commit через `PROCESS_MEMORY_COUNTERS_EX.PrivateUsage`;
   - job commit через `JobObjectMemoryUsageInformation` или `LimitViolationInformation2`, если API доступен;
   - effective parent/nested-job limit только если его видимость подтверждена harness.
5. Учесть:
   - `JOB_OBJECT_LIMIT_PROCESS_MEMORY`;
   - job-wide memory limit;
   - текущее process/job committed usage.
6. Рассчитать headroom как минимум из:
   - `ullAvailPhys`;
   - `ullAvailPageFile`;
   - process memory headroom;
   - job memory headroom.
7. Если активный или parent/nested limit есть, но его значение/current usage нельзя определить надёжно, вернуть `UNKNOWN`.

### Критерии готовности

- unrestricted process сохраняет текущее поведение;
- process/job с малым лимитом не получает ложный `AUTO_KEEP`;
- nested job с более строгим parent limit не получает ложный `AUTO_KEEP`;
- peak usage не используется как замена current usage;
- ошибки WinAPI приводят к safety-first решению.

## 8. Этап 6: тестовое покрытие

### Unit tests policy/finalization

- disabled;
- forced;
- auto keep;
- auto disable;
- auto unknown;
- repeated CLI options;
- explicit `--no-mmap`;
- forced RTR плюс `--defer-experts` возвращает configuration error;
- auto RTR плюс `--defer-experts` сохраняет mmap/deferral;
- multi-device `-ncmoe`;
- tied output;
- overflow guards;
- zero available memory;
- pass executed с `n_repacked=0`;
- policy enabled, но pass не был выполнен.

### Platform parser tests

- cgroup membership и mountinfo fixtures;
- v1/v2/hybrid mapping;
- malformed/truncated input;
- inherited parent limit;
- optional v1 memsw limit.

### Exporter contract tests

- одинаковая длина `get_fields()` и `get_values()`;
- requested/effective значения JSON/CSV/Markdown;
- SQL `test`/`test_v2` discovery и явная shared projection;
- legacy-only, v2-only и mixed SQLite fixtures;
- controlled error для отсутствующей обязательной таблицы/колонки;
- отсутствие match для unknown legacy RTR configuration и known RTR run;
- smoke test через SQLite;
- запуск `compare-llama-bench.py` над legacy, v2 и mixed fixtures.

## 9. Порядок реализации

1. Forced RTR coupling regression test.
2. Effective state API и benchmark metadata.
3. SQL compatibility.
4. Cgroup mountinfo.
5. Windows Job Object membership safety fallback.
6. Сквозная тестовая матрица и platform smoke tests.
7. Повторное независимое ревью полного диапазона RTR.

Тесты для каждого изменения добавляются в том же коммите, а не откладываются до пункта 6. Пункт 6 содержит только общие integration/platform проверки.

Пункты 1-3 являются безусловными merge blockers. Пункты 4-5 также являются merge blockers для заявления о safety-first поддержке Linux containers и Windows services/jobs. Если они откладываются, соответствующая платформа должна явно возвращать `UNKNOWN` для неподтверждённых конфигураций и это ограничение должно быть документировано.

## 10. API/ABI compatibility gate

1. Зафиксировать, что добавленный `repack_tensors_auto` изменяет размер публичного `llama_model_params`, который передаётся по значению.
2. До merge получить явное решение maintainer:
   - matching headers/library являются обязательным и достаточным контрактом; либо
   - нужен versioned params API/новая entry point без изменения старой by-value структуры.
3. Для новых query APIs определить:
   - C linkage/export;
   - поведение для `nullptr`;
   - поведение после failed/cancelled load;
   - source и binary compatibility expectations.
4. Добавить C API compile/link test с актуальным header и отдельный compatibility test в соответствии с выбранным контрактом.

ABI-риск не считается закрытым одной перестановкой поля в конец структуры.

## 11. Проверка перед merge

### Windows

- Release build: `test-rtr-params`, `llama-bench`, `llama-cli`;
- focused RTR tests;
- job-membership fallback tests; MSVC и MinGW build-check;
- SQL exporter/consumer smoke test.

### Linux

- полноценная Release-сборка;
- cgroup fixture tests;
- запуск в реальном cgroup v2 с ограниченным headroom;
- forced и auto smoke tests на небольшом GGUF.

### Общие проверки

- `git diff --check`;
- отсутствие conflict markers;
- сравнение requested/effective benchmark metadata;
- повторное агентное ревью `45dfd803..HEAD`;
- не выполнять push/force-push без отдельного подтверждения.

## 12. Рекомендуемое разбиение на коммиты

1. `test: protect forced runtime repack coupling` + loader regression test.
2. `fix: record effective rtr and mmap state` + C API/status/exporter contract tests.
3. `fix: restore llama-bench SQLite workflow` + `test`/`test_v2` consumer fixtures.
4. `fix: resolve cgroup memory hierarchy mounts` + mountinfo/cgroup fixtures.
5. `fix: disable RTR auto under unverified Windows jobs` + WinAPI fallback tests.
6. `test: cover cross-platform rtr integration matrix` — только сквозные и platform smoke tests.

## 13. Итог ревью реализации (`45dfd803..78b48540`)

Независимое и внешнее ревью фактического кода подтвердили, что SQL compatibility, effective state и platform safety остаются незавершёнными. Последующая перепроверка также установила, что прежний P1 о forced RTR был ложным: coupling уже выполняется внутри `llama_model_loader`. Вердикт: **not ready — implementation blockers remain**. Разделы 1–12 остаются источником истины для требуемых изменений с учётом уточнения этапа 1.

Статус этапов по факту кода:

| Этап основного плана | Статус | Подтверждённый факт |
|---|---|---|
| 1 — forced RTR coupling | ✅ **verified** | `llama_model_loader` отключает свой mmap при `repack_tensors=true`; отсутствует только loader-level regression test. |
| 2 — recorded effective state | ⚠️ **partial** | Public enum содержит 5 статусов, но `llama-bench` сохраняет запрошенный, а не effective mmap; `ENABLED` не сообщает `n_repacked`. |
| 3 — SQL compatibility | ❌ **P1 release blocker** | Writer использует `test_v2`, штатные consumers и README читают `test`; SQLite workflow неработоспособен. |
| 4 — cgroup mount resolution | ❌ **open** | Нет разбора `/proc/self/mountinfo`; используются захардкоженные `/sys/fs/cgroup` и `/sys/fs/cgroup/memory`. |
| 5 — Windows Job Object memory safety | ❌ **open** | Нет даже job-membership fallback; process с неучтённым job limit может получить `AUTO_KEEP`. |
| 6 — тестовое покрытие | ⚠️ **partial** | `tests/test-rtr-params.cpp` проверяет только CLI-парсинг. |

### Подтверждённые blockers и действия

1. **Восстановить SQL compatibility.** Нужен compatible consumer для `test`/`test_v2` и тесты для `scripts/compare-llama-bench.py`; versioned schema для новых effective полей требует отдельного контракта.
2. **Реализовать platform safety.** До mountinfo resolution и Windows job-membership fallback нельзя заявлять защиту от ложного `AUTO_KEEP` в соответствующих окружениях; точный Job Object accounting остаётся отдельной фазой.
3. **Добавить loader-level и integration tests.** Минимальный регрессионный кейс: `-rtr 1` при mmap по умолчанию должен входить в repack pass. Отдельно покрыть auto KEEP/DISABLE/UNKNOWN, effective mmap и SQL consumers.

### Уточнения по тестам и CLI

- `test-rtr-params` запускается успешно, но это **parser-only** верификация; она не подтверждает loader, memory policy, exporter или consumers.
- В файле 13 статических `assert`; `assert(ok)` выполняется для каждого из четырёх вызовов `parse()`. Не следует характеризовать этот прогон как комплексную runtime-проверку.
- Негативные кейсы для `-rtr banana`, `-rtr 2` и `-rtr -1` добавлять только после явного решения о CLI-грамматике: сейчас значение `-rtr` опционально, а неизвестный следующий токен может быть positional model path.
