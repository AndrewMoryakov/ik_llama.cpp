# Evidence 16: финальное ревью плана работ

## Область и метод

Проверяемое дерево: `dev@06768b196d056c5374f300780a3d05290a656e1b`
на DESKTOP-HENS8K7, `ik_llama_my-fork/upstream-integration`.
На начало и конец read-only проверки `git status --short --branch` вывел
только `## dev`.

Три независимых агента проверили полноту evidence-15, runtime/RTR и
интеграционные критерии. Существенные замечания затем повторно проверены
основным агентом через `git show HEAD:<path>`, `git grep` и
`git branch -a -vv`.

Сборка, `ctest`, модель, eval-сервер и dashboard не запускались. Все новые
выводы ниже имеют grade read-only. Они исправляют план, но не закрывают сами
дефекты проекта.

## Что evidence-15 описывает правильно

По текущим путям вызовов подтверждены:

- расхождение CPU MoE placement между RTR auto и loader;
- молчаливая отмена `--defer-experts` при forced RTR;
- обнуление существующего MoE trace через `std::ios::trunc`;
- отсутствие надёжной границы выполнения кода модели в eval;
- недостаточная проверка dashboard launch request;
- смешивание результатов между отдельными CI/eval запусками;
- открытые ошибки Step0 parser, build workflow и документации.

План evidence-15 охватывает все группы из evidence-12--14, но его нельзя
исполнять дословно без поправок ниже.

## Поправки к анализу и плану

### C1. Eval runner нужен трём версиям и двум типам suite

`safe_exec_python` и его вызовы есть в `llm_eval_suite_v1_2`, `v1_3` и `v2`,
в `run_fast_qc.py` и `run_deep_eval.py`. Исправление только V2 Fast-QC оставит
те же границы выполнения в остальных запускаемых наборах.

Если code-задачи временно отключить, сначала нужен статус `INCOMPLETE`.
FQC-06 входит в `critical_tests`, а `EVAL_FAIL_ON_GATE=1` сейчас возвращает 2
для обычного FAIL. Простое исключение задачи исказит процент или результат
gate. Неполный прогон нельзя сравнивать с полным как эквивалентный.

### C2. Современный V2 и legacy eval имеют разные дефекты происхождения

Современные `llm_eval_suite_v2/run_*` уже используют
`OUT_DIR/SUITE_NAME/RUN_ID` и пишут metadata. Их проблема точнее: `RUN_ID`
имеет точность до секунды или задаётся environment, `ensure_dir` использует
`exist_ok=True`, а `append_jsonl` дописывает в существующий файл. При коллизии
или повторном ID результаты смешиваются.

Legacy `eval/scripts/run_eval_suite_v2.py` и `run_eval_v2_plus.py` отдельно
пишут в постоянный `bench_results/.../results.jsonl` без достаточной metadata.
Эти пути требуют отдельных исправлений. Перестраивать уже существующую
структуру современного V2 не нужно.

### C3. Внутренний `tee -a` в CI надо сохранить

Ошибка находится в границе между прогонами: quoted glob в `ci/run.sh:28-30`
не очищает старые файлы. Несколько команд внутри одного CI-case намеренно
дописывают в общий лог, например в `ci/run.sh:323-352`. Глобальная замена
`tee -a` на overwrite потеряет часть текущего прогона.

Исправление: новый output-каталог, который обязан отсутствовать, либо
корректная очистка при старте. Внутренний append одного прогона сохраняется.

### C4. Успех Raptor build требует проверки артефактов

После проверки `%BUILD_EXIT%` скрипт должен отдельно проверить
`llama-server.exe`, `llama-cli.exe` и `llama-quantize.exe`. Безусловный
`exit /b 0` может скрыть отсутствие ожидаемого файла. Ненулевой build exit
возвращается сразу; ноль возвращается только после проверки всех обязательных
артефактов.

### C5. Step0 требует исправления parser, а не только fixtures

`examples/main/main.cpp:1545-1546` печатает `n_decoded` в строке `tokens`.
`step0-bench.ps1:303-305` принимает `runs|tokens` и записывает число напрямую
в `EvalRuns`. Evidence-9 фиксирует конкретный случай: 512 generated tokens и
511 eval runs.

Parser должен различать единицы. `runs` используется напрямую; для текущего
контракта `tokens` переводится в `max(0, tokens - 1)`. Fixtures должны покрыть
обе формы, их порядок и отсутствие одной из строк.

### C6. Контракт llama-bench шире RTR status

