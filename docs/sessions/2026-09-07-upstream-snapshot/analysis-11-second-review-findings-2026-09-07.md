# Анализ 11 — фиксация находок 2-го review-прохода (2026-09-07)

**Дата:** 2026-09-07
**Source:** «большое ревью v2» от 2026-09-07, выполненное по запросу пользователя
(«Исходя из нового анализа - запусти новое ревью»). 3 параллельных
verifier-агента с разными линзами:
- **factual-claim recheck** (file:line верификация)
- **merge-readiness check** (recipe в analysis-9 §3-§7)
- **post-correction stale-string** (что применилось, что нет)

**HEAD на момент review:** `085ca0b7` (фикс после первого review-прохода)
**Upstream на момент review:** `fe215a8c` (Joel Farthing, 2026-09-03)
**Назначение документа:** зафиксировать в репо то, что **известные проблемы**
в analysis-8/9/10 + 00-INDEX существуют, но **не все** исправлены. Это
reference для будущих читателей и агентов.

## Вердикт

**FAIL** по 3 осям:

1. **Stale-string:** 17 из 33 правок коммита `085ca0b7` НЕ применились
   (или применились неправильно) — цифры и SHA устарели.
2. **Factual-claim:** 3 из 13 «verified» правок содержат off-by-4 line numbers
   или устаревшие ссылки.
3. **Merge-readiness:** Рецепт в `analysis-9` §3-§7 имеет 4 CRITICAL проблемы,
   которые приведут к fail при попытке выполнения. Выполнять **нельзя**.

## CRITICAL findings (8)

### F1. §3.8 fast-forward **математически невозможен** (merge-readiness)
- **Локация:** `analysis-9-upstream-merge-recipe-2026-09-03.md` §1, §3.8
- **Что неверно:** Recipe говорит: `git switch main; git merge --ff-only
  origin/feature/minimax-step0-readiness; git push origin main`.
- **Реальность:** Local `main` (`3f839337`) и `origin/feature/minimax-step0-readiness`
  разошлись в `0ff3a432` (Kawrakow, 2026-02-28). `git merge --ff-only`
  **откажется**. `git rev-list --left-right --count HEAD...origin/main` =
  `250 5` — minimax опережает origin/main на **250** коммитов (не «5 коммитов
  назад» как утверждает §1).
- **Воздействие:** Recipe упадёт на этом шаге.
- **КОРРЕКЦИЯ:** §1 уже частично исправлен в 2026-09-07 (origin/main ВПЕРЕДИ,
  не позади). §3.8 ещё не исправлен.

### F2. `safety` remote **не существует** (merge-readiness)
- **Локация:** `analysis-9` §3.4
- **Что неверно:** Recipe говорит: `git push safety feature/rtr-auto-pr-prep-archived:...`
- **Реальность:** Ни в main, ни в rtr-pr worktree `safety` remote не настроен.
  `git remote -v` показывает только `origin`, `private`, `upstream`.
  Альтернативный путь `O:\user files\Projects\ik_llama.cpp-archive.git`
  тоже не существует (`Test-Path` = False).
- **Воздействие:** §3.4 упадёт при попытке push.

### F3. Путь к Step0 runbook **неверный** (merge-readiness)
- **Локация:** `analysis-9` §3.3, §3.6, §7
- **Что неверно:** Recipe ссылается на `step0/MINIMAX_TARGET_RUNBOOK.md`,
  `step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md`, `step0/step0-bench.ps1`.
- **Реальность:** Реальный путь: `docs/superpowers/specs/step0/...`. Файлы
  в корневом `step0/` **не существуют** — `git show HEAD:step0/...` возвращает
  fatal. Любая команда в recipe с этим путём упадёт.
- **Воздействие:** GATE 2 step 5 (`step0-bench.ps1 -WhatIf`) упадёт с file-not-found.

### F4. Runbook **жёстко зависит** от `repack_tensors_auto` и `-rtra` (merge-readiness)
- **Локация:** `docs/superpowers/specs/step0/MINIMAX_TARGET_RUNBOOK.md:101`
  + `analysis-9` §7
- **Что неверно:** Runbook явно rejects `-rtra, --run-time-repack-auto` в
  harness. Это значит harness **обязан распознать** эти флаги. Если merge
  случайно потеряет `repack_tensors_auto` поле в `include/llama.h` или
  `-rtra` парсер в `common/common.cpp` — Step0 harness сломается **молча**.
  Recipe §7 (GATE 1/2) **не имеет проверки** на эти поля/флаги.
- **Воздействие:** Пост-merge harness может не запуститься, и единственный
  признак — загадочный fail в первом прогоне.
- **КОРРЕКЦИЯ:** не применена.

