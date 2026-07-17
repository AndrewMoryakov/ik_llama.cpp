# RTR Auto: план исправления и реализации

Дата: 2026-07-17  
Рабочая ветка: `feature/rtr-auto-review-fixes`  
Проверенный диапазон RTR: `45dfd803..78b48540`  
Статус: обновлён после независимого review плана

## 1. Цель

Довести режимы `-rtr 1` и `-rtr auto` до состояния, в котором:

- forced RTR действительно выполняет repack;
- auto-policy безопасно принимает решение с учётом реального memory headroom;
- результаты `llama-bench` отражают фактические, а не только запрошенные параметры;
- SQL-вывод остаётся совместимым со штатными consumers;
- cgroup и Windows Job Object limits не приводят к ложному `AUTO_KEEP`;
- критические ветви покрыты автоматическими тестами.

## 2. Подтверждённые проблемы

### P1. Forced RTR не выполняет repack при mmap по умолчанию

- `common/common.cpp:1641-1675` включает `repack_tensors`, но не отключает mmap.
- `src/llama.cpp:3991-4024` отключает mmap только для `AUTO_KEEP`.
- Repack pass выполняется только при `!ml.use_mmap && ml.repack_tensors` в `src/llama.cpp:3278-3289`.

Результат: `-rtr`, `-rtr 1` и `-rtr on` могут выставить статус `ENABLED`, но не изменить ни одного тензора.

### P1. SQL exporter несовместим со штатными consumers

`llama-bench` пишет в `test_v2`, а `scripts/compare-llama-bench.py` и примеры в README продолжают читать `test`.

### P2. Benchmark metadata не отражает effective mmap

`llama-bench` сохраняет `inst.use_mmap`, хотя loader может изменить итоговое значение после RTR auto-policy.

### P2. Cgroup mount resolution неполон

Пути `/sys/fs/cgroup` и `/sys/fs/cgroup/memory` захардкожены. Не учитываются mount point и mount root из `/proc/self/mountinfo`.

### P2. Windows Job Object limits не учитываются

`GlobalMemoryStatusEx` показывает системный headroom, но не ограничение конкретного process/job.

### P2. Недостаточное тестовое покрытие

Текущий `test-rtr-params` проверяет только состояние parser и не исполняет loader policy, status lifecycle или exporters.

## 3. Этап 1: восстановить forced RTR coupling

### Реализация

1. Сохранить last-option-wins поведение parser: parser не должен необратимо изменять mmap.
2. После разрешения auto-policy централизованно финализировать параметры загрузки:

```cpp
if (params.repack_tensors) {
    params.use_mmap = false;
}
```

3. Выполнять финализацию до создания `llama_model_loader`.
4. Вынести переходы состояния в небольшую pure/helper-функцию, чтобы проверить их без загрузки большого GGUF.
5. Явно обработать несовместимость forced RTR и `--defer-experts`:
   - forced RTR (`-rtr`, `-rtr 1`, `-rtr on`) вместе с `--defer-experts` считается ошибкой конфигурации;
   - `-rtr auto` вместе с `--defer-experts` отключает repack через `AUTO_UNKNOWN`/`AUTO_DISABLE` и сохраняет mmap/deferral;
   - loader не должен молча отменять запрошенную deferred loading.

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
- forced RTR плюс `--defer-experts` завершается явной диагностикой до начала model load.

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
   - финальный loader mmap mode;
   - наличие mmap-backed model buffers после загрузки.
4. Развести mmap-семантики:
   - `use_mmap_requested` — входной параметр;
   - `use_mmap_loader_enabled` — финальный `ml.use_mmap` после loader-side решений;
   - `has_mmap_backed_buffers` — фактическое наличие mmap-backed buffers в загруженной модели.
5. Не использовать неоднозначный API `llama_model_uses_mmap()`. Добавить APIs с явным контрактом, например:

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

## 5. Этап 3: SQL compatibility

### Рекомендуемая переходная схема

1. Считать уже выпущенную на текущей ветке таблицу `test_v2` immutable. Не добавлять в неё новые колонки через повторный `CREATE TABLE IF NOT EXISTS`.
2. Создать `test_v3` с полным и окончательно определённым набором requested/policy/executed RTR и mmap полей.
3. Продолжать dual-write совместимой проекции в legacy-таблицу `test`, чтобы старые consumers видели новые запуски.
4. Добавить явное поле `schema_version` в `test_v3` и стабильный `run_id`/fingerprint для миграции и дедупликации.
5. Обновить `scripts/compare-llama-bench.py`:
   - предпочитать `test_v3`;
   - откатываться на `test_v2`, затем на `test`;
   - не выполнять неявный `UNION` между dual-written таблицами;
   - объединять history только через migration/deduplication по `run_id`/fingerprint.
6. Добавить отдельную migration utility для переноса legacy `test`/`test_v2` в `test_v3`. Миграция должна быть идемпотентной.
7. Обновить `examples/llama-bench/README.md` и SQL-примеры.
8. Зафиксировать номер и список колонок каждой схемы в одном месте.

### Критерии готовности

