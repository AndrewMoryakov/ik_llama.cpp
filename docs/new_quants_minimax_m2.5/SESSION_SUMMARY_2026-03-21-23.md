# Сводка работы 2026-03-21 — 2026-03-23

## Что было сделано

### День 1 (2026-03-21)

**Квантизация и инфраструктура:**
- Изучены рецепты Tapered-RAM и Deep-Taper 115
- Создана инфраструктура: 6 скриптов квантизации (.sh + .ps1), PowerShell-раннеры с прогрессом
- Скачан imatrix от Unsloth (несовместим), затем от ubergarm (совместим, BF16, 497 entries)
- Квантован v2 Tapered-RAM (90 GiB) из Q8_0 без imatrix
- Обнаружен баг: attention квантован дефолтным ftype (attn_q→iq3_ks, attn_output→q5_K)

**Бенчмарки v2:**
- tg32: 3.82 t/s, pg32:4: 7.01 t/s — в **6x быстрее** UD-Q5 (0.62 t/s)
- PPL = 9.53 ± 0.66 (8 чанков, грубо)

**Dashboard:**
- Исправлен пресет minimax_huge_safe (добавлен n_ctx)
- Созданы 2 основных + 2 экспериментальных пресета для Tapered-RAM
- Отключён live_observability в autoconfig для swap-bound моделей
- Добавлен --metrics флаг для llama-server

**Документация и учебник:**
- Создан MOE_ARCHITECTURE.md — архитектура MoE от нейрона до квантизации
- Создан CUSTOM_QUANTIZATION.md — практическое руководство
- Создан LEARNING_PLAN.md — план изучения 7 тем, 30 вопросов
- Обновлён README учебника (Вариант C — глубокий трек)

### День 2 (2026-03-22)

**Квантизация v3.1 (исправление attention):**
- Добавлены --attn-q-type, --attn-k-type, --attn-v-type, --attn-output-type, --ffn-gate-inp-type во все скрипты
- Embeddings подняты до q8_0
- Квантован v3.1 с imatrix (92 GiB, BPW 3.46)
- PPL = 9.70 ± 0.08 (552 чанка, полный wikitext-2) — **не улучшился** vs v2

**Квантизация v4 Deep-Taper:**
- Перераспределение бюджета: attention↓ (iq5_k/q5_K), experts↑ (5 зон)
- 36 из 62 слоёв down_exps в iq5_k, core down в iq4_xs
- 114 GiB, BPW 4.26
- PPL = 9.42 ± 0.23 (64 чанка) — улучшение всего 0.28

