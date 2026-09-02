# Анализ 10 — глубокий разбор upstream после верификации кода

**Дата:** 2026-09-03
**Baseline источник:** `upstream/main` @ `3c58ae37` (2026-08-31)
**Локальные проверки:** `git show`, `git grep`, `git diff --name-only`,
`git log`. Все ссылки `file:line` — на `upstream/main` если не указано иное.

**Связанные документы:**

- `analysis-8-upstream-snapshot-2026-08-31.md` — снапшот, к которому этот
  документ — коррекция и углубление.
- `analysis-9-upstream-merge-recipe-2026-09-03.md` — рецепт слияния, который
  правим в части §6 и §10 здесь.
- `step0/MINIMAX_TARGET_RUNBOOK.md` — runbook, в который не надо тащить
  ошибочные рекомендации из analysis-8.
- `step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md` — текущая метрика, к
  quality gate которой analysis-10 добавляет новые гейты.

## TL;DR (коррекция к analysis-8)

**`--defer-ple` — Linux-only, на Windows игнорируется с warning.** Все
рекомендации analysis-8 §2, §3, §8.1, §10, которые советовали включить
`--defer-ple` в Step0 baseline grid, **ошибочны** для целевой машины Ryzen
9 7950X / Windows. Подробности в §1.

Что **сохраняется**:

- RTR auto в upstream **полностью удалён**, переименования нет
  (см. §2). Анализ-8 здесь верен.
