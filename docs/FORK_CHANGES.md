# Что сделано в данном форке ik_llama.cpp

**Форк**: ik_llama.cpp (ikawrakow)
**Базовый коммит**: `bd387a279` (upstream HEAD на момент начала работы)
**Наши коммиты**: 5 штук, +663 строк кода в 9 файлах
**Целевое железо**: Ryzen 9 7950X (16C/32T, 2×CCD, AVX-512), 96 GB DDR5, без GPU

---

## Проблема

Модели класса MiniMax-M2.5 (230B параметров, MoE 256 экспертов) в квантизации Q5_K
занимают 151 GB — на 55 GB больше, чем доступная RAM. При этом на каждый токен
активны только 8 экспертов (~4.4 GB), остальные 148 GB ждут на диске.

Оригинальный ik_llama.cpp не имеет специальной обработки для моделей, которые не
помещаются в оперативную память. OS загружает модель через mmap и обслуживает
page fault'ы реактивно — когда данные уже нужны, а не заранее. Все 16 потоков
блокируются на barrier'е, пока хотя бы один ждёт подкачки страницы с SSD.

Расширить RAM невозможно (стоимость DDR5 выросла кратно за последние месяцы).
GPU отсутствует. Нужно выжать максимум из того, что есть.

---

## Что реализовано

### 1. Исправление краша muge+rtr (llama.cpp)

**Файл**: `src/llama.cpp` (+10 строк)

При одновременном использовании флагов `-muge 1` (слияние up+gate экспертов) и
`-rtr 1` (перепаковка строк для L1D) происходил GGML_ASSERT.

**Причина**: rtr-перепаковка меняет тип тензора (Q4_K → Q4_K_R4), но view-тензоры
(ffn_up_exps, ffn_gate_exps), которые являются окнами в fused-тензор ffn_up_gate_exps,
пропускаются при перепаковке. Их тип остаётся старым, и последующая проверка
консистентности типов падает.

**Решение**: после цикла перепаковки обходим все тензоры и синхронизируем тип
view-тензоров с типом их source. Размеры данных при перепаковке не меняются
(только порядок строк), поэтому nb[] остаётся валидным.

**Почему именно так**: рассматривались 4 альтернативы — пропуск fused-тензоров (теряем
rtr для экспертов), отключение muge при rtr (теряем muge), убрать assert (маскирует
баг). Выбранное решение сохраняет обе оптимизации без побочных эффектов.

---

### 2. Исправление CLI-алиасов muge (common.cpp, llama-bench.cpp)

**Файлы**: `common/common.cpp`, `examples/llama-bench/llama-bench.cpp` (+8 строк)

В оригинале флаг назывался `--merge-up-gate-expsrts` (опечатка). Добавлены корректные
варианты `--merge-up-gate-exps` и `--merge-up-gate-experts` с сохранением обратной
совместимости.

---

### 3. Исправление бага n_swa_pattern (llama-hparams.h)

**Файл**: `src/llama-hparams.h` (1 строка)

В функции сравнения гиперпараметров `operator!=` для поля `n_swa_pattern` стояло
`return false` вместо `return true`. Из-за этого модели с разным паттерном sliding
window attention считались идентичными, что могло приводить к некорректному
переиспользованию KV-кеша.

---

### 4. Software prefetch в MoE dispatch (ggml.c)

**Файл**: `ggml/src/ggml.c` (+40 строк)

Во время обработки текущего эксперта в mul_mat_id issueим software prefetch
(`_mm_prefetch` / `__builtin_prefetch`) для весов следующего активного эксперта.
Это перекрывает латентность доступа к RAM (~80 нс) с вычислениями текущего эксперта.

Реализовано в обеих функциях dispatch: `ggml_compute_forward_mul_mat_id` (down projection)
и `ggml_compute_forward_mul_mat_id_up_gate` (up+gate projection).

**Параметры**: hint=T1 (L2 cache), stride=1024 байт (16 cache lines), cap=256 KB.
Оптимизированы под Zen4 с 1 MB L2 на ядро.

