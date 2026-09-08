Отличная тема, Андрей. Давай разберём реалистичные направления оптимизации, ранжированные по потенциальному импакту для твоего конкретного сетапа.



\## Архитектура твоего железа — что важно понимать



Zen 4 7950X имеет несколько особенностей, которые ik\_llama.cpp использует не полностью:



\*\*Dual CCD\*\* — два чиплета по 8 ядер, каждый со своим L3 кэшем (32 МБ). Межчиплетная связь через Infinity Fabric добавляет латентность. Если поток на CCD0 лезет в память, закреплённую за CCD1 — штраф.



\*\*AVX-512 на Zen 4\*\* — реализован через 256-битные исполнительные блоки (double-pumped). Это значит AVX-512 не даёт 2x throughput vs AVX2, но даёт удобство 512-битных инструкций и \*\*AVX512-VNNI\*\* (Vector Neural Network Instructions) для целочисленных dot product.



\*\*DDR5 dual channel\*\* — ~100 ГБ/с теоретический bandwidth на 6200. Это hard ceiling для token generation в MoE-моделях.



То, что 6200 работает стабильнее и быстрее чем 6800 — скорее всего tRFC или tREFI на 6800 не вытягивают, и контроллер вынужден вставлять дополнительные циклы ожидания. Правильно настроенные тайминги важнее частоты.



---



\## Направления оптимизации (от высокого импакта к низкому)



\### 1. 🔥 Expert Prefetching для MoE (потенциал: +15-30% TG)



Это самое перспективное направление. Суть проблемы: в MoE-модели router решает, какие эксперты активировать. Но к моменту, когда решение принято, данные экспертов нужно подтянуть из RAM → L3 → L2. При 96 ГБ RAM и модели на 40-60 ГБ большинство экспертов живут в RAM, а не в кэше.



\*\*Идея\*\*: router logits вычисляются ДО применения экспертов. Можно:



\- После вычисления router scores сразу выдать `\_\_builtin\_prefetch()` / `\_mm\_prefetch()` на веса top-K экспертов

\- Пока идёт attention или другие вычисления — данные уже едут из RAM в кэш

\- Для GPT-OSS (4 эксперта из 128) и Qwen3-Next (10 из 512) — это особенно выгодно, потому что активные эксперты — малая доля от общего числа



```cpp

// Псевдокод: после router forward pass

auto top\_k\_experts = router.get\_top\_k(logits, k=4);

for (auto\& expert\_id : top\_k\_experts) {

&nbsp;   // Prefetch weights следующих экспертов пока считаем текущий слой

&nbsp;   prefetch\_expert\_weights(layer + 1, expert\_id, \_MM\_HINT\_T0);

}

```



\*\*Более агрессивный вариант\*\* — speculative prefetch: на основе статистики предыдущих токенов предсказывать вероятные эксперты для следующего токена и начинать prefetch ещё раньше. MoE-модели часто показывают temporal locality в выборе экспертов.



Это реализуемо через AI-агент: нужно найти в коде ik\_llama.cpp точки после router computation и перед expert execution, и вставить prefetch-логику.



---



\### 2. 🔥 CCD-aware Expert Partitioning (потенциал: +10-20% TG)



7950X = 2 × CCD, каждый с 32 МБ L3. Сейчас ik\_llama.cpp не знает про топологию CCD.



\*\*Идея\*\*: распределить экспертов между CCD так, чтобы каждый CCD обрабатывал «свою» порцию экспертов, минимизируя cross-CCD трафик:



\- Закрепить threads 0-7 на CCD0, 8-15 на CCD1 через `pthread\_setaffinity\_np`

\- Разделить expert weights пополам: эксперты 0-63 → NUMA node 0, эксперты 64-127 → NUMA node 1

\- При вычислении expert forward — направлять работу на CCD, где живут данные



```cpp

// Закрепление памяти экспертов на конкретных NUMA нодах

void\* alloc\_expert\_on\_node(int expert\_id, size\_t size) {

&nbsp;   int numa\_node = expert\_id < (n\_experts / 2) ? 0 : 1;

&nbsp;   return numa\_alloc\_onnode(size, numa\_node);

}

```



Для Qwen3-Next с 512 экспертами это особенно актуально — каждый эксперт маленький (expert intermediate dimension = 512), и cache locality становится критичной.



---



\### 3. 🔧 AVX512-VNNI оптимизация дequant kernels (потенциал: +5-15% PP)



AVX512-VNNI даёт инструкцию `VPDPBUSD` — dot product байтов с аккумуляцией в int32. Для IQ-квантов ik\_llama.cpp основные kernels уже хорошо оптимизированы, но есть нюансы:



\- Для Trellis-квантов (IQ\*\_KT) деquантизация может не использовать VNNI полностью