- Quant fudge factors (#2361) — потенциально сдвигают quality gate, но
  требуют **re-quantization** существующих GGUFs (см. §3).
- DFlash 2 / DSpark — большая переработка speculative decoding
  (см. §4).
- IQ4_KS / IQ4_KT — **только CUDA, нет CPU-пути** (см. §5).

Что **нового** в этом документе, чего не было в analysis-8:

- Risk classification всех 134 upstream-коммитов по зонам ответственности
  (§6) — actionable для приоритизации merge.
- Предсказание content conflict в `common/` (14 файлов) — §7.
- Подтверждение, что `tests/test-compare-llama-bench.py` **не переехал**,
  а просто удалён (§8).
- Тонкости логики `random_fragment` на Windows vs Linux (§1.1).
- Indexer cache quantized timeline (§5) — временно отключали, потом
  починили; для MiniMax-M2.7 нерелевантно (CPU-only), но знать полезно.

## 1. Главное открытие: `--defer-ple` не работает на Windows

### 1.1 Доказательства в коде

**Файл:** `src/llama-mmap.cpp` (PR #2389, коммит `3c58ae37`)

PR добавил новую функцию `random_fragment` в трёх `#if`-ветках:

- Linux-ветка (`_POSIX_MAPPED_FILES`): вызывает `posix_madvise(addr+first,
  len, POSIX_MADV_RANDOM)`.
- Windows-ветка (`_WIN32`): **no-op** — `GGML_UNUSED(first); GGML_UNUSED(last);`.
- Fallback (нет mmap support): бросает `std::runtime_error("mmap not
  supported")`.

**Файл:** `src/llama.cpp:5120` (upstream/main)

```cpp
LLAMA_LOG_WARN("%s: deferred per-layer token embedding is only supported
                on Linux; ignoring defer_ple\n", __func__);
```

**Файл:** `include/llama.h:436` — комментарий у поля:

```cpp
bool defer_ple;        // keep the per-layer token embedding on the file
                       // instead of resident in memory (Linux only)
```

**Файл:** `common/common.h:459` — то же:

```cpp
bool defer_ple = false; // if true, keep the per-layer token embedding on
                        // the file (Linux only)
```

### 1.2 Сценарии на Windows

- `use_mmap = true`, `--defer-ple` → попадает в `should_defer_ple_mmaps()`,
  который вернёт `true` (формально). Но при попытке применить —
  `random_fragment` — no-op, тензор остаётся resident. Функциональной
  разницы **нет**, только логи `posix_madvise(..., POSIX_MADV_RANDOM)
  failed` или просто молчание.
- `use_mmap = true`, `--defer-ple`, `use_mlock = true` →
  `defer_ple_mmap = false` явно, defer отключается без warning.
- `use_mmap = false`, `--defer-ple` → warning «--defer-ple had no effect:
  creating the tensors disabled mmap».
- `use_mmap = true`, модель с huge pages → warning «deferred per-layer
  token embedding disabled because the model is mapped on huge pages».

**Вывод:** на Windows `--defer-ple` либо игнорируется, либо даёт no-op.
**Никакого выигрыша на Ryzen 9 7950X / Windows от этого флага нет.**

### 1.3 Что это меняет в `analysis-9` §6.2

`analysis-9` §6.2 («common/common.{cpp,h}») рекомендовал «сохранить
upstream-side changes для `--defer-ple`». Это правильно для кода (merge
должен включать upstream-реализацию), но **неправильно для Step0
baseline** — флаг в MiniMax-M2.7 Step0 на Windows-цели не тестировать как
performance-knob.

**Коррекция к `analysis-8` §10 «рекомендация 2»**: НЕ добавлять
`--defer-ple` в Step0 baseline grid. Вместо этого:
- Добавить `--defer-ple` в smoke-тест на Linux-варианте (если будет
  отдельный Linux-pipeline), но не на Windows.
- Зафиксировать в `step0/MINIMAX_TARGET_RUNBOOK.md`: «`--defer-ple`
  no-op на Windows, тестированию не подлежит».

### 1.4 Альтернативы, которые работают на Windows

Если цель — сократить resident memory >RAM MoE-модели, на Windows
остаются:

- `--no-mmap` — но это **противопоказано** в Step0 baseline (runbook §«Non-
  negotiable experiment boundaries»: «do not use runtime -rtr or runtime
  -muge» — implicit: mmap must stay on).
- `--cpu-moe` / `-n-cpu-moe` — частичный offload экспертов на CPU, но это
  другое решение.
- Offline `_R4` repack GGUF + mmap — основной рычаг, не зависит от
  `--defer-ple`.
- Размер кванта: IQ4_XS / Q4_K и ниже — уже обсуждается в
  `analysis-2-bytes-per-token.md`.

**Все эти альтернативы уже в плане;** `--defer-ple` для Windows-цели —
не решение, а distractor.

## 2. RTR auto: подтверждение полной смерти в upstream

### 2.1 Файлы, проверенные на отсутствие

- `git ls-tree upstream/main src/llama-rtr-auto.h` → пусто
- `git ls-tree upstream/main src/llama-cgroup-resolver.h` → пусто
- `git ls-tree upstream/main docs/RTR_AUTO_PR_FOLLOWUP_PLAN.md` → пусто
- `git ls-tree upstream/main docs/RTR_AUTO_PR_FOLLOWUP_SPEC.md` → пусто

### 2.2 Поиск переименованного эквивалента

`git grep -l "rtr_auto\|rtr-auto\|RTR_AUTO" upstream/main -- 'src/*.cpp'
'src/*.h' 'common/*.cpp' 'common/*.h'` → **пусто**.

Нет ни одного source-файла в upstream, который бы содержал строки
`rtr_auto`, `rtr-auto` или `RTR_AUTO`. Это значит, что upstream не
переименовал функциональность — **он её убрал целиком**.

### 2.3 Что есть в upstream про repack / мmap-эффективность

Из 134 коммитов единственное релевантное — `b8b3034b Indexer topk: on
the CPU repack Q8_0 indexer cache (#2285)`:

```text
 ggml/src/iqk/iqk_mul_mat.cpp | 59 +++++++++++++++++++++++++++++++++++++++-----
 1 file changed, 53 insertions(+), 6 deletions(-)
```

Это **узкий** repack только Q8_0 индексер-кеша, **не общий repack** RAM-
тензоров. Подтверждает architectural choice upstream: «repack точечно
там, где даёт выигрыш, а не везде».

### 2.4 Выводы по судьбе PR #1738

`analysis-8` §8.1 предлагал «переформулировать в Q8_0 indexer repack».
Это **всё ещё актуально**, но с оговоркой: даже эта узкая
переформулировка может встретить сопротивление, потому что:

- Indexer topk есть только в моделях с sparse attention (GLM-DSA,
  DeepSeek-V4), MiniMax-M2.7 к ним не относится.
- На CPU (`ggml/src/iqk/`) — да, repack есть. Но MiniMax-M2.7 на
  текущем ggml-пути не использует indexer topk.
- **Сценарий использования PR #1738 для MiniMax-M2.7 = 0**. PR имеет
  смысл только как contribution upstream для GLM-DSA-семейства. Это
  надо явно сказать в PR-описании, если переформулировать.

## 3. Quantization fudge factors (#2361)

### 3.1 Что меняется

Коммит `7cff686d` (Kawrakow, 2026-08-27):

- `examples/quantize/quantize.cpp` +42 строки (новый CLI/API в
  `llama-quantize` для fudge factors).
- `ggml/include/ggml.h` +3 строки (новое API).
- `ggml/src/ggml-quants.c` +73 строки (изменения в квант-таблицах).

**Не затрагивает существующие GGUF-файлы.** Это adjustment на этапе
квантизации; если GGUF уже создан — fudge factors не применяются
автоматически.

### 3.2 Quality gate implications

`analysis-8` §5 писал: «может сдвинуть quality gate на уже размеченных
MiniMax-M3/M2.7 прогонах». Это **не совсем точно**:

- На **существующих** GGUFs — никакого сдвига. Quant таблицы уже в
  файле, fudge factors на них не действуют.
- На **новых** GGUFs, размеченных с новым `llama-quantize` — fudge
  factors дают **adjusted** quant tables. Perplexity может отличаться
  от старых GGUFs.

**Коррекция к `analysis-8` §5:** «re-quantize required to benefit» —
это не «может сломать существующие замеры», а «новые GGUFs будут
отличаться от старых, нужна baseline perplexity на новой версии».

### 3.3 Минимальное действие

При merge upstream → minimax + планах quant-новых-моделей:

1. **Не re-quantize** существующие MiniMax GGUFs без причины — старые
   таблицы работают.
2. При quant-новой-модели — задокументировать, какие fudge factors
   использовались, чтобы при следующем merge воспроизвести.
3. Если когда-то будет принят шаг «сменить quant MiniMax-M2.7 для
   fit-in-RAM» — добавить в план re-quantize с fudge factors + новый
   quality baseline.

## 4. DFlash 2 / DSpark / DFlash — текущее состояние upstream

### 4.1 Timeline релевантных коммитов

Из `git log 9d07d868..upstream/main -- src/llama-spec-features-dflash.cpp
src/llama-spec-features-dflash.h`:

```text
28fbe34c Dflash 2 speculative decoding (#2345)
7ebbb906 Initial implementation of DSpark (#2280)
276e4ea1 fix: isolate DFlash cross-device IO (#2243)
1a7691fa DFlash: add Laguna XS 2.1 support (#2124)
```

И соседние в `common/speculative*` (см. §7): `28fbe34c` объёмный
+6 коммитов в `src/llama-spec-features-dflash.{cpp,h}` (по `git diff
--stat`).

### 4.2 Что в Step0 это значит

DFlash 2 / DSpark в Step0 baseline **не входят** (см.
`MINIMAX_TARGET_RUNBOOK.md` — ни слова про spec decoding). Но
`analysis-8` §4 рекомендовал «зафиксировать awareness, отправная точка
— #2345, не DFlash v1». Это **подтверждается** §4.1.

### 4.3 Дополнительно — DFlash модели-саппорты

`1a7691fa DFlash: add Laguna XS 2.1 support (#2124)` — для Laguna. Не
для MiniMax. Никаких DFlash-бэкендов для MiniMax-M2.7 в upstream нет
(grep `MiniMax.*dflash\|minimax.*dflash` в upstream — пусто).

## 5. IQ4_KS / IQ4_KT — applicability

### 5.1 Где поддерживается

`git grep -l "IQ4_KS\|IQ4_KT" upstream/main` (по маске):

- `ggml/src/ggml-cuda/*` (12 файлов) — CUDA + IQK-multiply-mat.
- `ggml/src/vulkan-shaders/*` (6 файлов) — Vulkan shaders для
  `dequant`, `get_rows`, `mul_mat_vec`.

### 5.2 Где НЕ поддерживается

- `ggml/src/iqk/*` — CPU-путь (AVX2/AVX-512). **Ни одного файла с
  IQ4_KS/KT в `iqk/`.**
- `src/llama-quantize.cpp` — квантизация. Если IQ4_KS/KT нет в
  quantize.cpp — новые GGUFs с этими типами не создать (только
  конвертировать из уже-созданных).

### 5.3 Вывод

Для CPU-only MiniMax-M2.7 на Ryzen 9 7950X / Windows IQ4_KS / IQ4_KT
**неприменимы напрямую** — нет ни декодера, ни квантайзера. Vulkan-
вариант существует, но в `step0` baseline CPU-only без GPU.

Если в будущем планируется hybrid CPU+GPU — IQ4_KS/KT стоит держать в
голове, но это вне scope текущего `feature/minimax-step0-readiness`.

## 6. Risk classification 134 upstream-коммитов

Источник: `git diff --name-only 9d07d868..upstream/main` (221 файл, 134
коммита).

### 6.1 По областям

| Зона | Файлов | Risk для CPU-only MiniMax-M2.7 | Почему |
|---|---|---|---|
| `ggml/src/ggml-cuda/*` (CUDA) | 45 | **Нулевой** (build без CUDA) | Не компилируется при `-DGGML_CUDA=OFF` |
| `examples/server/webui_llamacpp/*` (web UI) | 0 в `9d07d868..upstream/main` | **Нулевой** | Не задевает inference path |
| `ggml/src/ggml-quants.{c,h}`, `ggml/src/iqk/*` (CPU quant) | ~10 | **Средний** | Влияет на квант-таблицы, нужен re-quant + perplexity smoke |
| `ggml/src/ggml.c`, `ggml/include/ggml.h` (core) | 2 | **Средний-высокий** | API меняется; проверить совместимость с minimax-правками |
| `src/llama.{cpp,h}`, `src/llama-*.cpp` (inference) | ~80 | **Высокий** | Ядро inference; build + smoke обязателен |
| `common/*` (CLI, sampling, chat, spec) | 14 (см. §7) | **Средний-высокий** | Conflicted с minimax-правками (см. §7) |
| `src/graphs/build_*.cpp` (graph builders) | 4 (новые модели) | **Низкий** | Не задействованы пока MiniMax-M2.7 не на одной из новых моделей |
| `src/llama-{dsv4,kda}.cpp` (новые модели) | 2 | **Нулевой** (MiniMax-M2.7 не использует) | Только при merge с поддержкой новых моделей |
| `models/templates/*.jinja` (chat templates) | 2 (GLM-5.2, DeepSeek-V4) | **Нулевой** | Не MiniMax-M2.7 |
| `tests/*` (тесты) | ~20 (новые + удалённые) | **Низкий** | Build-only, regression-check |
| `docs/*` (docs) | 1 (rtr-followup удалён) | **Нулевой** | Документация, не код |

### 6.2 Top 10 highest-risk коммитов

| SHA | Title | Risk | Почему |
|---|---|---|---|
| `7cff686d` | Quantization fudge factors (#2361) | Средний | Меняет quant-таблицы, но не existing GGUFs |
| `0b4d09a2` | model: Add Qwen3.8-Flash-Next (qwen4exp) runtime support (#2365) | Низкий для MiniMax-M2.7 | Другая модель |
| `15dddc60` | Qwen3.8-Flash-Next: faster TG on CUDA (#2373) | Нулевой | CUDA only |
| `28fbe34c` | Dflash 2 speculative decoding (#2345) | Низкий (не в Step0) | Spec decoding, не baseline |
| `b8b3034b` | Indexer topk: on the CPU repack Q8_0 indexer cache (#2285) | Низкий | Только GLM-DSA-семейство |
| `0ed847d3` | Adaptive P Sampler: Quality Control (#2337) | Низкий (sampling) | Output quality gate может сдвинуться |
| `1d76336e` | fix(server): capture all server log sinks (#2313) | Низкий | Server-side |
| `d180050f` | cuda: repair the HIP build, IQ4_KS/IQ4_KT on RDNA3 (#2339) | Нулевой | HIP/CUDA |
| `3c58ae37` | loader: add `--defer-ple` (#2389) | **Нулевой на Windows** | См. §1 |
| `ab6d8168` | CUDA DSA: fix v_offset for quantized K/V caches (#2387) | Нулевой | CUDA |

### 6.3 Практический вывод

Из 134 коммитов **для CPU-only MiniMax-M2.7 baseline** реально влияют:

- `7cff686d` (quant fudge, см. §3) — при re-quant.
- `08b500b9` (ggml: fix HC_POST single-token CPU chunk count) — CPU-
  kernel fix, безусловно полезен.
- `b37189aa` (Actually fix quantized indexer cache on CUDA) — CUDA
  only, не для MiniMax-M2.7.
- Sampling-изменения (`0ed847d3`) — могут сдвинуть quality gate, нужна
  re-validation.

Остальные 130 коммитов — либо CUDA-only, либо другие модели, либо
WebUI/server, либо tooling. **Build с `-DGGML_CUDA=OFF` отрезает** 45
файлов автоматически, что сильно снижает реальный risk-surface.

## 7. Предсказание content conflicts в `common/`

Из `git diff --name-only 9d07d868..upstream/main` — 14 файлов в
`common/`:

```text
common/chat-auto-parser-generator.cpp
common/chat.cpp
common/common.cpp           <-- minimax правил (moe-trace, token-timing)
common/common.h             <-- minimax правил
common/jinja/README.md
common/log.cpp
common/log.h
common/ngram-map.cpp
common/ngram-map.h
common/sampling.cpp
common/sampling.h
common/speculative-dflash-impl.h   (новый файл)
common/speculative.cpp
common/speculative.h
```

### 7.1 Конфликты, которых **стоит ждать**

- `common/common.cpp` — **высокая вероятность** content conflict.
  Minimax добавил CLI-флаги (`--moe-trace`, token-timing output), upstream
  добавил другие CLI-флаги (DFlash, `--defer-ple`, sampling). Раздел
  `add_opt` / `parse_args` — почти гарантированно пересечётся.

- `common/common.h` — **средняя вероятность**. Minimax расширил
  `common_params` (moe-trace поля, token-timing поля). Upstream тоже
  расширил (defer_ple, sampling, spec). Пересечение в районе структуры
  `common_params`.

- `common/sampling.{cpp,h}` — **средняя вероятность**. Minimax не
  правил sampling (если не правил — проверить). Upstream сильно
  изменил (Adaptive P Sampler #2337). Если minimax не трогал —
  upstream-сторона выигрывает автоматически; если трогал — content
  conflict.

- `common/chat.cpp` — **средняя вероятность**. Minimax не правил chat
  template (если не правил). Upstream добавил auto parser и tag
  templates. По умолчанию — upstream-сторона выигрывает.

- `common/speculative.{cpp,h}` — **низкая вероятность**. Minimax не
  работал со spec. Upstream переделал. Upstream-сторона.

- `common/log.{cpp,h}`, `common/ngram-map.{cpp,h}` — **низкая**.
  Minimax не трогал. Upstream-сторона.

- `common/chat-auto-parser-generator.cpp` — **нулевая** (upstream
  добавил; minimax не имел; add/add, оставить upstream).

- `common/speculative-dflash-impl.h` — **нулевая** (upstream добавил;
  minimax не имел; add/add, оставить upstream).

### 7.2 Алгоритм разрешения (для `analysis-9` §6.2)

1. **`common/common.cpp`**: после merge — `git checkout --ours
   common/common.cpp` как base, потом `git checkout --theirs
   common/common.cpp` поверх; руками восстановить minimax-блоки:
   - `add_opt` строки для `--moe-trace`, `--token-timing-output`,
     `--token-timing-format`.
   - Парсинг этих опций.
   - Output в JSON/CSV для token-timing.
2. **`common/common.h`**: то же, в `struct common_params`.
3. **`common/sampling.{cpp,h}`**: взять upstream-версию, проверить что
   minimax ничего не терял (grep `git log --oneline origin/main..HEAD --
   common/sampling.cpp`).
4. **Остальные 11 файлов**: брать upstream-версию без модификаций.

## 8. `tests/test-compare-llama-bench.py` — не переехал, удалён

### 8.1 Доказательства

- `git log --all --oneline --diff-filter=D -- tests/test-compare-llama-bench.py`
  → `843de95f fix: complete RTR auto pre-PR remediation` (rtr-pr HEAD).
- `git ls-tree upstream/main tests | Select-String "bench|compare"` →
  **пусто**.
- `git ls-tree upstream/main tools | Select-String "bench|compare"` →
  пусто (на всякий случай).
- `git ls-tree upstream/main scripts | Select-String "bench|compare"` →
  пусто.

**Файла нигде нет.** Удалён, не перемещён.

### 8.2 Что делать

Проверить, не использует ли `step0/step0-bench.ps1` этот файл:

```powershell
Select-String -Path "docs/superpowers/specs/step0/step0-bench.ps1" `
  -Pattern "test-compare-llama-bench|compare-llama-bench|llama-bench\.py"
```

Если использует — нужно либо:

- **Заменить** на прямой `llama-bench` (без python-обёртки) — upstream
  так и сделал.
- **Написать** новый wrapper, если minimax зависит от специфической
  логики сравнения.

`[UNVERIFIED]` — конкретное использование `step0-bench.ps1` не
проверял. Рекомендация: добавить в dry-run при первом merge.

## 9. Indexer cache quantized — CUDA-only, нерелевантно

`analysis-8` §5 упомянул «история: ломали → починили». Для полноты:

```text
96938a10 Disable quantized indexer cache (#2236)         (отключили)
b37189aa Actually fix quantized indexer cache on CUDA (#2286) (починили)
3861e045 indexer_topk: fix quantized q8_1 scratch sizing on CUDA (#2158) (побочный fix)
```

Все три — CUDA-only (`ggml/src/ggml-cuda/*`). На CPU (`ggml/src/iqk/*`)
этот cache **не используется**. Для MiniMax-M2.7 CPU-only это **noise**:
не нужен, не релевантен, не тестируется.

## 10. Коррекции к `analysis-9`

| Пункт analysis-9 | Что менять | Основание |
|---|---|---|
| §1 TL;DR п.1 «rebase rtr-pr удалит мёртвые RTR auto файлы» | Подтверждается, но добавить: **RTR auto не переименован** в upstream, это полное удаление | §2 |
| §3.6 п.3 «--help audit ожидаемо увидеть --defer-ple» | **Убрать**; или изменить на «ожидаемо НЕ увидеть активный эффект на Windows» | §1 |
| §3.6 п.4 «smoke perplexity с --defer-ple» | **Убрать**; на Windows-цели флаг no-op | §1 |
| §5.1 «Makefile» решение | Подтверждается; удалять | (без изменений) |
| §6.2 «common/common.{cpp,h}» | **Уточнить** порядок: `git checkout --ours` как base, потом `--theirs`, потом руками re-apply minimax-блоки (см. §7.2) | §7.1 |
| §6.4 «llama-mmap.h в корне rtr-pr» | Подтверждается: upstream-файл, придёт как add в minimax, не критично | (без изменений) |
| §7 GATE 2 п.4 | **Убрать** `--defer-ple` smoke | §1 |
| §10 «[UNVERIFIED]» п.3 «судьба test-compare-llama-bench.py» | **Подтверждено**: удалён, не переехал. Проверить `step0-bench.ps1` при merge | §8 |

## 11. Новые открытые вопросы

1. **PR #1738 — закрыть или переформулировать под indexer topk Q8_0?**
   Решение: переформулировка возможна только для GLM-DSA-семейства, не
   для MiniMax-M2.7. Если MiniMax-M2.7 — единственный use-case →
   закрывать. (`analysis-8` §8.1 + §2.4 здесь.)
2. **Quant fudge factors — применять ли к будущим quant-ам MiniMax?**
   Не блокирует merge, но влияет на любые новые квант-серии. Решение —
   не на сейчас.
3. **`step0-bench.ps1` использует `test-compare-llama-bench.py`?**
   Проверить grep'ом перед merge.
4. **Sampling quality gate** — перепрогон perplexity smoke на
   `Adaptive P Sampler` (`0ed847d3`) — отдельная задача, не блокер
   merge.
5. **WebUI-файлы** — `examples/server/webui_llamacpp/*` в 134-коммитной
   дельте **не меняются** (0 файлов). Это либо уже-стабилизировано, либо
   обновляется в отдельной ветке. Не блокер.

## 12. Что я НЕ проверил `[UNVERIFIED]`

- **Точные hunks** content conflict в `common/common.cpp` / `common.h`
  — не делал dry-run merge. Предсказание §7.1 основано на
  известной структуре файлов и моих знаниях о minimax-правках.
- **Использование `test-compare-llama-bench.py` в `step0-bench.ps1`** —
  grep не делал, см. §8.2.
- **`common/sampling.cpp` правил ли minimax** — не проверял git log
  minimax-30-коммитов на этот файл. Если правил — sampling-конфликт
  с `0ed847d3` будет сложнее.
- **Все 134 коммита** risk-классифицированы по `git diff --name-only` +
  file-paths. Не смотрел каждое commit-message вручную, возможны
  miss-классификации (high-risk поставлен в low, или наоборот).
- **CI на origin/feature/minimax-step0-readiness** — статус, наличие,
  поведение после merge не проверял.
- **Merged status `feature/raptor-lake-laptop` и `feature/upstream-integration`**
  относительно нового upstream — могут быть похожие merge-рецепты,
  применимые как reference. Не проверял.

## 13. Связанные документы (напоминание)

- `analysis-8-upstream-snapshot-2026-08-31.md` — снапшот, корректируемый
  этим документом.
- `analysis-9-upstream-merge-recipe-2026-09-03.md` — рецепт, обновляемый
  в §6.2, §10 здесь.
- `step0/MINIMAX_TARGET_RUNBOOK.md` — НЕ добавлять `--defer-ple` в
  baseline grid (см. §1.3).
- `step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md` — quality gate,
  должен учитывать fudge factors (см. §3) и Adaptive P Sampler
  (см. §6.1).
- `FORK_WORKFLOW.md` (на `origin/main`) — branch map.