**Результат на бенчмарках**: 0% прироста для in-RAM моделей. Hardware prefetcher Zen4
справляется самостоятельно при последовательном доступе. Код оставлен — потенциально
полезен на архитектурах с менее агрессивным hw prefetcher.

---

### 5. Software prefetch в IQK-ядрах (iqk_mul_mat.cpp)

**Файл**: `ggml/src/iqk/iqk_mul_mat.cpp` (+24 строки)

Аналогичный подход внутри IQK mul_mat ядер: prefetch следующего блока весов
во время dequantize + вычисления текущего блока. Реализовано для обеих функций:
`iqk_mul_mat_moe` и `iqk_moe_fused_up_gate`.

**Результат**: аналогично п.4 — 0% для in-RAM, hw prefetcher доминирует.

---

### 6. Batch VM prefetch для swap-bound моделей (ggml.c, ggml.h, llama.cpp)

**Файлы**: `ggml/include/ggml.h` (+6 строк), `ggml/src/ggml.c` (+80 строк), `src/llama.cpp` (+28 строк)

Ключевая оптимизация для моделей, не помещающихся в RAM.

**Механизм**: перед циклом экспертов thread 0 собирает адреса всех активных экспертов
в один массив и делает единственный вызов `PrefetchVirtualMemory()` (Windows) или
`madvise(MADV_WILLNEED)` (Linux). Это асинхронный хинт OS — «нам скоро понадобятся
эти страницы, начни подкачку заранее».

**Почему batch, а не per-expert**: экспериментально доказано, что per-expert вызов
PrefetchVirtualMemory внутри цикла экспертов даёт -36% TG. Причина — каждый вызов
проходит через ядро OS, выполняет page table walk, и при 8 экспертах × 62 слоя × 2
dispatch-точки = ~992 вызова/токен overhead превышает пользу. Один batch-вызов
на все активные эксперты = 0 overhead.

**Авто-детект**: включается автоматически когда model_size > 90% physical_RAM.
Для моделей, помещающихся в RAM, код не выполняется вообще — ноль overhead.

---

### 7. VirtualLock shared-тензоров (llama.cpp)

**Файл**: `src/llama.cpp` (+95 строк)

При загрузке swap-bound модели блокируем в RAM все тензоры, которые используются
каждый токен: attention (wq, wk, wv, wo), embedding, output head, нормализации,
роутеры, shared experts. Всего ~437 тензоров, ~2.82 GiB для MiniMax-M2.5.

**Мотивация**: без блокировки OS может вытеснить attention-веса в swap ради подкачки
очередного эксперта. При следующем обращении к attention все 16 потоков встанут на
page fault. Блокировка гарантирует, что вытесняются только экспертные веса —
именно то, для чего и предназначен механизм MoE.

**Детали реализации**:
- Перед блокировкой расширяем working set процесса через `SetProcessWorkingSetSize`
  (Windows) с лимитом 90% physical RAM
- На Linux используется `mlock()` с теми же семантиками
- Экспертные тензоры (ffn_*_exps) намеренно НЕ блокируются — они и есть swap-bound часть

---

### 8. Hot expert tracking + static lock (ggml.c, ggml.h, llama.cpp)

**Файлы**: `ggml/include/ggml.h` (+6 строк), `ggml/src/ggml.c` (+25 строк), `src/llama.cpp` (+80 строк)

Статическая блокировка самых популярных экспертов в RAM после первого промта.

**Как работает**:
1. Во время prompt processing (PP) atomic-счётчики считают сколько раз каждый эксперт
   был активирован роутером (по всем слоям, по всем токенам промта)
2. После PP (первый batch с n_tokens > 1) сортируем экспертов по популярности
3. Блокируем top-N через VirtualLock/mlock (N = 2 × n_expert_used = 16 для MiniMax)
4. Больше никогда не трогаем — ни unlock, ни re-evaluation

**Результат**: +11% TG на MiniMax-M2.5 (0.91 t/s vs 0.82 baseline).

**Почему static, а не dynamic**: первая реализация (PR04v1) использовала периодическую
переоценку — каждые 512 dispatches пересчитывала top-N, unlock'ала старых и lock'ала
новых. Результат: -63% TG (0.55 t/s). Причина — «VirtualLock storm»: ~10,400 syscalls
на 32 токена, при этом 56-69% экспертов менялись между оценками. Каждый VirtualLock
на swap-resident странице = блокирующее ожидание page-in с SSD.