\- Row-interleaved кванты (\_R4) уже оптимизированы, но можно проверить, используют ли они VNNI-пути на Zen 4



\*\*Что можно сделать\*\*: профилировать с `perf stat` какие инструкции реально используются и где bottleneck — в compute или в memory:



```bash

perf stat -e instructions,cycles,cache-misses,cache-references \\

&nbsp;   ./llama-cli -m model.gguf -p "test" -n 100

```



Если `cache-misses` высокий — проблема в bandwidth (→ фокус на prefetching). Если `instructions/cycle` низкий — проблема в compute (→ фокус на VNNI).



---



\### 4. 🔧 Gated DeltaNet kernel для Qwen3-Next (потенциал: variable)



Qwen3-Next использует нестандартный attention. Gated DeltaNet — это linear attention вариант с гейтингом из Mamba2, где 3 из 4 слоёв используют DeltaNet вместо стандартного softmax attention. Это потенциально большое преимущество для CPU — linear attention O(n) вместо O(n²).



Вопрос: насколько хорошо ik\_llama.cpp (и mainline llama.cpp) реализует этот путь? Если реализация наивная — есть потенциал для оптимизации recurrent state update:



```

// DeltaNet state update (упрощённо):

// S\_t = α\_t \* S\_{t-1} + β\_t \* v\_t \* k\_t^T

// Можно оптимизировать через blocked state updates

// и AVX-512 для матричных операций на state

```



Это сложная оптимизация, но AI-агент может помочь разобраться в текущей реализации и найти узкие места.



---



\### 5. 💡 Expert Weight Caching / Hot Expert Pool (потенциал: +5-10% TG)



Наблюдение: в MoE-моделях некоторые эксперты активируются гораздо чаще других (shared experts, «популярные» routing paths). 



\*\*Идея\*\*: runtime профилирование частоты активации экспертов + закрепление hot experts в памяти с `mlock()` и hint для аллокации ближе к L3:



```cpp

struct ExpertHeatMap {

&nbsp;   std::atomic<uint64\_t> activation\_count\[MAX\_EXPERTS];

&nbsp;   

&nbsp;   void update\_hot\_set(int layer) {

&nbsp;       // Топ-N самых горячих экспертов → madvise(MADV\_WILLNEED)

&nbsp;       auto hot = get\_top\_n\_experts(layer, HOT\_SET\_SIZE);

&nbsp;       for (auto\& e : hot) {

&nbsp;           madvise(expert\_weights\[layer]\[e], size, MADV\_WILLNEED);

&nbsp;       }

&nbsp;   }

};

```



---



\### 6. 💡 Micro-batched Token Generation (потенциал: +5-10% PP)



При prompt processing можно группировать токены в micro-batches, оптимизированные под размер L3 кэша. Вместо обработки всего prompt целиком (что вытесняет кэш) — обрабатывать блоками по 64-128 токенов, которые помещаются в L3 с весами.



---



\## Практический план атаки



Если будешь делать это через Claude Opus / Codex, вот рекомендуемый порядок:



\*\*Фаза 1: Profiling (день 1)\*\*

\- Собрать baseline бенчмарки для обеих моделей

\- `perf stat` + `perf record` для определения bottleneck

\- Проверить NUMA topology: `numactl --hardware`, `lstopo`



\*\*Фаза 2: Expert Prefetching (дни 2-4)\*\*

\- Найти в коде ik\_llama.cpp места `ggml\_compute\_forward\_mul\_mat` для MoE

\- Добавить prefetch после router logits computation

\- Замерить дельту



\*\*Фаза 3: NUMA-aware allocation (дни 5-7)\*\*

\- Модифицировать аллокатор для expert weights

\- Привязка потоков к CCD через affinity masks

\- Замерить дельту



\*\*Фаза 4: Fine-tuning (дни 8+)\*\*

\- VNNI paths, DeltaNet kernels, hot expert caching



\## Реалистичные ожидания



Суммарно, если всё пойдёт хорошо, можно ожидать \*\*+20-40% token generation speed\*\* для MoE-моделей на твоём конкретном железе. Для Qwen3-Next 80B это может означать разницу между 12 t/s и 16-17 t/s — заметное улучшение в интерактивном использовании.



Самый большой вопрос — expert prefetching. Если router prediction работает и данные успевают приехать из RAM до того, как они нужны — это может быть game changer для CPU-only MoE инференса. По сути, ты конвертируешь latency-bound задачу в bandwidth-bound, что для DDR5-6200 с хорошими таймингами — выгодная сделка.



Хочешь, чтобы я подготовил более детальный технический план с конкретными файлами и функциями в ik\_llama.cpp, куда нужно вносить изменения?

