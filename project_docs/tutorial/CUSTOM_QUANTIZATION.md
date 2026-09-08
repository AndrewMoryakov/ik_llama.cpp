# Кастомная квантизация MoE-моделей

Этот документ объясняет, зачем нужна кастомная квантизация, как она работает в ik_llama, и какие рецепты существуют для MiniMax M2.5.

Если вы не знаете, что такое эксперт, блок и роутер — сначала прочитайте `MOE_ARCHITECTURE.md`.

---

## 1. Зачем нужна кастомная квантизация

Стандартная квантизация (например, `IQ3_KS`) применяет один и тот же тип ко всем тензорам.

Но разные тензоры **неодинаково чувствительны** к потере точности:

- Attention (~3% веса) — критичен, экономия мала
- Edge-эксперты (первые/последние блоки) — очень чувствительны
- Core-эксперты (середина) — менее чувствительны, их много
- `down_exps` — важнее, чем `gate_up_exps`
- Output head / Embeddings — маленькие, но влияют сильно

Кастомная квантизация позволяет назначить **разный тип квантизации разным тензорам**, чтобы распределить байты рациональнее.

---

## 2. Как это работает в ik_llama

### Инструмент

`llama-quantize` — утилита для квантизации GGUF-моделей.

### Механизм custom rules

Флаг `--custom-q` принимает набор правил в формате:

```
--custom-q "regex1=type1,regex2=type2,..."
```

Каждое правило — пара `regex=тип`, где:
- **regex** — регулярное выражение, которое матчится на имя тензора
- **тип** — целевой тип квантизации (например, `iq5_k`, `iq4_xs`, `iq3_ks`)

Правила применяются по порядку. **Первое совпадение побеждает**.

Тензоры, которые не совпали ни с одним правилом, квантуются базовым типом (указанным как последний позиционный аргумент).

### Дополнительные флаги

- `--output-tensor-type TYPE` — тип для output head
- `--token-embedding-type TYPE` — тип для embeddings
- `--allow-requantize` — разрешить переквантизацию (нужно, если источник уже квантован, например Q8_0)

### Имена тензоров MiniMax M2.5

```
blk.N.ffn_down_exps.weight    — down-тензоры экспертов блока N
blk.N.ffn_gate_exps.weight    — gate-тензоры экспертов блока N
blk.N.ffn_up_exps.weight      — up-тензоры экспертов блока N
```

Где N — номер блока (0–61).

### Доступные IQ-типы

| Тип | BPW | Описание |
|-----|-----|----------|
| `iq3_ks` | 3.19 | Агрессивный, для основной массы |
| `iq4_xs` | 4.25 | Средний |
| `iq4_k` | 4.5 | Средний+ |
| `iq5_k` | 5.5 | Высокое качество |
| `iq6_k` | 6.6 | Очень высокое качество |
| `q8_0` | 8.0 | Почти без потерь |

---

## 3. Принципы проектирования рецепта

### Ступенчатая геометрия качества

Вместо грубого деления "края хорошие, центр плохой" используется **градиентное распределение** по зонам:

```
Edge → Bridge → [Sensitive-middle →] Core
```

Каждая зона получает свой тип квантизации. Чем ближе к краю — тем точнее.

### Асимметрия down vs gate/up

В каждой зоне `down_exps` квантуется **точнее**, чем `gate_exps` и `up_exps`. Это стратегия "AesSedai": байты лучше вкладывать в выходную проекцию эксперта.

### Дешёвые улучшения

- Output head → Q8_0 (стоит ~0.6 GiB, сильно влияет на качество)
- Embeddings → IQ4_K или Q8_0 (стоит ~0.3–0.6 GiB)

---

## 4. Текущие рецепты для MiniMax M2.5

### Старые рецепты (A–F)

Описаны в `../strategy/TASK.md`. Ключевые:

| Вариант | Размер | Swap | PPL | Идея |
|---------|--------|------|-----|------|
| A | 89 GiB | ~2 GiB | ~8.72 | Консервативный, edge IQ4_XS |
| C | 100 GiB | ~13 GiB | ~8.55 | AesSedai-стратегия |
| D | 107 GiB | ~20 GiB | ~8.45 | Balanced: C + edge IQ5_K |
| E | 110 GiB | ~23 GiB | ~8.40 | Quality+: D + sensitive middle |
| F | 87 GiB | ~0 GiB | ~8.80 | Speed-first: всё IQ3_KS |

### Новые рецепты

Описаны в `docs/new_quants_minimax_m2.5/minimax_quant_recipes.md`.

#### Tapered-RAM (~91 GiB)

Daily-driver под 96 GB RAM. Двухступенчатый taper.

```
Edge   [0-1, 60-61]   down=iq5_k   gate/up=iq4_xs
Bridge [2-4, 57-59]   down=iq4_xs  gate/up=iq3_ks
Core   [5-56]         down=iq3_ks  gate/up=iq3_ks
Attention/Norms:      q8_0
Output head:          q8_0
Embeddings:           iq4_k
```

