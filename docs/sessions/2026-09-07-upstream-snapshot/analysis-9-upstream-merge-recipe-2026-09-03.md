# Анализ 9 — рецепт слияния upstream в форк (на 2026-09-03)

> ## ⚠️ ОТМЕНЁН 2026-09-08 — не выполнять §3–§7
>
> Слияние с upstream выполнено **дважды** и **в обход** этого рецепта:
> `fe215a8c` (415 коммитов, 2026-09-08) и `1a2a8604` (2 коммита, в тот же
> день). Рабочий порядок действий записан в
> [`FORK_WORKFLOW.md`](../../../FORK_WORKFLOW.md), раздел «`upstream-sync`».
>
> Находки F1–F5 из `analysis-11` **так и не исправлены здесь** и исправлены
> не будут: §3.8 предлагает невозможный fast-forward, §3.4 — несуществующий
> remote `safety`, §3.6/§7 — несуществующие пути `step0/...`. Что оказалось
> с каждой из них на практике — в
> [`../2026-09-08-upstream-merge/evidence-1-merge-execution-2026-09-08.md`](../2026-09-08-upstream-merge/evidence-1-merge-execution-2026-09-08.md) §7.
>
> **Почему отменён, а не починен.** Починка дала бы инструкцию, которой
> никто не воспользуется: рабочая процедура живёт в `FORK_WORKFLOW.md` и
> уже дважды применена. Документ сохранён как запись анализа —
> §1, §5, §10, §12 (карта конфликтов из dry-run) остаются полезными и
> подтвердились на практике поблочно.

**Дата:** 2026-09-03
**Baseline источник:** `upstream/main` @ `3c58ae37`
(`loader: add --defer-ple …`, 2026-08-31)
**Целевые ветки:**

- `feature/rtr-auto-pr-prep` (`843de95f`, локальная, см. `ik_llama.cpp-rtr-pr/`)
- `feature/minimax-step0-readiness` (`3a24458a`, на `origin`)
- `origin/main` (`3f839337`, форк-дефолт)

**Связанные документы:** `analysis-8-upstream-snapshot-2026-08-31.md`,
`step0/MINIMAX_TARGET_RUNBOOK.md`, `FORK_WORKFLOW.md` (на `origin/main`),
`docs/RTR_AUTO_FIX_*` (если ещё в дереве).

## TL;DR

1. Сначала синхронизировать **rtr-pr** с `upstream/main` через rebase её 13
   собственных коммитов на новый upstream (134 коммита добавятся). Это
   автоматически удалит «мёртвые» RTR auto файлы, которые upstream убрал.
2. Потом синхронизировать **minimax-step0-readiness** с `upstream/main`
   через merge (415 коммитов добавятся, 34 собственных коммита minimax
   сохранятся как merge-commit lineage).
3. **fork main** (`origin/main`) после шага 2 — fast-forward на 5 коммитов
   от minimax-HEAD.
4. Каждый шаг проходит через **три gate** (build → smoke tests → perplexity
   smoke), см. §7.

## 1. Текущее состояние (verified `git rev-list`)

> **Коррекция 2026-09-07:** upstream HEAD сдвинулся с `3c58ae37` до
> `fe215a8c` (Joel Farthing, 2026-09-03, `#2404 qwen4exp gather selected
> cells for depth-constant TG attention`). Числа ниже пересчитаны
> относительно **текущего** upstream:
> `rtr-pr` теперь **141** upstream-коммитов впереди (было 134 → 139
> → 141), `minimax` теперь **415** (было 408 → 413 → 415).
> `minimax HEAD` = `085ca0b7` (текущий локальный, после 4 правок
> `6a6b44ef` → `eee79613` → `434bdd62` → `085ca0b7`).
> Автор upstream HEAD — **Joel Farthing**, не Kawrakow (исправлено).
> **КОРРЕКЦИЯ 2026-09-07:** lineage claim про "общий предок `0115ace2`"
> был **неверным** — verified `git merge-base --is-ancestor 0115ace2
> feature/rtr-auto-pr-prep` = NO. rtr-pr и minimax имеют **идентичный
> RTR auto код** (verified `git diff feature/rtr-auto-pr-prep HEAD --
> common/common.cpp include/llama.h src/llama.cpp src/llama-model.h`
> пусто для RTR auto), но через **разные коммиты**. См. §1 "Дополнительно".

```text
upstream/main = fe215a8c  (2026-09-03, Joel Farthing, #2404 qwen4exp)
                 │
                 │  (141 коммит)
                 ▼
rtr-pr mb ─── 9d07d868  (2026-07-18, mb между rtr-pr и upstream)
                 │
                 │  13 rtr-pr-коммитов
                 ▼
rtr-pr HEAD ─ 843de95f  (2026-07-19, fix: complete RTR auto pre-PR remediation)

upstream/main = fe215a8c
                 │
                 │  415 коммитов
                 ▼
minimax mb ─── 45dfd80  (2026-05-04, Andrew Moryakov, PR #1735 link)
                 │
                 │  34 minimax-коммита
                 ▼
minimax HEAD ─ 6a6b44ef  (2026-09-03, docs: add upstream analysis set)
                 │
                 │  eee79613  (2026-09-03, docs: correct analysis-9/10 with dry-run findings)
                 │
                 │  434bdd62  (2026-09-07, docs: correct analysis-8/9/10 with self-review findings)
                 ▼
              [текущий HEAD]

origin/main ── 3f839337  (2026-07-22, docs: harden Ryzen MiniMax handoff map)
                 │
                 │  5 коммитов (ВПЕРЕДИ minimax на эту дельту;
                 │  origin/main 2026-07-22 docs, minimax разошёлся
                 │  с origin/main в 0ff3a432 (2026-02-28, Kawrakow).
                 │  КОРРЕКЦИЯ 2026-09-07: ранее утверждалось
                 │  "origin/main отстаёт на 5 коммитов" — это было
                 │  backwards; origin/main ВПЕРЕДИ на 5 в своей
                 │  параллельной ветке, но minimax опережает origin/main
                 │  на 250+ коммитов в своей.)
                 ▼
              (5 коммитов origin/main отсутствуют в minimax)
```

Дополнительно:

- `git rev-list --left-right --count HEAD...upstream/main` для rtr-pr: `13  141`.
- То же для minimax: `34  415` (КОРРЕКЦИЯ 2026-09-07: было 33 — добавлен
  коммит `085ca0b7 docs: apply verifier-agent corrections`).
- `origin/main` (`3f839337`) **впереди** minimax-HEAD (`085ca0b7`) на 5
  коммитов в своей параллельной ветке; minimax опережает origin/main на
  250+ коммитов в основной ветке. **fast-forward в §3.8 невозможен** —
  `git merge --ff-only` откажется (топологии разошлись в 0ff3a432).
