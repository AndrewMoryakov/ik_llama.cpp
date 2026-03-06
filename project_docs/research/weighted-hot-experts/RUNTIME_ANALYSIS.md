# Weighted Hot Experts — Runtime Analysis

## Детальный анализ текущего hot-expert pipeline

Основан на чтении кода от 2026-03-06, HEAD: `cda3fe7f7`.

---

## 1. State Machine

### Статическое состояние (`src/llama.cpp:2346-2358`)

```
s_hot_locked[256]          — какие эксперты сейчас VirtualLocked
s_hot_max_locked           — бюджет (сколько можем заблокировать)
s_hot_n_expert             — всего экспертов в модели
s_hot_committed            — true после одноразового lock (никогда не сбрасывается)
s_hot_tail_window_active   — tail-window активен?
s_hot_tail_window_size     — размер tail window (или 0)
s_hot_selection_mode       — DEFAULT / FULL_PROMPT / TAIL_WINDOW
```

### Переходы состояний

```
MODEL LOAD → counters zeroed, mode determined, budget set
         ↓
PROMPT TOKENS → tail-window reset if boundary crossed (строка 4567)
         ↓
AFTER FIRST PROMPT BATCH → llama_hot_expert_commit() fires (строка 4944)
         → locks applied, s_hot_committed = true
         ↓
DECODE → no more locks, dispatch reordering only
```

---

## 2. Hit Accumulation

### Глобальные счётчики (`ggml/src/ggml.c:279-287`)

```c
static atomic_int ggml_moe_expert_hits[256];           // per-expert total
static atomic_int ggml_moe_layer_expert_hits[256][256]; // per-layer per-expert
static atomic_int ggml_moe_dispatch_count_val;          // total dispatch calls
```

### Точка аккумуляции (`ggml/src/ggml.c:17395-17415`)

В `mul_mat_id` kernel, thread 0:
1. Router выбирает экспертов для batch → `matrix_row_counts[expert_id]`
2. `atomic_fetch_add(&ggml_moe_expert_hits[a], row_count)` — hit = число строк
3. `atomic_fetch_add(&ggml_moe_layer_expert_hits[layer_id][a], row_count)` — per-layer
4. Отдельно трекает locked/unlocked dispatch counts

**Важно**: hit = количество обработанных строк, не просто "был диспатчен". Weighted by router output.

### API для чтения

```c
ggml_moe_get_expert_hits(int *out, int max)        // прочитать глобальные хиты
ggml_moe_get_layer_expert_hits(int *out, L, E)     // прочитать layer×expert матрицу
ggml_moe_reset_expert_hits()                       // обнулить всё
ggml_moe_get_dispatch_count()                      // сколько dispatch вызовов
```

---

## 3. Tail-Window Reset (`src/llama.cpp:4567-4578`)

```cpp
if (use_hot_tail_window && !hot_tail_window_reset && n_tokens_all > hot_tail_window) {
    const uint32_t tail_start = n_tokens_all - hot_tail_window;
    if (cur_token < tail_start && cur_token + n_tokens >= tail_start) {
        ggml_moe_reset_expert_hits();       // <-- ЖЁСТКИЙ RESET: всё обнуляется
        hot_tail_window_reset = true;
        s_hot_tail_window_active = true;
    }
}
```

**Это единственная точка, которую нужно изменить для blend.**

Вызывается из однопоточного интервала между u_batch submissions — compute threads не работают. Безопасно для scale/reset без дополнительной синхронизации.

---

## 4. Expert Commit (`src/llama.cpp:2503-2554`)

```cpp
static void llama_hot_expert_commit(const llama_model & model) {
    if (s_hot_committed) return;   // одноразовый
    if (dispatch_count < 32) return; // мало данных

    ggml_moe_get_expert_hits(hits, n_expert);  // читаем накопленные хиты
    // insertion sort по hits (descending)
    // VirtualLock/mlock top s_hot_max_locked экспертов
    s_hot_committed = true;
}
```

Вызывается на строке 4944 после первого prompt batch.

### Бюджет (`src/llama.cpp:2372-2387`)

- `IK_LLAMA_HOT_EXPERT_BUDGET` → прямое значение
- `IK_LLAMA_HOT_EXPERT_BUDGET_MULT` → `n_expert_used * mult`
- Default: `n_expert_used * 2` (для MiniMax: n_expert_used=8, budget=16)

---

## 5. Dispatch Reordering (`ggml/src/ggml.c:17418-17442`)

В каждом `mul_mat_id` call:
1. Сначала добавить locked экспертов в dispatch order
2. Затем unlocked экспертов
3. Compute loop обрабатывает в этом порядке

**Результат**: locked эксперты (0 page faults) вычисляются, пока OS подгружает unlocked.

---

## 6. VM Prefetch (`ggml/src/ggml.c:17447-17473`)

Thread 0 после dispatch reordering:
- **Windows**: `PrefetchVirtualMemory()` batch call для всех active экспертов
- **Linux**: `madvise(..., MADV_WILLNEED)` per expert

---

## 7. Телеметрия

### Locked/Unlocked Stats

```c
ggml_moe_get_locked_stats(&locked_rows, &unlocked_rows, &locked_dispatches, &unlocked_dispatches)
```

### Логирование (`src/llama.cpp:2389-2463`)

При `IK_LLAMA_HOT_EXPERT_TRACE=1`:
- Per-layer top-8 экспертов по hits
- locked_share (%)
- Commit summary: какие эксперты заблокированы, их hits

---

## 8. Точка вмешательства для Weighted Hot Experts

### Что менять:
Строка 4570: вместо `ggml_moe_reset_expert_hits()` → `ggml_moe_scale_expert_hits(blend)`

### Что НЕ менять:
- mul_mat_id kernel (аккумуляция)
- commit logic (сортировка + lock)
- dispatch reordering
- VM prefetch
- бюджет

### Ограничения (не нарушать):
- **Нет dynamic lock/unlock** — VirtualLock блокирующий (2.6GB page-in latency)
- **Одноразовый commit** — `s_hot_committed` никогда не сбрасывается
- **Dispatch reordering бесплатен** — per-kernel, без syscall
