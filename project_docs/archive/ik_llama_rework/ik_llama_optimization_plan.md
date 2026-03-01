# ik_llama.cpp Optimization Plan for Zen 4 CPU-only MoE Inference

## Reality Check (Read This First)
This plan started as a generic draft. For the current actionable, PR-sized backlog and exact code pointers for `ik_llama.cpp` (commit `3330890`), see `BACKLOG.md`.

Key mismatches vs the current `ik_llama.cpp` tree:
- MoE graph build is primarily in `src/llama-build-context.cpp` (not `src/llama-graph.cpp`).
- CPU MoE compute for `GGML_OP_MUL_MAT_ID` is in `ggml/src/ggml.c`, and IQK kernels live under `ggml/src/iqk/`.
- This `ik_llama.cpp` snapshot does **not** include `qwen3next` model code; upstream `llama.cpp` does (`src/models/qwen3next.cpp`).
- This tree includes `llama-sweep-bench` under `examples/sweep-bench/` (built as `build/bin/llama-sweep-bench`).

## Target Hardware
- **CPU**: AMD Ryzen 9 7950X (2 × CCD, 16C/32T, Zen 4, AVX-512 double-pumped)
- **RAM**: 96 GB DDR5-6200 (tuned timings, dual channel, ~100 GB/s theoretical BW)
- **GPU**: None (iGPU only — CPU-only inference)
- **Target models**: Qwen3-Next 80B-A3B, GPT-OSS 120B

## Repository Structure Map

```
ik_llama.cpp/
├── src/
│   ├── llama-build-context.cpp  ← 🔥 MoE graph construction, expert routing
│   ├── llama-model.cpp          ← Model loading, tensor allocation
│   ├── llama-context.cpp        ← Context management, KV cache
│   ├── llama-kv-cache.cpp       ← KV cache implementation
│   └── llama-memory.cpp         ← Memory management
├── ggml/
│   ├── src/
│   │   ├── ggml.c               ← Core tensor operations
│   │   ├── ggml-cpu/
│   │   │   ├── ggml-cpu.cpp     ← 🔥 CPU backend, thread scheduling
│   │   │   ├── ggml-cpu-impl.h  ← CPU implementation details
│   │   │   ├── iqk_mul_mat.cpp  ← 🔥 IQK quantized matmul kernels (Zen4/AVX512)
│   │   │   ├── iqk_mul_mat.h    ← IQK matmul headers
│   │   │   └── amx/             ← AMX kernels (Intel, не для нас)
│   │   ├── ggml-alloc.c         ← 🔥 Tensor memory allocator
│   │   └── ggml-backend.cpp     ← Backend abstraction
│   └── include/
│       ├── ggml.h               ← Core GGML API
│       └── ggml-cpu.h           ← CPU backend API
├── include/
│   └── llama.h                  ← Public llama API
└── examples/
    └── sweep-bench/             ← 🔧 Benchmarking tool
```

---

## Phase 0: Baseline & Profiling (День 1)

### 0.1 Сборка с правильными флагами

```bash
git clone https://github.com/ikawrakow/ik_llama.cpp.git
cd ik_llama.cpp
mkdir build && cd build

# Zen 4 optimized build
cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DGGML_CPU_AARCH64=OFF \
  -DCMAKE_C_FLAGS="-march=znver4 -O3 -flto" \
  -DCMAKE_CXX_FLAGS="-march=znver4 -O3 -flto" \
  -DGGML_NATIVE=ON

cmake --build . -j$(nproc)
```

**Важно**: `-march=znver4` включает AVX-512, VNNI, BF16 и все Zen4-специфичные оптимизации.

### 0.2 Baseline бенчмарки

```bash
# Использовать встроенный sweep-bench для воспроизводимых замеров
./bin/llama-sweep-bench \
  -m /path/to/qwen3-next-80b-a3b.IQ4_KS.gguf \
  -t 16 \
  -fa 1 \
  -c 4096

# Записать baseline для обеих моделей
# TG (token generation) и PP (prompt processing) — ключевые метрики
```

### 0.3 Profiling с perf

