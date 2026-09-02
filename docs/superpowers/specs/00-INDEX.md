# 00 — ИНДЕКС: ускорение MoE-инференса MiniMax M2.7 (CPU-only, ik_llama.cpp)

Набор спеков по ускорению инференса форка. Все находки привязаны к коду по `file:line`; недоказуемое помечено `[UNVERIFIED]`.

## Контекст задачи
- Модель **~110 GB** > RAM **96 GB** → весь artifact вместе с OS/KV/runtime не
  может быть резидентен; какой объём экспертов реально перечитывается с SSD,
  должен показать Step0.
- Наблюдаемая скорость: **~1.5–2 t/s**. `~4.9 GB/токен` — оценка
  **логически затрагиваемых** активных весов, а не доказанное чтение с SSD.
  Проверка единиц: `4.9 GB / 3.5 GB/s = 1.4 s/token = 0.71 t/s`, поэтому
  прежнее совпадение с 1.5–2 t/s было арифметической ошибкой.
- Кванты на пределе, RAM разогнана максимально → ищем выигрыш в **софте/модели**.

## ⚠️ Главный гейт перед любой реализацией
**Сначала `analysis-3` (ШАГ 0).** Измерь физические GB/токен с диска и
достигнутую полосу RAM. `phys_gen_bytes_per_tok` — лучший текущий device-level
estimator mmap-трафика, но не per-process ground truth: он включает весь диск,
имеет дискретизацию ~1 с и пока реконструирует границы decode. Нужны повторы,
raw samples, sensitivity 20/30/40%, тихий диск/pagefile и по возможности ETW.
Только после этого решать, сколько времени реально теряется на SSD, RAM и CPU.

## Файлы (порядок чтения)

| # | Файл | О чём | Ключевой рычаг |
|---|------|-------|----------------|
| 0 | `2025-moe-ssd-inference-speedup.md` | Головной спек + блок ПОПРАВОК | обзор + что устарело |
| 1 | `analysis-3-step0-measurements.md` | **Измерительный плейбук — начать здесь** | PowerShell-скрипты, disk/RAM/GGUF замеры |
| 2 | `analysis-5-creative-disk-bound.md` | **Творческие решения при неустранимой disk-bound** | 8 решений, от №1 «сегодня» до прунинга |
| 3 | `analysis-2-bytes-per-token.md` | Обрезка bytes/token | прунинг экспертов, `-ser`, tiered-quant |
| 4 | `analysis-1-prefetch-design.md` | Асинхронный префетч экспертов с SSD | спрятать I/O-латентность |
| 5 | `analysis-4-adjacent-kv-cpu.md` | Смежные направления | KV-cache, CPU-специфика |
| 6 | `analysis-6-fork-branch-opportunities.md` | Аудит других веток форка | Hot Experts/paging, SER, CPU-кандидаты |
| 7 | `analysis-7-branch-solution-projection.md` | Карта решений из сторонних веток | что переносить, что отложить, какие гейты |
| 8 | `analysis-8-upstream-snapshot-2026-08-31.md` | Снапшот `upstream/main` от 2026-08-31 | судьба PR #1738, `--defer-ple`, DFlash 2, IQ4_KS/KT |
| 9 | `analysis-9-upstream-merge-recipe-2026-09-03.md` | Готовый рецепт слияния upstream в форк | rebase rtr-pr → merge minimax, конфликты, gates, rollback |
| 9a | `analysis-10-upstream-deep-dive-2026-09-03.md` | Углублённая верификация в коде upstream | `--defer-ple` Linux-only, RTR auto полное удаление, IQ4_KS/KT без CPU, risk classification 134 коммитов |
| 10 | `step0/MINIMAX_TARGET_RUNBOOK.md` | Исполняемый runbook целевой машины | baseline → trace → simulator → decision gate |
| 11 | `step0/NEXT_AGENT_PROMPT.md` | Copy/paste handoff для другой машины | безопасный старт без истории чата |
| 12 | `step0/MINIMAX_READINESS_REVIEW_2026-07-21.md` | Финальное ревью готовности | найденные фиксы, тесты и границы GO |
| 13 | `step0/MINIMAX_METRICS_PACKAGE_SPEC_2026-07-22.md` | Расширенный пакет метрик | authoritative, token timing, ETW, routing locality |
| 14 | `step0/MINIMAX_METRICS_IMPLEMENTATION_REVIEW_2026-07-22.md` | Ревью реализации метрик | сделанное, проверки, target-only gates |

## Подтверждённые факты (grounded в дереве форка)
1. **`-ser` неактивен в HEAD** — `ggml_top_k_thresh` только объявление + определение + один закомментированный вызов; безопасное возвращение требует отдельной ветки, correctness-тестов и benchmark, а не простого uncomment.
2. **Per-expert tiered-quant невыразим** — эксперты слоя = один слитый 3D-тензор, единый тип; `--custom-q` даёт только per-layer гранулярность (`analysis-2` §2).
3. **`n_expert_used` переопределяется на рантайме** — цепочка `--override-kv` → `expert_used_count` → `hparams` → `ggml_top_k` подтверждена (`src/llama-arch.cpp:120`, `llama-hparams.cpp:73`, `llama-build-context.cpp:1091`).
4. **Runtime `-rtr` отключает mmap.** Для модели больше RAM это ведёт к полной
   загрузке/копированию и риску OOM/swap. Нужен offline `_R4` GGUF + mmap,
   **без `-rtr`**.
