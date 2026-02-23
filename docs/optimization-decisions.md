# Решения по оптимизации ik_llama.cpp — 2026-02-23

## Контекст
Форк ik_llama.cpp, оптимизация CPU-only inference для MoE моделей на Ryzen 9 7950X (96 GB DDR5).
Проведено 222 бенчмарка, установлен baseline. Теперь — код-уровневые оптимизации.

## Приоритеты (по ожидаемому импакту)

### 1. Исправление краша muge+rtr (КРИТИЧНО)
**Проблема:** GGML_ASSERT at llama.cpp:4510 при использовании `-muge 1 -rtr 1` на MoE моделях.

**Корневая причина:** При `rtr=1` loader отключает mmap и репакует тензоры in-place
(`iqk_repack_tensor`), изменяя их тип (Q4_K → Q4_K_R4). Когда `muge=1`, создаётся
fused тензор `ffn_up_gate_exps` с view-тензорами `ffn_up_exps` и `ffn_gate_exps`.
При репаке parent-тензор меняет тип, но view-тензоры пропускаются (view_src != nullptr),
и их тип остаётся старым. Позже `llama_repack_up_gate_exps()` проверяет
`type == type` → assertion fails.

**Выбранное решение:** После цикла репака обновить типы всех view-тензоров
чтобы соответствовали типу их source. Размер данных не меняется при репаке
(только перестановка строк), поэтому nb[] остаётся валидным.

**Альтернативы рассмотрены:**
- A) Пропускать fused тензоры в repack loop → теряем rtr оптимизацию для expert weights
- B) Отключать muge когда rtr включён → теряем muge оптимизацию (+3-5% PP)
- C) Убрать assertion → маскирует реальную проблему, данные будут некорректны
- **D) Обновлять view types (выбрано)** → сохраняет ВСЕ оптимизации, минимальный код

### 2. Expert Prefetch (PR03) — +15-30% MoE TG
**Проблема:** TG memory-bandwidth-bound. Ядра простаивают, ожидая данных эксперта из RAM.

**Выбранное решение:** Software prefetch в двух местах:
1. **ggml.c:17114** (expert dispatch loop): Пока вычисляется текущий эксперт,
   prefetch весов следующего эксперта из `src0->data + next_a * nb02`
2. **iqk_mul_mat.cpp:709** (kernel inner loop): Prefetch следующего блока весов
   при обходе матрицы

**Параметры для Zen4:**
- Hint: `_MM_HINT_T1` (L2 cache, оптимально для Zen4 — 1MB/core)
- Stride: 1024 bytes (16 cache lines по 64 bytes)
- Cap: 256 KiB per expert weight chunk
- Реализация за флагом (по умолчанию включено для MoE моделей)

**Альтернативы:**
- A) Кросс-слойный prefetch (layer N+1 по данным layer N) → слишком сложно, спекулятивно
- B) madvise(MADV_WILLNEED) на уровне страниц → слишком грубо, не помогает in-RAM моделям
- **C) Software prefetch в dispatch loop (выбрано)** → проверенный подход, нулевой риск

### 3. IQK Kernel Prefetch (PR09 partial)
**Проблема:** Ноль prefetch инструкций во всём IQK kernel коде.

**Выбранное решение:** Добавить `_mm_prefetch` для:
- Следующего блока весов `vx + (ix + k_x_step) * bx` в inner loop
- Q8 блоков input данных, которые будут загружены на следующей итерации

**Не включаем (пока):**
- VNNI audit (требует глубокого анализа дизассемблера, можно сломать)
- Tiling tuning (нужно профилирование, не blind optimization)

## Порядок реализации
1. muge+rtr fix → разблокирует комбинацию флагов для всех MoE моделей
2. Expert prefetch в dispatch loop → highest impact, lowest risk
3. IQK kernel prefetch → дополнительный прирост в inner loop
4. Build & verify → проверка компиляции

## Метрики успеха
- muge+rtr: модели Qwen3 и MiniMax не крашатся с `-muge 1 -rtr 1`
- Expert prefetch: TG > baseline на gpt-oss-20b и Qwen3-30B при t=16
- Kernel prefetch: PP не хуже baseline, возможно +5-10%

## Что НЕ делаем (и почему)
- PR05/PR06 NUMA — деприоритизировано, одна NUMA нода, CCD pinning вредит
- PR10 Batched MoE — слишком сложно для текущего этапа
- PR11 Weight reordering — зависит от профилирования
- Speculative decoding — отдельная задача
