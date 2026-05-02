# Perf Attribution: где живёт CPU-производительность форка

**Дата**: 2026-05-02 (после `feature/upstream-sync-2026-05-02` merge)

Документ возник из практического вопроса: «после upstream-merge bench показывает
+15% PP на Qwen3-30B и +59% PP на gpt-oss-20b — почему собственная Zen4-работа
форка не давала таких чисел раньше?». Ответ — потому что форк работает на
**других слоях стека**, чем тот, который дают эти конкретные числа. Слои не
конкурируют, а складываются.

---

## Наблюдаемые числа

Бенч `llama-bench -t 16 -fa 1 -rtr 1 -p 512 -n 32 -r 1` на Ryzen 9 7950X.

| Модель | Тест | Baseline (до merge) | После merge | Δ |
|--------|------|---------------------|-------------|---|
| Qwen3-30B-A3B Q4_K_M | PP512 | 316.8 t/s | 365.56 | **+15.4%** |
| Qwen3-30B-A3B Q4_K_M | TG32  | ~30 t/s   | 30.69  | +2.3% |
| gpt-oss-20b MXFP4    | PP512 | 281.2 t/s | 447.88 | **+59.3%** |
| gpt-oss-20b MXFP4    | TG32  | ~24 t/s   | 25.13  | +5% |

TG почти не меняется — он memory-bound. PP меняется сильно — он compute-bound.

---

## Откуда взялся прирост

Ни один из upstream-коммитов не упоминает Zen4 напрямую. Прирост — это сумма
эффектов от компьют-патчей, добавленных ikawrakow между 2026-03-23 и 2026-05-02:

**Главные кандидаты для Qwen3-30B (Q4_K_M)**:
- `#1578` Optimize mul_mat_q8_1_r8_q8_2 with AVX-512 for faster Q4_K/Q5_K prompt processing
- `#1456` Better barrier (spin-wait вместо OMP для batch > 32 — действует на PP512)
- `#1627` Fused fused_rms_norm + add (нормирование в MoE-блоках)
- `#1707` Faster small batch inference for MoE models (от 2026-04-30)