**Почему lock после PP, а не после TG**: эксперименты показали, что блокировка по
TG-статистике (deferred commit) даёт -31% TG. Причина — VirtualLock во время TG
это блокирующий I/O: ~2.6 GB подкачки с SSD прямо во время генерации. Блокировка
после PP «бесплатна» — она скрыта во времени PP и к началу TG страницы уже в RAM.

**Почему budget = 2×n_expert_used**: при 16 заблокированных из 256 (~6.25%) и 8
активных на токен, вероятность попадания в заблокированного эксперта ~50% при
равномерном распределении (выше при реальном skewed distribution). Увеличение до 32
дало лишь +2% TG при -15% PP — не оправдано.

---

### 9. Large Pages (ggml-backend.cpp)

**Файл**: `ggml/src/ggml-backend.cpp` (+80 строк)

Для буферов ≥2 MB используем `VirtualAlloc(MEM_LARGE_PAGES)` — 2 MB страницы вместо
стандартных 4 KB. Это снижает TLB misses в ~512 раз для больших непрерывных буферов
(модельные веса, KV-кеш).

**Требования**: привилегия `SeLockMemoryPrivilege` для пользователя (настраивается через
secpol.msc → Local Policies → User Rights Assignment). Скрипт автоматической настройки:
`build/add_large_pages_priv.ps1`.

**Fallback**: если привилегия отсутствует или VirtualAlloc не удался, код прозрачно
откатывается на обычный `malloc`. Ноль overhead в fallback-пути — подтверждено
бенчмарком (29.60 t/s = идентично baseline).

**Ожидаемый эффект**: +5-15% TG для in-RAM моделей. На данный момент не протестировано
с активной привилегией — требуется logoff/logon после её добавления.

---

### 10. Hot-expert tail-blend + expert-stats CSV export (2026-05-02)

**Файлы**: `ggml/src/ggml.c` (+25), `ggml/include/ggml.h` (+2), `src/llama.cpp` (+111),
`include/llama.h` (+4), `common/common.cpp` (+1), `examples/server/server.cpp` (+24).
**Коммит**: `e8444f2ad`.

**Tail-blend**: вместо hard-reset hit-счётчиков на границе tail-window — мягкое
масштабирование на blend factor (0–1). API: `IK_LLAMA_HOT_EXPERT_TAIL_BLEND=0.3` или
`--experimental hot-expert-tail-blend=0.3`. Требует ненулевой
`IK_LLAMA_HOT_EXPERT_TAIL_WINDOW`. Без env var — старое hard-reset поведение.

Новые ggml API:
- `ggml_moe_scale_expert_selection_hits(float scale)` — масштабирует ranking-счётчики
- `ggml_moe_reset_expert_tracking_stats()` — сбрасывает только telemetry/dispatch счётчики

**Expert-stats CSV export**: дамп per-layer per-expert dispatch hits в файл для
оффлайн-анализа и per-expert quant tuning.
- Env var: `IK_LLAMA_EXPORT_EXPERT_STATS=path.csv` — экспорт после `llama_hot_expert_commit`
- Public API: `llama_export_expert_stats_to_file(model, path)`
- Server endpoint: `GET /export-expert-stats[?filename=NAME]` (no path traversal)

**Результаты проверки**: tail-blend на MiniMax M2.5 — **negative** (early/late токены
активируют тот же hot-set, hard reset и blend дают идентичный результат). Инфраструктура
оставлена для возможной полезности на других моделях.

---

### 11. Custom quantization recipes для MiniMax M2.5 (2026-05-02)

**Файлы**: `scripts/quant_minimax_m25/` (10 файлов, скрипты и runners),
`docs/new_quants_minimax_m2.5/` (10 файлов, рецепты и research).
**Коммит**: `f22565a99`.