5. **Runtime `-muge` тоже отключает mmap.** Использовать заранее созданный
   `ffn_gate_up_exps`, а не runtime merge.
6. **Windows mmap large pages сейчас не реализованы:** `use_thp` игнорируется,
   `VirtualLock` только закрепляет обычные страницы.
7. **`expert_tensor_index` индексирует целые expert-тензоры**, не слабы
   `(layer, expert)`. Selective pin/cache требует нового per-expert range index.
8. **Eval callback даёт наблюдение, но не дешёвый production-trigger:** readback
   router IDs создаёт backend synchronization. Для первого прототипа приоритетен
   previous-token predictor, который не требует mid-graph readback.
9. **Baseline routing trace контрфактуален после вмешательства.** Он полезен для
   cache/prefetch и first-order logical-byte оценки, но top-k/SER/pruning требуют
   реального прогона и нового trace изменённого runtime.

## Рекомендованный порядок действий (по возрастанию затрат/риска)
1. **ШАГ 0 с контролями** (`analysis-3`) — baseline, physical I/O estimator,
   RAM BW, повторы и error bars.
2. **Routing trace + offline cache simulator — v1 реализован**
   (`tools/moe_cache_sim/README.md`): механический end-to-end smoke пройден на
   Qwen3-Coder-30B-A3B; следующий содержательный прогон — MiniMax. Это инструмент
   приоритизации, не обещание post-intervention скорости.
3. **Previous-token prefetch prototype** — сначала измерить Jaccard/byte recall,
   затем A/B physical I/O; выдавать запросы послойно с лимитом inflight bytes.
4. **Top-k 8→7→6 (затем 4 только как risk-case)** — каждый режим реально
   прогнать, заново снять trace и расширенный quality gate.
5. **SER** — после восстановления кода, сравнивать с fixed top-k при одинаковом
   среднем числе экспертов; также retrace.
6. **Только после данных:** selective pinning, explicit slab cache и pruning.
   Прунинг идти ступенями 224→208→192→176, а не сразу к 176.

## Правило валидации (для КАЖДОГО изменения)
Не ограничиваться одной PPL: domain-holdout (код/матан/tool-use/JSON,
мультиязык, long-context), aggregate removed routing mass, p95/p99/worst-domain,
gap rank `k/k+1`, logit-KL и top-1 token flips. Calibration и holdout разделять
по документам/сессиям. После каждого top-k/SER/pruning — новый реальный trace.

---

## Что достижимо на целевом железе (ПРОЕКЦИЯ, не замеры)

⚠️ **Это оценки, а не измерения.** Baseline ещё не снят (нет доступа к целевой
машине). Числа — диапазоны, подлежат замене/подтверждению после реального ШАГ 0
(`analysis-3` / `step0/step0-bench.ps1`).

Целевое железо: Ryzen 9 7950X, 96 ГБ DDR5, MiniMax-M2.7 ~110 ГБ, около
4.9 ГБ/токен логически активных весов, CPU-only.

**Сценарный RAM roofline короткого контекста:** ~65 ГБ/с ÷ 4.9 ГБ/токен
≈ 13 t/s теоретически. Это не жёсткий общий потолок: реальный mixed bpw, KV при
длинном контексте, compute и эффективность kernels снижают результат. Для
resident-модели рабочая проекция ниже — ~5–8 t/s; AVX-512 проверять A/B, AMX
для Ryzen неприменим.

| Тир | Вмешательство | Ожидаемо | Уверенность | Детали |
|---|---|---|---|---|
| 0 | сейчас, ничего | **1.5–2 t/s** | наблюдение пользователя | bottleneck ещё измеряется |
| 1 | offline `_R4`, AVX-512 A/B, threads/affinity | **~1.8–2.6 t/s** | средняя-низкая | без runtime `-rtr` |
| 2 | previous-token prefetch без снижения misses | **~2–3.2 t/s** | низкая | зависит от overlap и текущего QD |
| 3 | trace-guided pin/cache при хорошей locality | **~2.5–4 t/s** | низкая | до ~4–5 только при очень сильной locality |
| 4 | top-k=6 / top-k=4 | **~2–3.5 / ~3–5 t/s** | низкая | качество и cache regime могут измениться |
| 5 | модель реально помещена в RAM (целевой размер ~70–85 ГБ) | **~5–8 t/s** | средняя по физике, низкая по достижимости качества | оптимистично 9–10 |

**Выводы:**
- Для неизменённой 110-ГБ top-8 модели устойчивые **>4–5 t/s маловероятны**.
- **5–8 t/s** требуют реального fit-in-RAM; безопасная цель размера зависит от
  KV/context и составляет примерно **80–85 ГБ для короткого** и **70–80 ГБ для
  длинного контекста**.
- **>10 t/s** — экстремальный результат: fit-in-RAM плюс сокращение активных
  вычислений/байтов с подтверждённым quality trade-off.
- Общий риск-гейт: всё крупное (прунинг, top-k↓) разменивает качество → каждый
  шаг через расширенный quality suite и retrace, а не только perplexity.

---

## Апдейт (2026-07-18): smoke-тест харнесса ШАГ 0

Харнесс `step0/step0-bench.ps1` прогнан на маленькой модели — механика ОК и
`ReadTransferCount` удалён из ключевой метрики. Текущий `PhysicalDisk`-наклон —
полезный estimator, но ещё не ground truth: следующий шаг — явные timestamps
начала/конца decode, sensitivity transient fraction и ETW cross-check. Реальные
числа ждут целевой машины Ryzen9/96 ГБ + MiniMax-M2 (>RAM).