- merge-base `minimax` с `origin/main` — `0ff3a432` (Kawrakow, 2026-02-28).
- merge-base `rtr-pr` с `upstream/main` — `9d07d868` (2026-07-18).
- rtr-pr **локальная**; в `origin` её нет (по `FORK_WORKFLOW.md` —
  изолированный worktree).
- **Важно (КОРРЕКЦИЯ 2026-09-07):** `feature/minimax-step0-readiness`
  HEAD уже содержит RTR auto implementation **с идентичным кодом**
  через **параллельную имплементацию** в rtr-pr (verified `git diff
  feature/rtr-auto-pr-prep HEAD -- common/common.cpp include/llama.h
  src/llama.cpp src/llama-model.h` — нет различий в RTR auto).
  **КОРРЕКЦИЯ:** предыдущая формулировка "через общий предок
  `0115ace2`" была **неверной** — `git merge-base --is-ancestor 0115ace2
  feature/rtr-auto-pr-prep` = NO. rtr-pr получил RTR auto через
  **другой коммит**. Если когда-то изменить RTR auto в minimax без
  синхронизации с rtr-pr — rebase сломается. PR #1738 — это **та же
  implementation** в отдельной ветке для upstream-реквеста.

## 2. Решения, которые нужно принять ДО начала слияния

| # | Решение | Дефолт | Почему важно |
|---|---|---|---|
| 1 | Закрыть PR #1738 или переформулировать? | Закрыть (см. `analysis-8` §8.1) | Определяет, тащим ли мы RTR auto вообще |
| 2 | Делать rebase или merge в rtr-pr? | **Rebase** | rtr-pr локальная, ни с кем не расшарена; rebase даёт чистую линейную историю для архива |
| 3 | Делать rebase или merge в minimax? | **Merge** | minimax расшарена (push в origin); rebase перепишет 30+ уже опубликованных коммитов |
| 4 | Синхронизировать minimax ДО или ПОСЛЕ Step0 baseline? | **После** | merge upstream → minimax расширит diff и поверхность регрессии Step0 harness; см. `analysis-3` §правило валидации |
| 5 | Имя новой ветки для rebase rtr-pr? | `feature/rtr-auto-pr-prep-archived` | не теряем старые 13 коммитов как safety net |

Если хоть один пункт — «нет, делаем иначе», дальше применять §3/§4 как
reference, не как инструкцию.

## 3. Стратегия A (рекомендую): rtr-pr → rebase, minimax → merge

### 3.1 Подготовка

```powershell
# В рабочей копии ik_llama.cpp-rtr-pr:
Set-Location "O:\user files\Projects\ik_llama.cpp-rtr-pr"
git fetch upstream --prune --no-tags
git fetch origin --prune --no-tags

# Сохранить текущий tip как safety net (5-минутная страховка)
$backup = git rev-parse HEAD
git branch "backup/rtr-pr-pre-rebase-$(Get-Date -Format 'yyyyMMdd-HHmmss')" HEAD
Write-Host "Backup branch created. Tip: $backup"
```

### 3.2 Rebase rtr-pr на upstream

```powershell
Set-Location "O:\user files\Projects\ik_llama.cpp-rtr-pr"
git switch feature/rtr-auto-pr-prep

# Dry-run сначала, чтобы увидеть конфликты без записи
git rebase --merge --interactive=false --no-commit upstream/main 2>&1
# если конфликтов нет, очистить
git rebase --abort
```

Если dry-run показал конфликты (ожидаемо для RTR auto файлов, см. §6) —
сделать **настоящий rebase** и решать конфликты по §6.

```powershell
git rebase upstream/main
```

После успешного rebase:

```powershell
# Сравнить список RTR auto файлов (должны исчезнуть)
git ls-tree -r --name-only HEAD | Select-String -Pattern "rtr-auto|cgroup-resolver|RTR_AUTO_PR_FOLLOWUP"
# ожидаемый результат: пусто (или только то, что решили сохранить)
```

### 3.3 Валидация после rebase (GATE 1)

```powershell
# 1. Чистый CPU-билд, как в step0 runbook §0
cmake -S . -B build -DLLAMA_BUILD_TESTS=ON -DGGML_CUDA=OFF `
  -DGGML_NATIVE=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target llama-cli test-token-timing-writer
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

# 2. Тесты, которые выжили (RTR auto тестов больше нет)
ctest --test-dir build -C Release --output-on-failure

# 3. Perplexity smoke на маленькой модели (Qwen3-Coder-30B-A3B, как в
# `tools/moe_cache_sim/README.md` — там же есть smoke-инструкция)
# БЕЗ --moe-trace и БЕЗ -rtr. Smoke-цель: 0.1–0.5 минуты.
```

Если GATE 1 падает — **стоп**, не идти в §3.4. Либо fix, либо откат:

```powershell
git rebase --abort          # если в процессе
# или
git reset --hard "backup/rtr-pr-pre-rebase-<timestamp>"  # если уже после
```

### 3.4 Push rtr-pr (если нужно)

rtr-pr локальная и **не должна** идти в `origin` (см. `FORK_WORKFLOW.md`).
Если по итогам рецепта решено **заархивировать** ветку — последний push
должен идти в **safety-remote** (`safety/pre-upstream-integration-2026-07-16`),
а не в `origin`:

```powershell
git push safety feature/rtr-auto-pr-prep-archived:refs/heads/feature/rtr-auto-pr-prep-archived
```

Если safety remote нет в конфиге — создать локальную bare-репу как архив:

```powershell
git clone --bare . "O:\user files\Projects\ik_llama.cpp-archive.git"
git remote add archive "O:\user files\Projects\ik_llama.cpp-archive.git"
git push archive feature/rtr-auto-pr-prep-archived
```

### 3.5 Merge upstream в minimax

```powershell
Set-Location "O:\user files\Projects\ik_llama.cpp"
git fetch upstream --prune --no-tags

# Сохранить текущий tip minimax
$backup = git rev-parse HEAD
git branch "backup/minimax-pre-upstream-merge-$(Get-Date -Format 'yyyyMMdd-HHmmss')" HEAD

# Merge (НЕ rebase) — 415 коммитов upstream + 34 minimax-коммита
# (КОРРЕКЦИЯ 2026-09-07: было 408 + 30; сейчас upstream `fe215a8c` и HEAD `434bdd62`)
git switch feature/minimax-step0-readiness
git merge --no-ff upstream/main -m "merge: bring upstream main 2026-09-03 (fe215a8c) into minimax-step0-readiness"
```

