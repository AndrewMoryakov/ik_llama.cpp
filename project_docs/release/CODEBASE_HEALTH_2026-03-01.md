# Codebase Health - 2026-03-01

## Короткий вердикт

Кодовая база уже находится в состоянии, которым можно пользоваться.

Но правильный статус сейчас такой:

- рабочий инженерный milestone;
- usable technical preview;
- не финальный polished stable release.

Иначе говоря:

- точку с запятой поставить можно;
- окончательную точку ставить рано.

## 1. Что уже можно считать завершенным на текущем этапе

### A. Основной runtime story форка

Уже можно считать завершенным текущий базовый слой:

- MoE-focused CPU runtime work;
- Zen4-aware guidance;
- разделение `in-RAM` и `swap-bound` режимов;
- явный фокус на huge MoE, не помещающиеся в RAM целиком.

Это уже не набор разрозненных идей, а оформленный рабочий вектор.

### B. `rtr auto` как реальная feature

Этот слой уже можно считать законченным для текущего milestone:

- есть CLI support;
- есть API support;
- есть `llama-bench` support;
- есть benchmark-backed reasoning;
- есть MiniMax-specific bugfix в policy.

### C. Benchmark methodology

Уже завершен и оформлен важный методологический слой:

- `pp / tg / pg`;
- separate `mixed-path` reasoning;
- разделение `in-RAM` и `swap-bound`;
- сохранение raw artifacts и current-status notes.

### D. Dashboard + tutorial layer

Этот слой уже usable:

- dashboard можно использовать как launcher;
- knowledge layer приведен в соответствие с текущими выводами;
- human tutorial/docs слой собран;
- есть отдельный product docs слой для самого dashboard.

### E. Family-specific documentation baseline

Уже существует понятная source-of-truth карта по главным линиям:

- `Qwen3MoE`
- `gpt-oss`
- `MiniMax M2.5`

То есть следующая сессия или новый инженер уже не стартуют с нуля.

## 2. Что уже можно использовать, но осторожно

Это рабочие части дерева, но их нельзя подавать как окончательные stable defaults.

### A. Prompt packed-QKV path

Состояние:

- реализован;
- измерен;
- полезен как engineering branch.

Но:

- user-facing выигрыш пока недостаточно сильный;
- это не public default.

### B. Packed-QKV presets и arena

Состояние:

- полезны для исследований;
- дали понимание по structure/locality.

Но:

- это еще heuristic/research layer;
- end-to-end story пока недостаточно сильная.

### C. Deep tracing / profiling env-knobs

Примеры:

- `IK_LLAMA_PG_TRACE`
- `IK_LLAMA_PG_TRACE_DECODE_WINDOW`
- `IK_LLAMA_LAYER_SCORE_TRACE`
- `IK_LLAMA_EXEC_LAYER_TRACE`
- `IK_LLAMA_LOCALITY_TRACE`
- `IK_LLAMA_HOT_EXPERT_TRACE`

Это полезные инженерные инструменты.

Но:

- это не обычный пользовательский путь;
- не стоит выдавать их за “готовые функции продукта”.

### D. MiniMax advanced knobs

Примеры:

- `IK_LLAMA_HOT_EXPERT_BUDGET`
- `IK_LLAMA_HOT_EXPERT_BUDGET_MULT`

Состояние:

- для исследований полезны;
- уже дали полезные выводы.

Но:

- ordinary baseline сейчас: не задавать их;
- большие бюджеты пока `research-only`.

## 3. Что еще не закрыто и не надо выдавать за готовое

### A. Нет сильного headline engine win

Сейчас главный пробел такой:

- нет одного простого, сильного, легко объяснимого architecture-specific win, который уже можно вынести как главный публичный performance result.

Это главный блокер для более сильного релизного повествования.

### B. MiniMax policy еще не закрыта окончательно

Что уже известно:

- `rtr=off` safest baseline;
- старый плохой `auto` был policy bug;
- bugfix уже внесен.

Что еще не закрыто:

- длинный узкий pass `MiniMax off vs auto` после фикса.

Пока это не пройдено, MiniMax story usable, но еще не окончательно завершена.

### C. Рабочее дерево не собрано как чистый release snapshot

Текущее состояние дерева:

- много измененных файлов;
- есть benchmark scripts;
- есть raw benchmark artifacts;
- есть research infrastructure рядом с release-facing кодом.

Это не делает код непригодным.

Но это значит:

- состояние еще не выглядит как clean frozen milestone branch.

### D. Часть research lines по-прежнему открыта

Например:

- decode-side next win;
- MiniMax `off vs auto` closure;
- future family presets;
- custom quantization line.

Это ожидаемо для technical preview, но означает, что работа явно продолжается.

## Есть ли в кодовой базе грязь или костыли

Честный ответ:

- да, есть исследовательская незавершенность;
- да, есть dirty working tree;
- да, есть experimental env-gated paths.

Но:

- это не похоже на сломанный продукт;
- это похоже на живую инженерную кодовую базу, где уже есть usable baseline и поверх него продолжается optimization work.

То есть это не “хаос”, а “рабочая лаборатория с уже пригодным базовым путем”.

## Можно ли уже сейчас пользоваться текущим состоянием

Да, можно.

Правильный режим использования сейчас такой:

1. держаться validated guidance;
2. использовать current family-specific source-of-truth notes;
3. не включать experimental knobs без отдельного измерения;
4. не путать stable baseline и research paths.

Практически это означает:

- `Qwen3MoE` и `gpt-oss` уже можно использовать как нормальные рабочие линии;
- `MiniMax` тоже уже usable как huge-model target, но с более осторожной policy;
- experimental paths оставлять для инженерной работы, а не для baseline.

## Итог

Если вопрос звучит так:

- “можно ли поставить точку с запятой и уже пользоваться этим состоянием?”

Ответ:

- да.

Если вопрос звучит так:

- “можно ли уже называть это финально завершенным polished release?”

Ответ:

- нет.

Правильная формулировка текущего состояния:

- usable engineering milestone;
- practical technical preview;
- с продолжающейся optimization work поверх уже пригодного baseline.