```bash
# Общая статистика
perf stat -e instructions,cycles,cache-misses,cache-references,\
L1-dcache-load-misses,LLC-load-misses,\
branches,branch-misses \
  ./bin/llama-cli -m model.gguf -p "Hello" -n 50 -t 16

# Детальный профиль для hotspot анализа
perf record -g -F 999 \
  ./bin/llama-cli -m model.gguf -p "Hello" -n 100 -t 16
perf report --sort=dso,symbol

# NUMA статистика
numactl --hardware
lstopo --of txt
```

**Что искать в perf output:**
- Если `LLC-load-misses` > 10% от `cache-references` → bottleneck в RAM bandwidth → фокус на prefetching
- Если `instructions/cycle` < 1.0 → CPU простаивает ожидая данные → тоже prefetching
- Если `instructions/cycle` > 2.0 → compute bound → фокус на VNNI/kernels

### 0.4 Проверка NUMA topology

```bash
# На 7950X с двумя CCD:
# CCD0 (cores 0-7)  → NUMA node 0 → свой L3 32MB
# CCD1 (cores 8-15) → NUMA node 1 → свой L3 32MB

numactl --hardware
# Ожидаемый вывод:
# node 0: cpus: 0-7 16-23 (физические + SMT)
# node 1: cpus: 8-15 24-31 (физические + SMT)
# node distances:
# node 0 1
#   0: 10 32   ← cross-CCD latency ~3.2x

# Запуск с NUMA awareness
numactl -i all ./bin/llama-cli -m model.gguf ...
```

---

## Phase 1: Expert Prefetching для MoE (Дни 2-4)

### Потенциал: +15-30% TG speed

### 1.1 Понимание MoE flow в ik_llama.cpp

Ключевой файл: **`src/llama-graph.cpp`**

В MoE-моделях каждый layer содержит:
1. Attention block (dense — всегда выполняется)
2. Router/Gate (маленький linear layer — выбирает экспертов)
3. Expert FFN blocks (sparse — выполняются только top-K)

В GGML это представлено как операция `GGML_OP_MUL_MAT_ID` — "matrix multiply with expert ID selection".

#### Граф вычислений для одного MoE layer:

```
input
  │
  ├─→ [attention] (dense)
  │
  ├─→ [gate/router] → expert_ids (top-K selection)
  │
  └─→ [MUL_MAT_ID with expert_ids] (sparse FFN)
        │
        ├─→ expert_0.gate_proj × input → ...
        ├─→ expert_3.up_proj × input → ...
        └─→ expert_7.down_proj × ... → output
```

### 1.2 Точка вмешательства: Router → Prefetch

**Файл**: `src/llama-graph.cpp`

Искать функции, которые строят MoE-блок графа. В llama.cpp / ik_llama.cpp MoE обычно конструируется в методе типа:

```cpp
// Примерная структура (нужно найти конкретный метод для каждой архитектуры):
// Для GPT-OSS: build_gptoss() или build_gpt2() 
// Для Qwen3-Next: build_qwen3next()

struct ggml_tensor * ffn_gate = ggml_mul_mat(ctx, model.layers[il].ffn_gate_inp, cur);
// ^ Это router — маленькая матрица [hidden_dim × n_experts]
// После softmax + top-K получаем expert_ids

struct ggml_tensor * ffn_out = ggml_mul_mat_id(ctx, 
    model.layers[il].ffn_gate_exps,  // gate projection weights для всех экспертов
    expert_ids,                       // выбранные эксперты
    cur);                             // input
```

### 1.3 Реализация Software Prefetch

**Файл**: `ggml/src/ggml-cpu/ggml-cpu.cpp`

Нужно модифицировать обработчик `GGML_OP_MUL_MAT_ID` на CPU backend.

Найти функцию: `ggml_compute_forward_mul_mat_id()` или аналогичную.

