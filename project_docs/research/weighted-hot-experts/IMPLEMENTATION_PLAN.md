# Weighted Hot Experts — План реализации

## Подход: Soft Tail-Window Blend (Approach A)

Вместо обнуления хитов на tail boundary — масштабировать их. ~40 строк нового кода, 3 файла, полная обратная совместимость.

---

## Изменение 1: Новый API в ggml

### `ggml/include/ggml.h` (после строки 378)

Добавить объявление:

```c
GGML_API void ggml_moe_scale_expert_hits(float scale);
```

### `ggml/src/ggml.c` (после `ggml_moe_reset_expert_hits`, строка 310)

Добавить реализацию:

```c
GGML_API void ggml_moe_scale_expert_hits(float scale) {
    for (int i = 0; i < GGML_MOE_MAX_EXPERTS; ++i) {
        int val = (int)atomic_load(&ggml_moe_expert_hits[i]);
        atomic_store(&ggml_moe_expert_hits[i], (int)(val * scale));
    }
    for (int il = 0; il < GGML_MOE_MAX_LAYERS; ++il) {
        for (int ie = 0; ie < GGML_MOE_MAX_EXPERTS; ++ie) {
            int val = (int)atomic_load(&ggml_moe_layer_expert_hits[il][ie]);
            atomic_store(&ggml_moe_layer_expert_hits[il][ie], (int)(val * scale));
        }
    }
    // dispatch_count и locked/unlocked stats НЕ масштабируются
}
```

**Thread safety**: вызывается из однопоточного интервала между u_batch (подтверждено тем, что `reset()` уже использует неатомарные `= 0` для locked_rows).

**Integer truncation**: `42 * 0.3 = 12` (floor) — приемлемо.

**Latency**: 256 + 256×256 = 65792 atomic load/store pairs. Микросекунды, один раз за prompt.

---

## Изменение 2: Env var reader

### `src/llama.cpp` (после строки 224)

```cpp
static float llama_hot_expert_tail_blend() {
    static float value = -2.0f;
    if (value < -1.0f) {
        const char * env = std::getenv("IK_LLAMA_HOT_EXPERT_TAIL_BLEND");
        value = (env && env[0]) ? (float)std::atof(env) : -1.0f;
    }
    return value;
}
```

Семантика:

| Значение | Поведение | Эквивалент |
|----------|-----------|------------|
| не задано | default = жёсткий reset | текущий tail-window |
| `0.0` | scale × 0 = обнуление | жёсткий reset |
| `0.1` | 10% ранних хитов сохраняется | — |
| `0.3` | 30% ранних хитов сохраняется | — |
| `0.5` | 50/50 blend | — |
| `1.0` | нет reset | full-prompt |

**Требует** `IK_LLAMA_HOT_EXPERT_TAIL_WINDOW > 0`. Без tail-window blend не имеет эффекта.

---

## Изменение 3: Tail-window boundary logic

### `src/llama.cpp` (строки 4567-4578)

Было:
```cpp
ggml_moe_reset_expert_hits();
```

Стало:
```cpp
const float blend = llama_hot_expert_tail_blend();
if (blend >= 0.0f && blend < 1.0f) {
    if (blend > 0.0f) {
        ggml_moe_scale_expert_hits(blend);
    } else {
        ggml_moe_reset_expert_hits();
    }
} else if (blend < 0.0f) {
    ggml_moe_reset_expert_hits();
}
// blend >= 1.0 => пропускаем reset (full-prompt)
```

Сохранить лог:
```cpp
if (llama_hot_expert_trace_enabled()) {
    if (blend >= 0.0f) {
        LLAMA_LOG_INFO("%s: hot experts selection: tail-window[%u]+blend[%.2f] at token %u/%u\n",
                __func__, hot_tail_window, blend, tail_start, n_tokens_all);
    } else {
        LLAMA_LOG_INFO("%s: hot experts selection switched to tail-window[%u] at token %u/%u\n",
                __func__, hot_tail_window, tail_start, n_tokens_all);
    }
}
```

---

## Изменение 4: Selection label

### `src/llama.cpp` (функция `llama_hot_expert_selection_label()`, строки 2359-2370)

```cpp
if (s_hot_tail_window_active && s_hot_tail_window_size > 0) {
    std::string label = "tail-window[" + std::to_string(s_hot_tail_window_size) + "]";
    const float blend = llama_hot_expert_tail_blend();
    if (blend >= 0.0f) {
        char buf[32];
        snprintf(buf, sizeof(buf), "+blend[%.2f]", blend);
        label += buf;
    }
    return label;
}
```

Это отображается в commit summary:
```
hot experts: locked 16/32 (budget 16, selection=tail-window[16]+blend[0.30]) | top-8: ...
```

---

## Изменение 5: Init log

### `src/llama.cpp` (район строки 3089-3095)

В `LLAMA_LOG_INFO` при инициализации hot-expert добавить blend factor.

---

## Изменение 6: Dashboard evidence-layer

### `dashboard/evidence-layer.js`

Добавить knob entry:

```js
hot_expert_tail_blend: {
    id: 'hot_expert_tail_blend',
    applicability: 'moe-huge',
    runtimeSupport: 'generic-moe-hot-expert-path',
    validation: 'research',
    confidence: 'none',
    risk: 'low',
    testedOn: [],
    failureModeRu: 'Неудачный blend factor может не улучшить selection.',
    failureModeEn: 'A poor blend factor may not improve selection.',
}
```

---

## Порядок выполнения

1. `ggml/include/ggml.h` — объявление
2. `ggml/src/ggml.c` — реализация `ggml_moe_scale_expert_hits`
3. `src/llama.cpp` — env var + boundary + label + init log
4. `dashboard/evidence-layer.js` — knob entry
5. Build: `python3 run_build.py`
6. Smoke test: запуск без env vars → идентичное поведение
7. `cd dashboard && npm test` — 121 тест зелёный

---

## Что НЕ меняется

- mul_mat_id kernel (аккумуляция хитов)
- commit logic (сортировка + VirtualLock)
- dispatch reordering
- VM prefetch
- бюджет блокировки
- CLI args (только env var, по паттерну существующих)

---

## Обратная совместимость

| Сценарий | Поведение |
|----------|-----------|
| Env var не задана | 100% идентично текущему коду |
| blend=0.0 | Математически = жёсткий reset |
| blend=1.0 | Математически = full-prompt |
| tail-window не задан | blend не имеет эффекта |
| In-RAM модель | hot-expert tracking отключен (`ggml_moe_vm_prefetch=0`), blend неактивен |

---

## Расширение: Multi-Segment Decay (Approach B)

Если Approach A покажет сигнал, расширение через тот же `ggml_moe_scale_expert_hits`:

- `IK_LLAMA_HOT_EXPERT_DECAY_SEGMENTS=4` — количество сегментов
- `IK_LLAMA_HOT_EXPERT_DECAY_FACTOR=0.5` — decay per segment
- На каждой boundary: `scale(decay_factor)`, tail tokens накапливают поверх
- Результат: экспоненциально-подобный decay — earliest tokens → наименьший вклад

Не требует нового ggml API — только больше вызовов `scale` из `llama.cpp`.