- documented SQLite workflow работает на чистой БД;
- новый вывод можно добавить в БД со старой таблицей `test`;
- новый вывод можно добавить в БД с уже существующей `test_v2` без ошибки missing column;
- штатный compare script работает с `test`, `test_v2` и `test_v3`;
- dual-write строки не удваиваются в compare output;
- migration utility можно безопасно запустить повторно;
- новые RTR-поля доступны consumers, которые понимают v3.

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
- SQL v1/v2 create и insert;
- SQL v3 create и insert;
- migration `test`/`test_v2` -> `test_v3`;
- идемпотентность migration и отсутствие duplicate rows;
- smoke test через SQLite;
- запуск `compare-llama-bench.py` над legacy, v2 и v3 fixtures.

## 9. Порядок реализации

1. Forced RTR coupling.
2. Effective state API и benchmark metadata.
3. SQL compatibility.
4. Cgroup mountinfo.
5. Windows Job Object limits.
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
- Job Object tests или отдельный test harness;
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

1. `fix: restore forced runtime repack coupling` + policy/finalization tests.
2. `fix: record effective rtr and mmap state` + C API/status/exporter contract tests.
3. `fix: preserve llama-bench sql compatibility` + SQLite migration/consumer fixtures.
4. `fix: resolve cgroup memory hierarchy mounts` + mountinfo/cgroup fixtures.
5. `fix: honor Windows job memory limits` + WinAPI harness tests.
6. `test: cover cross-platform rtr integration matrix` — только сквозные и platform smoke tests.

## 13. Итог ревью реализации (`45dfd803..78b48540`)

Независимое агентное ревью фактического кода (не только плана). Вердикт: **approved with action items** — семантика policy, проба памяти и согласованность с loader корректны; критических багов в финальном состоянии диапазона не найдено. Коммиты `15e04dec`, `d4032bc1`, `78b48540` закрывают предыдущие находки ревьюеров.

Статус этапов по факту кода:

| Этап | Статус | Примечание |
|---|---|---|
| 1 — forced RTR coupling | ✅ done | `common/common.cpp` `-rtr` handling; loader финализирует mmap |
| 2 — placement resolver | ✅ done | `llama_rtr_auto_ncmoe_cpu_override`; regex first-match зеркалит loader |
| 3 — per-OS memory probe | ✅ done | `ullAvailPhys` / `MemAvailable`+cgroup v2/v1 / `host_statistics64` |
| 4 — effective state + 4 статуса RTR | ✅ done | статусы в `include/llama.h`, surfaced в llama-bench |
| 5 — Windows Job Object limits | ✅ done | `IsProcessInJob` / `JOB_OBJECT_LIMIT_PROCESS_MEMORY` |
| 6 — cgroup mount resolution | ✅ done | v2 unified + v1 memory-controller, clamp `UINT64_MAX` |
| P1/P2 — тесты | ⚠️ **partial** | `tests/test-rtr-params.cpp` покрывает только CLI-парсинг |

### Оставшиеся action items (тесты)

1. **Харнесс не умеет негативные тесты** (`tests/test-rtr-params.cpp:11-28`): `parse()` делает `assert(ok)` на `gpt_params_parse_ex`, поэтому отклонение мусора (`-rtr banana`, `-rtr 2`, `-rtr -1`) непроверяемо. Нужен `parse_fails()`, возвращающий bool, + 3–4 rejection-кейса.
2. **Тест не перспективен для фичи под ревью** (`tests/test-rtr-params.cpp:31-56`): все 4 кейса — только CLI-парсинг. Если удалить все `llama_rtr_auto_*` из `src/llama.cpp`, тест всё равно пройдёт. Не покрыты placement resolver, memory gates (90% ceiling, вторичный total-CPU-bytes gate) и tri-state KEEP/DISABLE/UNKNOWN. Нужно вынести резолвер+гейты за инжектируемый memory-probe seam и добавить unit-кейсы на каждую ветку решения.
3. **Нет кейсов на два спекокритичных написания**: голый `-rtr` (= legacy `-rtr 1`) и алиас `-rtra` — ровно обещания обратной совместимости из тела PR.
4. (minor) Тест молчит при успехе (exit 0, пустой вывод) — по строке `fprintf` на кейс упростит триаж CI.
5. (minor) Дублирование условий `-ncmoe` между policy (`src/llama.cpp:3709-3738`) и loader (`src/llama-load-tensors.cpp:233-296`): сегодня это точные логические комплементы, но живут в двух местах — добавить перекрёстный комментарий.

### Фактическая верификация

- Configure VS 2022, `-DGGML_CUDA=OFF -DGGML_BLAS=OFF -DLLAMA_BUILD_SERVER=OFF -DCMAKE_BUILD_TYPE=Release` в `build-review` — OK.
- Build `test-rtr-params` → exit 0; 0 warnings в файлах дифа (C4244/C4065/C4141 только в пре-существующих `ggml/src/iqk/*`).
- Run `test-rtr-params.exe` → EXIT=0, все 12 assert'ов живые (`NDEBUG` снят до `<cassert>`) и прошли.