Улучшения по сравнению со старыми A/F:
- Более плавная градация качества по глубине
- Усиленный приоритет `down_exps`
- Output head в Q8_0

#### Deep-Taper 115 (~115 GiB)

Quality ceiling, ~20% overflow RAM. Пятизонная лестница.

```
Edge       [0-3, 58-61]    down=iq5_k   gate/up=iq5_k
Bridge     [4-7, 54-57]    down=iq5_k   gate/up=iq4_xs
Mid-sens   [8-11, 50-53]   down=iq5_k   gate/up=iq4_xs
Mid-high   [12-16, 45-49]  down=iq5_k   gate/up=iq3_ks
Mid-core   [17-44]         down=iq4_xs   gate/up=iq3_ks
Attention/Norms:           q8_0
Output head:               q8_0
Embeddings:                q8_0
```

---

## 5. Как запустить квантизацию

Скрипты лежат в `scripts/quant_minimax_m25/`.

### PowerShell (Windows) — с прогрессом

```powershell
# Tapered-RAM
.\scripts\quant_minimax_m25\run_tapered_ram.ps1

# Deep-Taper 115
.\scripts\quant_minimax_m25\run_deep_taper_115.ps1

# С кастомными путями
.\scripts\quant_minimax_m25\run_tapered_ram.ps1 `
    -Source "Z:\MiniMax_M2.5\MiniMax-M2.5-Q8_0-00001-of-00006.gguf" `
    -Output "D:\output.gguf" `
    -Imatrix "D:\imatrix.dat"
```

### Bash

```bash
./scripts/quant_minimax_m25/quantize_tapered_ram.sh source.gguf output.gguf [imatrix.dat]
./scripts/quant_minimax_m25/quantize_deep_taper_115.sh source.gguf output.gguf [imatrix.dat]
```

### Ручной запуск

```bash
llama-quantize \
    --allow-requantize \
    --output-tensor-type q8_0 \
    --token-embedding-type iq4_k \
    --custom-q "blk\.(0|1|60|61)\.ffn_down_exps=iq5_k,..." \
    source.gguf output.gguf IQ3_KS
```

---

## 6. Importance Matrix (imatrix)

IQ-кванты (iq3_ks, iq4_xs, iq5_k) могут использовать **importance matrix** — файл, который говорит квантайзеру, какие веса важнее.

### Зачем

Без imatrix квантайзер распределяет точность равномерно. С imatrix — вкладывает больше точности в веса, которые сильнее влияют на качество ответов.

### Как получить

1. **Скачать** готовый (например, с HuggingFace) — но формат может не подходить
2. **Сгенерировать самому**: `llama-imatrix -m model.gguf -f calibration_text.txt -o imatrix.dat`

Генерация imatrix требует прогона модели на калибровочном тексте — это долгий процесс для huge-моделей.

### Текущий статус

Готовый imatrix от Unsloth (`imatrix_unsloth.gguf_file`) имеет нестандартный формат и не загружается напрямую в ik_llama. Квантизация без imatrix работает, но качество чуть ниже оптимального.

---

## 7. Открытые вопросы

### Качество без imatrix

Насколько критична потеря качества при квантизации из Q8_0 без imatrix? Нужно:
- Сравнить PPL квантов с и без imatrix
- Или сгенерировать собственный imatrix

### Источник квантизации: Q8_0 vs BF16

Текущий источник — Q8_0 (уже квантован). Для максимального качества лучше BF16, но это ~450 GiB загрузки. Вопрос: насколько велика разница на практике для IQ3/IQ4/IQ5 квантов?

### Сравнение с существующим UD-Q5

Есть готовый UD-Q5_K_XL (~151 GiB). Нужно сравнить:
- Tapered-RAM (91 GiB, без swap) vs UD-Q5 (151 GiB, 63 GiB swap)
- По скорости (t/s) и по качеству ответов

### Второй рецепт

Deep-Taper 115 ещё не собран. Стоит собрать и сравнить с Tapered-RAM по скорости и качеству.

### Практическая валидация

Расчётные оценки PPL не заменяют живое тестирование. Нужно проверить:
- Кодинг (генерация, рефакторинг, поиск ошибок)
- Reasoning (логические задачи, многошаговые выводы)
- Длинный контекст (суммаризация, удержание деталей)
- "Грязные" задачи (неидеальные промпты, смешение языков)

---

## Что читать дальше

- `MOE_ARCHITECTURE.md` — как устроена MoE-модель изнутри
- `MINI_TUTORIAL.md` — runtime-поведение и inference
- `../strategy/TASK.md` — полные описания рецептов A–F
- `docs/new_quants_minimax_m2.5/minimax_quant_recipes.md` — детали новых рецептов
