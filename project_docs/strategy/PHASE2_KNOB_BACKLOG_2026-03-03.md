# Phase 2 Knob Backlog - 2026-03-03

## Зачем нужен этот документ

Это рабочий backlog для `Phase 2`.

Он отвечает на практический вопрос:

- какие параметры нужно отвязывать от одной family и расширять на целый класс моделей;
- какие параметры уже достаточно широкие и не требуют отдельной generalization line;
- какие параметры по архитектуре должны оставаться узкими и не должны насильно расширяться.

Этот документ опирается на `Phase 1` и использует ту же трехосевую модель:

1. `Applicability`
2. `Runtime support today`
3. `Validation`

Но здесь главный фокус уже другой:

- что именно делать в runtime;
- что считать `Phase 2` задачей;
- что сознательно не включать в `Phase 2`.

---

## Группы параметров

Весь backlog делится на три группы:

1. `Generalize in Phase 2`
- knobs, которые по механике относятся к классу моделей, а не к одной family

2. `Already broad enough`
- knobs, которые уже не прибиты к одной family и не являются главным объектом `Phase 2`

3. `Remain architecture-specific`
- knobs, которые нельзя честно расширять просто на весь класс без потери инженерной строгости

---

## 1. Generalize in Phase 2

Это главная рабочая группа.

### 1.1 Hot experts line

| Knob | Applicability | Runtime support today | Why it belongs to Phase 2 | Target state |
|---|---|---|---|---|
| `Hot Expert Selection` | `MoE / huge-MoE` | `generic MoE hot-expert path` | Это не MiniMax-only идея по природе, а runtime strategy для expert locality | class-capable runtime path with honest fallback and validation matrix |
| `Tail Window` | `MoE / huge-MoE` | `generic MoE hot-expert path` | Это selection strategy для hot experts, а не property одной family | available to compatible MoE paths, validated family by family |
| `Hot Expert Budget` | `MoE / huge-MoE` | `generic MoE hot-expert path` | Это runtime budget policy для удержания hot set, не family-specific mechanism | class-level knob with per-family validation guidance |
| `Hot Expert Budget Mult` | `MoE / huge-MoE` | `generic MoE hot-expert path` | Это более мягкий способ масштабировать hot set поверх baseline runtime, не прибитый к одной family | class-level knob with CLI/UI/runtime parity and research validation guidance |

Практический смысл:

- это одна цельная `hot experts / locality` линия;
- именно она ближе всего к главной huge-MoE цели форка;
- здесь generalized support уже доведен до целостного runtime блока:
  - `Hot Expert Budget`
  - `Hot Expert Budget Mult`
  - `Hot Expert Selection`
  - `Tail Window`

### 1.2 Split-QKV line

| Knob | Applicability | Runtime support today | Why it belongs to Phase 2 | Target state |
|---|---|---|---|---|
| `Prompt Packed QKV` | `Split-QKV` | `generic split-QKV manual path; auto still family-tuned` | Это не knob только для `Qwen3MoE`/`gpt-oss`, а class-level prompt attention experiment | class-capable manual runtime path plus honest support model |
| `Prompt Packed preset` | `Split-QKV` | `same as above` | preset layer должен работать поверх class-capable path, а не только family-first naming | class-aware preset semantics, family-tuned auto allowed |
| `Prompt Packed range` | `Split-QKV` | `same as above` | manual layer selection относится к split-QKV runtime path, а не к одной family | class-capable manual control with validation guidance |

Практический смысл:

- `Prompt Packed QKV` уже widened manual-path в runtime;
- `auto` можно оставить family-tuned;
- `Phase 2` здесь не обязана делать все preset policies universal, достаточно сделать underlying runtime path class-capable.

---

## 2. Already broad enough

Это knobs, которые уже достаточно широкие и не являются главным объектом `Phase 2`.

