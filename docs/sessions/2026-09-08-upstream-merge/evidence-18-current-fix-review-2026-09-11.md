# Evidence 18: проверка текущих исправлений

Дата: 2026-09-11

Проверенный репозиторий:
`Z:\files\projects\ik_llama_proj\ik_llama_my-fork\upstream-integration`
на `DESKTOP-HENS8K7`.

Проверенный HEAD: `a68429429a1330bf9d233079e512fbaa0af3c97a`.
В момент последней проверки `dev` и `origin/dev` указывали на этот commit,
рабочее дерево было чистым.

## Итог

Последние девять commit закрыли опасное исполнение модельного кода, произвольный
выбор программы в dashboard, смешивание старых CI-логов, потерю exit code
Raptor build, ошибку разбора Step0 и обычную перезапись существующей MoE trace.
Исправление медианы внесено в код.

Полный план не закрыт. Ниже перечислены проблемы, подтверждённые на указанном
HEAD. Оценка `read-only` означает вывод из текущего исходного кода без runtime
воспроизведения.

## 1. P1: неполный eval по-прежнему выглядит завершённым

`safe_exec_python()` во всех трёх версиях теперь выбрасывает
`CodeExecutionDisabled`, поэтому модельный код больше не исполняется внутри
оценщика. Это нужная граница безопасности.

Статус отказа доведён до итогового отчёта только в
`eval/llm_eval_suite_v2/run_fast_qc.py`: там появляются `complete=false`,
`not_executed` и строка `INCOMPLETE`.

Остальные пути теряют это различие:

- `eval/llm_eval_suite_v1_2/run_fast_qc.py` и `run_deep_eval.py` ловят общий
  `Exception`, выставляют обычный ноль и не записывают `executed=false`;
- `eval/llm_eval_suite_v1_3` делает то же;
- `eval/llm_eval_suite_v2/run_deep_eval.py` сохраняет `executed=false` только
  внутри details отдельного задания, но summary не содержит `complete` или
  `not_executed` и в конце печатает `DEEP EVAL COMPLETE`.

Следствие: непрогнанное кодовое задание неотличимо в итоговой оценке от неверного
ответа, а неполный suite можно использовать как завершённый benchmark.

Проверка: read-only, `Select-String` по `safe_exec_python`,
`CodeExecutionDisabled`, `not_executed` и `complete`, затем чтение scorer и
summary paths. Дополнительно выполнено:

```
python eval/llm_eval_suite_v2/test_no_code_exec.py
```

На Python 3.14.2 получено 6/6. Этот test подтверждает V2 Fast-QC, но не V2
Deep и не v1_2/v1_3.

## 2. P1: RTR auto и loader считают разные CPU-слои

`src/llama.cpp:5445` для одной GPU оценивает первые `N` слоёв:

```
cpu = il < std::min(params.ncmoe, n_layer);
```

Loader при одной GPU выбирает последние `N` слоёв, где реально есть expert
tensors. При `0 < ncmoe < n_layer` RTR auto может оценить не тот набор данных и
разрешить repack при недостаточной памяти.

Отдельно forced `-rtr 1` отключает mmap. Условие в
`src/llama-model-loader.cpp:662` после этого молча отменяет
`--defer-experts`:

```
return defer_experts && use_mmap && !expert_tensor_index.empty();
```

Проверка: read-only. GPU/OOM runtime не выполнялся.

## 3. P2: MoE trace не создаётся атомарно

`examples/main/moe-trace.cpp:261-266` сначала вызывает `fs::exists()`, затем
отдельно открывает файл через `std::ios::trunc`.

Другой процесс может создать файл между этими операциями, после чего он будет
обнулён. Если сам `fs::exists()` возвращает ошибку, код также продолжает путь к
`open(...trunc)` вместо отказа.

Обычный последовательный повтор теперь сохраняет старую trace, но критерий
create-without-replace и защита от гонки не выполнены.

Проверка: read-only. Найденный
`D:\build-zen4\bin\test-moe-trace-writer.exe` собран 2026-09-09, раньше commit
`53ea571d` от 2026-09-10, поэтому его успешный запуск не засчитывается как test
нового кода. Test source в последних commit не менялся.

## 4. P2: Step0 source of truth содержит старые медианы и статус

Код `Get-Median` исправлен, а evidence-17 вручную использует правильные числа.
Но документы и сохранённый summary расходятся:

- `00-INDEX.md` всё ещё называет авторитетной линией 3.02 т/с и 163.6 МБ на
  токен и говорит, что один пункт Step0 не пройден;
- `evidence-7-step0-baseline-2026-09-09.md` по-прежнему подписывает максимум
  как медиану;
- `evidence-9-step0-diagnostics-2026-09-09.md` в начале говорит
  «НЕ ПРОЙДЕН», хотя дополнение в §5 фиксирует успешный прогон;
- `F:\step0-2026-09-11\step0-results_taperedram_cpu_mmap_20260911_070649.summary.csv`
  хранит 8.01 т/с и 15,568,040 B/token как медианы. По трём строкам raw CSV
  правильные медианы равны 6.88 и 14,262,869.

