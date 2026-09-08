# Evidence 1 — выполнение слияния (2026-09-08)

**Цель:** влить `ikawrakow/ik_llama.cpp` в ветку Step0-готовности, сохранив
работу форка.

## 1. Идентичности (verified)

```text
база форка   origin/feature/minimax-step0-readiness = 1e190293
upstream     ikawrakow/ik_llama.cpp main            = fe215a8c
                (Joel Farthing, 2026-09-03, #2404 qwen4exp)
merge-base                                          = 45dfd80
расхождение  git rev-list --left-right --count      = 36  415
результат    merge-коммит                           = 43979d36
             follow-up (help -rtra)                 = 62ba7ba6
```

`git ls-remote` 2026-09-08 подтвердил, что upstream с 2026-09-03 **не двигался**.

## 2. Изоляция

- Ветка `feature/upstream-integration` (по `FORK_WORKFLOW.md`), отдельный
  worktree `../upstream-integration`. Каталог с `main` не затрагивался.
- Remote назван **`ik-upstream`**, а не `upstream`. Причина: в соседнем клоне
  `Z:\files\projects\ik_llama_proj\ik_llama.cpp` имя `upstream` указывает на
  **ggerganov/llama.cpp**, а `origin` — на ikawrakow. Команда
  `git merge upstream/main`, взятая из рецепта буквально, влила бы туда
  ванильный llama.cpp.
- `git branch --unset-upstream` — `worktree add -b` проставил tracking на
  общую ветку-источник, и случайный push ушёл бы в неё.
- Страховка: тег `snapshot/pre-upstream-merge-2026-09-07`.

## 3. Конфликты: 6 файлов / 15 блоков

Карта предварительно посчитана `git merge-tree --write-tree` (не трогает
рабочее дерево, индекс и HEAD) и **совпала с фактическим merge поблочно**:
`.gitignore` 1, `common/common.cpp` 4, `docs/parameters.md` 1,
`examples/main/main.cpp` 6, `include/llama.h` 1, `src/llama.cpp` 2.

| Файл | Разрешение |
|---|---|
| `.gitignore` | Якорные шаблоны upstream + негативные правила форка. **Неякорные дубликаты форка выброшены** — см. §4. |
| `docs/parameters.md` | Строки форка `-rtr [0\|1\|auto]` и `-rtra` вместо upstream-строки `-rtr`; более полные `--ctx-checkpoints` из upstream. |
| `include/llama.h` | Все три поля: `defer_ple`, `swa_compress`, затем `repack_tensors_auto` последним. Не «или-или»: поля независимы. |
| `src/llama.cpp` | Обе стороны; порядок инициализаторов в `llama_model_default_params()` приведён к порядку полей в заголовке. |
| `common/common.cpp` | Парсеры `--moe-trace`/`--token-timing` рядом с апстримовским `-ot`; help получил `-cmoe`/`-ncmoe`/`-thp`/`-okv`. `--suffix-corpus` — по upstream: теперь ошибка legacy-опции (замена `--spec-type suffix:suffix_corpus=`). |
| `examples/main/main.cpp` | Хуки **переподключены**, а не слиты текстом (§5). |

## 4. Дефект, допущенный и исправленный в этой же сессии

Первая версия разрешения `.gitignore` объединяла оба набора строк — как и
советует `analysis-9` §12.2 («идемпотентно, оба набора совместимы»). **Совет
неверен.** Неякорный `build*` матчится по базовому имени на любой глубине и
поглощает новые файлы upstream:

```console
$ git check-ignore -v --no-index src/graphs/build_deepseek4.cpp
.gitignore:54:build*    src/graphs/build_deepseek4.cpp
```

Upstream заякорил свои шаблоны (`/build*`) именно поэтому. Отслеживаемые файлы
`.gitignore` не затрагивает, так что сборка не ломается — пострадал бы
следующий созданный `src/graphs/build_<модель>.cpp`. Исправлено; после правки
`build_deepseek4.cpp` не матчится, `build/CMakeCache.txt` игнорируется,
негативные правила форка работают.

## 5. `examples/main/main.cpp`: почему текстового слияния не хватило

Upstream переписал цикл декодирования и семплирования под спекулятивное
декодирование. Последовательность форка «sample → замер → accept → push» как
единый участок в новом коде отсутствует: семплирование теперь в трёх местах.

- `moe_trace->begin_batch/end_batch` обёрнуты вокруг новой конструкции
  `llama_batch`, включая путь очистки `need_prompt_target_features`.
- `token_timing->after_sample` переподключён **только к неспекулятивной**
  точке семплирования.
- `embd_is_generated` выставляется после обоих push-ей токена.
- `exit_code` и `finish()` сохранены; печать таймингов отдана upstream.

**[UNVERIFIED] / ограничение:** на спекулятивном пути token-timing не
инструментован. При `--spec-*` счёт токенов занижается. Для Step0 (CPU-only,
без draft-модели) поведение идентично прежнему.

## 6. Межфайловый разрыв, которого не показал ни один конфликт

```text
main.cpp(200): error C2440: cannot convert from
  'bool (*)(ggml_tensor *, bool, void *)' to 'ggml_backend_sched_eval_callback'
```

Upstream сменил typedef с `bool` на `int` (`ggml/include/ggml-backend.h:179`).
Оба файла слились автоматически — несовместимость возникла *между* ними.

Семантика проверена по вызывающей стороне до правки: в
`ggml/src/ggml-backend.cpp` для `ask==true` — `while (!need …)`, для
`ask==false` — `if (need && !callback(...)) break;`. Смысл значения прежний.
Upstream перевёл на `int` и свои колбэки (`ggml_debug`, `ik_collect_imatrix`,
`cb_eval`). Правка: `moe_trace_writer::callback` → `int` в `moe-trace.h/.cpp`.

## 7. Статус находок F1–F5 из `analysis-11`

| # | Находка | Статус по факту |
|---|---|---|
| F1 | `--ff-only` невозможен | **Подтверждена.** merge-base `0ff3a432`, расхождение `main`↔minimax = 6/252 (в документе 5/250). |
| F2 | remote `safety` не настроен | **Подтверждена**, и хуже: имя `upstream` в соседнем клоне указывает на ggerganov (§2). |
| F3 | пути `step0/...` неверны | **Подтверждена.** Реальные — `docs/superpowers/specs/step0/`. |
| F4 | харнесс «сломается молча» | **Уточнить.** Потеря поля даёт **ошибку компиляции**, а не тишину. Молча теряется только help-строка `-rtra` — что и произошло, см. `62ba7ba6`. |
| F5 | конфликт-маркеры протухли | **Не воспроизвелась**: upstream с 2026-09-03 не двигался, структура конфликтов та же. Рассуждение верно, посылка сегодня ложна. |

## 8. Воспроизведение

```powershell
git remote add ik-upstream https://github.com/ikawrakow/ik_llama.cpp.git
git fetch --no-tags ik-upstream main
git tag snapshot/pre-upstream-merge-2026-09-07 origin/feature/minimax-step0-readiness
git worktree add -b feature/upstream-integration ..\upstream-integration `
    origin/feature/minimax-step0-readiness
cd ..\upstream-integration
git branch --unset-upstream
git merge-tree --write-tree --name-only HEAD ik-upstream/main   # карта конфликтов без побочных эффектов
git merge --no-commit --no-ff ik-upstream/main
```