```cpp
// ТЕКУЩИЙ flow (упрощённо):
static void ggml_compute_forward_mul_mat_id(
    const struct ggml_compute_params * params,
    struct ggml_tensor * dst) {
    
    // 1. Получить expert_ids из router output
    const int * ids = (const int *)dst->src[2]->data;
    
    // 2. Для каждого выбранного эксперта:
    for (int e = 0; e < n_experts_used; e++) {
        int expert_id = ids[e];
        // 3. Выполнить matmul с весами этого эксперта
        //    ← Здесь CPU ждёт загрузки весов из RAM!
        mul_mat_kernel(expert_weights[expert_id], input, output);
    }
}
```

**Модификация — добавить prefetch pipeline:**

```cpp
static void ggml_compute_forward_mul_mat_id_prefetched(
    const struct ggml_compute_params * params,
    struct ggml_tensor * dst) {
    
    const int * ids = (const int *)dst->src[2]->data;
    
    // НОВОЕ: Prefetch весов следующего эксперта пока считаем текущий
    for (int e = 0; e < n_experts_used; e++) {
        int expert_id = ids[e];
        
        // Prefetch СЛЕДУЮЩЕГО эксперта (если есть)
        if (e + 1 < n_experts_used) {
            int next_expert_id = ids[e + 1];
            const char * next_weights = (const char *)get_expert_data(
                dst->src[0], next_expert_id);
            size_t weight_size = expert_weight_bytes(dst->src[0], next_expert_id);
            
            // Prefetch в L2 cache (T1) — оптимально для Zen 4
            // Шаг 64 байт = размер cache line
            for (size_t offset = 0; offset < weight_size; 
                 offset += 64 * 16) { // Каждые 16 cache lines
                _mm_prefetch(next_weights + offset, _MM_HINT_T1);
            }
        }
        
        // Выполнить matmul текущего эксперта
        // (пока считаем — данные следующего едут из RAM в L2)
        mul_mat_kernel(expert_weights[expert_id], input, output);
    }
}
```

### 1.4 Cross-Layer Prefetch (более агрессивный)

**Файл**: `src/llama-graph.cpp`

Идея: предсказать экспертов для layer N+1 пока считаем layer N.

```cpp
// В функции построения графа для MoE layer:
// После router layer N — добавить callback для prefetch layer N+1

// Вставить операцию prefetch как GGML custom op:
struct ggml_tensor * prefetch_hint = ggml_custom_op(ctx,
    model.layers[il + 1].ffn_gate_exps,  // веса следующего layer
    expert_ids,                           // эксперты текущего layer
    prefetch_callback);                   // custom callback

// callback делает:
// 1. Использует expert_ids текущего слоя как hint
//    (корреляция между слоями обычно > 60% для MoE)
// 2. Prefetch весов этих же экспертов в следующем слое
```

### 1.5 Как дать задание AI-агенту (Phase 1)

**Промпт для Claude Opus / Codex:**

```
Задача: Добавить software prefetching в MoE inference path ik_llama.cpp 
для CPU-only конфигурации на AMD Zen 4.

Контекст: CPU-only inference MoE-моделей (Qwen3-Next 80B, GPT-OSS 120B). 
Bottleneck — загрузка expert weights из RAM. На Zen 4 с DDR5-6200 
bandwidth ~100 GB/s, но latency ~100ns для random access.

Шаги:
1. Найти в src/llama-graph.cpp как строится MoE-блок для архитектур 
   "gptoss" и "qwen3moe" / "qwen3next". Найти где вычисляется router 
   (ffn_gate_inp) и где вызывается MUL_MAT_ID.

2. В ggml/src/ggml-cpu/ggml-cpu.cpp найти обработчик 
   GGML_OP_MUL_MAT_ID. Понять как он итерирует по экспертам.

3. Добавить _mm_prefetch() с hint _MM_HINT_T1 для весов следующего 
   эксперта в очереди. Prefetch stride: каждые 1024 байт (16 cache 
   lines × 64 bytes).

4. Обернуть в #ifdef __AVX512F__ чтобы не ломать другие платформы.

5. Добавить CLI флаг --prefetch-experts (default: off) для A/B testing.

Файлы для изучения:
- src/llama-graph.cpp (MoE graph construction)
- ggml/src/ggml-cpu/ggml-cpu.cpp (CPU compute forward)
- ggml/src/ggml-cpu/iqk_mul_mat.cpp (IQK matmul kernels)
```

---

