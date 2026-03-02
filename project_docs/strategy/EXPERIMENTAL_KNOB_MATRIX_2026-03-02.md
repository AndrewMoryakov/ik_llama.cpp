# Experimental Knob Matrix - 2026-03-02

## Зачем нужен этот документ

Это canonical matrix для `Phase 1`.

Он фиксирует для каждого experimental knob пять вещей:

1. `Applicability`
- для какого класса моделей knob имеет смысл по механике

2. `Runtime support today`
- где текущий код реально уже включает этот path

3. `Validated on`
- где уже есть benchmark-backed signal

4. `Risk`
- насколько knob безопасен как user-facing experiment

5. `Failure mode`
- что чаще всего идет не так, если включить knob вне правильного класса или без A/B

Ключевое правило:

- `Applicability` не равно `Validation`
- `Validation` не равно `universal support`
- `Runtime support today` может быть уже, чем theoretical applicability

---

## Матрица

| Knob | Applicability | Runtime support today | Validated on | Risk | Failure mode |
|---|---|---|---|---|---|
| `SER` (`ser_enabled`, `ser_min`, `ser_thresh`) | `MoE` | `generic MoE runtime path` | `research-only` | `medium` | может не дать win, а при неудачном пороге менять router-side behavior без практической пользы |
| `Hot Expert Budget` | `MoE / huge-MoE` | `MiniMax-first path` | `MiniMax partial` | `medium` | лишнее давление на RAM, удержание неправильного hot set |
| `Hot Expert Selection` | `MoE / huge-MoE` | `MiniMax-first path` | `MiniMax partial` | `medium` | knob подходит классу моделей, но вне MiniMax today может быть research-only без сильного runtime effect |
| `Tail Window` | `MoE / huge-MoE` | `MiniMax-only tail-window path` | `MiniMax partial` | `medium` | вне MiniMax текущий код не включает реальный tail-window selection path |
| `Merge QKV` | `attention arch-specific` | `accepted broadly, effect arch-sensitive` | `research-only` | `medium` | слабый или отрицательный win из-за неудачного attention/layout path |
| `Prompt Packed QKV` | `Split-QKV` | `Qwen3MoE / gpt-oss-first runtime path` | `Qwen3MoE`, `gpt-oss` partial | `high` | дополнительная RAM, более долгий load/startup, prompt-only gain без strong end-to-end win |
| `Prompt Packed preset` | `Split-QKV` | `Qwen3MoE / gpt-oss-first runtime path` | `Qwen3MoE`, `gpt-oss` partial | `high` | family-неподходящий preset или suboptimal layer subset |
| `Prompt Packed range` | `Split-QKV` | `Qwen3MoE / gpt-oss-first runtime path` | `research-only outside current families` | `high` | ручной диапазон может ухудшить RAM/load time или не дать useful prompt win |
| `Live Observability` | `All` | `dashboard-only tooling` | `helper/tooling` | `low` | лишний trace noise, если нужен максимально чистый benchmark |
| `Experimental preset` | `All` | `dashboard helper` | `helper/tooling` | `low` | может включить bundle, который пользователь не до конца понимает |
| `Link preset to validated settings` | `All` | `dashboard helper` | `helper/tooling` | `low` | пресет может перестроить validated baseline шире, чем ожидал пользователь |

---

## Как читать матрицу

### 1. Пример: `Tail Window`

Правильная интерпретация такая:

- по механике это knob класса `MoE / huge-MoE locality`
- по текущему runtime today это `MiniMax-only tail-window path`
- по validation это сейчас `MiniMax partial`

То есть:

- knob нельзя называть "только MiniMax по природе"
- но нельзя и делать вид, что current runtime уже одинаково поддерживает его на всех MoE

### 2. Пример: `Prompt Packed QKV`

Правильная интерпретация такая:

- по механике это knob класса `Split-QKV`
- по текущему runtime today это family-first path для `Qwen3MoE / gpt-oss`
- по validation это partial signal именно на этих семьях

То есть:

- knob не должен подаваться как "Qwen/gpt-oss only by definition"
- но current runtime support и validation пока реально уже, чем theoretical class applicability

---

## Что считается закрытием Phase 1

`Phase 1` считается закрытой, если одновременно выполнено следующее:

1. `dashboard` показывает три отдельные оси:
- applicability
- runtime support
- validation

2. presets описываются в той же логике, а не как ad-hoc bundle names

3. этот документ используется как source of truth для дальнейших runtime-generalization фаз

На текущем слое это условие выполнено для product/dashboard semantics.

---

## Что идет дальше

После закрытия `Phase 1` проект переходит к следующим содержательным фазам:

1. `Phase 2`
- runtime generalization
- сначала `Hot Expert Selection / Tail Window`
- затем `Prompt Packed QKV`

2. `Phase 3`
- targeted validation для новых generalized runtime paths

3. `Phase 4`
- architecture-specific optimization

То есть дальше работа уже должна идти не над базовой semantic путаницей, а над реальным расширением runtime support и performance wins.