Следствие: читатель индекса или автоматический потребитель summary получает
старое значение даже после исправления скрипта.

Проверка артефактов:

```
Get-Content F:\step0-2026-09-11\step0-results_taperedram_cpu_mmap_20260911_070649.summary.csv
Import-Csv F:\step0-2026-09-11\step0-results.csv
```

Сам Tapered-RAM результат остаётся provisional: phase записана как
`reconstructed_estimate_from_end_and_reported_tps`, разброс скорости между
тремя повторами составляет 20%, установившийся режим и perplexity не измерены.
Ускорение и сокращение физического чтения видны в артефактах, но точный размер
эффекта и вывод о причине нельзя считать финальными.

## 5. P2: Raptor build не проверяет происхождение артефактов

`build_raptor_lake.bat` теперь завершает работу через
`exit /b %BUILD_EXIT%`. Это устраняет потерю ненулевого exit code.

Скрипт всё ещё только выполняет `dir` для трёх `.exe`. Он не удаляет или не
помечает старые артефакты перед build и не проверяет после успешного CMake, что
ожидаемые binaries созданы текущим запуском. Старые файлы могут выглядеть как
результат нового build.

Проверка: read-only. На Raptor Lake этот скрипт не запускался.

## 6. P2: происхождение eval и benchmark результатов не закрыто

Современные eval runners строят путь как `OUT_DIR/SUITE_NAME/RUN_ID`, но
`RUN_ID` по умолчанию имеет точность до секунды, каталог создаётся с
`exist_ok=True`, а JSONL дописывается. Два запуска с одинаковым ID смешиваются.
Legacy runners в `eval/scripts` отдельно пишут в постоянные output paths без
достаточной metadata.

`scripts/compare-llama-bench.py` по-прежнему не включает полный RTR/repack
контекст в ключ сравнения и использует hardcoded `master` для автоматического
выбора baseline. Разные режимы могут попасть в одну группу.

Проверка: read-only. Реальная eval database в этой проверке не запускалась.

## 7. P2: strict JSON допускает окружающий текст

`eval/llm_eval_suite_v2/eval_common.py:149-173` после неудачного полного
`json.loads()` извлекает объект между первой `{` и последней `}` или массив
между `[` и `]`. Scorers называют эту функцию `strict_json_loads`, поэтому
задание с требованием «JSON only» принимает ответ с посторонним текстом.

Проверка: read-only на текущем HEAD. Ранее это было воспроизведено scorer-test,
но в этой проверке reproducer не повторялся.

## 8. P2: dashboard test зависит от отсутствия сборки

Защита `/api/launch` проверена командой:

```
python dashboard/test_dashboard_launch.py
```

На Python 3.14.2 получено 10/10: абсолютный путь, traversal и чужой Origin
отклонены. На этой машине `repo\build\bin\llama-cli.exe` отсутствовал.

Два test cases ожидают 404 именно из-за отсутствия разрешённого binary. В
обычном checkout после build эти запросы доходят до `pm.launch`, могут запустить
реальный `llama-cli` и перестают возвращать 404. Test должен изолировать
`BUILD_BIN` и подменить launch. Windows terminal branch после замены `.bat` на
прямой `Popen` runtime-проверки не имеет.

## 9. P3: `ci/run.sh` потерял executable bit

Содержательная правка glob верна: `rm -f "$OUT"/*.log` удаляет файлы между
запусками и не ломает внутренние `tee -a`.

Одновременно file mode изменился с `100755` на `100644`. Документированная
команда `bash ./ci/run.sh ...` работает, но прямой `./ci/run.sh ...` на Unix
завершится permission error.

Проверка:

```
git ls-files -s ci/run.sh
```

На проверенном HEAD получен mode `100644`.

## Подтверждённые закрытые части

- `python eval/llm_eval_suite_v2/test_no_code_exec.py`: 6/6, модельный код в
  V2 Fast-QC не исполняется и summary помечается incomplete.
- `python dashboard/test_dashboard_launch.py`: 10/10 при отсутствующем
  `repo\build\bin`.
- Step0 parser различает `runs` и `tokens`; в evidence-9 записан MiniMax run с
  `expected/reported eval runs: 511/511`. Дорогой run в этой проверке не
  повторялся.
- Обычный повтор MoE trace отклоняется по `fs::exists`; atomic race остаётся.
- `ci/run.sh` раскрывает cleanup glob; полный двойной CI run не выполнялся.
- Raptor script возвращает сохранённый build exit code; Raptor runtime не
  выполнялся.
- `git ls-remote --heads origin` вернул ровно четыре ветки: `dev`, `main`,
  `upstream-sync`, `exp/raptor-runtime`.

## Границы проверки

Полная сборка, `ctest`, inference smoke, Linux/GPU RTR, Raptor Lake build,
Windows terminal launch и повторный MiniMax benchmark не выполнялись. Проверка
не утверждает, что перечисление исчерпывает все дефекты проекта; оно сверяет
последние исправления с открытыми пунктами evidence-13...16.