## Phase 2: NUMA-aware Expert Allocation (Дни 5-7)

### Потенциал: +10-20% TG speed

### 2.1 Проблема

7950X имеет 2 CCD, каждый со своим 32 МБ L3. Cross-CCD доступ через Infinity Fabric добавляет ~3x латентность. Сейчас ik_llama.cpp аллоцирует тензоры через стандартный malloc, который размещает данные на NUMA node потока, который первым к ним обратился (first-touch policy).

### 2.2 Точка вмешательства: Аллокатор тензоров

**Файл**: `ggml/src/ggml-alloc.c`

Функция `ggml_gallocr_alloc_graph()` — распределяет буферы для тензоров графа.

**Файл**: `ggml/src/ggml-backend.cpp`

Функция `ggml_backend_cpu_buffer_type()` и связанные — создают CPU буферы.

**Файл**: `src/llama-model.cpp`

Функция `llm_load_tensors()` — загружает веса модели. Здесь expert weights 
аллоцируются и заполняются данными из GGUF файла.

### 2.3 Реализация NUMA-aware allocation

```cpp
// Новый файл: ggml/src/ggml-cpu/ggml-numa-alloc.h

#pragma once
#include <numa.h>
#include <numaif.h>

struct ggml_numa_config {
    int n_nodes;           // Количество NUMA nodes (2 для 7950X)
    int n_cores_per_node;  // Ядер на node (8 для 7950X)
    bool enabled;
};

// Аллоцировать expert weights с NUMA affinity
static void * ggml_numa_alloc_expert(
    size_t size, 
    int expert_id, 
    int total_experts,
    struct ggml_numa_config * cfg) {
    
    if (!cfg->enabled || cfg->n_nodes <= 1) {
        return malloc(size);
    }
    
    // Распределить экспертов по NUMA nodes равномерно
    int target_node = expert_id / (total_experts / cfg->n_nodes);
    if (target_node >= cfg->n_nodes) target_node = cfg->n_nodes - 1;
    
    void * ptr = numa_alloc_onnode(size, target_node);
    if (!ptr) ptr = malloc(size); // fallback
    
    return ptr;
}
```

### 2.4 Thread Affinity для Expert Computation

**Файл**: `ggml/src/ggml-cpu/ggml-cpu.cpp`

В threadpool scheduling модифицировать назначение потоков:

```cpp
// При обработке MUL_MAT_ID:
// Назначить потоки CCD0 для экспертов [0..N/2-1]
// Назначить потоки CCD1 для экспертов [N/2..N-1]

static void schedule_expert_threads(
    int expert_id, int total_experts, int n_threads,
    struct ggml_numa_config * cfg) {
    
    int target_node = expert_id / (total_experts / cfg->n_nodes);
    int cores_per_node = n_threads / cfg->n_nodes;
    
    // Установить affinity только на ядра целевого NUMA node
    cpu_set_t cpuset;
    CPU_ZERO(&cpuset);
    int start_core = target_node * cores_per_node;
    for (int i = start_core; i < start_core + cores_per_node; i++) {
        CPU_SET(i, &cpuset);
    }
    pthread_setaffinity_np(pthread_self(), sizeof(cpuset), &cpuset);
}
```

### 2.5 Промпт для AI-агента (Phase 2)

```
Задача: Реализовать NUMA-aware memory allocation для MoE expert weights 
в ik_llama.cpp, оптимизировано для AMD Ryzen 9 7950X (2 CCD, 2 NUMA nodes).

Контекст: 7950X имеет 2 чиплета с отдельными 32MB L3 кэшами.
Cross-CCD latency ~3x. Expert weights MoE-моделей (512 экспертов для 
Qwen3-Next, 128 для GPT-OSS) загружаются через malloc без NUMA awareness.

Требования:
1. В src/llama-model.cpp, в функции llm_load_tensors(), найти где 
   аллоцируются тензоры expert weights (ffn_gate_exps, ffn_up_exps, 
   ffn_down_exps). Модифицировать аллокацию с использованием 
   numa_alloc_onnode().

2. Распределить экспертов: первая половина на NUMA node 0, 
   вторая на NUMA node 1.

3. В ggml-cpu.cpp при обработке MUL_MAT_ID — направлять потоки 
   на NUMA node, где находятся данные эксперта.

4. Добавить CLI флаг --numa-experts [auto|off|interleave|split] 
   (default: auto — detect NUMA topology).

5. Использовать libnuma. Добавить в CMakeLists.txt:
   find_package(NUMA)
   target_link_libraries(ggml-cpu PRIVATE numa)

Файлы для изучения:
- src/llama-model.cpp (llm_load_tensors)
- ggml/src/ggml-alloc.c (tensor allocation)
- ggml/src/ggml-cpu/ggml-cpu.cpp (thread scheduling)
- CMakeLists.txt (build system)
```

