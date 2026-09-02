# Анализ 9 — рецепт слияния upstream в форк (на 2026-09-03)

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
   через merge (408 коммитов добавятся, 30 собственных коммитов minimax
   сохранятся как merge-commit lineage).
3. **fork main** (`origin/main`) после шага 2 — fast-forward на 5 коммитов
   от minimax-HEAD.
4. Каждый шаг проходит через **три gate** (build → smoke tests → perplexity
   smoke), см. §7.

## 1. Текущее состояние (verified `git rev-list`)

```text
upstream/main = 3c58ae37  (2026-08-31, Joel Farthing, --defer-ple)
                 │
                 │  (134 коммитов)
                 ▼
rtr-pr mb ─── 9d07d868  (2026-07-18, mb между rtr-pr и upstream)
                 │
                 │  13 rtr-pr-коммитов
                 ▼
rtr-pr HEAD ─ 843de95f  (2026-07-19, fix: complete RTR auto pre-PR remediation)

upstream/main = 3c58ae37
                 │
                 │  408 коммитов
                 ▼
minimax mb ─── 45dfd80  (2026-05-04, Andrew Moryakov, PR #1735 link)
                 │
                 │  30 minimax-коммитов
                 ▼
minimax HEAD ─ 3a24458a  (2026-07-22, docs: harden MiniMax target-machine handoff)

origin/main ── 3f839337  (2026-08-27, docs: harden Ryzen MiniMax handoff map)
                 │   ▲
                 │   │  (5 коммитов, fast-forward)
                 └───┘
```

Дополнительно:

- `git rev-list --left-right --count HEAD...upstream/main` для rtr-pr: `13  134`.
- То же для minimax: `30  408`.
- `origin/main` отстаёт от minimax-HEAD на 5 коммитов.
- merge-base `minimax` с `origin/main` — `0ff3a432` (Kawrakow, 2026-02-28).
- merge-base `rtr-pr` с `upstream/main` — `9d07d868` (2026-07-18).
- rtr-pr **локальная**; в `origin` её нет (по `FORK_WORKFLOW.md` —
  изолированный worktree).

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

# Merge (НЕ rebase) — 408 коммитов upstream + 30 minimax-коммитов
git switch feature/minimax-step0-readiness
git merge --no-ff upstream/main -m "merge: bring upstream main 2026-08-31 into minimax-step0-readiness"
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
& ".\build\bin\Release\llama-cli.exe" --help 2>&1 | Select-String -Pattern "defer-ple|rtr|prefetch-experts|muge"
# ожидаемо увидеть: --defer-ple
# ожидаемо НЕ увидеть: --run-time-repack (он исчез)
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
| `tests/test-compare-llama-bench.py` | Удалён в upstream | **`git rm`** при rebase |
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
| `Makefile` | Удалён в upstream; **есть в minimax** | **delete/modify conflict**; см. §6.3 |

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

**Что делал upstream:** другие CLI-флаги (`--defer-ple`, DFlash callbacks,
sampling).

**Подход:**

1. Открыть `common/arg.cpp` (или эквивалент), `common/common.h` и
   `src/llama.cpp`.
2. Найти minimax-блоки: `moe_trace`, `token_timing`, `--moe-trace`.
3. Найти upstream-блоки: `defer-ple`, `defer_ple`, DFlash additions.
4. **Сохранить оба.** Минимальный путь: взять upstream-версию как base и
   заново in-сертить minimax-блоки по их оригинальным коммитам
   (`c472ed52`..`3a24458a`).
5. Если rebase — лучше squash конфликт-фикс в один коммит:
   `fix(merge): reconcile upstream CLI flags with moe-trace token-timing`.

### 6.3 `Makefile`

Upstream удалил через `Remove Makefile (#1847)`. Этот merge приходит в
rtr-pr/minimax как часть `843de95f..upstream/main` дельты.

**В minimax:** `Makefile` присутствует (см. `analysis-8` §1). Merge даст
**delete/modify** конфликт.

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

## 10. Что я НЕ проверил `[UNVERIFIED]`

- **Точные строки content conflict** в `common/common.{cpp,h}` и
  `src/llama.cpp` — без локального dry-run merge невозможно предсказать,
  какой именно hunks пересекутся.
- **CI workflow** (если есть) на `feature/minimax-step0-readiness` —
  статус и поведение после merge.
- **Поведение `--defer-ple` end-to-end** — даже после merge не
  валидировано, что loader-флаг не падает на MiniMax-M2.7 GGUF.
  Требует реального прогона.
- **Snapshot tags очистка** — в проекте нет convention по удалению
  тегов через 30 дней; возможно, стоит завести отдельный script.
- **Стратегия B «прямой merge»** — формально безопасна, потому что
  minimax не наследует RTR auto файлы, но я не делал dry-run merge
  для подтверждения нулевого conflict-list'а кроме §5.2.

## 11. Открытые вопросы для пользователя

1. **PR #1738: закрываем или переформулируем?** (решение §2 пункт 1).
2. **`Makefile` в minimax: оставить как локальное исключение или
   удалить?** (решение §6.3).
3. **`llama-mmap.h` в корне: после merge перенести в `include/` или
   удалить?** (решение §6.4).
4. **Синхронизировать minimax ДО или ПОСЛЕ Step0 baseline на целевой
   машине?** (решение §2 пункт 4).
5. **`safety` remote настроен или создаём локальный bare-repo для
   архива rtr-pr?**

---

**Связанные документы:**

- `analysis-8-upstream-snapshot-2026-08-31.md` — снапшот upstream
- `step0/MINIMAX_TARGET_RUNBOOK.md` — runbook (помешать merge'у сюда
  до завершения baseline)
- `step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md` — что именно
  merge должен сохранить в `common/` и `examples/main/`
- `FORK_WORKFLOW.md` (на `origin/main`) — branch map и правила
  изоляции
- `codex-review-workflow.md` (в `~/.mavis/agents/mavis/memory/`) — если
  merge пойдёт через codex review pipeline