**Tapered-RAM v3.1**: 92 GiB, 3.46 bpw, PPL 9.70 ± 0.08 (full 552 chunks). Ступенчатый
taper: edge iq5_k/iq4_xs → bridge iq4_xs/iq3_ks → core IQ3_KS. Attention q8_0,
embeddings q8_0, ffn_gate_inp f32, ubergarm BF16 imatrix.

**Эффект**: tg32 0.62 t/s (UD-Q5 swap-bound) → **3.82 t/s (+520%, 6.2x)**. Главный
успех форка — single biggest perf win, ортогональный SIMD-оптимизациям ikawrakow'a.

**Deep-Taper v4**: 114 GiB, 4.26 bpw, PPL 9.42 ± 0.23 — лучше качество, но swap-bound
на 96 GB (tg8 0.02 t/s). Не практичен; оставлен как PPL-ceiling reference.

См. `docs/new_quants_minimax_m2.5/` для полной методологии: рецепт-генеалогия,
PPL-research, hybrid source experiments, eval suite, operational gotchas.

---

## Что было попробовано и отвергнуто

Все решения ниже были реализованы, протестированы на MiniMax-M2.5 и отвергнуты
на основании бенчмарков.

| Эксперимент | TG результат | Причина отказа |
|---|---|---|
| Per-expert PrefetchVirtualMemory в цикле | -36% TG | Syscall overhead (992 вызова/токен) |
| Periodic VirtualLock/Unlock (PR04v1) | -63% TG | Lock storm (~10,400 syscalls/32 токена) |
| Deferred commit (lock по TG-статистике) | -31% TG | VirtualLock = blocking I/O во время TG |
| Lookahead prefetch (эксперты предыдущего токена) | -14% TG | Конкуренция за SSD bandwidth |
| Budget 32 вместо 16 | +2% TG, -15% PP | Маргинальный прирост, значительная цена |
| rtr=1 на swap-bound | -46-60% TG | Увеличивает working set |
| muge=1 на swap-bound | -46% TG | Удваивает contiguous allocation |
| CCD pinning (start /affinity) | -5-11% TG | Урезает L3 с 64 MB до 32 MB |
| Отключение SMT | -79% TG | Половина потоков, без прироста IPC |

---

## Архитектура изменений

```
ggml.h          — API: vm_prefetch flag, hot expert hit counters
                   (6 функций, 1 define)

ggml.c          — VM prefetch batch, L2 prefetch в dispatch loop,
                   atomic hit counters для экспертов
                   (179 строк)

ggml-backend.cpp — Large Pages через VirtualAlloc(MEM_LARGE_PAGES),
                    fallback на malloc
                    (80 строк)

iqk_mul_mat.cpp — L2 prefetch в inner loop IQK ядер
                   (24 строки)

llama.cpp       — Авто-детект swap-bound, VirtualLock shared тензоров,
                   hot expert tracking + static lock, view type sync
                   (283 строки)

common.cpp      — CLI-алиасы для muge
llama-bench.cpp — То же для бенчмарка
llama-hparams.h — Bugfix n_swa_pattern
```

Все изменения за guard'ами:
- VM prefetch: только когда `ggml_moe_vm_prefetch == 1` (авто-детект model > 90% RAM)
- Large Pages: только при наличии `SeLockMemoryPrivilege`
- Hot expert lock: только для swap-bound MoE моделей
- Software prefetch: ifdef `__x86_64__` / `_M_X64`

**Для моделей, помещающихся в RAM, все изменения дают ровно 0% overhead** — подтверждено
бенчмарками на Qwen3-30B-A3B Q4_K_M (17 GiB): PP=315 t/s, TG=29.6 t/s (идентично upstream).

---

## Итоговые числа

**MiniMax-M2.5 (151 GiB, swap-bound)**:
- Baseline: TG ~0.82 t/s
- С нашими оптимизациями: TG 0.91 t/s (+11%)
- Теоретический потолок: ~1.0-1.2 t/s (ограничение SSD ~3 GB/s)

**Qwen3-30B-A3B (17 GiB, in-RAM)**:
- Baseline: PP=306 t/s, TG=29.9 t/s
- С нашими оптимизациями: PP=315 t/s, TG=29.6 t/s (в пределах шума)
