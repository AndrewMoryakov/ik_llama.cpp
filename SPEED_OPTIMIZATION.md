# Оптимизация скорости ik_llama.cpp на AMD Ryzen 9 7950X

Сборка: MSVC 19.41, AVX-512 + IQK (Zen4), CPU-only, Release

---

## Три уровня оптимизации

### 1. Тип квантизации: IQx_K вместо Qx_K

ik_llama.cpp имеет собственные типы квантизации — IQ2_K, IQ3_K, IQ4_K, IQ5_K — которые и быстрее, и качественнее стандартных.

Бенчмарки на Ryzen 9 7950X (LLaMA-3.1-8B, 16 threads PP, 4 threads TG):

| Тип | PP (t/s) | TG (t/s) | Ускорение PP vs llama.cpp |
|---|---|---|---|
| **Q8_K_R8** | **370** | — | Абсолютный рекорд (~5.5 TFLOPS) |
| Q4_0 | 274 | 12.9 | 1.78x |
| Q4_K_S | 270 | 13.5 | 2.49x |
| IQ4_XS | 270 | 13.6 | **3.63x** |
| Q8_0 | 268 | 7.6 | 1.81x |
| Q6_K | 259 | 10.1 | 3.14x |
| BF16 | 257 | 4.3 | 3.27x |
| Q5_K_S | 255 | 11.4 | 3.37x |
| IQ3_S / IQ3_K | 181 | 16.1 | **6.45x** |
| IQ2_XS / IQ2_K | 195 | 21.5 | **4.19x** |

Качество IQ-типов (LLaMA-3.1-70B, QError = PPL(Q)/PPL(fp16) - 1):

| Тип | bpw | Ошибка | Сравнение |
|---|---|---|---|
| IQ5_K | ~5.5 | 1.4% | 2.1x лучше Q5_0, на 40% лучше Q5_K_S |
| IQ4_K | ~4.5 | — | 2.7x лучше Q4_0, на 40% лучше Q4_K_S |

### 2. Row-interleaved repacking (_R4 / _R8)

Тензоры модели перепаковываются для лучшего использования SIMD (AVX-512). Бесплатное ускорение без потери качества.

Два способа использования:

- Флаг `-rtr 1` при запуске — перепаковка на лету (не нужен mmap)
- Перепаковать файл навсегда:
  ```
  llama-quantize.exe --repack --repack-pattern exps model.gguf repacked.gguf q4_k_r4
  ```

### 3. Архитектура модели: MoE >> Dense

На CPU модели Mixture-of-Experts гораздо быстрее при том же уровне интеллекта, потому что активируется только малая часть параметров.

Примеры:

| Модель | Всего | Активно | Эффект |
|---|---|---|---|
| Qwen3-30B-A3B | 30B | 3B | Скорость как у 3B, интеллект как у 14-20B |
| gpt-oss-20b | 21B | 3.6B | Аналогично |
| gpt-oss-120b | 117B | 5.1B | Конкурирует с o4-mini |

---

## Бенчмарки: ik_llama.cpp vs llama.cpp (Ryzen 7950X)

### Prompt processing (pp512)

| Тип | llama.cpp (t/s) | ik_llama.cpp (t/s) | Ускорение |
|---|---|---|---|
| IQ2_XS | 46.5 | 194.6 | 4.19x |
| IQ3_S | 28.0 | 180.8 | 6.45x |
| Q4_K_S | 108.3 | 269.6 | 2.49x |
| Q5_K_S | 75.6 | 254.7 | 3.37x |
| Q6_K | 82.5 | 259.2 | 3.14x |
| Q8_0 | 148.2 | 268.2 | 1.81x |
| BF16 | 78.6 | 256.9 | 3.27x |

На Ryzen-7950X самый медленный тип в ik_llama.cpp быстрее самого быстрого типа в llama.cpp для prompt processing.

### Token generation (tg128)

| Тип | llama.cpp (t/s) | ik_llama.cpp (t/s) | Ускорение |
|---|---|---|---|
| IQ2_XS | 10.9 | 21.5 | 1.97x |
| IQ3_S | 6.8 | 16.1 | 2.37x |
| Q4_K_S | 9.6 | 13.5 | 1.41x |
| Q8_0 | 5.0 | 7.6 | 1.54x |

Token generation ускоряется меньше — bottleneck в пропускной способности DDR5 (~67 GB/s).

---

## Рекомендации для максимальной скорости

### Из имеющихся моделей

| Модель | Что сделать | Почему быстро |
|---|---|---|
| Qwen3-30B-A3B-Q4_K_M | запустить с `-rtr 1` | MoE, активны только 3B, repack ускорит PP |
| Qwen3-Coder-30B-A3B-Q4_K_M | запустить с `-rtr 1` | То же |
| gpt-oss-20b-MXFP4 | запустить как есть | MoE, нативный 4-bit |
| DeepSeek-R1-0528-Qwen3-8B-Q4_K_M | запустить с `-rtr 1` | Маленькая dense, всё в кэше |
| Qwen3-4B-Instruct-2507-Q8_0 | как есть | 4B, молниеносная |

### Что скачать для идеальной скорости

На HuggingFace искать GGUF с суффиксами IQ4_K, IQ4_XS, IQ3_K или _R4 — они специально оптимизированы для ik_llama.cpp:

- Qwen3-30B-A3B-IQ4_XS.gguf
- Qwen3-32B-IQ4_K.gguf
- любая модель с суффиксом _R4

---

## Пример запуска с максимальными оптимизациями

```
llama-cli.exe -m Qwen3-30B-A3B-Q4_K_M.gguf -t 8 -c 8192 -fa on -rtr 1 -ub 1024 -ctk q8_0 --conversation
```

Флаги:

| Флаг | Назначение |
|---|---|
| `-rtr 1` | Repack в R4 формат на лету |
| `-ub 1024` | Увеличенный u-batch (лучше для MoE) |
| `-ctk q8_0` | Квантизация KV-кэша (экономит RAM, ускоряет длинный контекст) |
| `-fa on` | Flash Attention (IQK-ядра) |
| `-t 8` | Один CCD (избежать overhead dual-CCD) |

---

## Формула максимальной скорости

**MoE архитектура + IQx_K квантизация + R4 repack + Flash Attention = максимум tok/s**

---

## Источники

- [ik_llama.cpp CPU performance comparison (Discussion #164)](https://github.com/ikawrakow/ik_llama.cpp/discussions/164)
- [New IQ2_K, IQ3_K, IQ4_K, IQ5_K types (Discussion #8)](https://github.com/ikawrakow/ik_llama.cpp/discussions/8)
- [Quick-start guide (Discussion #258)](https://github.com/ikawrakow/ik_llama.cpp/discussions/258)
- [Jan 2025 performance wiki](https://github.com/ikawrakow/ik_llama.cpp/wiki/Jan-2025:-prompt-processing-performance-comparison)
