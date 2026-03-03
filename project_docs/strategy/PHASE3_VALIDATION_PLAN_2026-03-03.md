# Phase 3 Validation Plan - 2026-03-03

## Зачем нужна Phase 3

`Phase 3` не добавляет новые knobs и не расширяет runtime support.

Ее задача другая:

1. проверить, что generalized runtime support из `Phase 2` реально дает осмысленный signal;
2. отделить:
   - useful generalized path
   - neutral/no-op path
   - harmful/regressive path
3. не продвигать ложные defaults только потому, что knob теперь доступен шире.

Ключевая идея:

- `Phase 2` расширяет support;
- `Phase 3` проверяет, есть ли от этого practical value.

---

## Что именно валидируем

### 1. Hot experts / locality line

Класс:

- `MoE / huge-MoE`

Knobs:

- `Hot Expert Selection`
- `Tail Window`
- `Hot Expert Budget`
- `Hot Expert Budget Mult`

### 2. Prompt Packed line

Класс:

- `Split-QKV`

Knobs:

- `Prompt Packed QKV`
- `Prompt Packed preset`
- `Prompt Packed range` (только как advanced sanity)

---

## Модели для нормального плана

### A. `MiniMax`

Зачем:

- главный huge-MoE target;
- лучший кейс для проверки `hot experts / locality`;
- уже есть baseline и history по `off vs auto`, `budget`, `tail-window`.

Current execution note:

- deferred for a later dedicated window because huge-model confirm runs are expensive;
- not part of the current active Phase 3 pass.

### B. `gpt-oss-20b`

Зачем:

- менее noisy MoE;
- хороший sanity-target вне `MiniMax`;
- подходит и для `hot experts`, и для `Prompt Packed`.

### C. `Qwen3-30B-A3B`

Зачем:

- основной runtime target для `Prompt Packed QKV`;
- подходит для `Split-QKV` validation.

### D. `gpt-oss-120b`

Зачем:

- важная линия сама по себе, не только packaging target;
- позволяет проверить, survives ли generalized support на большом `gpt-oss` режиме;
- используется в текущем active Phase 3 pass.

---

## Validation lines

## 1. Hot Expert Selection / Tail Window

### На `MiniMax`

Baseline:

- `rtr=auto`
- `selection=default`

Experiments:

1. `selection=full-prompt`
2. `selection=tail-window`
3. `tail-window=16`

Workloads:

1. short:
   - `pg32,4`
2. confirm:
   - `pg512,128`
3. optional sanity:
   - `tg32`
   - `tg128`

Цель:

- понять, дает ли generalized `selection` что-то кроме старой MiniMax-specific линии;
- не путать короткий signal с practical default.

### На `gpt-oss-20b`

Цель:

- проверить, есть ли signal вне `MiniMax`.

Experiments:

1. baseline
2. `full-prompt`
3. `tail-window=16`

Workloads:

1. short:
   - `pg32,4` или `pg128,32`
2. если есть signal:
   - `pg512,128`

---

## 2. Hot Expert Budget / Budget Mult

### На `MiniMax`

Проверяем:

1. baseline:
   - `budget=0`
   - `budget-mult=0`
2. experiment:
   - `budget-mult=1.5`
3. optional historical reference:
   - `budget=16`

Workloads:

1. short:
   - `pg32,4`
2. если signal есть:
   - `pg512,128`

Цель:

- проверить, полезен ли `budget-mult` как более мягкий runtime control, чем fixed budget.

### На `gpt-oss-20b`

Только sanity:

1. baseline
2. `budget-mult=1.5`

Если signal нулевой:

- дальше не тратить на это время.

---

## 3. Prompt Packed QKV

### На `Qwen3-30B-A3B`

Baseline:

- standard runtime path

Experiment:

- `prompt-packed=on`
- `preset=front-half`

Optional advanced:

- `manual range`

Workloads:

1. `pp512`
2. `pg512,128`

Цель:

- проверить, подтверждается ли generalized `Split-QKV` path на главной Qwen line.

### На `gpt-oss-20b`

Baseline:

- standard runtime path

Experiment:

- `prompt-packed=on`
- `preset=back-half`

Workloads:

1. `pp512`
2. `pg512,128`

Цель:

- проверить ту же generalized line на `gpt-oss`.

### На одной сторонней `Split-QKV` модели

Цель:

- проверить не только старые validated families, но и сам факт generalized manual path.

Допустим:

- `Mistral-7B` или другая совместимая split-QKV модель

Workload:

- короткий smoke/perf sanity

---

## Порядок выполнения

### Step 1. Short A/B

Сначала только дешевые targeted runs:

