# Анализ совместимости моделей с ik_llama.cpp

Сборка: MSVC 19.41, AVX-512 + IQK (Zen4), CPU-only, Release
Целевой CPU: AMD Ryzen 9 7950X (96 GB DDR5)
Версия: commit 3330890 (Merge #1211)

Важно:

- этот документ в первую очередь про совместимость и общие рекомендации по семействам моделей
- он не является главным документом по текущей performance-стратегии форка
- текущий стратегический фокус форка: большие MoE-модели, в том числе модели, которые не помещаются в RAM целиком

Сначала стоит прочитать:

- `../strategy/FORK_GOAL_AND_SCOPE_2026-02-28.md`
- `MINIMAX_M2_5_RUNTIME.md`
- `../runbooks/GUIDE.md`

Поддерживаемые архитектуры: llama, llama4, falcon, grok, gpt2, gptj, gptneox, mpt, baichuan, starcoder, starcoder2, bert, nomic-bert, jina-bert-v2, bloom, stablelm, qwen, qwen2, qwen2moe, qwen2vl, qwen3, qwen3moe, qwen3vl, qwen3vlmoe, phi2, phi3, gemma, gemma2, gemma3, mamba, command-r, dbrx, olmo, openelm, arctic, deepseek2, chatglm, glm4, glm4moe, t5, granite, granitemoe, cohere2, dots1, ernie4_5, hunyuan-moe, **gpt-oss (MXFP4)**, bailingmoe2, minimax-m2, smollm3, mistral3, mimo2 и др.

---

## Топ-выбор для Ryzen 9 7950X

| Модель | Архитектура | RAM | Комментарий |
|---|---|---|---|
| Qwen3-32B-Q6_K | qwen3 | ~25 GB | Лучшее соотношение качество/размер |
| QwQ-32B-Q4_K_M | qwen2 | ~19 GB | Сильная reasoning-модель |
| DeepSeek-R1-Distill-Qwen-32B-Q6_K | qwen2 | ~25 GB | Reasoning, chain-of-thought |
| DeepSeek-R1-Distill-Qwen-14B-Q8_0 | qwen2 | ~15 GB | Хороший баланс |
| Qwen2.5-14B-Instruct-Q8_0 | qwen2 | ~15 GB | Универсальная, высокое качество |
| phi-4-Q8_0 | phi3 | ~15 GB | Microsoft, хороша для рассуждений |
| Phi-4-reasoning-plus-Q8_0 | phi3 | ~15 GB | Усиленная reasoning-версия |
| gemma-3-27b-it-Q8_0 | gemma3 | ~28 GB | Google, мультимодальная (+ mmproj) |

---

## Быстрые модели (<16 GB, помещаются в один CCD)

| Модель | RAM | Комментарий |
|---|---|---|
| Meta-Llama-3.1-8B-Instruct-Q8_0 | ~8 GB | Классика, быстрая |
| Hermes-3-Llama-3.1-8B-Q8_0 | ~8 GB | Function calling, агентные задачи |
| DeepSeek-R1-0528-Qwen3-8B-Q4_K_M | ~5 GB | Свежий R1, reasoning |
| DeepSeek-R1-Distill-Qwen-7B-Q4_K_M | ~4 GB | Компактный reasoning |
| Mistral-Nemo-Instruct-2407-Q8_0 | ~13 GB | 12B, хороший универсал |
| GLM-4.7-Flash-Q8_0 | ~5 GB | Быстрая китайская модель |
| Qwen3-4B-Instruct-2507-Q8_0 | ~5 GB | Новейшая, с thinking mode |
| gemma-3-4b-it-Q8_0 | ~5 GB | Компактная мультимодальная |

---

## Код

| Модель | RAM | Комментарий |
|---|---|---|
| qwen2.5-coder-32b-instruct-q8_0 (5 частей) | ~34 GB | Лучший open-source кодер, влезет в 64 GB |
| Qwen3-Coder-30B-A3B-Instruct-Q4_K_M | ~18 GB | MoE, активны только 3B — очень быстрая |
| Devstral-Small-2505-Q4_K_M | ~14 GB | Mistral, хороша для кода |
| DeepSeek-Coder-V2-Lite-Instruct-Q8_0_L | ~18 GB | MoE, кодинг |
| DeepSeek-Coder-V2-Lite-Instruct-Q5_K_L | ~12 GB | Та же, легче |
| Trinity-2-Codestral-22B-Q5_K_S | ~15 GB | Codestral-based |
| qwen2.5-coder-3b-instruct-q4_k_m | ~2 GB | Ультра-быстрая, для автокомплита |

---

## MoE (Mixture of Experts) — быстрые при своём размере

| Модель | Всего / Активно | RAM | Комментарий |
|---|---|---|---|
| Qwen3-30B-A3B-Q4_K_M | 30B / 3B | ~18 GB | Быстрая, активны только 3B параметров |
| Qwen3-30B-A3B-Instruct-2507-Q4_K_M | 30B / 3B | ~18 GB | Новейшая instruct-версия |
| Qwen3-Next-80B-A3B (2 части) | 80B / 3B | ~50 GB | Самая умная MoE, влезет в 64 GB |
| mixtral-8x7b-instruct-Q2_K | 47B / 13B | ~16 GB | Старая, Q2_K — низкое качество |

---

## GPT-OSS (OpenAI open-weight)

| Модель | RAM | Комментарий |
|---|---|---|
| gpt-oss-20b-MXFP4 | ~12 GB | Нативный MXFP4, отлично для CPU |
| gpt-oss-120b-MXFP4 (2 части) | ~60 GB | Влезет в 64 GB, но будет медленно (swap) |

Поддержка подтверждена: архитектура `gpt-oss` и тип `MXFP4` присутствуют в коде ik_llama.cpp.

---

## Мультимодальные (текст + изображения)

Требуют специальный exe и файл vision-проектора (`--mmproj`).

| Модель | Exe | mmproj |
|---|---|---|
| gemma-3-27b-it-Q8_0 | llama-gemma3-cli.exe | mmproj-model-f16.gguf (рядом) |
| gemma-3-4b-it-Q8_0 | llama-gemma3-cli.exe | mmproj-model-f16.gguf (рядом) |
| llava-v1.5-7b-Q8_0 | llama-llava-cli.exe | llava-v1.5-7b-mmproj-model-f16.gguf |
| LLaVA-NeXT-Video-7B-DPO-F16 | llama-llava-cli.exe | mmproj-model-f32.gguf |

Пример запуска:

```
llama-gemma3-cli.exe -m gemma-3-27b-it-Q8_0.gguf --mmproj mmproj-model-f16.gguf --image photo.jpg -t 8
```

---

## Остальные совместимые модели

| Модель | Комментарий |
|---|---|
| ArliAI-RPMax-12B-Q4_K_S | RP / creative writing |
| Mistral-7B-Instruct-v0.3-Q8_0 | Классический Mistral |
| Mistral-Small-3.1-24B-Q4_K_M | Свежий Mistral, мультимодальная |
| Mistral-Nemo-Instruct-2407-Q4_K_M | Легче чем Q8 версия |
| aya-23-35B-Q5_K_M | Мультиязычная (Cohere) |
| Marco-o1-Q8_0 | Reasoning |
| mathstral-7B-Q8_0 | Математика |
| dolphin-2.9.3-mistral-nemo-12b | Uncensored |
| T-lite-Q8_0 | Турецкий |
| Fireball-Meta-Llama-3.2-8B | Agent-тюн |
| NemoomeN-Reflection-Tuned-12b | Reflection-тюн |
| phind-codellama-34b-v2-Q3_K_S | Кодинг, но Q3 — низкое качество |
| GLM-4.5-Air (2 части) | ChatGLM, MoE |
| FuseO1-DeepSeekR1-Qwen2.5-Coder-32B | Reasoning + Code |
| Qwen_Qwen3-4B-IQ4_NL | Компактная Qwen3 |
| Qwen_QwQ-32B-IQ2_XXS | Очень агрессивная квантизация, низкое качество |
| Meta-Llama-3.1-8B-Instruct-exp20-8-Q8 | Экспериментальная Llama |
| IQuestLab.IQuest-Coder-V1-40B-Q5_K_M | Кодинг, ~28 GB |
| Qwen2.5-0.5B-Instruct-Q4_K_M / Q8_0 | Ультра-компактная, ~0.5 GB |
| Qwen2.5-1.5B-Instruct-Q4_K_M | Компактная, ~1 GB |
| Qwen2.5-7B-Instruct-1M-Q8_0 | 1M контекст (потребует много RAM) |
| Qwen3-0.6B-Q8_0 | Минимальная, ~0.7 GB |
| Qwen3-1.7B-Q4_K_M | Компактная, ~1.2 GB |
| DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M | Компактный reasoning, ~1 GB |
| DeepSeek-R1-Distill-Qwen-32B-Q4_K_M | Reasoning, ~19 GB |
| Nous-Hermes-2-Mistral-7B-DPO-Q8_0 | Instruct/chat |
| Meta-Llama-3.1-70B-Instruct-Q8_0 (2 части) | ~70 GB — не влезет в 64 GB RAM |
| Phi-4-reasoning-plus-Q4_K_M | Reasoning, легче чем Q8 |

---

## Служебные файлы (НЕ модели)

Эти файлы не запускаются самостоятельно — подключаются через `--mmproj` к мультимодальным моделям.

| Файл | Для какой модели |
|---|---|
| mmproj-model-f16.gguf (×3) | gemma-3-27b / gemma-3-4b / Devstral |
| mmproj-model-f32.gguf | LLaVA-NeXT-Video-7B |
| llava-v1.5-7b-mmproj-model-f16.gguf | llava-v1.5-7b |

---

## Неподдерживаемые архитектуры

| Модель | Архитектура | Причина |
|---|---|---|
| Qwen3-Next-80B-A3B (2 части) | qwen3next | Гибридная архитектура (DeltaNet + MoE), добавлена в llama.cpp b7186 (PR #16095), в ik_llama.cpp пока отсутствует |
| Phi-4-reasoning-plus-Q8_0 | phi3 | Несовпадение тензоров (expected 243, got 241) — GGUF создан новой версией llama.cpp. Решение: перекачать из unsloth или обновить ik_llama.cpp |

Для Qwen3-Next используйте mainline llama.cpp b7186+ или LM Studio / Ollama.

---

## Модели которые НЕ влезут в 64 GB RAM

| Модель | Примерный размер | Проблема |
|---|---|---|
| Meta-Llama-3.1-70B-Instruct-Q8_0 | ~70 GB | Превышает RAM |
| gpt-oss-120b-MXFP4 | ~60 GB | Формально влезет, но с контекстом — swap |

---

## Рекомендации по запуску

### На каждый день
```
llama-cli.exe -m Qwen3-32B-Q6_K.gguf -t 8 -c 8192 -fa on --conversation
```

### Код
```
llama-cli.exe -m Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf -t 8 -c 16384 -fa on --conversation
```

### GPT-OSS
```
llama-cli.exe -m gpt-oss-20b-MXFP4.gguf -t 8 -c 4096 -fa on --conversation
```

### Бенчмарк
```
llama-bench.exe -m model.gguf -t 8
```

### Сервер (OpenAI API)
```
llama-server.exe -m model.gguf -t 8 -c 8192 -fa on --host 0.0.0.0 --port 8080
```

### Мультимодальная (Gemma 3)
```
llama-gemma3-cli.exe -m gemma-3-27b-it-Q8_0.gguf --mmproj mmproj-model-f16.gguf --image photo.jpg -t 8
```

---

## Совет по потокам

Ryzen 9 7950X — dual-CCD (2 чиплета по 8 ядер). Рекомендуется `-t 8` (один CCD) вместо `-t 16`, чтобы избежать overhead межчиплетного взаимодействия. Попробуйте оба варианта с `llama-bench` и сравните.
