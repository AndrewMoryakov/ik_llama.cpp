# RTR Auto: спецификация исправлений

Дата: 2026-07-17

Статус: draft для review до начала реализации

Связанный план: `docs/RTR_AUTO_FIX_IMPLEMENTATION_PLAN.md`

Проверенное состояние: `45dfd803..78b48540`

## 1. Назначение и границы

Спецификация устраняет подтверждённые регрессии и ложные safety claims RTR:

1. существующая forced RTR coupling должна быть защищена regression test и точно отражена в документации;
2. public/benchmark state должен описывать факт загрузки, а не только запрос;
3. SQL output `llama-bench` и штатный consumer должны снова работать вместе;
4. auto-policy не должна выдавать `AUTO_KEEP`, если Linux cgroup или Windows Job Object limit нельзя надёжно учесть.

Не входят в эту работу: смена семантики bare `-rtr`, отклонение неизвестного следующего токена CLI, произвольная миграция пользовательских SQLite БД и заявление поддержки непроверяемых nested Windows jobs. Эти решения требуют отдельного контракта/дизайна.

При конфликте с разделом 5 основного плана эта спецификация имеет приоритет для SQL. Она разделяет два результата: immediate consumer fix для существующих `test`/`test_v2` и отдельную versioned schema работу для новых effective полей. Dual-write в произвольную legacy-схему `test` не допускается: у текущего emitter нет безопасного conditional insert, а без стабильного `run_id` нельзя строго устранять дубликаты.

## 2. Инварианты и термины

- Parser сохраняет current last-option-wins и не меняет `use_mmap` для `-rtr`.
- `requested mmap` — значение из model params до RTR policy.
- `loader mmap enabled` — итоговое `ml.use_mmap` после `create_tensors()`; оно может отличаться от requested mmap.
- `has mmap-backed buffers` — хотя бы один model buffer действительно создан из mmap. Это не синоним `loader mmap enabled`.
- `repack policy enabled` — final `params.repack_tensors` после auto-policy.
- `repack pass executed` — loader вошёл в цикл repack.
- `n_repacked` — число тензоров с изменённым type.
- `repack effective` — строго `n_repacked > 0`; policy status сам по себе не является доказательством repack.
- Любая неустранимая неопределённость memory probe возвращает `AUTO_UNKNOWN`, а не `AUTO_KEEP`.

## 3. RTR finalization и forced coupling

### 3.1 Контракт

Forced coupling уже реализована в конструкторе `llama_model_loader`: при `repack_tensors=true` он устанавливает внутренний `use_mmap=false` до сохранения его в loader. Поэтому для forced RTR **не добавляется** дублирующее изменение `params.use_mmap` до конструктора: оно изменило бы поведение последующей ветки `defer_experts` и смешало requested state с effective state.

Parser по-прежнему не получает coupling обратно. Требуемая работа — сохранить текущую loader-side семантику и добавить regression test, который проходит путь parser → loader → repack loop.

| Последний RTR-запрос | Решение policy | Final repack | Final mmap | RTR status |
|---|---|---:|---:|---|
| off | — | false | requested | `DISABLED` |
| forced (`-rtr`, `1`, `on`) | — | true | false | `ENABLED` |
| auto | KEEP | true | false | `AUTO_KEEP` |
| auto | DISABLE | false | requested | `AUTO_DISABLE` |
| auto | UNKNOWN | false | requested | `AUTO_UNKNOWN` |

`--no-mmap` всегда сохраняет false. Цепочки `-rtr 1 -rtr auto` и `-rtr 1 -rtr 0` определяются последним RTR option до loader finalization.

### 3.2 Deferred experts

`--defer-experts` не меняет семантику в этой серии. Его текущая Linux-specific обработка и non-Linux warning/ignore остаются отдельной задачей: нельзя вводить unconditional forced+defer configuration error без явного решения о cross-platform breaking change. Regression suite фиксирует фактическое поведение поддерживаемых конфигураций, но не объявляет новую ошибку конфигурации.

### 3.3 Тестируемый helper

Если переходы auto-policy выносятся в private pure helper, его контракт ограничивается policy state `{ requested_mmap, repack, repack_auto, auto_decision }`; loader-side forced coupling остаётся в `llama_model_loader`. Helper не является public API и не меняет семантику `defer_experts`.

## 4. Effective state и C API

`llama_model` хранит следующие значения после успешной загрузки:

```cpp
bool     use_mmap_requested;
bool     use_mmap_loader_enabled;
bool     has_mmap_backed_buffers;
bool     repack_pass_executed;
uint64_t n_repacked;
```

- `use_mmap_requested` snapshot до policy;
- `use_mmap_loader_enabled` записывается из `ml.use_mmap` после `create_tensors()`;
- `has_mmap_backed_buffers` выставляется в точке успешного создания mmap-backed CPU/Metal buffer, а не выводится из `model.mappings`;
- `repack_pass_executed` выставляется при входе в repack loop;
- `n_repacked` увеличивается только при фактической смене типа тензора.