Writer сохраняет `repack`, `repack_auto`, `repack_effective`,
`repack_status`, `defer_experts`, `use_thp`, `fused_moe`, `grouped_er`,
`override_tensor`, `mla_attn`, `ser`, `reuse` и другие runtime-параметры.
Comparator использует только `KEY_PROPERTIES` и может соединить разные
эксперименты.

Нужно разделить:

- запрошенную конфигурацию, используемую как идентичность эксперимента;
- фактический outcome auto-policy, используемый для отчёта и анализа;
- legacy-строки без новых колонок, которые остаются unknown.

Для nullable колонок нужен null-safe join. Простое добавление outcome-полей в
JOIN может исключить полезное сравнение при изменении решения auto-policy.

У comparator есть ещё две независимые ошибки. `find_parent_in_data()` проверяет
`commit.hexsha`, а должен проверять `current_commit.hexsha`; обход родителей
фактически не работает. Автоматический режим обращается к `repo.heads.master`,
но в проверенном репозитории есть `main`, а `master` отсутствует. Текущие тесты
передают оба commit argument и не покрывают default-path.

### C7. Строгий JSON нужен всем whole-answer заданиям

Требование `STRICT JSON only` есть у FQC-01, FQC-02, FQC-03, FQC-04 и FQC-08.
Все соответствующие scorer используют permissive helper. Для них нужен parser
полного ответа. Глобально менять общий helper можно только после аудита мест,
где специально извлекается вложенный JSON-блок.

### C8. Dashboard требует общего server-side контракта

Allowlist бинарников недостаточен. Handler принимает произвольные ключи и
значения environment; их также нужно ограничить. Проверку доступа и Origin
следует применять централизованно ко всем изменяющим `/api/*` endpoints,
включая launch, stop, stdin, файловые и replay операции.

Существующие dashboard-тесты покрывают клиентский JavaScript. До HTTP-критериев
валидацию launch request нужно вынести в чистые Python-функции и покрыть
Python-тестами. Origin/token затем проверяются отдельными HTTP-тестами.

### C9. Placement helper должен появиться до теста

Auto-placement функция сейчас `static` внутри `src/llama.cpp`, а
`test-rtr-params.cpp` проверяет парсинг параметров. Сначала нужен общий
тестируемый helper, который используют policy и loader. Только после этого
fixture сможет доказать, что обе стороны выбирают одинаковые CPU MoE-слои.

### C10. Финальный build gate должен собирать тесты явно

Gate использует отдельный новый build-каталог и задаёт
`-DLLAMA_BUILD_TESTS=ON`. Затем выполняются `cmake --build <gate-dir>` и
`ctest --test-dir <gate-dir> --output-on-failure`. Путь модели, backend и
binary для smoke фиксируются до запуска.

## Исправленный порядок работ

1. **Build и CI integrity.** Исправить Raptor exit и проверку артефактов,
   затем границу output-каталога CI. Проверить успешный и неуспешный paths.
2. **Eval execution boundary.** Определить один общий runner для v1_2, v1_3 и
   v2, определить ресурсы и timeout, добавить `INCOMPLETE` и запрет сравнения
   неполного прогона с полным.
3. **Dashboard server contract.** Вынести проверку request в Python helper,
   добавить allowlist бинарников и environment, затем общую авторизацию всех
   изменяющих endpoints и безопасный Windows terminal path.
4. **RTR placement.** Вынести общий helper placement, перевести auto-policy и
   loader на него, затем исправить forced RTR вместе с deferred experts.
5. **Artifact provenance.** Исправить atomic create/resume современного V2,
   legacy output paths и MoE trace create-without-replace.
6. **Scoring и comparison.** Ввести whole-answer JSON parser; определить полный
   benchmark identity contract; исправить parent traversal и main/master;
   добавить SQLite tests с различающимися runtime-параметрами.
7. **Step0.** Исправить преобразование units в parser, прогнать fixtures,
   пересчитать сохранённые артефакты и только при необходимости повторить
   baseline.
8. **Документация.** Исправить Raptor handoff, Vulkan path, build gate,
   допустимые test failures, статус Step0 и маркировку reconstructed I/O.
9. **Финальный gate.** Новый Release build-каталог, tests enabled, build,
   `ctest`, `--help` audit и smoke. Для RTR отдельно выполнить Linux/GPU run.

## Критерий готовности плана к реализации

После C1--C10 план достаточно полный для начала исправлений. Задача считается
закрытой только по списку конкретных проверок, выполненных на названном commit
и binary. Исходниковое чтение подтверждает механизм, но не заменяет `cmd.exe`,
HTTP, CI, SQLite, Windows build и Linux/GPU runtime проверки.
