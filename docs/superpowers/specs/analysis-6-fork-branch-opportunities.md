# Анализ 6 — возможности из других веток форка

**Дата аудита:** 2026-07-19
**Scope:** только refs `origin/*` данного форка. Это не аудит `upstream` и не
рекомендация сливать какие-либо ветки целиком.

## Цель

Проверить, не была ли в других ветках уже начата работа по найденным направлениям
ускорения MiniMax-M2.7 на Ryzen 9 7950X / 96 GB: locality экспертов, prefetch,
сокращение bytes/token, offline layout и CPU kernels. Результат должен помочь
выбрать малый переносимый кандидат после ШАГ 0 и routing trace, а не заменить эти
измерения.

## Краткий вывод

В форке есть одна практически релевантная, но крупно разошедшаяся серия **Hot
Experts / paging**. Она реализует статический PP-derived выбор горячих экспертов,
lock/prefetch и экспорт статистики. Это полезный источник кода и экспериментов,
но **не** реализация previous-token prefetch или управляемого slab cache.

Остальные направления либо уже интегрированы в HEAD, либо являются историческими
экспериментами. Готовой реализации predictive selective residency, true
previous-token prefetch, per-expert tiered quantization, slab cache либо
SMT/CCD-pinning в `origin/*` не найдено.

## 1. Hot Experts / paging — основной кандидат для точечного переноса

### Где находится

Опорная ветка: `origin/safety/pre-upstream-merge-2026-05-02`, tip
`e8444f2ad8bee4cd33c7f429c77ef492be0e8e77`
(`Feature: hot-expert tail-blend + expert-stats CSV export`). Серия также
содержится в:

- `origin/dev`;
- `origin/feature/raptor-lake-laptop`;
- `origin/feature/rtr-auto-v2`;
- `origin/milestone/upstream-sync-2026-05-02`.

Ключевые коммиты серии: `3e92b6b3`, `d161b85a`, `17fea126`, `bbd28eaa`,
`638e9c5f`, `b6046155`, `29e4fa3f`, `1b6514ec`, `e8444f2a`.

На дату аудита серия **не входит** в текущую ветку
`feature/rtr-auto-review-fixes`; расхождение с её tip: текущая ветка имеет 219
уникальных коммитов, серия — 77. Поэтому merge всей ветки создаст неоправданный
конфликтный и продуктовый риск.

### Что реализовано

- PP routing statistics per-layer/per-expert;
- однократный статический выбор top-N hot experts и их lock через
  `VirtualLock`/`mlock`;
- pin shared/dense/router tensors и первоочередная диспетчеризация locked
  experts;
- VM-prefetch активных экспертов: `PrefetchVirtualMemory` на Windows,
  `madvise(..., MADV_WILLNEED)` на Linux;
- CSV/public API/server endpoint для статистики:
  `IK_LLAMA_EXPORT_EXPERT_STATS=path.csv`,
  `llama_export_expert_stats_to_file(...)`,
  `GET /export-expert-stats`;
- experimental policy `IK_LLAMA_HOT_EXPERT_SELECTION=tail-window`,
  `IK_LLAMA_HOT_EXPERT_TAIL_WINDOW` и поздний tail-blend.

Это **static PP-derived hot set плюс prefetch текущего active dispatch**. Это не
предсказание следующего токена: для ранних MoE-слоёв необходимого lead time оно
не даёт. Динамические lock/unlock в этой линии сознательно не использованы из-за
blocking I/O и lock storm.

### Имеющиеся evidence и ограничения

Полезные первичные заметки в этой линии:

```text
project_docs/benchmarks/current/MINIMAX_HOT_EXPERT_LONGRUN_2026-03-01.md
project_docs/benchmarks/current/MINIMAX_HOT_EXPERT_BUDGET_QUICKCHECK_2026-02-28.md
project_docs/benchmarks/current/MINIMAX_LOCALITY_TAIL_WINDOW_2026-03-02.md
project_docs/research/weighted-hot-experts/RUNTIME_ANALYSIS.md
project_docs/models/MINIMAX_M2_5_RUNTIME.md
```

Описанные там замеры на близкой конфигурации (Ryzen 9 7950X, 96 GB, Windows,
MiniMax M2.5) показывают, что budget 16 обошёл 24/32 на mixed `pp32+tg4`; 32
выигрывал только standalone TG32. Для tail-window=16 отмечены примерно `+1.21%`
на `pp32+tg4` и `-1.61%` на TG128. Это **research-only evidence**, не основание
делать policy default и не переносимое без A/B на MiniMax M2.7.