**Для gpt-oss-20b (MXFP4)** дополнительно:
- AVX-VNNI 256-bit для Q8_K/Q8_1/Q8_0 R8 (#1460/1463/1459) — это путь intermediate
  Q8 буфера в `mul_mat_id`. MXFP4 деквантуется на лету в Q8 для матумножения,
  так что эти патчи ускоряют именно эту стадию.

Точную attribution per-commit без bisect определить нельзя — но порядок цифр
согласуется с этим списком.

---

## Распределение perf-работы по слоям стека

```
┌─────────────────────────────────────────────────────────────────────┐
│ Слой                              │ Кто работает    │ Текущий статус │
├─────────────────────────────────────────────────────────────────────┤
│ Hand-written AVX-512 SIMD kernels │ ikawrakow       │ ~1.8 MB кода   │
│ (iqk_gemm_*.cpp, fused ops)       │ (upstream)      │ git blame: ✓   │
├─────────────────────────────────────────────────────────────────────┤
│ Build configuration: AVX-512 set  │ форк            │ build_zen4.bat │
│ (VBMI + VNNI + BF16 + native)     │                 │ необходимо для │
│                                    │                 │ активации iqk  │
├─────────────────────────────────────────────────────────────────────┤
│ Software prefetch (_mm_prefetch)  │ форк (3e92b6b32)│ 0% gain в IQK, │
│ в IQK kernel + MoE dispatch       │                 │ замещён uplstm │
│                                    │                 │ thread-split   │
├─────────────────────────────────────────────────────────────────────┤
│ VM prefetch (madvise/PrefetchVM)  │ форк (d161b85a7)│ работает для   │
│ batch hint OS перед dispatch      │                 │ swap-bound     │
│                                    │                 │ выкл. для RAM  │
├─────────────────────────────────────────────────────────────────────┤
│ Large pages (MEM_LARGE_PAGES,     │ форк (d161b85a7)│ активны        │
│ SeLockMemoryPrivilege)            │                 │ everywhere     │
├─────────────────────────────────────────────────────────────────────┤
│ Shared tensor lock (VirtualLock,  │ форк (d161b85a7)│ critically     │
│ mlock) для swap-bound MoE         │                 │ важно для swap │
├─────────────────────────────────────────────────────────────────────┤
│ Hot-expert tracking + lock budget │ форк (PR04+v2)  │ swap-bound     │
│ (с tail-window и tail-blend)      │ (bbd28eaa6 etc.)│ feature only   │
├─────────────────────────────────────────────────────────────────────┤
│ Custom quantization recipes       │ форк            │ Tapered-RAM    │
│ (Tapered-RAM v3.1, Deep-Taper v4) │ (script + docs) │ MiniMax 6.2x   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Что значит каждый слой

### `build_zen4.bat` — Zen4 build configuration (есть в форке)

```bat
-DGGML_AVX512=ON       # включить общий AVX-512 path
-DGGML_AVX512_VBMI=ON  # Vector Byte Manipulation (Zen4 имеет, Intel desktop нет)
-DGGML_AVX512_VNNI=ON  # Vector Neural Network (vpdpbusd для INT8 dot)
-DGGML_AVX512_BF16=ON  # Brain Float 16 (vdpbf16ps)
-DGGML_NATIVE=ON       # -march=native → znver4 на 7950X
```

ikawrakow в `iqk_gemm_*.cpp` пишет код за защитой `#ifdef __AVX512VNNI__` и
аналогичными. Без правильных build-флагов компилятор не определяет эти макросы
и валится на slow fallback через AVX2 / scalar. **Все 1.8 MB hand-written
AVX-512 kernels физически не выполняются** без правильной конфигурации.

То есть форковский `build_zen4.bat` — это **необходимое условие** для активации
upstream perf. Это знающий выбор флагов под конкретную микроархитектуру, а не
автоматическая часть базы.

### Software prefetch (`_mm_prefetch`) — есть в форке, не работает

Коммит `3e92b6b32 MoE optimization: ... add expert prefetch`. В IQK kernel
inner loops вставлены `_mm_prefetch(addr, _MM_HINT_T1)` для подкачки следующего
chunk weights. Бенч-результат — **0% gain**. ikawrakow в свой merge-план положил
"Принять upstream (наш prefetch = 0% gain, ikawrakow добавил thread-splitting)".
То есть собственный SSE-prefetch не победил планировщика инструкций ikawrakow'a,
который уже close-to-optimal. Код есть, но эффекта нет — это **negative result**,
полезный сам по себе как закрытое направление.

### VM prefetch (`madvise(MADV_WILLNEED)` / `PrefetchVirtualMemory`) — работает в swap

Коммит `d161b85a7`. Перед dispatch loop делается **batched** OS-вызов на подкачку
страниц активных экспертов из swap. По дизайну включается только когда
`-rtr` детектит swap-bound сценарий (`ggml_moe_vm_prefetch == 1` иначе ноль).

Для in-RAM моделей выключен — потому что бессмысленно прогревать страницы
которые уже в RAM. Поэтому на сегодняшних бенчах Qwen3-30B и gpt-oss-20b его
эффекта не видно — это by design.

### Large pages — активны везде

`d161b85a7` — `MEM_LARGE_PAGES` через `SetProcessWorkingSetSize` + `VirtualAlloc`,
с `SeLockMemoryPrivilege`. Линукс-аналог через `mlock`. Снижает TLB miss rate
для больших моделей. Активны и на in-RAM, и на swap-bound моделях. Видно в
выводе `ggml_large_pages_available: large pages enabled (page size: 2048 KB)`.

### VirtualLock + working set sizing — критично для swap-bound

`d161b85a7`. На swap-bound моделях операционка под давлением начинает выкидывать
страницы в swap. Без lock'а она может выкинуть **shared tensors** (attention,
embedding, router) — критические для каждого токена — оставив в RAM **expert
weights** которые активны только частично. Lock на shared даёт операционке
правильную подсказку: «expert weights можно свопить, остальное — нет».