| Knob | Applicability | Why not a Phase 2 focus |
|---|---|---|
| `SER` (`ser_enabled`, `ser_min`, `ser_thresh`) | `MoE` | Это уже class-level по смыслу; главный вопрос здесь не generalization, а usefulness/validation |
| `Merge Up+Gate Experts` (`muge`) | `MoE` | Это уже MoE-side knob; нет главной family-lock проблемы |
| `Fused MoE` | `MoE` | То же: основная проблема не в class-generalization |
| `Flash Attention` | `All` | Уже universal runtime knob |
| `RTR / Runtime Repack` | `All` | Уже universal runtime policy knob |
| `KV Cache K/V` | `All` | Уже общий runtime/memory layer |
| `Graph Reuse` | `All` | Уже общий execution knob |

Практический смысл:

- эти knobs можно дальше benchmark-ить, документировать и включать в presets;
- но их не надо считать ядром `Phase 2`.

---

## 3. Remain architecture-specific

Это knobs, которые нельзя честно расширять просто до "целого класса моделей" без дополнительных capability layers или без риска вводить пользователя в заблуждение.

| Knob | Why it should remain narrow |
|---|---|
| `MLA mode` | Это реально MLA-specific path, а не generic MoE/dense knob |
| `Merge QKV` | Attention/layout-sensitive knob; applicability зависит от конкретной attention architecture, а не только от family label |
| `Prompt Packed auto policy` | underlying knob class-level, но auto policy может оставаться family-tuned |
| Family-specific experimental presets | presets не обязаны быть class-universal только потому, что underlying knobs class-level |

Практический смысл:

- здесь нельзя путать `underlying runtime capability` и `family-tuned policy`;
- `Phase 2` должна generalized делать там, где knob реально class-capable;
- `family-first auto policy` можно оставить узкой, если это инженерно оправдано.

---

## Приоритет внутри Phase 2

### Приоритет 1

`Hot experts / locality`

Состав:

1. `Hot Expert Selection`
2. `Tail Window`
3. `Hot Expert Budget`

Почему:

- это ближе всего к главной huge-MoE задаче форка;
- это уже имеет прямую связь с `MiniMax` и future `huge-MoE` work;
- это дает лучший шанс на class-level runtime usefulness.

### Приоритет 2

`Split-QKV runtime support`

Состав:

1. `Prompt Packed QKV`
2. `Prompt Packed preset`
3. `Prompt Packed range`

Почему:

- это уже важная class-based line;
- но practical upside пока слабее, чем у huge-MoE locality line.

### Не считать приоритетом Phase 2

1. `SER`
2. `muge`
3. `Fused MoE`
4. `Flash Attention`
5. `RTR`
6. `KV Cache`
7. `Graph Reuse`

Почему:

- они важны;
- но не являются главным случаем "parameter suitable for class, but hardcoded too narrowly".

---

## Правило принятия решений для новых knobs

Если появляется новый experimental knob, его нужно сначала пропустить через этот фильтр:

1. knob class-applicable by mechanism?
2. runtime today already too narrowly gated?
3. limitation is artificial or architecture-driven?

### Если limitation artificial

- knob идет в `Phase 2` backlog

### Если limitation architecture-driven

- knob остается `architecture-specific`
- но может быть видимым в dashboard как experimental with honest support badge

---

## Что считается завершением Phase 2

`Phase 2` считается практически завершенной, если:

1. главные class-capable knobs уже widened in runtime:
   - `Hot Expert Selection / Tail Window`
   - `Prompt Packed QKV` manual path
2. dashboard/product layer честно это отражает
3. следующий главный вопрос становится уже не "можно ли включить knob", а:
   - "дает ли generalized path полезный benchmark-backed signal?"

После этой точки проект переходит в `Phase 3`:

- targeted validation generalized paths

---

## Текущий вывод

На текущем этапе:

1. `Hot experts` line — главный и самый правильный объект `Phase 2`
2. `Prompt Packed QKV` line — второй главный объект `Phase 2`
3. `SER`, `muge`, `Fused MoE` и общие runtime knobs не являются ядром `Phase 2`
4. `MLA mode`, `Merge QKV` и family-specific auto-policies не нужно насильно делать class-universal

Именно по этой логике дальше и стоит продолжать runtime generalization.