---

## Phase 3: Hot Expert Caching (Дни 8-9)

### Потенциал: +5-10% TG speed

### 3.1 Концепция

В MoE-моделях распределение активации экспертов не равномерное. Shared experts активируются для каждого токена. Некоторые routed experts статистически "горячее" других.

### 3.2 Реализация: Runtime Heat Tracking

**Новый файл**: `src/llama-expert-cache.h`

```cpp
#pragma once
#include <atomic>
#include <algorithm>
#include <cstring>
#include <sys/mman.h>

#define MAX_LAYERS 128
#define MAX_EXPERTS 1024
#define HOT_SET_SIZE 32  // Сколько экспертов "прибивать" к кэшу

struct expert_heat_tracker {
    // Счётчики активации [layer][expert]
    std::atomic<uint64_t> counts[MAX_LAYERS][MAX_EXPERTS];
    int n_layers;
    int n_experts;
    uint64_t update_interval;  // Каждые N токенов пересчитывать hot set
    uint64_t token_counter;
    
    // Указатели на веса экспертов для mlock/madvise
    struct expert_weight_info {
        void * data;
        size_t size;
        bool is_locked;
    } weights[MAX_LAYERS][MAX_EXPERTS];
    
    void init(int layers, int experts) {
        n_layers = layers;
        n_experts = experts;
        update_interval = 256;  // Каждые 256 токенов
        token_counter = 0;
        memset(counts, 0, sizeof(counts));
    }
    
    void record_activation(int layer, int expert_id) {
        counts[layer][expert_id].fetch_add(1, std::memory_order_relaxed);
    }
    
    void maybe_update_hot_set() {
        if (++token_counter % update_interval != 0) return;
        
        for (int l = 0; l < n_layers; l++) {
            // Собрать counts для этого слоя
            struct { int id; uint64_t count; } sorted[MAX_EXPERTS];
            for (int e = 0; e < n_experts; e++) {
                sorted[e] = {e, counts[l][e].load(std::memory_order_relaxed)};
            }
            
            // Partial sort — найти top-HOT_SET_SIZE
            std::partial_sort(sorted, sorted + HOT_SET_SIZE, 
                            sorted + n_experts,
                            [](auto& a, auto& b) { return a.count > b.count; });
            
            // madvise(MADV_WILLNEED) для горячих экспертов
            for (int i = 0; i < HOT_SET_SIZE && i < n_experts; i++) {
                auto& w = weights[l][sorted[i].id];
                if (w.data && !w.is_locked) {
                    madvise(w.data, w.size, MADV_WILLNEED);
                    w.is_locked = true;
                }
            }
            
            // madvise(MADV_DONTNEED) для холодных (optional, агрессивно)
            // Не делаем — пусть OS управляет
        }
    }
};
```

### 3.3 Интеграция

**Файл**: `src/llama-context.cpp`

Добавить `expert_heat_tracker` в `llama_context`:

```cpp
struct llama_context {
    // ... existing fields ...
    expert_heat_tracker expert_cache;  // НОВОЕ
};
```

**Файл**: `ggml/src/ggml-cpu/ggml-cpu.cpp`

В обработчике `MUL_MAT_ID` — записывать активации:

```cpp
// После выбора экспертов, перед matmul:
if (ctx->expert_cache.n_experts > 0) {
    for (int e = 0; e < n_experts_used; e++) {
        ctx->expert_cache.record_activation(current_layer, ids[e]);
    }
    ctx->expert_cache.maybe_update_hot_set();
}
```