1. `gpt-oss-20b hot experts sanity`
2. `gpt-oss-20b prompt-packed`
3. `gpt-oss-120b prompt-packed`
4. `Qwen3 prompt-packed`

Completed non-MiniMax execution subset:

1. `gpt-oss-20b hot experts sanity`
2. `gpt-oss-20b prompt-packed`
3. `gpt-oss-120b prompt-packed`
4. `Qwen3-30B-A3B prompt-packed`

Still deferred:

- full `MiniMax` validation slice

### Step 2. Narrow confirm runs

Только для случаев, где short A/B дал signal.

### Step 3. Phase 3 summary

Зафиксировать:

1. `confirmed useful`
2. `neutral`
3. `harmful / regressive`

по каждому generalized path.

---

## Критерий успеха

`Phase 3` считается успешной, если по каждому generalized path есть честный outcome:

1. `confirmed useful`
2. `neutral`
3. `harmful`

Не требуется, чтобы все knobs дали win.

Требуется:

- получить ясную practical map generalized support.

---

## Что не делать

1. не строить широкую full-factorial matrix;
2. не смешивать knobs между собой без узкой гипотезы;
3. не использовать `gpt-oss-120b` как основной Phase 3 target;
4. не превращать `Phase 3` в новую `Phase 2`;
5. не promoted делать knob после одного короткого сигнала.

---

## Реалистичное время

Нормальный план:

1. short A/B:
   - несколько часов
2. confirm-run-ы:
   - еще часы
3. разбор и docs:
   - полдня

Итого:

- обычно `1-2` дня плотной работы
- если heavy confirm-run-ы затянутся — до `3` дней

---

## Practical conclusion

Первый non-MiniMax `Phase 3` pass уже дал полезную развилку:

1. generalized `Prompt Packed QKV` подтвердился как реально полезная huge-model branch на `gpt-oss-120b`
2. `Prompt Packed QKV` на `gpt-oss-20b` и `Qwen3-30B-A3B` остался в основном prompt-side, без сильного mixed-path value
3. generalized `tail-window=16` на `gpt-oss-20b` дал слабый, но положительный signal

Следующий правильный порядок теперь такой:

1. optional dedicated `MiniMax` validation slice, когда будет отдельное окно времени
2. confirm/productize `Prompt Packed QKV` for `gpt-oss-120b`
3. сместить `gpt-oss-20b` mainline в decode-side optimization, а не в дальнейший prompt-only tuning

---

## Unfinished follow-up from the current Phase 3 pass

The current pass closed the first non-MiniMax generalized validation cycle, but it also left three concrete follow-up lines.

### 1. `gpt-oss-120b prompt-packed confirm`

Goal:

- prove that `Prompt Packed QKV back-half` on `gpt-oss-120b` is a stable practical win and not a single good run

What to run:

1. baseline:
   - standard runtime path
2. experiment:
   - `prompt-packed=on`
   - `preset=back-half`
3. workloads:
   - `pp512`
   - `pg512,128`
4. repeats:
   - preferably `r=3`

What counts as success:

1. mixed-path advantage remains positive
2. decode does not regress materially
3. result stays practical, not merely prompt-side

### 2. `gpt-oss-120b prompt-packed productization`

This starts only after the confirm step.

Goal:

- turn the confirmed result into usable product-layer guidance

What to do:

1. raise `Validation` / `Confidence` for `gpt-oss-120b`
2. decide whether a dedicated `gpt-oss-120b` preset is warranted
3. reflect the result in:
   - benchmark current-status docs
   - `PRODUCT_GUIDE`
   - dashboard guidance / confidence layer
4. keep this as a model-specific practical branch, not a universal `Split-QKV` default

What counts as success:

1. `gpt-oss-120b` gets a clear, honest recommendation
2. `gpt-oss-20b` and `Qwen3` do not inherit that default automatically

### 3. `gpt-oss-20b decode-side optimization handoff`

The current `Phase 3` result for `gpt-oss-20b` is not “keep tuning prompt-packed”, but a handoff to the next technical line.

What the current result means:

1. `Prompt Packed QKV` on `gpt-oss-20b` improves prompt-side behavior
2. mixed-path practical value stays weak / near-neutral

Practical consequence:

- the next mainline technical priority for `gpt-oss-20b` is `decode-side optimization`, not more prompt-only tuning

What to do next:

1. keep the fresh `gpt-oss-20b` baseline as the new reference
2. move to decode-side profiling
3. select the first narrow decode bottleneck

This is not a separate benchmark question to keep open inside prompt-packed work. It is the correct handoff from current `Phase 3` into the next technical line.