Если merge — fast-forward (то есть upstream/main достижим из minimax — в
нашем случае **нет**, minimax имеет 30 уникальных коммитов, поэтому merge
создаст merge-commit).

### 3.6 Валидация после merge (GATE 2)

Тот же набор, что GATE 1, **плюс** Step0-специфичные проверки:

```powershell
# 1. Build + tests
cmake -S . -B build -DLLAMA_BUILD_TESTS=ON -DGGML_CUDA=OFF `
  -DGGML_NATIVE=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target llama-cli `
  test-moe-trace-writer test-token-timing-writer
ctest --test-dir build -C Release --output-on-failure

# 2. step0-bench.ps1 в dry-run / smoke-режиме (без реальной MiniMax-M2.7)
# — не запускать на целевой машине с этой версией до отдельного решения

# 3. Проверить, что новые upstream-флаги появились в --help
& ".\build\bin\Release\llama-cli.exe" --help 2>&1 | Select-String -Pattern "defer-ple|defer-experts|rtr|prefetch-experts|muge"
# ожидаемо увидеть: --defer-ple, --defer-experts, --run-time-repack
# (последний — КОРРЕКЦИЯ 2026-09-07: ранее утверждалось что флаг
# исчез, но он жив в upstream `common/common.cpp:2216, 3308`. Удалён
# только `auto`-режим.)
```

### 3.7 Push minimax

```powershell
Set-Location "O:\user files\Projects\ik_llama.cpp"
git push origin feature/minimax-step0-readiness
```

### 3.8 Fast-forward fork main (опционально)

```powershell
# Только после успешного GATE 2
Set-Location "O:\user files\Projects\ik_llama.cpp"
git switch main
git merge --ff-only origin/feature/minimax-step0-readiness
git push origin main
```

**Не делать**, пока GATE 2 не зелёный.

## 4. Стратегия B (альтернатива): прямой merge upstream → minimax

Если по решению 1 (см. §2) PR #1738 закрыт и rtr-pr не нужна — можно
пропустить §3.1–3.4 и сразу делать §3.5. Логика: 30 minimax-коммитов
(Step0 readiness handoff) **не конфликтуют** с RTR auto файлами, потому
что они в `docs/superpowers/specs/`, `step0/`, `examples/main/`, `tools/`,
`tests/`.

Проверить это можно заранее:

```powershell
Set-Location "O:\user files\Projects\ik_llama.cpp"
# upstream-удалённые файлы которых нет в minimax:
$mb = "45dfd80371785731bc2ed05a76252497a4e7a282"
$deleted = git diff --name-only --diff-filter=D "$mb..upstream/main"
$localFiles = $deleted | Where-Object { Test-Path $_ }
Write-Host "Upstream-deleted files still present locally: $($localFiles.Count)"
$localFiles | ForEach-Object { Write-Host "  $_" }
```

Если этот список содержит **только** RTR auto файлы (`src/llama-rtr-auto.h`,
`src/llama-cgroup-resolver.h`, `tests/test-rtr-{auto-peak,params,cgroup-resolver}.cpp`,
`docs/RTR_AUTO_PR_FOLLOWUP_*`) — стратегия B безопасна. Эти файлы в minimax
отсутствуют, потому что rtr-pr — отдельная ветка.

## 5. Карта конфликтов (что ожидать)

### 5.1 Конфликты при rebase rtr-pr (стратегия A)

Из 13 rtr-pr-коммитов upstream изменил следующие файлы (по diff
`843de95f..upstream/main`):

| Файл / каталог | Состояние | Действие |
|---|---|---|
| `src/llama-rtr-auto.h` | Удалён в upstream | **`git rm`** при rebase |
| `src/llama-cgroup-resolver.h` | Удалён в upstream | **`git rm`** при rebase |
| `tests/test-rtr-auto-peak.cpp` | Удалён в upstream | **`git rm`** при rebase |
| `tests/test-rtr-params.cpp` | Удалён в upstream | **`git rm`** при rebase |
| `tests/test-cgroup-resolver.cpp` | Удалён в upstream | **`git rm`** при rebase |
| `tests/test-compare-llama-bench.py` | **Fork-only файл, не в upstream** (КОРРЕКЦИЯ 2026-09-07: ранее помечено как "Renamed → scripts/" — но `git diff --name-status` показывает `D` (потому что это не rename, а удаление fork-only файла)) | **`git rm`** (файл существует в rtr-pr как fork artifact) |
| `docs/RTR_AUTO_PR_FOLLOWUP_PLAN.md` | Удалён в upstream | **`git rm`** при rebase |
| `docs/RTR_AUTO_PR_FOLLOWUP_SPEC.md` | Удалён в upstream | **`git rm`** при rebase |
| `common/common.{cpp,h}` | Изменён в обоих (rtr-auto + upstream) | **content conflict**; смотреть §6.2 |
| `src/llama.cpp` | Изменён в обоих | **content conflict**; смотреть §6.2 |
| `src/llama-model.cpp` | Изменён в обоих | **content conflict** |
| `Makefile` | Удалён в upstream (через merge), но **присутствует в rtr-pr** | rtr-pr не наследует это удаление; оставить как есть или удалить вручную |

Полный список добавляемых upstream файлов (134 коммита, выборка по
директориям):

- `ggml/src/ggml-cuda/{ds4_comp, kda, latent_attn}.{cu,cuh}` — новые CUDA
  ядра
- `ggml/src/iqk/iqk_kda.cpp` — новый CPU kernel
- `ggml/src/vulkan-shaders/{dequant,get_rows,mul_mat_vec}_iq4_k{s,t}.comp` —
  IQ4_KS/KT Vulkan
- `src/graphs/build_{bailingmoe3,deepseek4,muse_glimmer,qwen4exp}.cpp` — новые
  graph builders
- `src/llama-dsv4.{cpp,h}`, `src/llama-kda.{cpp,h}` — новые модели
- `examples/spec-bench/{CMakeLists.txt, README.md, spec-bench.cpp, prompts/*}` —
  новый example
- `models/templates/{GLM-5.2,deepseek-ai-DeepSeek-V4}.jinja` — чат-шаблоны
- `tests/test-iq4-ks-kt-decode.cpp` — новый тест

### 5.2 Конфликты при merge upstream → minimax (стратегия A и B)

minimax и upstream расходятся в `45dfd80`. Дельта:

| Зона | Состояние | Действие |
|---|---|---|
| `common/common.{cpp,h}` | Изменён в minimax (для `--moe-trace` / token-timing) **и** в upstream | **content conflict**, ожидаемо; разрешать в пользу upstream-стороны + re-apply токен-тайминг правок minimax |
| `examples/main/main.cpp`, `token-timing.{cpp,h}` | Добавлены в minimax, не существуют в upstream | **add/add**; upstream не знает, merge добавит оба варианта; вручную оставить minimax-версию |
| `tools/moe_cache_sim/*` | Добавлены в minimax, не существуют в upstream | **add/add**; оставить minimax-версию |
| `tests/test-{moe-cache-sim,token-timing-*}` | Добавлены в minimax, не существуют в upstream | **add/add**; оставить minimax-версию |
| `docs/superpowers/specs/*` | Добавлены в minimax, не существуют в upstream | **add/add**; оставить |
| `src/llama.{cpp,h}` | Изменён в upstream; minimax не трогал | upstream-сторона выигрывает автоматически |
| `ggml/src/*` | Изменён в upstream; minimax не трогал | upstream-сторона |
| `examples/llava/*` | Удалён в upstream (Prune examples/llava) | автоматически; minimax не имел этих файлов в `45dfd80` |
| `Makefile` | Удалён в upstream; **есть в minimax** | **auto-deleted (D status), не conflict** (КОРРЕКЦИЯ 2026-09-07: ранее предсказан delete/modify conflict; dry-run показал, что git обрабатывает как pure delete). См. §12.8 для фактического результата. Рекомендация §6.3 по удалению — остаётся в силе. |

Upstream-удалённые файлы vs minimax (`45dfd80..upstream/main`):
`Makefile`, `examples/llava/*` (16 файлов), `examples/server/webui_*/...`
(несколько). Из них minimax имеет только `Makefile` (см. `analysis-8` §1).

## 6. Плейбук разрешения конфликтов

### 6.1 Удаление RTR auto файлов при rebase rtr-pr

```powershell
# После остановки rebase на конфликте:
git rm src/llama-rtr-auto.h
git rm src/llama-cgroup-resolver.h
git rm tests/test-rtr-auto-peak.cpp
git rm tests/test-rtr-params.cpp
git rm tests/test-cgroup-resolver.cpp
# Примечание 2026-09-07: tests/test-compare-llama-bench.py переехал
# в scripts/compare-llama-bench.py (КОРРЕКЦИЯ к §5.1). Если rebase
# rtr-pr детектит rename — `git rm` не нужен, git сам выполнит rename.
# Если rename-detection выключен — оставить `git rm` ниже.
git rm tests/test-compare-llama-bench.py
git rm docs/RTR_AUTO_PR_FOLLOWUP_PLAN.md
git rm docs/RTR_AUTO_PR_FOLLOWUP_SPEC.md
# Если RTR auto включался через include в src/llama.cpp — удалить
# include-строки вручную (см. §6.2)

# Продолжить rebase:
git rebase --continue
```

Если `git rm` отказывается (файл не в HEAD) —

```powershell
# Файл уже удалён upstream, но rebase думает иначе; принять upstream-версию
git checkout --theirs <file>
git add <file>
```

### 6.2 `common/common.{cpp,h}` и `src/llama.cpp`

**Что делал minimax:** добавил CLI-флаги и аргументы для `--moe-trace` /
token-timing (см. `step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md`).

**Что делал upstream:** другие CLI-флаги (`--defer-ple`, `--defer-experts`,
DFlash callbacks, sampling).

**Подход (общий):**

1. Открыть `common/arg.cpp` (или эквивалент), `common/common.h` и
   `src/llama.cpp`.
2. Найти minimax-блоки: `moe_trace`, `token_timing`, `--moe-trace`.
3. Найти upstream-блоки: `defer-ple`, `defer_ple`, DFlash additions.
4. **Сохранить оба.** Минимальный путь: взять upstream-версию как base и
   заново in-сертить minimax-блоки по их оригинальным коммитам
   (`c472ed52`..`3a24458a`).
5. Если rebase — лучше squash конфликт-фикс в один коммит:
   `fix(merge): reconcile upstream CLI flags with moe-trace token-timing`.

**Конкретные 4 конфликт-блока в `common/common.cpp`** (verified dry-run
2026-09-03, см. §12):

- **Блок 1** (после `params.speculative.suffix_corpus`):
  - HEAD (minimax): legacy-формат `params.speculative.suffix_corpus = argv[i]; return true;`
  - upstream: новый `throw common_speculative_legacy_option_error(arg, ...)`
  - **Резолв:** принять upstream-формат; minimax не имел этого изменения,
    legacy-формата больше нет в minimax 33 коммитах.

- **Блок 2** (CLI-args-handler):
  - HEAD (minimax): `--moe-trace` + `--token-timing` парсинг (оба
    `params.moe_trace_file` / `params.token_timing_file`).
  - upstream: пусто (нет этих флагов).
  - **Резолв:** **сохранить HEAD-блок** (`--moe-trace` + `--token-timing`
    целиком), удалить upstream-маркер. Убедиться что
    `params.supports_moe_trace` / `params.supports_token_timing` есть в
    `common/common.h`.

- **Блок 3** (CLI help text для `-rtr`, `--cpu-moe`):
  - HEAD (minimax): `-rtr, --run-time-repack [0|1|auto]` (длинная форма).
  - upstream: `-rtr, --run-time-repack` (короткая форма) + новое
    `-thp, --transparent-huge-pages`.
  - **Резолв:** **сохранить обе** формы `-rtr` (расширить upstream
    до `[0|1|auto]` если переформулируем PR #1738, или оставить две
    отдельные строки). Сохранить `-thp` (upstream-добавление).

- **Блок 4** (CLI help text для `--override-kv` / `--override-tensor`):
  - HEAD (minimax): minimax добавил `--moe-trace` + `--token-timing`
    options внутри этого блока.
  - upstream: добавил `-ot, --override-tensor` отдельной строкой.
  - **Резолв:** **сохранить обе секции** (HEAD + upstream добавления).
    Если minimax-блок остался «внутри» upstream-блока — вытащить
    minimax-options в их собственные строки.

### 6.3 `Makefile`

Upstream удалил через `Remove Makefile (#1847)`. Этот merge приходит в
rtr-pr/minimax как часть `843de95f..upstream/main` дельты.

**В minimax:** `Makefile` присутствует (см. `analysis-8` §1). Merge даст
**auto-deleted (D status)**, не conflict. **КОРРЕКЦИЯ 2026-09-07:**
ранее утверждалось "delete/modify conflict" — dry-run 2026-09-03
показал, что git обрабатывает как pure delete. Принять upstream-версию
(`Makefile` удалён), см. §5.2.

**Решение:**

