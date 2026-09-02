# Анализ 8 — снапшот upstream main на 2026-08-31

**Дата аудита:** 2026-09-02
**Baseline:** `origin/feature/rtr-auto-pr-prep` @ `843de95f`
(`fix: complete RTR auto pre-PR remediation`, 2026-07-19)
**Upstream:** `ikawrakow/ik_llama.cpp` @ `3c58ae37`
(`loader: add --defer-ple to keep per-layer token embedding out of resident
memory`, 2026-08-31)
**Scope:** только `upstream/main`. Это не план merge и не замена baseline
измерений на целевой машине. Все цифры — производные от `git log`/`git diff`,
никакие числа из реальных прогонов MiniMax-M2.7 не заявляются.

## Цель

Понять, что изменилось в `upstream/main` за ~6 недель, как это соотносится с
собственной работой на `feature/minimax-step0-readiness` (Step0 readiness) и
`feature/rtr-auto-pr-prep` (PR #1738 к upstream), и какие новые средства upstream
стоит учесть в Step0 harness до запуска на Ryzen 9 7950X / 96 GB.

## Краткий вывод

- **PR #1738 в текущем виде фактически потерял повестку.** Upstream удалил
  `src/llama-rtr-auto.h`, `src/llama-cgroup-resolver.h`, followup-тесты и
  followup-документацию. На замену пришёл узкий loader-флаг `--defer-ple` (#2389).
  Стратегия upstream: не auto-repack всех RAM-тензоров, а прицельно отложить
  per-layer token embedding. Это другая архитектурная гипотеза, не совместимая
  с RTR auto по принципу действия.
- **`--defer-ple` релевантен к MiniMax-M2.7** (>RAM MoE). Per-layer token
  embedding — заметная доля resident memory; один loader-флаг потенциально
  сокращает pressure без риска CUDA-k-quant incompatibility, который давал
  runtime `-rtr`. Стоит как минимум включить в Step0 baseline grid.
- **DFlash 2 (#2345) — большая переработка speculative decoding.** Если в
  MiniMax-M3/M2.7 когда-нибудь планируется spec decoding, актуальная версия —
  DFlash 2, не DFlash v1.
- **Quant: IQ4_KS / IQ4_KT** теперь живут и в Vulkan (#2332), и в HIP/RDNA3
  (#2339). В `step0` квант-сценарии их нужно учитывать.
- **232 файла, +23 035 / -4 501 строк.** Headline-impact: `src/llama.cpp`
  (+2 900), `src/llama-spec-features-dflash.{cpp,h}` (+296), `src/llama-model.h`
  (+116), новые `src/llama-reload.cpp` (+132) и `tests/test-iq4-ks-kt-decode.cpp`
  (+443). См. §5.

## 1. Что удалено в upstream (нас касается напрямую)

Из `git diff --name-status 843de95f..upstream/main` (только `D`/`R` строки,
имеющие отношение к собственной работе):

```text
D  docs/RTR_AUTO_PR_FOLLOWUP_PLAN.md
D  docs/RTR_AUTO_PR_FOLLOWUP_SPEC.md
D  src/llama-rtr-auto.h                       (-44 строк в diff)
D  src/llama-cgroup-resolver.h
D  tests/test-rtr-auto-peak.cpp
D  tests/test-rtr-params.cpp
D  tests/test-cgroup-resolver.cpp
D  tests/test-compare-llama-bench.py          (-282 строк; видимо, переехал в tools/)
```

Прямые следствия:

- В `feature/rtr-auto-pr-prep` эти файлы ещё живы. Любой rebase на
  `upstream/main` приведёт к **конфликтам** на уровне файлов: upstream
  ожидает, что их нет.
- Локальные followup-документы (`docs/RTR_AUTO_PR_FOLLOWUP_PLAN.md`,
  `docs/RTR_AUTO_PR_FOLLOWUP_SPEC.md`) утратили актуальность — следующие
  ревью-итерации по PR #1738 имеют смысл **только** при переформулировании
  PR (см. §4).
- `tests/test-compare-llama-bench.py` исчез — стоит проверить, переехал ли
  он в `tools/llama-bench/` или в `examples/`. Это влияет на скрипты
  `step0/step0-bench.ps1`, если они на него опирались `[UNVERIFIED]`.

## 2. Что пришло вместо RTR auto: `--defer-ple`

PR #2389 (Joel Farthing, 2026-08-31): «loader: add `--defer-ple` to keep
per-layer token embedding out of resident memory». Это **узкое loader-only
решение** той же проблемы >RAM:

| Ось | Собственный RTR auto (PR #1738) | Upstream `--defer-ple` (#2389) |
|---|---|---|
| Что трогает | Все оставшиеся в RAM тензоры (auto-repack в row-interleaved) | Только per-layer token embedding |
| Где | Runtime, через `--run-time-repack auto` + tri-state | Loader, явный CLI-флаг |
| Побочный эффект | k-quants теряют CUDA offload (см. README предупреждение и `analysis-3`) | Нет, репак отсутствует |
| Сложность | placement-aware, mmap state, cgroup, Windows job objects (см. `a8c17080`..`843de95f`) | Один флаг в loader |
| Quality gate | Свой, в PR-серии | Встроен в PR-merge процесс upstream |

Соседний коммит — `b8b3034b Indexer topk: on the CPU repack Q8_0 indexer cache`
(#2285). **Это узкий repack Q8_0 в индексер-кеше** — та часть, которая
логически отделима от общего auto-repack. Возможный компромисс для PR #1738:

- отказаться от широкого `rtr-auto`;
- донести только Q8_0 indexer cache repack (по сути, cherry-pick `#2285`
  + тесты);
- обосновать отдельный сценарий использования.

`[UNVERIFIED]` Не проверял, насколько `#2285` уже закрывает сценарии, ради
которых затевался `rtr-auto`. Это требует отдельного review-прохода.

## 3. Новые модель-саппорты (для awareness, не для MiniMax-M2.7)

- `0b4d09a2 model: Add Qwen3.8-Flash-Next (qwen4exp) runtime support (#2365)`
  + `15dddc60 Qwen3.8-Flash-Next: faster TG on CUDA (#2373)`
- `1dede1d7 Adding Muse-Glimmer support (#2293)`
- `ea791ac5 speculative: add Step 3.7 MTP support (#2250)`
- `1a7691fa DFlash: add Laguna XS 2.1 support (#2124)`
- В README (`origin/main` → `upstream/main`) добавились строки: DeepSeek-V4
  (#2165), Muse-Glimmer (#2293), DSpark (#2304), Qwen-3.8-Flash-Next (#2365).

MiniMax-M3 в README уже был (#1963). MiniMax-M2.7 в upstream-списке явной
строки не имеет; для нашего сценария это не критично, но если когда-то
понадобится upstream-PR с пометкой MiniMax-M2.7 — это придётся обосновать
отдельно.

## 4. DFlash 2 — переработка speculative decoding

Серия коммитов:

```text
28fbe34c Dflash 2 speculative decoding (#2345)
2f068b5d dflash: use draft context as capacity contract (#2341)
ad26e68b Apply callback to extract features in spec (#2348)
66b2f50c Allow dspark to draft more than the amount of block size (#2323)
6831fa6d CUDA graphs improvements (#2316)
8337e4cd Fix Qwen35+ MTP (#2322)
```

Скоупы в файлах: `src/llama-spec-features-dflash.{cpp,h}` (+296), новые
вызовы в `src/llama.cpp` (+2 900 в общем diff, большая часть — model
machinery, не только DFlash). DSpark (#2304) — новый draft-бэкенд.

**Для MiniMax-M2.7 Step0**: DFlash 2 пока не планировался, см.
`analysis-2-bytes-per-token.md` и `step0/MINIMAX_TARGET_RUNBOOK.md` —
speculative decoding не входит в baseline grid. Но если позже появится
задача ускорить TG без сжатия модели — это самый свежий кандидат.

## 5. Quant

- `64109a4d vulkan: add IQ4_KS and IQ4_KT support (#2332)` — Vulkan.
- `d180050f cuda: repair the HIP build, and validate IQ4_KS and IQ4_KT on
  RDNA3 (#2339)` — HIP/CUDA path.
- `c013cd87 Do not quantize integer tensors (#2246)` — квант-пайплайн.
- `7cff686d Quantization fudge factors (#2361)` — общая подстройка точности.
  Может сдвинуть quality gate на уже размеченных MiniMax-M3/M2.7 прогонах
  `[UNVERIFIED]`. **Рекомендация:** при включении нового upstream-бампa в
  `feature/minimax-step0-readiness` сначала повторить perplexity smoke на
  лёгкой модели (Qwen3-Coder-30B-A3B), и только потом — на MiniMax.
- `b37189aa Actually fix quantized indexer cache on CUDA (#2286)` —
  отменяет временный `96938a10 Disable quantized indexer cache (#2236)`.
  История: ломали → починили. Стоит знать, чтобы не упираться в старый
  workaround.

## 6. Прочее, что может задеть Step0 / Step0 handoff

- `b8b3034b Indexer topk: on the CPU repack Q8_0 indexer cache (#2285)` —
  см. §2.
- `08b500b9 ggml: fix HC_POST single-token CPU chunk count (#2357)` — CPU
  kernel fix, релевантен к AVX2/AVX-512.
- `d206417c server: fix prompt re-use with --reasoning-tokens none (#2353)` —
  парсер; не критично для Step0.
- `73ad1626 rpc: fix crash running GLM-5.2 (glm-dsa) split over RPC (#2360)` —
  RPC; не критично для CPU-only MiniMax-M2.7.
- `850320be metal: initialize encode_async in ggml_backend_metal_init
  (#2334)` — Metal; вне скоупа CPU-only Ryzen.
- `1d76336e fix(server): capture all server log sinks in --log-file, gated
  on explicit flag (#2313)` — server logging; не критично для Step0.
- `97370e3f chat: fix multi-argument tool calls for tagged templates
  (#2351)` — парсер; вне Step0.
- `0ed847d3 Adaptive P Sampler: Quality Control (#2337)` — sampling; вне
  Step0.

## 7. Активность upstream по авторам (843de95f..upstream/main)

```text
   62  Iwan Kawrakow
   23  Joel Farthing
   17  Samuel Oliveira Alves        (DFlash 2)
    5  Nexesenex
    3  Yap Sok Ann
    3  mb8565
    2  Guy Barel
    2  ShubhamPriyadarshi
    2  Thireus
    2  replikeit
```

Headline-контрибьюторы — Kawrakow + Farthing. Это объясняет, почему
выбор архитектуры (`--defer-ple` вместо RTR auto) — скорее сознательное
upstream-решение, а не случайность.

## 8. Что это значит для собственных веток

### 8.1 `feature/rtr-auto-pr-prep` (PR #1738)

Два варианта:

1. **Закрыть PR #1738** как deprioritized и заархивировать ветку. Перед
   архивацией — синхронизировать с `upstream/main` (134 коммита), чтобы
   дальнейшие cherry-picks не тащили старые RTR auto слои.
2. **Переформулировать PR** в сторону узкого Q8_0 indexer cache repack
   (по сути, cherry-pick `#2285` + тесты). Плюс: меньше конфликт-зоны,
   вписывается в реальный upstream-выбор. Минус: меньше амбиции, чем
   `--run-time-repack auto`.

В обоих случаях:

- `src/llama-rtr-auto.h`, `src/llama-cgroup-resolver.h`,
  `tests/test-rtr-auto-peak.cpp`, `tests/test-rtr-params.cpp`,
  `tests/test-cgroup-resolver.cpp` — **должны быть удалены** при ближайшем
  ребейзе на `upstream/main` (или явно помечены как fork-only).
- Followup-документы в `docs/` (`RTR_AUTO_PR_FOLLOWUP_*`) утратили
  актуальность; их судьба — отдельное решение.

### 8.2 `feature/minimax-step0-readiness` (Step0 baseline)

Минимальные действия до запуска на целевой машине:

1. **Добавить `--defer-ple` в baseline grid** `step0/MINIMAX_TARGET_RUNBOOK.md`.
   Это бесплатный выигрыш: без runtime-repack, без CUDA-k-quant incompatibility.
   Тестировать как один из параметров наряду с `-ngl`, `-np`, `--cpu-moe`.
2. **Сверять quant-сценарии** (`step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md`)
   с новыми IQ4_KS / IQ4_KT, если они релевантны для MiniMax-M2.7 на
   AMD-цели `[UNVERIFIED — IQ4_KS/KT для CPU-Ryzen в этом PR не валидировался]`.
3. **Повторить perplexity smoke** на лёгкой модели после каждого upstream-бампа
   (см. `analysis-3 §правило валидации`). Quantization fudge factors (#2361)
   могут сдвинуть quality gate.
4. **DFlash 2** в Step0 не добавлять — это вне scope baseline. Но зафиксировать
   awareness: если в `analysis-2` или `analysis-5` появится задача spec
   decoding, отправная точка — `#2345` + `#2341` + `#2348`, не DFlash v1.
5. **Решить, синхронизировать ли `feature/minimax-step0-readiness` с
   `upstream/main`.** Текущий `HEAD` (3a24458a) — 30 коммитов впереди
   `feature/rtr-auto-pr-prep`, который, в свою очередь, на 134 позади
   upstream. Merge upstream → minimax в принципе не требуется до завершения
   Step0 baseline (см. `00-INDEX.md §⚠️ Главный гейт`). Решение — отдельное.

## 9. Что я НЕ проверил `[UNVERIFIED]`

- Семантику `--defer-ple` end-to-end (на какой стадии loader, влияние на
  perplexity при длинном контексте, поведение с split-mode graph). Проверяется
  только реальным прогоном, не из diff.
- Влияние Quantization fudge factors (#2361) на MiniMax-M3 / MiniMax-M2.7
  quality gate.
- Судьбу `tests/test-compare-llama-bench.py` — переехал ли он в `tools/`
  или просто удалён. Влияние на `step0-bench.ps1` неизвестно без чтения
  скрипта.
- `git diff --shortstat 843de95f..upstream/main` не считал; число
  `+23 035 / -4 501` — по `git diff --stat` с дефолтным
  `diff.renames=true`. Если в upstream были mass-renames, числа отличаются.

## 10. Рекомендации (в порядке убывания срочности)

1. **Принять решение по PR #1738** (закрыть / переформулировать) до того,
   как токены будут потрачены на очередную итерацию по отзывам upstream
   ревьюеров, которые уже неактуальны.
2. **Добавить `--defer-ple` в Step0 baseline grid** в `MINIMAX_TARGET_RUNBOOK.md`.
3. **Решить, делать ли rebase `feature/minimax-step0-readiness` на
   `upstream/main` сейчас или после Step0 baseline.** Аргументы за «сейчас»:
   устойчивость к API drift. Против: расширение diff и рост риска Step0
   harness regression.
4. **Залогировать этот снапшот** (`docs/superpowers/specs/analysis-8-...md`)
   в `00-INDEX.md`, чтобы будущий агент/человек мог быстро сверить
   актуальность собственных планов против upstream main.

---

**Связанные документы:**

- `analysis-3-step0-measurements.md` — baseline playbook
- `analysis-6-fork-branch-opportunities.md` — fork-branch audit
- `analysis-7-branch-solution-projection.md` — external-branch solution map
- `step0/MINIMAX_TARGET_RUNBOOK.md` — Step0 runbook
- `step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md` — metrics spec
- `FORK_WORKFLOW.md` (на `origin/main`) — branch map
