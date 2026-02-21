# ik_llama.cpp — Руководство по исполняемым файлам

Сборка: MSVC 19.41, AVX-512 + IQK (Zen4), Release
Целевой CPU: AMD Ryzen 9 7950X

## Основные — повседневное использование

### llama-cli.exe — универсальный чат/генерация

Самый частый сценарий. Подходит для любых текстовых GGUF-моделей.

```
llama-cli.exe -m model.gguf -t 8 -c 4096 --conversation
```

Модели: LLaMA 3, Qwen 2.5, Mistral, Phi, DeepSeek, Gemma и любые другие text-only модели.

### llama-server.exe — HTTP-сервер с OpenAI-совместимым API

Когда нужно подключаться из других программ (SillyTavern, Open WebUI, собственные скрипты).

```
llama-server.exe -m model.gguf -t 8 -c 4096 --port 8080
```

Endpoint: `http://localhost:8080/v1/chat/completions`. Те же модели что и для cli.

### llama-infill.exe — дописывание кода (Fill-in-the-Middle)

Для code-completion моделей, обученных с FIM-токенами.

Модели: CodeLlama, DeepSeek Coder, StarCoder, Qwen2.5-Coder.

---

## Мультимодальные (текст + изображения)

### llama-llava-cli.exe — LLaVA-архитектура

```
llama-llava-cli.exe -m model.gguf --mmproj mmproj.gguf --image photo.jpg -p "Describe this image"
```

Модели: LLaVA 1.5/1.6, BakLLaVA, Obsidian.

### llama-minicpmv-cli.exe — MiniCPM-V

Модели: MiniCPM-V 2.5/2.6 (компактные vision-модели, хорошо работают на CPU).

### llama-mtmd-cli.exe — универсальный multimodal

Более новый мультимодальный CLI с поддержкой разных архитектур.

### llama-gemma3-cli.exe — Gemma 3 vision

Модели: Gemma 3 (4B, 12B, 27B) — поддерживают и текст, и изображения.

### llama-qwen2vl-cli.exe — Qwen2-VL

Модели: Qwen2-VL (vision-language).

---

## Инструменты для работы с моделями

### llama-quantize.exe — квантизация

Конвертирует модель в меньший формат.

```
llama-quantize.exe model-f16.gguf model-q4_k_m.gguf Q4_K_M
```

Популярные типы квантизации для Ryzen 9 7950X:

| Тип | Размер (7B) | Качество | Скорость |
|---|---|---|---|
| Q8_0 | ~7 GB | Почти без потерь | Базовая |
| Q6_K | ~5.5 GB | Отличное | Быстрее |
| Q4_K_M | ~4 GB | Хорошее | Ещё быстрее |
| IQ3_S | ~3 GB | Приемлемое | Самая быстрая |

### llama-imatrix.exe — importance matrix

Создаёт матрицу важности для более качественной квантизации (особенно на IQ-типах).

```
llama-imatrix.exe -m model-f16.gguf -f calibration_data.txt -o imatrix.dat
llama-quantize.exe --imatrix imatrix.dat model-f16.gguf model-iq3s.gguf IQ3_S
```

### llama-gguf-split.exe — разделение/объединение GGUF

Для моделей, которые не помещаются в один файл или скачаны частями.

### llama-gguf.exe — просмотр метаданных GGUF

Полезно чтобы посмотреть что внутри файла модели (архитектура, квантизация, контекст).

---

## Бенчмарки и оценка

### llama-bench.exe — замер производительности

```
llama-bench.exe -m model.gguf -t 8
```

Покажет tok/s для prompt processing и generation. Первое что стоит запустить после сборки.

### llama-perplexity.exe — оценка качества модели

Измеряет perplexity на тестовом датасете. Полезно для сравнения квантизаций.

### llama-bench-matmult.exe — бенчмарк матричных операций

Проверка сырой скорости IQK-ядер на CPU.

---

## Speculative decoding

### llama-speculative.exe — спекулятивная генерация

Использует маленькую "draft" модель для ускорения большой.

```
llama-speculative.exe -m big-model.gguf -md draft-model.gguf -t 8
```

Пример: основная LLaMA 3 70B + draft LLaMA 3 8B. Может дать 1.5-2x ускорение generation.

---

## Embeddings / RAG

### llama-embedding.exe — извлечение embeddings

```
llama-embedding.exe -m embedding-model.gguf -p "text to embed"
```

Модели: nomic-embed, bge, e5, mxbai-embed.

### llama-retrieval.exe — поиск по базе документов

Простой RAG-поиск через embeddings.

---

## Прочие утилиты

| Файл | Назначение |
|---|---|
| llama-tokenize.exe | Токенизация текста (отладка промптов) |
| llama-export-lora.exe | Экспорт LoRA-адаптеров |
| llama-cvector-generator.exe | Генерация control vectors для управления стилем |
| llama-gbnf-validator.exe | Валидация GBNF-грамматик (structured output) |
| llama-save-load-state.exe | Сохранение/загрузка состояния сессии |
| llama-lookahead.exe | Lookahead decoding (экспериментальное ускорение) |
| llama-lookup*.exe | N-gram lookup для спекулятивного декодирования |
| llama-parallel.exe | Параллельная генерация нескольких запросов |
| llama-batched.exe | Пакетная генерация |
| llama-passkey.exe | Тест на длинный контекст (passkey retrieval) |
| llama-gritlm.exe | GritLM — модель, совмещающая генерацию и embeddings |
| llama-quantize-stats.exe | Статистика квантизации по слоям |

---

## Рекомендация для быстрого старта на Ryzen 9 7950X

1. Скачать модель: Qwen2.5-7B-Q6_K.gguf или LLaMA-3.1-8B-Q6_K.gguf
2. Замерить скорость:
   ```
   llama-bench.exe -m model.gguf -t 8
   ```
3. Чат в консоли:
   ```
   llama-cli.exe -m model.gguf -t 8 -c 8192 --conversation
   ```
4. Или запустить сервер:
   ```
   llama-server.exe -m model.gguf -t 8 -c 8192 --port 8080
   ```

Совет: используйте `-t 8` (один CCD) вместо `-t 16` — на dual-CCD процессорах межчиплетный overhead может замедлять инференс.