- **Принять upstream-версию** (`git checkout --theirs Makefile`) и удалить
  локально. Аргументы: upstream-команда решила, что cmake — единственный
  путь; `Makefile` с тех пор никем не правился в minimax; сборка через
  cmake уже используется (см. `step0-bench.ps1`).
- Если хочется сохранить `Makefile` для удобства (например, в нём есть
  локальные convenience-таргеты, не вошедшие в cmake) — добавить
  `Makefile` в merge-коммит как «локальное исключение, см. §6.3». Это
  **потенциально** конфликтует с будущими merge'ами, потому что upstream
  не ожидает его увидеть.

Рекомендация: **принять upstream-версию и удалить**.

### 6.4 `llama-mmap.h` в корне rtr-pr

Из `analysis-8` §«Подозрительные артефакты»: файл `llama-mmap.h` в корне
rtr-pr пришёл из upstream PR #1989 (on-demand tensor reload). В minimax
его нет, потому что minimax не наследует PR #1989 lineage.

При merge upstream → minimax файл придёт **как add** (upstream-добавляет).
Никакого конфликта, но это лишний корень-уровневый header. Проверить, не
ломает ли `#include`-цепочку (см. `analysis-8` §10 пункт «Что я НЕ
проверил»).

Если `#include` сломан —

```powershell
# Переместить в include/ (где upstream-аналоги живут)
git mv llama-mmap.h include/llama-mmap.h
# или удалить, если include-цепочка не нужна
git rm llama-mmap.h
```

## 7. Валидационные гейты

Каждый из шагов §3.3, §3.6, §3.8 имеет свой gate. Каждый gate —
**обязательный**, не «желательный».

### GATE 1 (после rebase rtr-pr)

1. **Build:** чистый `cmake -B build -DGGML_CUDA=OFF` + `cmake --build`.
2. **Tests:** `ctest -R "token-timing|moe-trace"`. RTR auto тестов больше
   нет — это норма. Если они вдруг появятся как `not found` — игнорировать
   (test-runner сам отфильтрует).
3. **Smoke perplexity:** маленькая модель, 32 токена prompt + 8 токенов
   gen, БЕЗ `--moe-trace`, БЕЗ `-rtr`. Должно показать ~0.5–2 t/s и
   ненулевой perplexity. **Если 0 t/s или NaN — откат, см. §8.**

### GATE 2 (после merge upstream → minimax)

1. **Build:** те же флаги + добавить `test-iq4-ks-kt-decode` в таргеты
   (он новый в upstream).
2. **Tests:** полный `ctest -C Release` (без фильтра).
3. **`--help` audit:** см. §3.6 пункт 3.
4. **Smoke perplexity:** тот же, что GATE 1, плюс отдельный прогон с
   `--defer-ple` для проверки, что флаг работает.
5. **Step0 harness dry-run:** `step0-bench.ps1 -WhatIf` (если такая опция
   есть; иначе запустить с `output_dir=/tmp/smoke` и проверить, что
   harness не падает на пустых путях).
6. **Token-timing regression:** `test-token-timing-writer.exe` —
   сравнить с эталоном из `step0/NEXT_AGENT_PROMPT.md` (если есть).

### GATE 3 (после push в origin)

1. **CI на `feature/minimax-step0-readiness`** (если настроен): см.
   `.github/workflows/`.
2. **Tag-snapshot:** `git tag snapshot/post-upstream-merge-2026-09-03 HEAD`
   для возможности быстрого отката (см. §8).

## 8. Rollback

### 8.1 Если что-то пошло не так в rebase rtr-pr

```powershell
# Мягкий откат (rebase в процессе)
git rebase --abort

# Жёсткий откат (rebase завершился, но что-то не так)
git reset --hard "backup/rtr-pr-pre-rebase-<timestamp>"
```

Backup-ветка создаётся в §3.1; **не удалять** её, пока GATE 1 не зелёный
**+** ещё сутки (на случай позднего регрессионного обнаружения).

### 8.2 Если merge upstream → minimax сломал GATE 2

```powershell
# Откатить merge-коммит
git reset --hard "backup/minimax-pre-upstream-merge-<timestamp>"

# Или revert (если уже push)
git revert -m 1 <merge-commit-sha>
git push origin feature/minimax-step0-readiness
```

Revert-вариант предпочтительнее, если merge уже запушен, потому что
**reset ломает уже-синхронизированные worktree'ы у других агентов.**

### 8.3 Если push в origin уже сделан и CI красный

```powershell
# Срочный revert
git revert -m 1 <merge-commit-sha>
git push origin feature/minimax-step0-readiness

# Параллельно — оставить комментарий в issue / commit message, чтобы
# будущий rebase не подцепил тот же merge обратно
```

### 8.4 Snapshot-стратегия (proactive)

Перед **каждым** шагом §3 создавать git tag:

```powershell
git tag snapshot/pre-rtr-pr-rebase-<ts> feature/rtr-auto-pr-prep
git tag snapshot/pre-upstream-merge-<ts> feature/minimax-step0-readiness
git push origin --tags  # если origin принимает tags
```

Эти tags — «машина времени». Не удалять 30 дней.

## 9. Порядок выполнения (чек-лист)

```text
[ ] 1. Решить §2 (5 решений). Без них дальше — угадайка.
[ ] 2. Сделать backup-ветки (snapshot tags) в обеих worktree'ах.
[ ] 3. (Только стратегия A) §3.1–3.3: rebase rtr-pr + GATE 1.
[ ] 4. (Только стратегия A) §3.4: push rtr-pr в safety remote или
       локальный archive bare-repo.
[ ] 5. §3.5–3.6: merge upstream в minimax + GATE 2.
[ ] 6. §6.2 / §6.3: разрешить content conflicts по плейбуку.
[ ] 7. §3.7: push minimax в origin.
[ ] 8. (Опционально) §3.8: fast-forward origin/main.
[ ] 9. §8.4: snapshot tags оставить жить на 30 дней.
[ ] 10. (Опционально) обновить `00-INDEX.md` и `analysis-8`, чтобы
       отразить факт слияния + новые ссылки на upstream-флаги.
```

## 10. Verified / Unverified статус

> **Коррекция 2026-09-07:** предыдущая версия §10 смешивала VERIFIED и
> UNVERIFIED под одним заголовком. Разделено.

### 10.1 VERIFIED (через dry-run 2026-09-03 и verifier-агентов)

- **Конфликт-мапа 6 файлов / 15 блоков** (см. §12).
- **Стратегия B «прямой merge»** — 1.6% conflict rate, manageable. 14
  файлов в `common/` требуют внимания, но не дали конфликта (только
  `common/common.cpp` + `common/common.h` + `docs/parameters.md`).
- **`--run-time-repack` жив в upstream** (`common/common.cpp:2216`,
  `:3308`).