Добавляются additive C API queries (для `nullptr`: `false`/`0`):

```cpp
LLAMA_API bool     llama_model_loader_mmap_enabled(const struct llama_model * model);
LLAMA_API bool     llama_model_has_mmap_buffers(const struct llama_model * model);
LLAMA_API bool     llama_model_repack_pass_executed(const struct llama_model * model);
LLAMA_API uint64_t llama_model_n_repacked(const struct llama_model * model);
```

Существующий `llama_model_rtr_status()` остаётся решением policy из пяти значений и не меняет контракт. Новый двусмысленный API вида `llama_model_uses_mmap()` не добавляется. Новые символы требуют C API compile/link test; существующее изменение by-value `llama_model_params` остаётся отдельным ABI gate.

`llama-bench` обязан различать requested (`inst.use_mmap`, requested RTR), policy (`repack_status`) и effective значения. Нельзя переопределять существующий `test_v2.use_mmap` как effective mmap: в `test` и текущем `test_v2` это requested configuration, и такая смена сломает cross-version comparison. В immediate fix `test_v2` сохраняет current requested semantics; `repack_effective` исправляется на `llama_model_n_repacked() > 0` без изменения schema. Полный SQL export requested/effective state требует отдельной immutable `test_v3` schema с разными колонками `use_mmap_requested`, `use_mmap_loader_enabled`, `has_mmap_backed_buffers`, `repack_pass_executed` и `n_repacked`.

## 5. SQL output и compare script

### 5.1 Контракт совместимости

- SQL writer продолжает писать versioned `test_v2`; legacy `test` не изменяется.
- `scripts/compare-llama-bench.py` обнаруживает только фиксированные имена `test` и `test_v2` через `sqlite_master`/`PRAGMA table_info` и строит общий logical source как явную проекцию полей, используемых самим script. `SELECT *` и подстановка произвольных DB object names запрещены.
- Если присутствующая таблица не содержит обязательное поле, script завершается понятной ошибкой `table <name> is not compatible`; он не пропускает таблицу молча.
- Если существуют обе таблицы, script делает `UNION ALL` совместимых явных проекций. Текущий writer не делает dual-write, поэтому это сохраняет возможность сравнить legacy baseline и v2 candidate. Появление dual-write в будущем требует отдельного `run_id`/deduplication дизайна до изменения этого правила.
- `repack` и `repack_auto` входят в key/boolean/pretty properties только для table variants, где они документированно присутствуют. Старые `test` без этих колонок нормализуются в `NULL`/unknown, а не в `0`: cross-version comparison с такой unknown configuration не должен молча match/усредняться с известной RTR configuration.
- `repack_effective` и `repack_status` не входят в cross-version join key, поскольку legacy schema их не содержит.
- README использует `test_v2` для нового output; устаревший 26-column SQL dump удаляется или заменяется командой `.schema test_v2`, чтобы не дублировать evolving schema.

Выбор более новой схемы `test_v3`, migration или dual-write допускается только отдельной спецификацией с immutable column set, `schema_version`, stable `run_id` и идемпотентной migration utility.

### 5.2 Проверки

SQLite fixture tests должны подтверждать:

1. чистая БД с `test_v2` работает с writer и compare;
2. legacy БД только с `test` работает с compare;
3. mixed БД с `test` и `test_v2` позволяет сравнить только records с полной сопоставимой configuration; unknown legacy RTR configuration не match с known RTR configuration;
4. отсутствие обеих таблиц и отсутствие обязательной колонки дают controlled error;
5. runs с `repack=0` и `repack=1` не match/не усредняются;
6. `get_fields()` и `get_values()` имеют одинаковую длину, а effective RTR/mmap значения сериализуются согласованно.

## 6. Linux: cgroup mount resolution

Весь Linux код остаётся под `#if defined(__linux__)`. `/proc/self/cgroup` разбирается в membership records, а `/proc/self/mountinfo` — структурно: mandatory fields, optional fields до `-`, затем fstype, source и super options. Рассматриваются только `cgroup2` и `cgroup` с точным `memory` controller в super options. Mountinfo escapes `\040`, `\011`, `\012`, `\134` декодируются; malformed input возвращает unknown.

Для каждой membership resolver сопоставляет её с реальным mountpoint/root с проверкой границы path component и lexical normalization без `.`/`..`:

- host-relative membership: равен `mount.root` или начинается с `mount.root + '/'`;
- namespace-relative membership: путь добавляется к mountpoint;
- предпочтение — exact host-relative, затем наиболее специфичный root;
- duplicate/bind candidates дают минимум корректно измеренного headroom;
- обход родителей ограничен resolved mountpoint, а не `/sys/fs/cgroup`.

Для v2 resolver сначала проверяет доступность `memory` в `cgroup.controllers` у resolved hierarchy: если controller не доступен, v2 не является memory constraint и host/v1 fallback допустим. Если controller доступен, v2 использует `memory.max`/`memory.current` (`max` = unlimited); отсутствие этих обязательных файлов — unknown. v1 использует `memory.limit_in_bytes`/`memory.usage_in_bytes` и, если виден любой memsw file, требует валидную пару memsw limit/usage. Все вычисления headroom saturating. В hybrid hierarchy берётся минимум host memory и всех успешно resolved memory controller headroom.

