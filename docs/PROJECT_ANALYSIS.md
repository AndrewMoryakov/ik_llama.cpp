# Анализ проекта: форк ik_llama.cpp

## Обзор

Данный репозиторий — форк [ikawrakow/ik_llama.cpp](https://github.com/ikawrakow/ik_llama.cpp/),
который сам является форком оригинального [ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp).

Цепочка наследования:

```
ggerganov/llama.cpp          — базовый инференс-движок
  └─ ikawrakow/ik_llama.cpp  — продвинутая квантизация, MoE-фьюзинг, SIMD-ядра
       └─ данный форк (dev)  — swap-aware memory management для MoE на CPU
```

**Целевое железо**: Ryzen 9 7950X (16C/32T), 96 GB DDR5, без GPU.
**Целевая модель**: MiniMax-M2.5 (230B, 256 MoE экспертов, 151 GB в Q5_K — не помещается в RAM).

---

## Часть 1. Что даёт ikawrakow/ik_llama.cpp (база)

ikawrakow оптимизировал **вычисления**: квантизация, GEMM-ядра, фьюзинг операций,
flash attention. Всё нижеописанное присутствует в [оригинальном репозитории](https://github.com/ikawrakow/ik_llama.cpp/)
и не является частью данного форка.

### 1.1. IQK — собственная система квантизации

Директория `ggml/src/iqk/` — 35+ файлов, ~1.8 MB кода. Полностью отсутствует в upstream llama.cpp.

**Ключевая идея**: при prompt processing (матрица × матрица) распаковка квантованных
весов стоит дорого. IQK переиспользует распакованные веса для нескольких колонок
входной матрицы вместо повторной распаковки. Результат: **+150–350% скорость prompt
processing** по сравнению с upstream llama.cpp.

**Архитектура dispatch'а:**

```
iqk_mul_mat()
  → MulMat::prepare(typeA, typeB) — выбор набора GEMM-ядер по типу квантизации
  → is_dequant_better(typeA, Ny)  — решение: распаковать в Q8 промежуточно?
  → mul_mat_NxM()                 — тайлинг (64 элемента по X), вызов kernel<Ny>
```

**GEMM-ядра** (hand-tuned AVX2/NEON/AVX-512):

| Файл | Типы | Размер |
|---|---|---|
| `iqk_gemm_kquants.cpp` | Q2_K..Q6_K, IQ4_XS | 247 KB |
| `iqk_gemm_iqk_quants.cpp` | IQ2_K..IQ6_K, IQ4_KS, IQ5_KS | 288 KB |
| `iqk_gemm_iquants.cpp` | IQ2_XXS, IQ2_XS, IQ3_XXS, IQ3_S, IQ2_S | 201 KB |
| `iqk_gemm_1bit.cpp` | IQ1_S, IQ1_M, IQ1_BN, IQ2_BN | 181 KB |
| `iqk_gemm_legacy_quants.cpp` | Q4_0, Q5_0, Q6_0, Q8_0, IQ4_NL, MXFP4 | 151 KB |
| `iqk_gemm_ktquants.cpp` | IQ1_KT..IQ4_KT (Trellis) | 126 KB |
| `iqk_gemm_floats.cpp` | F16, BF16, F32 | 45 KB |
| `iqk_quantize.cpp` | Квантизация/деквантизация всех типов | 412 KB |

### 1.2. Типы квантизации — 89 типов в enum ggml_type

| Семейство | Типы | Суть |
|---|---|---|
| **IQ\*_K** | IQ2_K, IQ2_KS, IQ2_KL, IQ3_K, IQ3_KS, IQ4_K, IQ4_KS, IQ4_KSS, IQ5_K, IQ5_KS, IQ6_K | K-block квантизация с importance matrix |
| **IQ\*_KT** (Trellis) | IQ1_KT, IQ2_KT, IQ3_KT, IQ4_KT | Trellis-кодирование — VQ с оптимальным codebook |
| **IQ\*_BN** | IQ1_BN, IQ2_BN | Binary normalized — тернарные значения {−1, 0, +1} |
| **MXFP4** | MXFP4 | Microsoft MX Format — block floating point 4-bit |
| **Q8_K варианты** | Q8_K16, Q8_K32, Q8_K64, Q8_K128, Q8_KV | Промежуточные форматы для flash attention |
| **_R4/_R8/_R16** | 28 типов | Row-tensor repack — перемежение строк для SIMD |

**Row-Tensor Repack** — фирменная инновация ikawrakow. Перемежение 4/8/16 строк
матрицы весов для оптимального использования SIMD-регистров и кэша CPU:

```
Стандартный layout:  row0 row0 row0 | row1 row1 row1 | row2 row2 row2 | row3 row3 row3
R4 layout:           row0 row1 row2 row3 | row0 row1 row2 row3 | row0 row1 row2 row3
```

### 1.3. MoE-оптимизации на уровне GGML

**Новые операции** (отсутствуют в upstream llama.cpp):

| Операция | Назначение |
|---|---|
| `GGML_OP_MOE_FUSED_UP_GATE` | Фьюзинг gate + up проекции + активация в одном ядре |
| `GGML_OP_FUSED_UP_GATE` | Standalone фьюзинг up+gate (не MoE) |
| `GGML_OP_FUSED_MUL_UNARY` | Умножение + unary активация (SiLU/GELU) |
| `GGML_OP_FUSED_RMS_NORM` | Fused RMS нормализация |
| `GGML_OP_ARGSORT_THRESH` | Сортировка с порогом для expert gating |
| `GGML_OP_GROUPED_TOPK` | Групповой top-K (для BailingMoeV2) |
| `GGML_OP_DELTA_NET` | Fused delta-net слой (state-space модели) |
| `GGML_OP_MULTI_ADD` | Batch-сложение нескольких тензоров |
| `GGML_OP_HADAMARD` | Поэлементное произведение Адамара |

**IQK MoE-ядра** (`iqk_mul_mat.h`):

- `iqk_mul_mat_moe()` — квантизованное умножение с expert routing
- `iqk_moe_fused_up_gate()` — fused up/gate с активацией в одном ядре
- `iqk_topk_moe()` — top-K отбор экспертов на квантизованных logits

**Merge Up+Gate Experts**: на этапе загрузки мержит `ffn_up_exps` + `ffn_gate_exps`
в один тензор, позволяя одним вызовом `moe_fused_up_gate` заменить два `mul_mat_id`.

### 1.4. Flash Attention с квантизацией

Директория `ggml/src/iqk/fa/` — 8 ядер, специализированных по размеру голов:
64×64, 96×96, 128×128, 192×128, 192×192, 256×256, 576×512.

Работает **напрямую с квантизованными K/V** (Q8_KV, IQ4_NL и т.д.) без деквантизации.
Поддерживает sliding window attention, soft-cap, sink tokens.

### 1.5. Delta-Net

Fused реализация delta-net слоя (state-space модели) с AVX2, ARM NEON и AVX-512 вариантами.

### 1.6. Поддержка моделей

Qwen3-MoE, Qwen3.5-MoE, Qwen3-VL-MoE, GLM-4/5 MoE, BailingMoeV2,
OpenAI MoE, Kimi-2.5 Vision, Step-3.5.

### 1.7. CUDA расширения

- `topk-moe.cu` — GPU top-K expert selection
- `iqk_mmvq.cu` — CUDA ядра для IQK типов (40+ template-инстансов)

---

## Часть 2. Что сделано в данном форке (наша работа)

ikawrakow оптимизировал **вычисления**. Мы оптимизировали **память** — что держать
в RAM, что отдать в swap, и как минимизировать цену page faults, когда модель
в 1.5× больше физической памяти.

**Одной строкой: swap-aware memory residency management для MoE-инференса на CPU.**

### 2.1. Проблема

MiniMax-M2.5 в Q5_K занимает 151 GB — на 55 GB больше, чем доступная RAM.
На каждый токен активны только 8 экспертов из 256 (~4.4 GB), остальные 148 GB
ждут на диске. Оригинальный ik_llama.cpp обслуживает page faults реактивно — все
16 потоков блокируются на barrier'е, пока хотя бы один ждёт подкачки с SSD.

### 2.2. Реализованные оптимизации

#### 2.2.1. Hot Expert Tracking + Static Lock (+11% TG)

**Файлы**: `src/llama.cpp`, `ggml/src/ggml.c`, `ggml/include/ggml.h`

Главная оптимизация. Механизм:

1. **Фаза 1 (Prompt Processing)**: атомарные счётчики в GGML фиксируют, сколько
   раз каждый эксперт был вызван при обработке промпта
2. **Фаза 2 (После PP)**: сортируем экспертов по популярности
3. **Фаза 3**: VirtualLock/mlock top-N экспертов (N = 2 × n_expert_used, т.е.
   16 для MiniMax с 8 активными)
4. **Фаза 4**: Никогда не переоцениваем (static lock)

Статичность критична: динамическая переоценка вызывала "VirtualLock storm" —
10 400 syscalls/32 токена → −63% TG.

**Результат**: 0.82 → 0.91 t/s на MiniMax-M2.5 (**+11%**).

**API:**
```c
// GGML уровень — атомарные счётчики
ggml_moe_get_expert_hits(int * out, int max_experts);
ggml_moe_get_dispatch_count(void);
ggml_moe_reset_expert_hits(void);
ggml_moe_set_expert_locked(int expert_id, int locked);
```

**Env-переменные:**
- `IK_LLAMA_HOT_EXPERT_BUDGET` — ручной бюджет блокировки
- `IK_LLAMA_HOT_EXPERT_BUDGET_MULT` — множитель бюджета
- `IK_LLAMA_HOT_EXPERT_TAIL_WINDOW` — размер окна для tail-window режима
- `IK_LLAMA_HOT_EXPERT_TRACE` — включить трассировку

#### 2.2.2. VirtualLock shared-тензоров

**Файл**: `src/llama.cpp` (+95 строк)

Лочит в RAM тензоры, которые нужны на **каждом** токене:
- Attention: wq, wk, wv, wo
- Embeddings: tok_embd, output
- Нормализация: attn_norm, ffn_norm, output_norm
- Роутеры: ffn_gate_inp
- Shared experts: ffn_gate/down/up (shared)

**НЕ лочит**: `ffn_*_exps` — основные MoE-веса (~148 GB), которые управляемо
свопятся через hot expert tracking.

Итого: ~437 тензоров, ~2.82 GiB навсегда в RAM.

Расширяет Windows working set через `SetProcessWorkingSetSize` до 90% физической RAM.

#### 2.2.3. VM Batch Prefetch

**Файлы**: `ggml/include/ggml.h`, `ggml/src/ggml.c`, `src/llama.cpp` (+114 строк)

Thread 0 собирает адреса всех активных экспертов и делает **один** батчевый
вызов `PrefetchVirtualMemory()` (Windows) / `madvise(MADV_WILLNEED)` (Linux)
вместо per-expert syscall.

Per-expert вариант давал **−36% TG** (992 syscalls/token). Батчевый — нейтральный
или чуть положительный.

**Автодетект**: включается автоматически когда модель > 90% физической RAM.

```c
ggml_set_moe_vm_prefetch(int enable);
ggml_get_moe_vm_prefetch(void);
```

#### 2.2.4. RTR Auto-Disable

**Файлы**: `src/llama.cpp`, `common/common.cpp`, `include/llama.h`

Автоматически отключает run-time tensor repack для swap-bound MoE-моделей.
RTR меняет тип тензоров при загрузке (Q4_K → Q4_K_R4), что увеличивает
page fault overhead при свопинге.

```
--run-time-repack auto    # новый режим: отключается если модель > 90% RAM
```

#### 2.2.5. Prompt-Packed QKV

**Файл**: `src/llama.cpp` (~500 строк)

Мержит раздельные Q, K, V тензоры attention в единый contiguous буфер.
Уменьшает количество отдельных обращений к памяти при prompt processing.

- Per-architecture пресеты (QWEN3MOE, OPENAI_MOE)
- Квантует в Q8_0 (или сохраняет F16/BF16 если источник F16/BF16)
- Конфигурируется через `--experimental prompt-packed-qkv=on`

#### 2.2.6. Large Pages

**Файл**: `ggml/src/ggml-backend.cpp` (+80 строк)

Для буферов ≥ 2 MB: `VirtualAlloc(MEM_LARGE_PAGES)` — страницы 2 MB вместо 4 KB.
Снижает TLB misses ~512×.

Требует `SeLockMemoryPrivilege` (скрипт: `build/add_large_pages_priv.ps1`).
Прозрачный fallback к malloc при отсутствии привилегии.

#### 2.2.7. Software Prefetch (нейтральный результат)

**Файлы**: `ggml/src/ggml.c` (+40 строк), `ggml/src/iqk/iqk_mul_mat.cpp` (+24 строки)

`_mm_prefetch` для весов следующего эксперта во время обработки текущего.
Результат: **0%** для in-RAM моделей (hardware prefetcher Zen4 и так эффективен).
Оставлен в коде как потенциально полезный для других платформ.

### 2.3. Багфиксы (3 штуки)

| Баг | Файл | Суть |
|---|---|---|
| muge+rtr crash | `src/llama.cpp` | View-тензоры теряли синхронизацию типов после repack → GGML_ASSERT |
| CLI alias | `common/common.cpp` | Добавлены корректные варианты `--merge-up-gate-exps` / `--merge-up-gate-experts` |
| n_swa_pattern | `src/llama-hparams.h` | Неверный оператор сравнения: `false` → `true` |

### 2.4. CLI-расширения

**Файл**: `common/common.cpp` (+142 строки)

```
--experimental KEY=VALUE          # repeatable, для рантайм-оверрайдов
--run-time-repack [on|off|auto]   # расширен режимом auto
```

Поддерживаемые ключи `--experimental`:
hot-expert-budget, hot-expert-budget-mult, hot-expert-selection,
hot-expert-tail-window, prompt-packed-qkv, prompt-packed-preset,
prompt-packed-range.

### 2.5. Tracing-инфраструктура

10 env-переменных для диагностики:

| Переменная | Что трассирует |
|---|---|
| `IK_LLAMA_PG_TRACE` | Фазы prompt processing (reset, build, alloc, compute) |
| `IK_LLAMA_PG_TRACE_DECODE_WINDOW` | Окно decode для pg-trace |
| `IK_LLAMA_HOT_EXPERT_TRACE` | Dispatch-хиты экспертов, locked/unlocked rows |
| `IK_LLAMA_LOCALITY_TRACE` | Locality трассировка (доступ к страницам) |
| `IK_LLAMA_PROMPT_PACKED_QKV` | Статус prompt-packed QKV |
| `IK_LLAMA_PROMPT_PACKED_QKV_PRESET` | Архитектурный пресет |
| `IK_LLAMA_PROMPT_PACKED_QKV_RANGE` | Диапазон слоёв для pack |
| `IK_LLAMA_HOT_EXPERT_BUDGET` | Бюджет блокировки экспертов |
| `IK_LLAMA_HOT_EXPERT_BUDGET_MULT` | Множитель бюджета |
| `IK_LLAMA_HOT_EXPERT_TAIL_WINDOW` | Окно tail-window |

### 2.6. Отвергнутые эксперименты

| Эксперимент | Результат | Причина отката |
|---|---|---|
| Per-expert VM prefetch | **−36% TG** | 992 syscalls/token |
| Динамический VirtualLock/Unlock | **−63% TG** | 10 400 syscalls/32 tokens |
| Huge Pages через mmap | **0%** | Zen4 prefetcher и так эффективен |
| NUMA interleave | **0%** | Single-socket система |
| madvise sequential | **−14%** | Эксперты не последовательны |
| Thread pinning к CCX | **0%** | Ядро Zen4 само балансирует |

---

## Часть 3. Dashboard — веб-интерфейс мониторинга

**27 файлов, 17 126 строк.** Полностью новая подсистема, отсутствует в ikawrakow/ik_llama.cpp.

**Доступ**: `http://127.0.0.1:7860/`

### Backend

| Файл | Строк | Назначение |
|---|---|---|
| `dashboard_server.py` | 979 | HTTP-сервер, 14 API endpoints (launch/stop/status, live-metrics, replay) |
| `live_metrics.py` | 501 | Regex-парсер pg-trace, hot experts, llama_print_timings |

### Frontend

| Файл | Строк | Назначение |
|---|---|---|
| `dashboard.js` | 2 491 | Модель-детекция, рекомендации параметров |
| `dashboard-live.js` | 1 942 | Real-time визуализация фаз инференса и экспертов |
| `evidence-layer.js` | 883 | Валидация параметров, генеалогия решений |
| `dashboard-i18n.js` | 904 | Локализация EN/RU |
| `dashboard-help.js` | 793 | Глоссарий и справка |
| `dashboard.html` | 1 068 | UI |
| `dashboard.css` | 2 900 | Стили |
| `dashboard-live.css` | 1 032 | Стили live-режима |

### Тестирование

7 файлов юнит-тестов (Vitest), 740 строк.

---

## Часть 4. Бенчмарк-инфраструктура и документация

### Скрипты (12 PowerShell, ~3 900 строк)

- `bench-moe.ps1` — MoE-специфичные бенчмарки
- `bench-advanced.ps1` — расширенный набор тестов
- `bench-cpu-topology.ps1` — профилирование CPU-топологии
- `bench-minimax-hot-budget.ps1` — оптимизация бюджета горячих экспертов
- `bench-minimax-locality-confirm.ps1` — подтверждение locality-гипотез
- `bench-minimax-policy-closeout.ps1` — финализация политик
- `bench-thread-scaling.ps1` — масштабирование по потокам
- `bench-phase3-validation.ps1` — валидация phase 3
- `bench-matrix-mixed.ps1` — матрица смешанной квантизации
- `bench-gptoss-runtime.ps1` — GPT-OSS-120B runtime
- `bench-gptoss120b-prompt-packed-confirm.ps1` — валидация prompt packing
- `watch-benchmark.ps1` — наблюдение за бенчмарком

### Результаты бенчмарков

~200 файлов (JSON/JSONL/CSV) в `bench_results/` — 20+ прогонов за февраль–март 2026.

### Документация (112 файлов, ~22 700 строк)

```
project_docs/
├── strategy/       — цели форка, матрица параметров, план валидации
├── research/       — expert-selection, weighted-hot-experts
├── tutorial/       — START_HERE, рецепты, антипаттерны, кастомная квантизация
├── release/        — чеклисты, changelog, known limits
├── benchmarks/     — индексы, RTR-политика, стратегия квантизации
├── runbooks/       — MoE runtime profiles, speed optimization
├── dashboard/      — product guide, roadmap
├── development/    — архитектурные карты, планы
├── models/         — MiniMax-M2.5 runtime-специфика
└── llm/            — bootstrap для LLM-агентов, source-of-truth map
```

---

## Часть 5. Сводка изменений

### Модифицированные файлы ikawrakow (C++ ядро)

| Файл | Наших строк | Назначение |
|---|---|---|
| `src/llama.cpp` | +1 395 | Hot experts, shared lock, prompt-packed QKV, RTR auto |
| `ggml/src/ggml.c` | +458 | Атомарные счётчики, VM prefetch, exec tracing |
| `ggml/include/ggml.h` | +20 | API: vm_prefetch, expert hits, lock status |
| `include/llama.h` | +5 | repack_tensors_auto, публичный API |
| `common/common.cpp` | +142 | --experimental, --run-time-repack auto |
| `ggml/src/ggml-backend.cpp` | +80 | Large Pages |
| `ggml/src/iqk/iqk_mul_mat.cpp` | +24 | Software prefetch в IQK ядрах |
| `src/llama-hparams.h` | +1 | Bugfix n_swa_pattern |
| **Итого** | **+2 125** | |

### Полностью новые подсистемы

| Компонент | Файлов | Строк |
|---|---|---|
| Dashboard | 27 | 17 126 |
| Документация | 112 | 22 668 |
| Бенчмарк-скрипты | 12 | 3 919 |
| Результаты бенчмарков | ~200 | — |
| **Итого** | **~351** | **~45 800+** |

### Ключевой результат

- **MiniMax-M2.5 (151 GiB, swap-bound)**: 0.82 → 0.91 t/s (**+11%**)
- **Qwen3-30B-A3B (17 GiB, in-RAM)**: ноль оверхеда, идентичная скорость с upstream
- Все оптимизации включаются автоматически при модели > 90% RAM