### Решение

После baseline/trace создать отдельную рабочую ветку
`feature/minimax-hot-experts-port` и переносить только изолированные части после
code review:

1. сначала export routing stats как инструмент измерения;
2. затем статический budget/pin как отдельный A/B experiment;
3. только при доказанной locality — VM-prefetch;
4. мерить latency, physical I/O, locked bytes и качество; добавить строгий
   budget и безопасную деградацию при ошибке lock/prefetch.

Не переносить dashboard, benchmark artefacts, docs и несвязанные изменения из
ветки-донора. Не смешивать это с будущим previous-token prefetch: это две разные
гипотезы с разными источниками истины.

## 2. SER и routing

Исторические refs: `origin/ik/smart_expert_selection` (tip `8e612d50`),
`origin/ik/fix_ser`, `origin/ik/fix_ser_cuda`.

В текущем HEAD `-ser` разбирается, но сам вызов SER в
`src/llama-build-context.cpp` закомментирован и заменён `ggml_top_k`; следовательно
SER фактически no-op. Возврат нельзя свести к переносу старого коммита: нужны
correctness tests, quality gate, baseline и новый routing trace после каждого
режима. CPU/CUDA fused top-k из этих линий в основном уже исторически интегрирован;
CUDA routing не решает paging bottleneck CPU-only MiniMax. Grouped routing из
отдельных веток относится к `BAILINGMOE2`, а не к MiniMax, поэтому не является
кандидатом для этой задачи.

## 3. Offline artifact, fused gate/up, Zen4 и KV

Исторические ветки `origin/ik/offline_repack`,
`origin/ik/offline_repack_patterns`, `origin/ik/repack_also_experts`,
`origin/ik/merge_up_gate_exps_3`, `origin/ik/r4_faster_zen4`,
`origin/ik/avx2_r4_tweaks`, `origin/ik/zen4_repack_f16` и связанные KV-ветки
не являются кандидатами на прямой перенос: значимая функциональность уже есть в
текущем дереве — `llama-quantize --repack`, `--repack-pattern`, runtime `-muge`,
R4/R8/Zen4 paths и KV types `-ctk`/`-ctv`.

Для целевой модели важен не runtime вариант: `-rtr` и `-muge` отключают mmap и
для artifact > RAM ведут к OOM/swap. Правильный эксперимент — заранее создать
offline `_R4` и fused gate/up GGUF, затем загружать его mmap без `-rtr`/`-muge`.

## 4. CPU-only MoE

`origin/ik/cpu_moe_tg` (tip `6944e7e68d4c1f8be189d1772266da99b225e24a`,
`This is slightly better for CPU-only inference`) содержит компактный
special fast fused up/gate path для TG с одним токеном, применимый когда число
потоков делится на число экспертов. Это отдельный low-level кандидат: возможен
ручной port и benchmark на resident/compute-bound фазе. Он не уменьшает
SSD paging и не должен опережать измерение bottleneck.

## 5. Что пока отсутствует и остаётся нашим планом

В `origin/*` не найдено готового кода для:

- true previous-token expert prefetch с послойным lead time и bounded inflight
  bytes;
- explicit slab cache с контролируемыми residency, eviction и queue depth;
- predictive selective residency;
- полноценной per-expert tiered quantization;
- SMT/CCD affinity/pinning policy.

Следовательно, реализованные `--moe-trace` и offline cache simulator остаются
правильной следующей точкой: они скажут, есть ли locality и какой из этих новых
проектов имеет шанс дать выигрыш. Симулятор лишь приоритизирует работу; скорость,
physical I/O и качество подтвердит только настоящий A/B run на M2.7.

## Практический порядок

1. Выполнить ШАГ 0 на целевом железе и снять MiniMax routing trace.
2. Прогнать cache simulation и оценить hot-set / previous-token recall.
3. Если hot-set стабилен, точечно перенести export stats и static hot-expert
   experiment в отдельную ветку.
4. Если previous-token recall достаточен, предпочесть новый bounded
   previous-token prefetch prototype: у него больше потенциальный lead time.
5. Переходить к SER/top-k/pruning только с real retrace и quality gate.