Если memory membership/controller отсутствует полностью, host memory допустима. Если membership заявлен, но mount, обязательный file или mapping нельзя надёжно разрешить, probe возвращает `{ ok=false }` и auto-policy выдаёт `AUTO_UNKNOWN`; fallback к host memory запрещён.

## 7. Windows: Job Object memory limits

В Windows ветке `GlobalMemoryStatusEx` остаётся host cap. Immediate safety fix под `#if defined(_WIN32)` сначала вызывает `IsProcessInJob(GetCurrentProcess(), NULL, &in_job)`: error или `in_job=true` возвращает unknown и тем самым запрещает `AUTO_KEEP`. Это безопасно, потому что WinAPI не даёт общего runtime-способа перечислить/доказать все parent и nested effective job limits.

Расширенный Job Object accounting — отдельная фаза после доказуемого platform contract. Только в ней private probe сможет добавить job cap:

1. `IsProcessInJob(GetCurrentProcess(), NULL, &in_job)`; error => unknown, `false` => no job limit.
2. Если job есть, `QueryInformationJobObject(NULL, JobObjectExtendedLimitInformation, ...)`.
3. Учитываются только выставленные `JOB_OBJECT_LIMIT_PROCESS_MEMORY` и `JOB_OBJECT_LIMIT_JOB_MEMORY`.
4. Process headroom = saturating(`ProcessMemoryLimit - PROCESS_MEMORY_COUNTERS_EX::PrivateUsage`), полученный через `GetProcessMemoryInfo`.
5. Job headroom = saturating(`JobMemoryLimit - JOBOBJECT_MEMORY_USAGE_INFORMATION::JobMemory`). Peak counters как current usage не используются.
6. Итог — минимум host cap и всех известных job headroom.

Ошибка любого требуемого WinAPI вызова либо limit с неизвестным current usage даёт `AUTO_UNKNOWN`. До появления runtime-проверяемого способа доказать полную topology любой job membership остаётся `AUTO_UNKNOWN`. Нельзя заявлять general nested-job support на основании одного `QueryInformationJobObject(NULL, ...)` или только test harness.

Зависимость `GetProcessMemoryInfo` (`<psapi.h>` и Psapi linkage либо документированная Kernel32 альтернатива) должна быть явно добавлена и проверена на поддерживаемых MSVC/MinGW конфигурациях.

## 8. Тестовая стратегия и критерии приёмки

Каждый production commit содержит собственные тесты. `test-rtr-params` остаётся parser-only: добавить bare `-rtr` и `-rtra`, но не вводить rejection cases для неизвестных значений до решения CLI grammar.

Обязательные тесты:

- pure state helper: off, forced, auto KEEP/DISABLE/UNKNOWN, repeated options, explicit no-mmap;
- C API: queries на `nullptr`, пять RTR statuses, compile/link test;
- loader integration на RTR-capable IQK fixture: forced `use_mmap=true` -> `ENABLED`, loader mmap false, pass executed, `n_repacked > 0`; отсутствие fixture допускает явный skip, не pass;
- policy integration через injectable memory-probe seam: AUTO KEEP/DISABLE/UNKNOWN и current supported defer behavior;
- mmap fallback: `create_tensors()` failure фиксирует loader mmap false;
- Linux parser/resolver fixtures: v1, v2, hybrid, co-mount, custom root, bind, escapes, prefix rejection, inherited cap, malformed/missing input;
- Windows injected WinAPI-ops unit tests: no job, each API error, process/job/both limit, zero headroom, host cap below job cap; Windows harness с реальным process/job limit;
- SQL SQLite fixtures из раздела 5.2.

Definition of done:

1. `-rtr 1` при mmap по умолчанию доказуемо выполняет repack pass; существующая loader coupling не регрессирует.
2. C API различает requested/loader/buffer/repack state; `repack_effective` не подменяется policy status. SQL requested mmap semantics не меняется до v3.
3. Новый SQL output читается штатным compare script, а legacy rows с неизвестной RTR configuration не сопоставляются с known RTR runs.
4. Неразрешённый cgroup/job limit никогда не приводит к `AUTO_KEEP`.
5. Linux/Windows build и соответствующие platform tests проходят; `git diff --check` чист.

## 9. Порядок реализации

1. Forced coupling regression test и точная документация current loader contract.
2. Model state/C API + корректный `repack_effective`; versioned v3 design review до изменения SQL effective metadata.
3. SQL consumer compatibility для `test`/`test_v2` и SQLite fixtures.
4. Linux mountinfo resolver и fixtures.
5. Windows job-membership safety fallback; расширенный Job Object probe — только после отдельного platform contract.
6. Полный cross-platform smoke, ABI/API gate и повторное независимое review.

Каждый пункт — отдельный commit; push/force-push не выполняются без отдельного подтверждения.