**Исследования:**
- PPL_RESEARCH.md — результаты, выводы, 7 направлений v5
- HYBRID_SOURCE_RESEARCH.md — найден BF16 от PrimeIntellect (619 GiB) и FP8 оригинал (320 GiB)
- RECIPE_V5.md — рецепт v5 (FP8 источник, gate/up асимметрия)
- Уточнение IQ vs Q: IQ ≥ Q при равном BPW (подтверждено llama.cpp PR #5747)

**Dashboard live metrics:**
- Добавлены current/min/max/avg tok/s в бэкенд (live_metrics.py)
- Добавлены в фронтенд (dashboard-live.js) + i18n
- Попытка polling /metrics и /slots для real-time — ограничения сервера

### День 3 (2026-03-23)

**Eval Suite:**
- Создан EVAL_SUITE.md — 13 тестов, 130 баллов, с детальными рубриками
- 10 базовых + 3 сложных (AIME, CPU sim, trick questions)
- Валидация задач: исправлена нерешаемая задача с коробками, пересчитана задача про поезда
- Прогон на v4: **72/130 (55%)**, 3 пустых ответа на math/reasoning

**Expert stats export:**
- Добавлена `llama_export_expert_stats()` в llama.cpp (C++)
- Env: `IK_LLAMA_EXPORT_EXPERT_STATS=path.csv`
- Создан `scripts/analyze_expert_stats.py` для анализа
- Пересборка через build_now.bat, экспорт работает
- Ограничение: однократный экспорт при hot expert commit

**Сборка:**
- Доработан build_now.bat: показывает SUCCESS/FAILED, не закрывается

---

## Ключевые результаты

### PPL по версиям

| Версия | BPW | PPL | Источник |
|--------|-----|-----|----------|
| v2 | 3.37 | ~9.5 | Q8_0, без imatrix |
| v3.1 | 3.46 | 9.70 | Q8_0, imatrix, attention fix |
| v4 | 4.26 | 9.42 | Q8_0, imatrix, budget redistribution |
| v5 (ожид.) | 4.26 | ~8.9–9.2 | FP8/BF16 |

### Скорость vs UD-Q5

| Модель | Размер | tg32 | pg32:4 |
|--------|--------|------|--------|
| UD-Q5 | 151 GiB | 0.62 t/s | 1.28 t/s |
| Tapered-RAM v2 | 90 GiB | **3.82 t/s** | **7.01 t/s** |
| Deep-Taper v4 | 114 GiB | **~4 t/s** | — |

### Eval Suite v4

Итого: **72/130**. Без пустых ответов: **72/100 = 72%**.

---

## Открытые вопросы

1. Почему 3 теста (math/reasoning) возвращают пустой content?
2. Variant D (uniform iq4_xs) — лучше или хуже taper?
3. FP8 источник — насколько улучшит PPL?
4. Per-expert frequency: нужен длительный сбор данных (доработать экспорт)

---

## Созданные файлы

### Документация
```
docs/new_quants_minimax_m2.5/
├── minimax_quant_recipes.md        — исходные рецепты v2
├── ROADMAP_V3.md                   — roadmap v3→v4→v5
├── RECIPE_V5.md                    — рецепт v5 (FP8, gate/up asym)
├── PPL_RESEARCH.md                 — результаты PPL, 7 выводов для статей
├── HYBRID_SOURCE_RESEARCH.md       — BF16/FP8 источники
├── EVAL_SUITE.md                   — 13 тестов, 130 баллов
└── SESSION_SUMMARY_2026-03-21-23.md — эта сводка
```

### Учебник
```
project_docs/tutorial/
├── MOE_ARCHITECTURE.md             — архитектура MoE (NEW)
├── CUSTOM_QUANTIZATION.md          — кастомная квантизация (NEW)
├── LEARNING_PLAN.md                — план изучения 7 тем (NEW)
└── README.md                       — обновлён (Вариант C)
```

### Скрипты
```
scripts/quant_minimax_m25/
├── quantize_tapered_ram.sh/.ps1    — Tapered-RAM
├── quantize_deep_taper_115.sh/.ps1 — Deep-Taper 115
├── quantize_tapered_ram_v4.sh      — Tapered-RAM v4
├── quantize_deep_taper_v4.sh       — Deep-Taper v4
├── run_tapered_ram.ps1             — с прогрессом
├── run_deep_taper_115.ps1          — с прогрессом
├── verify_quant.sh                 — верификация
└── README.md

scripts/
├── run_eval_suite.py               — прогон Eval Suite (NEW)
├── analyze_expert_stats.py         — анализ dispatch stats (NEW)
```

### Bench results
```
bench_results/
├── 2026-03-21_tapered_ram_baseline/ — v2 speed + conclusions
├── 2026-03-22_tapered_ram_v31_ppl/  — v3.1 PPL (552 chunks)
├── 2026-03-22_deep_taper_v4/        — v4 PPL (64 chunks)
└── 2026-03-22_eval_suite_v4/        — Eval Suite results + scoring
```

### День 3, продолжение (2026-03-23)

**Eval Suite V2 + V3 (дискриминаторные тесты):**
- Создан EVAL_SUITE_V2.md — 10 сложных тестов, 100 баллов
- Создан V2-11 (reverse engineering x^y) — 15 баллов
- Создан V3 дискриминатор — 5 тестов для выявления разницы 228B vs 42B
- Прогнаны на MiniMax v4 и Qwen3-42B-A3B

**Результаты сравнения MiniMax v4 vs Qwen3-42B:**
- V2 (общие задачи): MiniMax ~32/50, Qwen3 ~33/50 — примерное равенство
- V3 (дискриминаторы): MiniMax **43/50**, Qwen3 **28/50** — MiniMax побеждает
- MiniMax сильнее на: мультиязычность (4 языка), фактическая точность, 10 ограничений
- Qwen3 сильнее на: скорость (3x), простые задачи

**Инфраструктура thinking-моделей:**
- Обнаружена проблема: thinking-модели (Qwen3) дают пустой content через /v1/chat/completions
- Решение: /completion endpoint + извлечение после </think>
- Создан run_eval_v2_thinking.py для thinking-моделей
- Создан run_eval_v3_discriminator.py (поддержка обоих режимов)

**Expert stats export (доработка):**
- Добавлена публичная API: llama_export_expert_stats_to_file() в llama.h
- Добавлен endpoint GET /export-expert-stats в server.cpp
- Защита от path traversal (только filename, без path separators)
- Dashboard proxy: /api/export-expert-stats
- Требует пересборки (build_now.bat)

---

## Итоговые результаты

### PPL по версиям

| Версия | BPW | PPL | Источник |
|--------|-----|-----|----------|
| v2 | 3.37 | ~9.5 | Q8_0, без imatrix |
| v3.1 | 3.46 | 9.70 | Q8_0, imatrix, attention fix |
| v4 | 4.26 | 9.42 | Q8_0, imatrix, budget redistribution |

### Eval Scores

| Suite | MiniMax v4 (114 GiB) | Qwen3-42B (22 GiB) |
|-------|---------------------|---------------------|
| V1 (13 tests) | 72/130 | — |
| V2 (10 tests) | 70/100 | ~33/50 (5 tests) |
| V3 discriminator (5 tests) | **43/50** | **28/50** |

### Скорость

| Модель | Размер | tg32 | pg32:4 | Реальная |
|--------|--------|------|--------|----------|
| UD-Q5 | 151 GiB | 0.62 t/s | 1.28 t/s | ~0.6 t/s |
| Tapered-RAM v2 | 90 GiB | 3.82 t/s | 7.01 t/s | ~4 t/s |
| Deep-Taper v4 | 114 GiB | — | — | ~4 t/s |
| Qwen3-42B | 22 GiB | — | — | ~20 t/s |

---

## 8 ключевых выводов для статей

1. Размер > BPW для скорости на ограниченной RAM (6x)
2. Attention — не bottleneck PPL для MoE (3% весов)
3. Перераспределение бюджета attention→experts — скромный эффект
4. Двойная квантизация Q8_0 — потолок PPL ~9.4
5. Swap-bound MoE работает при mmap + hot experts (~4 t/s)
6. Cold-start бенчмарки врут (0.02 vs 4 t/s)
7. IQ ≥ Q при равном BPW (подтверждено)
8. 228B > 42B на сложных задачах (мультиязычность, факты, constraints)

---

### Изменения в коде
```
include/llama.h                     — llama_export_expert_stats_to_file() (NEW)
src/llama.cpp                       — llama_export_expert_stats() + public wrapper (NEW)
examples/server/server.cpp          — GET /export-expert-stats endpoint (NEW)
dashboard/evidence-layer.js         — 4 новых пресета
dashboard/dashboard-autoconfig.js   — live_observability OFF для swap-bound
dashboard/dashboard-command.js      — --metrics для server, --custom-q fixes
dashboard/dashboard-live.js         — current/min/max tok/s display
dashboard/dashboard-i18n.js         — i18n для новых метрик
dashboard/live_metrics.py           — current/min/max/session_history + timings parser
dashboard/dashboard_server.py       — _poll_server_metrics, expert stats proxy
build_now.bat                       — SUCCESS/FAILED + pause + echo fix
```

### Скрипты (новые)
```
scripts/
├── run_eval_suite.py               — V1 Eval (13 tests)
├── run_eval_suite_v2.py            — V2 Eval (10 tests)
├── run_eval_v2_plus.py             — V2 + V2-11 (5 key tests)
├── run_eval_v2_thinking.py         — V2 для thinking-моделей (/completion)
├── run_eval_v3_discriminator.py    — V3 дискриминатор (5 tests, dual mode)
├── analyze_expert_stats.py         — анализ dispatch stats
```

### Bench results (новые)
```
bench_results/
├── eval_v2_deep_taper_v4/          — V2 на MiniMax v4
├── eval_v2_qwen3_42b/             — V2 на Qwen3-42B
├── eval_v3_minimax_v4/            — V3 на MiniMax v4
├── eval_v3_qwen3_42b/            — V3 на Qwen3-42B
└── eval_v3_comparison.md          — сравнительный анализ
```
