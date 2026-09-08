# Evidence 2 — результаты гейтов (2026-09-08)

Все числа ниже получены прогоном на целевой машине. Ничего не перенесено из
проекций.

## 0. Среда

```text
хост      DESKTOP-HENS8K7 (Windows 11 Pro)
CPU       AMD Ryzen 9 7950X, 16 ядер / 32 потока
RAM       95.1 GiB
компилятор MSVC 19.41.34120.0 (VS 2022 Community), генератор Ninja
конфиг    cmake -G Ninja -DCMAKE_BUILD_TYPE=Release -DGGML_CUDA=OFF
дерево    Z:\...\ik_llama_my-fork\upstream-integration  (HEAD 62ba7ba6)
сборка    Z:\...\ik_llama_my-fork\build-ui
```

Обнаружено при конфигурации: AVX/AVX2/FMA/AVX512 — Success; ccache отсутствует.
CUDA не собиралась — GPU-пути этой сессией **не проверены [UNVERIFIED]**.

## 1. Сборка — PASS

`cmake --build` без фильтра цели: **155/155 целей, 0 ошибок**. Собраны
`llama-cli`, `llama-server`, `llama-perplexity` и все тестовые бинарники.

Первый прогон упал на одной ошибке (`main.cpp(200)`, см. `evidence-1` §6);
после правки сигнатуры колбэка — чисто.

## 2. `ctest` — 27/31, новых отказов нет

Зарегистрирован 31 тест. **Все семь тестов форка проходят:**

```text
21 test-rtr-params ................ Passed
22 test-cgroup-resolver ........... Passed
23 test-moe-trace-writer .......... Passed
24 test-token-timing-writer ....... Passed
25 test-moe-cache-sim ............. Passed
30 test-moe-trace-cli-lifecycle ... Passed
31 test-token-timing-cli-lifecycle  Passed
```

Новый апстримовский `26 test-iq4-ks-kt-decode` — Passed.

### Четыре отказа совпадают с эталоном

Сравнение с закоммиченными логами `docs/rtr-handoff/upstream-four-tests.log`
(чистый upstream) и `pr-four-tests.log` (PR-ветка):

| Тест | Метка | Сейчас | upstream-лог | pr-лог |
|---|---|---|---|---|
| `test-tokenizer-0-bert-bge` | main | Failed | Failed | Failed |
| `test-jinja-py` | python | Failed | Failed | Failed |
| `test-chat-template` | — | `0xc0000409` | `0xc0000409` | `0xc0000409` |
| `test-eval-callback` | curl | Failed | Failed | Failed |

Совпадает и код краха `0xc0000409` (STATUS_STACK_BUFFER_OVERRUN) в том же
тесте — улика сильнее, чем совпадение имён.

Установленные причины двух из четырёх:

- `test-eval-callback` — тянет модель с HuggingFace, сборка без libcurl
  (`LLAMA_CURL=OFF` по умолчанию): «built without libcurl».
- `test-tokenizer-0-bert-bge` — WPM-токенайзер не приводит к нижнему регистру:
  `Hello` → `[UNK]` вместо `hello`.

`test-chat-template` и `test-jinja-py` **[UNVERIFIED]**: воспроизводятся на
upstream, к корню не прослежены.

## 3. Smoke-прогоны инструментовки — PASS

### 3.1 `--token-timing` (плотная модель)

```powershell
llama-cli -m ...\Qwen2.5-1.5B-Instruct-Q4_K_M.gguf `
          -p "The capital of France is" -n 16 -c 512 -t 16 --seed 42 `
          --token-timing tt.ndjson --no-display-prompt
```

```text
prompt eval  47.95 ms /  5 tokens (104.27 t/s)
eval        463.68 ms / 16 tokens ( 34.51 t/s)
```

Артефакт — 17 строк: header + 15 intervals + end.

```json
{"type":"interval","index":0,"input_token_id":12095,"output_token_id":11,
 "ready_offset_us":78135,"inter_ready_us":25335,"eval_us":24986,"sample_us":111}
{"type":"end","complete":true,"generated_tokens":16,"intervals":15,
 "n_eval":15,"llama_reported_n_eval":15}
```

**Ключевой инвариант:** `n_eval` == `llama_reported_n_eval` == 15. Писатель
сверяет свой счётчик с внутренним счётчиком библиотеки — то есть хук
срабатывает ровно один раз на сгенерированный токен. Именно это могло
сломаться при переносе на новую точку семплирования.

### 3.2 `--moe-trace` (MoE-модель)