### F5. Conflict markers в §12.4 **stale** (merge-readiness)
- **Локация:** `analysis-9` §12.4
- **Что неверно:** Recipe цитирует `<<<<<<< ... >>>>>>>` markers из dry-run,
  который был запущен против `caf7eae5` (на 2 коммита позади текущего
  `fe215a8c`). При реальном merge маркеры будут **другими**. Resolver не
  сможет найти exact-текст, который ожидал.
- **Воздействие:** GATE 2 step (conflict resolution) не пройдёт без surprise.

### F6. `analysis-10 §0` TL;DR — **прямое противоречие** §8 (stale-string)
- **Локация:** `analysis-10-upstream-deep-dive-2026-09-03.md:52-53`
- **Что неверно:** TL;DR говорит: «`tests/test-compare-llama-bench.py` **не
  переехал**, а просто удалён (§8)».
- **Реальность:** §8 строки 504, 508, 512-517 говорят: «`tests/test-compare-llama-bench.py`
  **переехал** в `scripts/compare-llama-bench.py`».
- **Воздействие:** Кто откроет только TL;DR — получит неверную картину.

### F7. **Overcorrection** в §1.1 — «три #if-ветки» → «две» (stale-string)
- **Локация:** `analysis-10` §1.1 (строки 67-69)
- **Что неверно:** Я поправил «три #if-ветки» → «две» в `085ca0b7`,
  утверждая, что fallback-ветка существовала до PR.
- **Реальность:** `git show 3c58ae37^:src/llama-mmap.cpp | Select-String
  random_fragment` → пусто. PR добавил **все три**. Моя правка —
  фактически неверна.
- **КОРРЕКЦИЯ:** не применена.

### F8. **Incorrect git command claim** в §8.1 (stale-string)
- **Локация:** `analysis-10` §8.1 (строки 512-514)
- **Что неверно:** Doc говорит: «`git log --all --diff-filter=D --
  tests/test-compare-llama-bench.py` → находит только 843de95f».
- **Реальность:** Эта команда возвращает **empty**. Файл в 843de95f не
  deleted, а modified. Doc объясняет правильно (что upstream никогда не
  имел файла), но первая часть (про diff-filter=D) — нет.
- **Воздействие:** Кто повторит команду — получит другой результат.

## MAJOR findings (10 отобранных)

### F9. `src/llama.cpp:5120` → реально **5124** (factual-claim)
Off-by-4. `git show upstream/main:src/llama.cpp` строка 5124 содержит
`LLAMA_LOG_WARN("...deferred per-layer token embedding is only supported
on Linux; ignoring defer_ple")`. Соседние строки (5116, 5120) — это
**другие** warning'и про `--defer-ple`.

### F10. `src/llama.cpp:7974-7976` → реально **7978-7980** (factual-claim)
Off-by-4. Три init-строки upstream `llama_model_default_params()` для
`defer_experts`/`defer_ple`/`swa_compress` находятся на строках 7978-7980,
а не 7974-7976. Содержимое строк совпадает.

### F11. `src/llama-spec-features-dflash.{cpp,h}` (+276/-20) → реально **+280/-21** (stale-string)
КОРРЕКЦИЯ 2026-09-07: было указано 276/20, реально 280/21.

### F12. `src/llama-model.h` (+112/-11) → реально **+133/-11** (stale-string)
КОРРЕКЦИЯ 2026-09-07: было указано 112/11, реально 133/11.

### F13. `analysis-10:218-219` всё ещё содержит `src/llama.h` и `3337+` (stale-string)
Коррекция `src/llama.h` → `include/llama.h` и `3337+` → `3609+` **не дошла**
до этого места файла (только до §14.1, §12.4 в analysis-9). В §2.5
(видимый список файлов) остались старые ссылки.

### F14. `analysis-9 §1` диаграмма: HEAD `434bdd62` не отражает `085ca0b7` (stale-string)
Реальный HEAD — `085ca0b7` (4 коммита после 434bdd62). Диаграмма показывает
`6a6b44ef → eee79613 → 434bdd62 → [текущий HEAD]`, но «текущий» =
`085ca0b7`, не `434bdd62`. Также 33 → должно быть 34.

### F15. `analysis-9 §6.3` строка 427 противоречит исправленному §5.2 (stale-string)
§5.2 (исправлено в `085ca0b7`): «auto-deleted (D status), не conflict».
§6.3 (не исправлено): всё ещё говорит «delete/modify конфликт».

### F16. **6 мест** в analysis-9: 33 → 34 (stale-string)
После `085ca0b7` minimax own commits = 34. Все «33» в body должны быть 34.