---

## Phase 4: AVX-512 Kernel Micro-optimizations (Дни 10-12)

### Потенциал: +5-15% PP speed

### 4.1 Проверка использования VNNI

**Файл**: `ggml/src/ggml-cpu/iqk_mul_mat.cpp`

Это основной файл с IQK matmul kernels. Проверить:

```bash
# Какие AVX-512 инструкции реально генерируются?
objdump -d build/ggml/src/ggml-cpu/CMakeFiles/ggml-cpu.dir/iqk_mul_mat.cpp.o \
  | grep -c vpdpbusd   # VNNI dot product
  
objdump -d build/ggml/src/ggml-cpu/CMakeFiles/ggml-cpu.dir/iqk_mul_mat.cpp.o \
  | grep -c vpmaddubsw  # Fallback multiply-add

# Если vpdpbusd count == 0, VNNI не используется → потенциал!
```

### 4.2 Оптимизация dequant loop для Zen 4

Zen 4 AVX-512 — double-pumped (256-bit execution units). Это означает:

- `_mm512_*` → 2 микрооперации (не 1 как на Intel)
- Throughput: 1 AVX-512 op / 2 cycles  
- НО: меньше переключений между 256/512 режимами (нет VZEROUPPER penalty)

**Оптимальная стратегия для Zen 4**: использовать AVX-512 для удобства (ширина), но не ожидать 2x throughput vs AVX2.

```cpp
// В iqk_mul_mat.cpp — проверить есть ли Zen4-специфичный path
// Искать: #ifdef __AVX512VNNI__ или __AVXVNNI__

// Для IQ4_K dequant + dot product:
// Оптимальный Zen4 pattern:
__m512i dot_product_vnni(const __m512i a, const __m512i b) {
    __m512i acc = _mm512_setzero_si512();
    // VPDPBUSD: 4 × uint8*int8 → int32, accumulated
    return _mm512_dpbusd_epi32(acc, a, b);
    // На Zen 4: 2 cycles throughput (double-pumped)
    // Но одна инструкция вместо 4 отдельных multiply+add
}
```

### 4.3 Промпт для AI-агента (Phase 4)

```
Задача: Аудит и оптимизация AVX-512 kernels в iqk_mul_mat.cpp 
для AMD Zen 4 (Ryzen 9 7950X).

Контекст: Zen 4 реализует AVX-512 через double-pumping 256-bit 
execution units. VNNI доступен (VPDPBUSD). Целевые кванты: 
IQ3_KS, IQ4_KS, IQ4_K_R4.

Шаги:
1. Изучить ggml/src/ggml-cpu/iqk_mul_mat.cpp
2. Найти kernels для IQ4_KS и IQ4_K_R4 (row-interleaved)
3. Проверить используется ли VPDPBUSD (AVX512-VNNI) в dequant 
   + dot product path
4. Если нет — добавить VNNI path под #ifdef __AVX512VNNI__
5. Для Zen 4: предпочитать 2 × __m256i операции вместо 1 × __m512i 
   где throughput одинаковый, но latency ниже
6. Добавить __builtin_prefetch для следующего block_q в inner loop
7. Benchmark дельту через llama-sweep-bench
```

---

## Phase 5: Gated DeltaNet Optimization для Qwen3-Next (Дни 13-15)

### Потенциал: variable (зависит от текущей реализации)

### 5.1 Что такое Gated DeltaNet в Qwen3-Next

Архитектура: `12 × (3 × (Gated DeltaNet → MoE) → 1 × (Gated Attention → MoE))`

Gated DeltaNet — linear attention с recurrent state:
- O(n) complexity вместо O(n²) для softmax attention
- State: матрица S ∈ R^{d_k × d_v}
- Update: S_t = α_t ⊙ S_{t-1} + β_t · v_t · k_t^T

### 5.2 Точка вмешательства

**Файл**: `src/llama-graph.cpp`

Искать реализацию Qwen3-Next (или gated_deltanet). Это может быть:
- `build_qwen3next()`
- Или generic path с условием на `model.arch == LLM_ARCH_QWEN3NEXT`