Эффект: на MiniMax-M2.5 (151 GiB) с `rtr=auto` без lock'а tg32 = 0.6 t/s,
с lock'ом — ~3.5+ t/s. Это работа форка которая на in-RAM моделях не виден,
но даёт огромный прирост в целевом use-case.

### Hot-expert tracking — swap-bound feature

PR04 (коммиты `17fea1261`, `bbd28eaa6`). Собирает статистику использования
экспертов на prompt-фазе, потом **один раз** locks top-K самых популярных
экспертов в RAM. Без периодической re-evaluation — иначе VirtualLock storm
давал -63% TG регрессию (это закрытый negative result в `bbd28eaa6`).

С tail-window и tail-blend для уточнения статистики (наша `e8444f2ad`).
Tail-blend на MiniMax дал **negative result** (все blend-значения дают
тот же hot-set), но инфраструктура осталась.

### Custom quantization — главный успех форка

Tapered-RAM v3.1 для MiniMax-M2.5: 151 GiB UD-Q5 → **92 GiB** custom recipe
(taper по чувствительности слоёв). Бенч: tg32 0.62 → 3.82 t/s = **+520% (6.2x)**.
Это самый большой prefетный выигрыш в форке. Он не отменяется и не уменьшается
upstream-патчами — это уровень **выбора bpw для каждого тензора**, ортогональный
SIMD-оптимизациям ikawrakow'a.

---

## Phase 4 AVX-512 micro-optimizations (отложено)

В архиве лежит `project_docs/archive/ik_llama_rework/ik_llama_optimization_plan.md`
с **Phase 4: AVX-512 Kernel Micro-optimizations**, потенциал «+5–15% PP speed».
План включал:

- `objdump -d ... | grep -c vpdpbusd` для проверки реального покрытия VNNI
- Анализ Zen4-specific особенностей (double-pumped 256-bit execution units)
- Переписать критические циклы в `iqk_mul_mat.cpp` под Zen4 scheduling

**Phase 4 не был реализован**: hand-written SIMD kernels требуют другого dev-loop
(cycle-accurate бенчи, intrinsics, чтение AMD optimization manuals), и работа
по форку пошла в memory-management направление, где результат был быстрее
(Tapered-RAM 6.2x против предполагаемых +5-15%).

Это валидное стратегическое решение, не пробел. Часть upstream-перцентажей
которые мы видим сейчас (#1578 AVX-512 для Q4_K, #1707 small-batch MoE) —
это работа того же класса, которую закрыл ikawrakow вместо нас. Без потери,
просто другая команда сделала.

---

## Резюме

| Утверждение | Статус |
|-------------|--------|
| Форк работал на Zen4-уровне | ✓ да (build config, prefetch, large pages, VirtualLock, tapered quant) |
| Форк писал собственные AVX-512 SIMD kernels | ✗ нет (Phase 4 plan в archive, реализации нет) |
| Сегодняшний +15% / +59% — заслуга форка | частично (build config активирует, kernel — ikawrakow) |
| Tapered-RAM 6.2x — заслуга форка | ✓ полностью |
| Memory-management — заслуга форка | ✓ полностью |

CPU-инференс — это многослойный стек. Форк закрыл нижние слои (build config) и
верхние (memory + recipes). Серединой (hand-written SIMD) занимается ikawrakow.
Это естественное разделение труда, и оно работает: после merge вы получаете и
то, и другое.

---

**Связанные документы**:
- `docs/FORK_CHANGES.md` — что именно отличается от upstream
- `docs/PROJECT_ANALYSIS.md` — общая архитектура и иерархия форков
- `project_docs/archive/ik_llama_rework/ik_llama_optimization_plan.md` — полный план Phase 1-4
- `MEMORY.md` (auto-memory) — сводка того что settled и что закрыто