### F17. `tests/test-compare-llama-bench.py` — **fork-only файл**, не rename (stale-string)
Я поправил "R" (rename) на "переехал", но это **всё ещё не rename**:
- Файл добавлен в форк коммитом `85fc0aff` (Andrew_Moryakov, 2026-07-17)
- upstream никогда не имел этого файла
- `scripts/compare-llama-bench.py` (upstream) — из #4844, другой файл, другая история
- `git diff --name-status 843de95f..fe215a8c` показывает `D` (потому что
  fork файл vs upstream файл — разные)

### F18. Lineage claim про `0115ace2` — **неверно** (merge-readiness)
`git merge-base --is-ancestor 0115ace2 feature/rtr-auto-pr-prep` = NO.
rtr-pr и minimax имеют **идентичный RTR auto код** (verified `git diff
feature/rtr-auto-pr-prep HEAD -- common/common.cpp include/llama.h
src/llama.cpp src/llama-model.h` пусто), но через **разные коммиты**.

### F19. `analysis-10 §6.1` таблица счётчиков файлов устарела (stale-string)
- `ggml-cuda/*` — реально 44, не 45
- `src/llama*.cpp/.h` — реально 30, не ~80
- `src/graphs/build_*.cpp` — реально 15, не 4
- `models/templates/*.jinja` — реально 2 (плюс другие jinja добавлены)

### F20. `--defer-ple` CLI parser (новый в upstream) — **не перечислен** в §6.2 (merge-readiness)
Upstream добавил `if (arg == "--defer-ple")` парсер в `common/common.cpp`.
Если он рядом с `-rtr` — может дать непредсказанный content conflict, не
перечисленный в recipe.

## MINOR findings (5 отобранных)

- **F21.** `analysis-9 §11.1` "defer_ple+swa_compress" отсутствует `defer_experts` —
  3 поля, не 2 (factual-claim).
- **F22.** GATE 2 `--help` audit pattern включает `prefetch-experts|muge` —
  **не существуют** в upstream (merge-readiness).
- **F23.** `analysis-9 §6.2` Block 3 "сохранить обе формы -rtr" vs §12.5
  рекомендует одну — внутреннее противоречие (merge-readiness).
- **F24.** Duplicate "Appended to preserve the source layout" comment в
  rtr-pr `include/llama.h` (×2) (merge-readiness).
- **F25.** §3.7 `git push` не имеет защиты от non-fast-forward (merge-readiness).

## Что НЕ было применено (recipe-level, требует «правь recipe»)

Эти 5 finding-блоков (F1, F2, F3, F4, F5) относятся к **recipe** в
`analysis-9 §3-§7`, не к **analysis-содержимому**. Их исправление требует
явного "правим recipe" от пользователя. На момент фиксации этого
документа recipe остаётся **непригодным к выполнению** — выполнение §3.8
упадёт на fast-forward, §3.4 упадёт на push в safety remote, §3.6/§7 упадёт
на несуществующий путь к runbook.

## Связь с предыдущими коррекционными коммитами

- `6a6b44ef docs: add upstream analysis set 2026-09-03` — исходные файлы.
- `eee79613 docs: correct analysis-9/10 with dry-run findings` — первая волна
  коррекций (после dry-run 2026-09-03).
- `434bdd62 docs: correct analysis-8/9/10 with self-review findings` —
  вторая волна (после моего self-review).
- `085ca0b7 docs: apply verifier-agent corrections (2026-09-07)` — третья
  волна (после первого 3-agent review).
- **Этот документ** фиксирует, что **четвёртая волна** (2026-09-07) нашла
  ещё 25 находок, из которых **~15-20 применены** в `085ca0b7` (этот коммит),
  **~5-10 отложены** (F1-F5, recipe-level).

## Рекомендации для будущих итераций

1. **Прежде чем выполнять recipe из `analysis-9 §3-§7`:** применить
   recipe-level фиксы (F1-F5). До этого recipe непригоден.
2. **Прежде чем добавлять новые analysis-документы:** учесть паттерн
   «commit-time / verification-time drift» — upstream двигается между
   write и verify, цифры устаревают. Возможно, делать verification **перед**
   commit, а не после.
3. **Рассмотреть pre-commit hooks** для автоматической проверки
   `git rev-list --count HEAD...upstream/main` и обновления соответствующих
   чисел в файлах.

## Связанные документы

- `analysis-8-upstream-snapshot-2026-08-31.md` — исходный снапшот.
- `analysis-9-upstream-merge-recipe-2026-09-03.md` — recipe (F1-F5 не исправлены).
- `analysis-10-upstream-deep-dive-2026-09-03.md` — deep-dive.
- `00-INDEX.md` — индексная таблица.
- `step0/MINIMAX_TARGET_RUNBOOK.md` — Step0 runbook (зависит от recipe correctness).