```powershell
llama-cli -m ...\Qwen3-30B-A3B-Instruct-2507-Q4_K_M.gguf `
          -p "2+2=" -n 6 -c 512 -t 32 --seed 42 `
          --moe-trace moe.ndjson --no-display-prompt
```

```text
prompt eval  934.84 ms / 4 tokens ( 4.28 t/s)
eval         883.80 ms / 6 tokens ( 6.79 t/s)
всего 117.7 s (в основном загрузка 17.3 ГБ)
```

⚠️ Эти t/s — **не бенчмарк**: режим трассировки добавляет синхронизацию
бэкенда, о чём сам инструмент и предупреждает.

Артефакт — 243 строки: `meta` + `model` + **240 × route** + `end`.

```json
{"type":"route","batch_index":0,"pos":4,"layer":0,"n_expert":128,
 "selected":[{"rank":0,"expert":58,"selection_score":0.0530792177,
              "weight":0.216634676}, ...]}
{"type":"end","complete":true,"batches":5,"routes":240}
```

**Арифметика сходится:** 5 батчей × 48 слоёв = 240 маршрутов. Пять, а не
шесть, — первый токен приходит из prompt-eval и под `embd_is_generated` не
попадает. Расхождение на единицу здесь означает «гейтинг работает».

### 3.3 Взаимоисключение флагов

`--token-timing` вместе с `--moe-trace` → отказ с сообщением
«are mutually exclusive», exit=1. Защита форка пережила слияние.

## 4. Аудит `--help` и новые флаги upstream — PASS

Присутствуют: `--moe-trace`, `--token-timing`, `-rtr`, **`-rtra`** (восстановлен
коммитом `62ba7ba6`), `--defer-ple`, `--defer-experts`, `--spec-type`, `-cmoe`,
`-ncmoe`, `-thp`, `-okv`, `-ot`.

### `-rtra` работает end-to-end, а не только парсится

```text
llama_get_available_ram_bytes: process is in a Windows Job Object;
    RTR auto memory headroom is unknown
llama_model_load: --run-time-repack auto: disabled
    (uncertainty: could not query available memory)
```

Ровно поведение из `docs/parameters.md`. Отключение здесь — успешный
результат: проверялось наличие механизма оценки памяти, а не факт репака.

### `--defer-ple`

```text
llama_model_load: deferred per-layer token embedding is only supported on Linux;
    ignoring defer_ple
```

Claim из `analysis-10` §1 подтверждён на железе. `--defer-experts` в этой
сессии **не прогонялся [UNVERIFIED]**.

## 5. Perplexity smoke — PASS (с оговоркой)

```powershell
llama-perplexity -m ...\Qwen2.5-1.5B-Instruct-Q4_K_M.gguf -f ppl.txt -c 256 -t 32
```

```text
perplexity: calculating perplexity over 4 chunks, n_ctx=256
Final estimate: PPL over 4 chunks for n_ctx=256 = 1.0126 +/- 0.00125
```

⚠️ Корпус — 40 повторов трёх предложений, поэтому **число не является оценкой
качества модели**. Гейт требует «ненулевой и не NaN» — выполнено. Для реального
сравнения нужен нормальный holdout (см. правило валидации в `00-INDEX`
сессии 2026-09-07).

Замечание по инструменту: флаг `--chunks` в этой сборке отсутствует и даёт
`exit=-1` без внятного сообщения.

## 6. Сводка

| Гейт | Проверка | Статус |
|---|---|---|
| GATE 1 | Сборка | **PASS** 155/155 |
| GATE 1 | Тесты | **PASS** 27/31, новых отказов 0 |
| GATE 1 | Perplexity smoke | **PASS** 1.0126, exit=0 |
| GATE 2 | Аудит `--help` | **PASS** |
| GATE 2 | `--defer-ple` | **PASS** (Linux-only подтверждено) |
| GATE 2 | Инструментовка Step0 | **PASS** обе, артефакты валидны |
| GATE 3 | CI / push | **не выполнялся** — ничего не запушено |

## 7. Что осталось непроверенным

1. `token-timing` на спекулятивном пути (`--spec-*`) — занижает счёт.
2. Корневые причины `test-chat-template` и `test-jinja-py`.
3. `--defer-experts` не прогонялся.
4. Сборка и прогон с CUDA.
5. Защита путей больше не покрывает корпус из `--spec-type suffix:suffix_corpus=`
   (опция `--suffix-corpus` удалена upstream).
6. Реальный perplexity/quality-suite на непорождённом корпусе.