```cpp
// Ключевой цикл для DeltaNet state update:
// Текущая наивная реализация (если есть):
for (int t = 0; t < seq_len; t++) {
    // gate: α_t = sigmoid(gate_input[t])
    // state update: S = α * S + β * outer(v[t], k[t])
    // output: o[t] = S @ q[t]
}

// Оптимизированная версия — blocked state update:
// Обрабатывать по chunk_size токенов за раз
// Аккумулировать Δ через chunk, применить один раз
const int chunk_size = 64; // Подобрать под L2 cache
for (int chunk = 0; chunk < seq_len; chunk += chunk_size) {
    // Batch outer products в одну матрицу
    // Одно обновление state вместо chunk_size
}
```

### 5.3 Промпт для AI-агента (Phase 5)

```
Задача: Найти и оптимизировать Gated DeltaNet реализацию для 
Qwen3-Next моделей в ik_llama.cpp для CPU inference.

Контекст: Qwen3-Next 80B использует hybrid attention — 3 из 4 
attention blocks используют Gated DeltaNet (linear attention) 
вместо стандартного softmax attention. Linear attention O(n) 
вместо O(n²), но state update (матрица d_k × d_v) может быть 
наивно реализован.

Шаги:
1. В src/llama-graph.cpp найти как строится граф для Qwen3-Next:
   - Искать LLM_ARCH_QWEN3NEXT или "qwen3next" или "deltanet"
   - Найти state update loop для DeltaNet
   
2. Проверить: реализован ли DeltaNet как recurrent loop (по токенам) 
   или как matmul (batched)
   
3. Для token generation (batch=1): recurrent state update — 
   оптимизировать через AVX-512 SIMD для outer product и 
   elementwise gate multiplication
   
4. Для prompt processing (batch>1): проверить можно ли сделать 
   parallel scan или chunkwise recurrence для батча

5. Проверить alignment state матрицы для AVX-512 (64-byte aligned)

Файлы:
- src/llama-graph.cpp
- ggml/src/ggml.c (custom ops)
- ggml/src/ggml-cpu/ggml-cpu.cpp
```

---

## Сводная таблица изменений

| Phase | Файлы | Изменение | Сложность | Импакт |
|-------|-------|-----------|-----------|--------|
| 1 | ggml-cpu.cpp | Expert prefetching | Средняя | +15-30% TG |
| 2 | llama-model.cpp, ggml-cpu.cpp | NUMA allocation | Высокая | +10-20% TG |
| 3 | llama-context.cpp, ggml-cpu.cpp | Hot expert caching | Низкая | +5-10% TG |
| 4 | iqk_mul_mat.cpp | VNNI kernels | Высокая | +5-15% PP |
| 5 | llama-graph.cpp | DeltaNet optimization | Очень высокая | Variable |

## Инструменты для валидации

```bash
# A/B тестирование каждого изменения:
./bin/llama-sweep-bench -m model.gguf -t 16 -fa 1 -c 4096

# Perplexity проверка (убедиться что не сломали качество):
./bin/llama-perplexity -m model.gguf -f wiki.test.raw

# Memory bandwidth utilization:
perf stat -e offcore_response.demand_data_rd.l3_miss.any_snoop \
  ./bin/llama-cli -m model.gguf -p "Hello" -n 100

# Flamegraph для визуализации hotspots:
perf record -g ./bin/llama-cli -m model.gguf -p "Hello" -n 100
perf script | stackcollapse-perf.pl | flamegraph.pl > flame.svg
```

## Замечания по безопасности изменений

1. **Все оптимизации за feature flags** — `--prefetch-experts`, `--numa-experts`, etc.
2. **Fallback на стандартный путь** при ошибках (нет libnuma, NUMA topology не определена)
3. **Perplexity не должна измениться** — все оптимизации чисто compute/memory, не меняют математику
4. **Компиляция без NUMA** должна работать — `#ifdef HAVE_NUMA`

---

*Plan version: 1.0 | Target: ik_llama.cpp main branch | Hardware: AMD 7950X + 96GB DDR5*