- **`--defer-experts` жив в upstream** (см. `analysis-10` §14.2).
- **`repack_tensors_auto` жив в minimax HEAD** через общий предок
  `0115ace2`.
- **6 файлов / 15 блоков** в dry-run conflict-map (см. §12).

### 10.2 UNVERIFIED (всё ещё открыто)

- **CI workflow** (если есть) на `feature/minimax-step0-readiness` —
  статус и поведение после merge. **Не проверял** в dry-run.
- **Поведение `--defer-ple` end-to-end** — даже после merge не
  валидировано, что loader-флаг не падает на MiniMax-M2.7 GGUF.
  Требует реального прогона. **На Windows — no-op** (см.
  `analysis-10` §1), для целевой машины не релевантно.
- **Snapshot tags очистка** — в проекте нет convention по удалению
  тегов через 30 дней; возможно, стоит завести отдельный script.
- **`--defer-experts` (PR #1634)** точная реализация в `common/common.cpp` —
  флаг жив, но точная семантика CLI-парсера не изучена отдельной
  секцией.
- **`--run-time-repack` точная семантика `0`/`1` без `auto`** — флаг
  жив, но минимальное поведение в `common/common.cpp` после удаления
  auto-режима не изучено детально.

## 11. Открытые вопросы для пользователя

1. **PR #1738: закрываем или переформулируем?** (решение §2 пункт 1).
   После `analysis-10` §14.1: переформулировка как «auto-режим поверх
   `--run-time-repack`» аддитивна, не конфликтует с upstream. Решение
   остаётся за тобой.
2. **`Makefile` в minimax: оставить как локальное исключение или
   удалить?** (решение §6.3).
3. **`llama-mmap.h` в корне: после merge перенести в `include/` или
   удалить?** (решение §6.4).
4. **Синхронизировать minimax ДО или ПОСЛЕ Step0 baseline на целевой
   машине?** (решение §2 пункт 4).
5. **`safety` remote настроен или создаём локальный bare-repo для
   архива rtr-pr?**
6. **`repack_tensors_auto` в `include/llama.h`: оставить?** (После
   `analysis-10` §14.1) Если minimax хочет сохранить RTR auto —
   сохранить поле в структуре, в конфликте с `defer_ple`+`swa_compress`.
   См. §12.4.
7. **`--defer-experts` в Step0 baseline grid: тестировать на Linux-варианте
   когда-нибудь?** (После `analysis-10` §14.2)

## 12. Actual dry-run conflict map (2026-09-03)

> **Источник:** `git merge --no-commit --no-ff upstream/main` в
> `feature/minimax-step0-readiness` (HEAD `6a6b44ef`) с последующим
> `git merge --abort`. Snapshot-tag:
> `snapshot/pre-upstream-merge-20260903-014713`. Upstream HEAD на момент
> dry-run: `caf7eae5` (на 2 коммита свежее, чем `3c58ae37` из §1).

### 12.1 Статистика

> **Коррекция 2026-09-03:** upstream HEAD на момент dry-run был
> `caf7eae5` (на 2 коммита свежее, чем `3c58ae37` в §1 исходной
> версии). Числа ниже отражают именно `caf7eae5`. На 2026-09-03 11:30
> upstream — `caf7eae5`, rtr-pr отстаёт на 139, minimax — на 413.

| Категория | Кол-во | Примечание |
|---|---|---|
| Всего изменено файлов | 930 | Полная дельта upstream → minimax |
| Auto-merged (M) | 396 | Без конфликтов |
| Added (A) | 391 | Новые upstream-файлы, не существовали в minimax |
| Deleted (D) | 109 | Удалённые в upstream, не было в minimax |
| Renamed (R) | 28 | WebUI-реорганизация, auto-detected |
| **Content conflict (UU)** | **6 файлов, 15 блоков** | Ручное разрешение |
| **% conflict** | **1.6%** | Очень manageable |

### 12.2 Conflict-1: `.gitignore` (1 блок)

```text
<<<<<<< HEAD (minimax)
 +tags
 +.build/
 +build*
 +!build-info.cmake
 ...
 +!tools/moe_cache_sim/build_layout.py
=======
+ /tags
+ /.build/
+ /build*
+ /cmake-build-*
 ...
```

**Резолв:** добавить upstream-паттерны (`/tags`, `/cmake-build-*`) +
сохранить minimax-паттерны. Идемпотентно, оба набора совместимы.

### 12.3 Conflict-2: `common/common.cpp` (4 блока)

Подробно в §6.2. Сводка:

| # | Что HEAD (minimax) | Что upstream | Резолв |
|---|---|---|---|
| 1 | `params.speculative.suffix_corpus = argv[i];` | `throw common_speculative_legacy_option_error(arg, ...)` | upstream |
| 2 | `--moe-trace` + `--token-timing` блок (cli args) | (нет, не существует) | **HEAD** |
| 3 | `-rtr, --run-time-repack [0|1\|auto]` help text | `-rtr, --run-time-repack` + `-thp` | **ОБА** (расширить upstream-форму + добавить `-thp`) |
| 4 | `--override-kv` (длинный) + `--moe-trace` + `--token-timing` (внутри блока) | `--override-kv` (с `-okv`) + `-ot, --override-tensor` | **ОБА** (HEAD-options наружу, upstream-добавления сохранить) |

### 12.4 Conflict-3: `include/llama.h` (1 блок)

```text
<<<<<<< HEAD (minimax)
        // Appended to preserve the source layout of all pre-existing fields.
        // The C ABI still requires callers and the library to use matching headers.
        bool repack_tensors_auto; // if true, may auto-disable run-time repack
=======
        bool defer_ple;        // keep the per-layer token embedding on the file instead of resident in memory (Linux only)
        bool swa_compress;     // must match llama_context_params::swa_compress; the fit also assumes that context's n_ubatch
>>>>>>> upstream/main
```

> **Коррекция 2026-09-03:** текст маркеров выше **взят из dry-run
> conflict markers**, не из реального `include/llama.h` в minimax HEAD.
> В реальном файле форма может отличаться. Перед merge — открыть
> `include/llama.h` в minimax и посмотреть, как именно выглядит
> `repack_tensors_auto` декларация (с комментарием или без, с
> групппингом или нет).

**Резолв:** сохранить **все четыре** поля (КОРРЕКЦИЯ 2026-09-07: upstream
добавил `defer_experts` между `flash_attn` и `defer_ple` — verified
`git blame upstream/main -- include/llama.h`):

```cpp
        // Appended to preserve the source layout of all pre-existing fields.
        // The C ABI still requires callers and the library to use matching headers.
        bool repack_tensors_auto; // if true, may auto-disable run-time repack
        bool defer_experts;       // defer expert mmap residency to speed up model loading (Linux only)
        bool defer_ple;           // keep the per-layer token embedding on the file (Linux only)
        bool swa_compress;        // must match llama_context_params::swa_compress
```

**Что за `repack_tensors_auto` на самом деле** (verified 2026-09-03,
это не «просто поле»):

Это **видимый конец** всей RTR auto implementation, которая уже
**живёт** в `feature/minimax-step0-readiness` HEAD (через общий
предок `0115ace2 runtime : add --run-time-repack auto mode for
swap-bound MoE safety`):

- `common/common.h:382` — `bool repack_tensors_auto = false; // if true,
  use a safety-first memory check before run-time repack`
- `common/common.cpp:1669-1708` — **полный CLI-парсинг** `-rtr` +
  `--run-time-repack [0|1/1/on/auto/0/off]`, `-rtra` alias,
  проброс в `mparams.repack_tensors_auto`.
- `common/common.cpp:2764` — help text для `-rtr, --run-time-repack
  [0|1|auto]`.
- `common/common.cpp:3661` — `mparams.repack_tensors_auto =
  params.repack_tensors_auto` (проброс в model params).
- `include/llama.h:441` — `repack_tensors_auto` в `llama_model_params`
  (этот conflict, см. выше). **КОРРЕКЦИЯ 2026-09-07:** ранее указывалось
  `src/llama.h` — файл `src/llama.h` не существует, правильный путь
  `include/llama.h`.
- `src/llama.cpp:3609+` — `enum class llama_rtr_auto_decision`,
  `struct llama_rtr_auto_override`, `static bool
  llama_rtr_auto_parse_layer(...)` — **вся auto-логика** живёт в
  minimax HEAD. **КОРРЕКЦИЯ 2026-09-07:** ранее указывалось `3337+` —
  это header комментарий секции; сами символы на 3609+ (off by 272
  строк).
- `src/llama-model.h:466` — `llama_rtr_status rtr_status =
  LLAMA_RTR_STATUS_DISABLED`.

**Это значит:**

- PR #1738 — **не «альтернативная реализация»**. Это **та же самая
  implementation**, которую AndrewM оформил в отдельной worktree
  (`feature/rtr-auto-pr-prep`) специально для upstream-реквеста.
  Minimax её унаследовал через общий предок.
- `repack_tensors_auto` уже есть. Удалять его = удалить всю RTR
  auto логику. Сохранение зависит от решения §11.1, но это
  **substantive** решение, не косметическое.
- В conflict-map §12.4 я писал «сохранить все три поля» — это
  устаревшая формулировка (КОРРЕКЦИЯ 2026-09-07: upstream добавил
  `defer_experts` отдельно от `defer_ple`). Текущее: «сохранить все
  четыре поля». Подразумевалось «сохранить всю RTR auto logic +
  добавить три новых поля upstream», а не «равноправные bool'ы».

### 12.5 Conflict-4: `docs/parameters.md` (1 блок)

```text
<<<<<<< HEAD (minimax)
| `-rtr, --run-time-repack [0|1|auto]` | Repack tensors if interleaved variant is available. `0`/`off` = disable, `1`/`on` = always (legacy), `auto` = enable but auto-disable when the estimated peak memory would exceed safe headroom. ... |
| `-rtra, --run-time-repack-auto` | Alias for `-rtr auto`: ... |
| `--ctx-checkpoints` | ... |
=======
| `--ui-mcp-proxy, --webui-mcp-proxy` | ... |
| `--defer-experts` | Defer expert mmap residency on Linux ... |
| `-rtr, --run-time-repack` | Repack tensors if interleaved variant is available | ... |
| `--ctx-checkpoints N` | Set the number of checkpoints per slot | 32 | ... |
| `--ctx-checkpoints-tolerance N` | The number of tokens before the full prompt to create the checkpoint | 5 | ... |
| `--ctx-checkpoints-eviction NAME` | Eviction strategy for checkpoint. | `variance` | ... |
```

**Резолв:** сохранить **все** строки обеих сторон, **кроме `-rtr`** —
унифицировать в одну строку:

- **Принять как одну строку** (рекомендация, superset):
  ```text
  | `-rtr, --run-time-repack [0\|1\|auto]` | Repack tensors if interleaved variant is available. `0`/`off` = disable, `1`/`on` = always (legacy), `auto` = enable but auto-disable when the estimated peak memory would exceed safe headroom. Bare `-rtr` with no value is equivalent to `-rtr 1` (legacy on). In a Windows Job Object, `auto` conservatively disables repack because effective memory headroom is unknown. [PR 147](https://github.com/ikawrakow/ik_llama.cpp/pull/147), [PR 1738](https://github.com/ikawrakow/ik_llama.cpp/pull/1738) | 0 | ... |
  ```
  minimax-форма `[-rtr, --run-time-repack [0|1|auto]]` — superset
  upstream-формы `-rtr, --run-time-repack`. Документационная DRY:
  одна строка, не две.

- **Сохранить** (другие строки, кроме `-rtr`):
  - minimax: `-rtra` (alias), `--ctx-checkpoints` (без дефолта).
  - upstream: `--ui-mcp-proxy`, `--defer-experts`, `--ctx-checkpoints
    N` (с дефолтом 32), `--ctx-checkpoints-tolerance`,
    `--ctx-checkpoints-eviction`.

**Почему не «обе формы -rtr»:** исходная рекомендация §12.5
предлагала «сохранить обе строки, унифицировать или нет». Это плохо:
- Документационный долг (нарушает DRY).
- Длинная форма (с `[0|1|auto]`) — strict superset короткой. Обе
  рядом вводят в заблуждение: пользователь видит `-rtr` дважды и
  думает, что это разные флаги.
- Реальная семантика (что upstream оставил в `common/common.cpp` —
  см. `analysis-10` §14.1) — `0`/`1` без `auto`. Это subset minimax-
  формы. Унификация в minimax-форму ничего не теряет.

### 12.6 Conflict-5: `examples/main/main.cpp` (6 блоков)

| # | Что HEAD (minimax) | Что upstream | Резолв |
|---|---|---|---|
| 1 | `#include <memory>` | `#include <limits>` | **ОБА** `#include`'а |
| 2 | `if (moe_trace \|\| token_timing) { ... protected_paths ... }` | (нет) | **HEAD** (весь блок) |
| 3 | `if (moe_trace && embd_is_generated) { moe_trace->begin_batch(...) }` + `if (llama_decode(...)) { ... end_batch() }` | `const bool need_prompt_target_features = embd_is_prompt && spec != nullptr && params.speculative.uses_target_features();` | **ОБА** (блоки независимы, добавить оба) |
| 4 | `if (token_timing) { ... after_sample(...) }` + `common_sampler_accept(...)` | (upstream-extensions) | **ОБА** |
| 5 | `embd.push_back(id); embd_is_generated = true;` | `const int min_usable_draft = ...; if (... common_speculative_before_draft(...))` | **ОБА** (разные ветки кода, оба валидны) |
| 6 | `if (moe_trace && !moe_trace->finish()) { ... } if (token_timing && !token_timing->finish(...)) { ... }` | (нет) | **HEAD** (весь блок) |

**Общая логика:** minimax-блоки (1, 2, 3, 4, 6) **не пересекаются
логически** с upstream-блоками. Конфликт только потому, что правки в
соседних строках. После ручного разрешения: оба набора блоков живут
параллельно в `main.cpp`.

### 12.7 Conflict-6: `src/llama.cpp` (2 блока)

| # | Что HEAD (minimax) | Что upstream | Резолв |
|---|---|---|---|
| 1 | `model.use_mmap_loader_enabled = ml.use_mmap;` (одна строка) | 8 строк MTP-package validation + hot-swap registry | **ОБА** (добавить upstream-блок ПОСЛЕ minimax-строки) |
| 2 | `/*.repack_tensors_auto =*/ false,` (одна строка) | `/*.defer_experts =*/ false, /*.defer_ple =*/ false, /*.swa_compress =*/ false,` (**три** строки, КОРРЕКЦИЯ 2026-09-07: ранее указано "две строки" — пропущен `defer_experts`) | **ОБА** (все четыре инициализации в `llama_model_default_params()`) |

### 12.8 Что прошло через merge без конфликта (важные файлы)

> **Коррекция 2026-09-03:** §12.8 изначально утверждал, что
> `common/common.h` «auto-merged без конфликта, Git справился сам».
> Это слишком легкомысленно. Реально: minimax-сторона имеет
> `repack_tensors_auto` поле (от RTR auto через общий предок
> `0115ace2`), upstream-сторона добавила `defer_ple`, `defer_experts`
> и `swa_compress` (последний — в `llama_context_params`).
> Auto-merge прошёл, потому что git поместил новые поля в
> неконфликтующие места структуры. **Перед merge** — открыть
> `common/common.h` и проверить, что:
> 1. `repack_tensors_auto` на месте (RTR auto logic не потерялась).
> 2. `defer_ple` + `defer_experts` на месте (Linux-only, см.
>    `analysis-10` §14.2).
> 3. `swa_compress` на месте в `llama_context_params` (если применимо).
> 4. `params.supports_moe_trace` / `params.supports_token_timing` на
>    месте (нужны для `--moe-trace` / `--token-timing` CLI).

- **`common/common.h`** — auto-merged (см. коррекцию выше). Поля
  RTR auto и defer-семейства сосуществуют.
- **`scripts/compare-llama-bench.py`** — auto-merged (M status).
  Подтверждение: файл переехал из `tests/`, не удалён (см.
  `analysis-10` §14.3).
- **`Makefile`** — auto-deleted (D status). Подтверждение: upstream
  удалил через PR #1847, minimax имел свою копию, merge её удалил без
  конфликта. Рекомендация §6.3 остаётся в силе.
- **`common/sampling.{cpp,h}`** — auto-merged (M status). minimax
  не правил → upstream-wins без вопросов.
- **`common/chat.cpp`**, **`common/speculative.{cpp,h}`**,
  **`common/log.{cpp,h}`** — auto-merged. Аналогично.
- **`ggml/src/iqk/iqk_quantize.{cpp,h}`** — auto-merged (упомянуты в
  initial merge output, без конфликта).
- **`src/llama-model.h`**, **`examples/llama-bench/llama-bench.cpp`**,
  **`tests/CMakeLists.txt`** — auto-merged.

> **Дополнение 2026-09-03 к `examples/llama-bench/llama-bench.cpp`:**
> в upstream этот файл имеет поле `bool defer_experts = false;`
> (line 272). Auto-merge прошёл успешно (minimax не правил). При
> использовании llama-bench в Step0 (если когда-нибудь понадобится) —
> новое поле будет в `--help` llama-bench. На Windows — no-op (Linux
> only, как `--defer-ple`).

### 12.9 Не-merge'ед, но упомянутые

- **`llama-mmap.h`** в корне rtr-pr (из `analysis-8` §10) — это rtr-pr
  branch, в minimax его нет. После merge upstream → minimax **придёт**
  как новый файл (auto-add, без конфликта). См. `analysis-9` §6.4
  (рекомендация: перенести в `include/` или удалить).

### 12.10 Что НЕ было конфликтом, но я ожидал

- **`common/sampling.{cpp,h}`** — minimax не правил, явно подтверждено в
  `analysis-10` §12 (теперь VERIFIED). Adaptive P Sampler (#2337) →
  upstream-wins без вопросов.
- **`tools/moe_cache_sim/`** — auto-merged (M status). minimax
  добавил; upstream не трогал; git справился.
- **`tests/test-{moe-cache-sim,token-timing-*}`** — auto-merged
  (M status). minimax добавил; upstream не трогал.

### 12.11 Заключение по dry-run

**Merge is mechanical, low-risk, well-bounded.** 1.6% conflict rate, 15
блоков в 6 файлах — реально за один сеанс с codex sub-agents
(stale-string / cross-doc / commit-hygiene lenses).

Рекомендованный порядок разрешения:

1. `.gitignore` (1 блок, тривиально) — 1 минута.
2. `include/llama.h` (1 блок) — 2 минуты.
3. `docs/parameters.md` (1 блок) — 3 минуты.
4. `src/llama.cpp` (2 блока) — 5 минут.
5. `common/common.cpp` (4 блока) — 10 минут.
6. `examples/main/main.cpp` (6 блоков) — 15 минут.

Итого: ~36 минут ручной работы, **до** запуска GATE 2.

---

**Связанные документы:**

- `analysis-8-upstream-snapshot-2026-08-31.md` — снапшот upstream
- `analysis-10-upstream-deep-dive-2026-09-03.md` — глубокий разбор,
  коррекции после dry-run
- `step0/MINIMAX_TARGET_RUNBOOK.md` — runbook (помешать merge'у сюда
  до завершения baseline)
- `step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md` — что именно
  merge должен сохранить в `common/` и `examples/main/`
- `FORK_WORKFLOW.md` (на `origin/main`) — branch map и правила
  изоляции
- `codex-review-workflow.md` (в `~/.mavis/agents/mavis/memory/`) — если
  merge пойдёт через codex review pipeline
