# Analysis 5 — Творческие решения, если подтвердится disk-bound (MiniMax M2.7, CPU-only)

## Вводная и ограничения задачи (заданы пользователем)

- Модель **~110 GB**, RAM **96 GB** → весь artifact вместе с runtime state не
  помещается; объём steady-state physical SSD I/O на токен ещё надо измерить.
- **Кванты на пределе** — сжать сильнее нельзя (потеря качества неприемлема).
- **RAM разогнана максимально** — полоса памяти выжата.
- Задача: найти ускорение в **оптимизации софта/модели**, творчески и нестандартно.

## Ключевая рамка для всех решений

`~4.9 GB/token` — logical active weights, не доказанные physical reads. Если
Step0 подтвердит SSD/page-fault bound режим, тратить часть CPU/RAM на снижение
physical bytes/token может быть выгодно, но не бесплатно: проверять CPU overhead,
page-cache displacement, working set и реальный I/O.

1. **Читать МЕНЬШЕ** экспертов за токен.
2. **Амортизировать** чтение на несколько токенов.
3. **Читать УМНЕЕ** (те же байты — быстрее, за счёт очереди I/O и удержания горячего).

## Grounding (проверено в дереве этого форка)

- Runtime-цепочка top-k: `%s.expert_used_count` (`src/llama-arch.cpp:120`) → `ml.get_key(LLM_KV_EXPERT_USED_COUNT, hparams.n_expert_used, false)` (`src/llama-hparams.cpp:73`) → `ggml_top_k(ctx, selection_probs, n_expert_used)` (`src/llama-build-context.cpp:1091`).
- `--override-kv` позволяет переопределить `n_expert_used` до чтения hparams.
  В прогоне всё равно проверить loader log `Using metadata override`.
- `-ser` неактивен: `ggml_top_k_thresh` только объявление (`ggml/include/ggml.h:2398`) + определение (`ggml/src/ggml.c:10127`) + **один закомментированный вызов** (`src/llama-build-context.cpp:1089`); живой путь — `ggml_top_k`.
- Спекулятивное декодирование: `-md/--model-draft` (`common/common.cpp:1082`), `--draft/--draft-max/--draft-n` (`common/common.cpp:1021`), примеры `examples/speculative`, `examples/lookup` присутствуют.

---

## A. Читать МЕНЬШЕ экспертов — доступно сегодня, без пересборки

### №1 — Runtime top-k override: обратимый, но влияющий на качество

Модель не трогаем вообще:
```powershell
.\build\bin\llama-cli.exe -m "<MODEL>" --override-kv minimax-m2.expert_used_count=int:6 ...
```
Начать 8→7→6; 5/4 тестировать только если routing/quality gates проходят.
Selected-expert fraction падает линейно, но physical I/O и t/s — нет: остаются
фиксированные тензоры, page/cache effects и alignment. MiniMax ренормирует
оставшиеся веса (`norm_w=true`), хотя обучался с top-8. Измерять removed routing
mass, domain quality, physical bytes/token и t/s; после каждого режима — retrace.

### №2 — SER: отдельный implementation experiment
Threshold path отключён при fused-selection refactor. Возвращать его только
отдельной веткой с сохранением fused baseline, проверками `-1` IDs,
normalization/no-NaN и benchmark overhead. Сравнивать с fixed top-k при
одинаковом среднем числе экспертов и делать реальный retrace.

---

## B. Амортизировать чтение — спекулятивное декодирование

### №3 — Драфт-модель в RAM + верификация пачкой

Совместимый draft может амортизировать target calls, но не автоматически expert
I/O: при низком overlap target batch может затронуть до
`min(n_expert, 8 × K)` expert IDs на слой в каждом expert-weight tensor; rejected
позиции тоже вычисляются. Draft допустим только при прохождении проверок vocab
type, special tokens и token content из `examples/speculative/speculative.cpp`.
Он также занимает RAM/page cache. Sweep K=1/2/4/8 и измерять accepted/drafted,
union, target calls/output token, общий RSS, physical bytes/token и end-to-end t/s.

### №4 — `examples/lookup` (prompt-lookup): драфт БЕЗ драфт-модели
Кандидаты берутся из n-грамм контекста. Вторая модель не нужна, но lookup и
rejected target positions не бесплатны. Отдельно benchmark repetitive code/RAG
и open-ended prose, с hit/acceptance, physical bytes/token и net t/s.

---

## C. Читать УМНЕЕ — те же байты, быстрее / реже с диска

### №5 — Queue depth / асинхронный батч-префетч
Если Step0 покажет низкую эффективную SSD-полосу и page-fault dominated access,
сначала тестировать previous-token predictor (без mid-graph sync). Same-layer
IDs возникают внутри графа; callback/readback создаёт synchronization boundary и
может съесть выигрыш. Измерять реальный queue depth/effective throughput, не
выводить пользу из паспортных 3.5 GB/s.

### №6 — Точечный `VirtualLock` горячих экспертов (обход вердикта «per-expert невыразим»)
Per-expert ranges концептуально адресуемы внутри merged tensor, но текущий
`expert_tensor_index` хранит только whole-tensor ranges и Windows defer path не
реализован. Нужны `offs + expert*nb[2]`, page alignment, shards, lifetime и
проверка VirtualLock privilege/working-set limits. Сценарий 30/70 не считать
фактом; бюджет и payoff определяет trace.

### №7 — GGUF re-layout соседних тензоров эксперта
Standard GGUF не может interleave `gate[i]/up[i]/down[i]`, сохранив три
монолитных 3D tensor contiguous. Реальный существующий путь — offline fused
loader-supported offline `ffn_gate_up_exps` artifact (если conversion/quantization
pipeline его создаёт) + отдельный `down`, затем mmap **без runtime `-muge`**.
Полный expert-major layout — новый format/loader/kernel, не gguf-py-only rewrite.

---

## D. Структурно

### №8 — Прунинг 256 → ~176 экспертов
Task-specific pruning — staged high-risk путь к меньшему artifact, не доказанный
«мёртвый хвост». Тестировать 224/208/192/176, включая required
`ffn_exp_probs_b`, и искать измеренный residency/I/O cliff. Маску выбирать на
calibration, затем проверять aggregate top-8 intersections, removed mass и
domain quality на независимом holdout.

---

## Deprioritized pending measurement
- **On-the-fly compression** — отложено до замера compressibility реального
  artifact и decompression throughput.
- **Layer-skip / early-exit** — требует отдельного sensitivity/quality study;
  сравнение с pruning пока не доказано.
- **Дальнейший RAM tuning** — вне scope по условию пользователя; релевантность
  всё равно зависит от Step0.

## Рекомендованный порядок (по возрастанию затрат/риска)
1. Target MiniMax **Step0** с контролями и повторами.
2. Routing trace + offline cache simulator как prioritization tool. Baseline
   trace точен для неизменённой модели/no-intersection masks; после первого
   изменения маршрута это не end-to-end quality или Windows paging simulator.
3. Fixed top-k 8/7/6 с routing, quality и physical-I/O gates; retrace каждого.
4. Prompt lookup на повторяющихся реальных workloads.
5. Previous-token prefetch только если Step0/trace поддерживают bottleneck model.
6. SER после безопасной реактивации; draft speculation — если есть совместимый draft.
7. Selective lock/slab cache и staged pruning — только после измерений.

## 5-line summary
1. Paging plausible, но не подтверждён; оптимизировать измеренный physical I/O,
   а не принимать 4.9 GB/token за SSD-трафик.
2. Fixed top-k — самый дешёвый обратимый quality experiment; идти 8→7→6 и
   проверять фактический I/O, а не обещать линейное ускорение.
3. Спекуляция выгодна только когда acceptance и expert overlap перекрывают
   rejected work и память draft.
4. Prefetch/selective lock требуют измеренных page-fault/working-set оснований;
   standard GGUF не даёт expert-interleaved gate/up/down простым relayout.
5. Pruning может создать residency cliff, но требует complete-mask анализа,
   `ffn_exp_probs_b` remap и полного теста переписанного artifact.
