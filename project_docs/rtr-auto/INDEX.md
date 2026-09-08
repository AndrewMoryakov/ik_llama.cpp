# INDEX — навигация по `rtr-auto/`

Один файл, чтобы быстро найти нужный документ. См. также `README.md`
для краткого описания каждого файла.

## Все файлы (chronological)

| Дата       | Файл                              | Тип             | Краткая суть                                                                  |
|------------|-----------------------------------|-----------------|-------------------------------------------------------------------------------|
| 2026-05-04 | `ANALYSIS.md`                     | research        | Pre-submit analysis. Problem context, implementation walkthrough, edge cases. |
| 2026-05-04 | `POST_SUBMIT_BUG_2026-05-04.md`   | post-mortem     | `use_mmap` regression bug, нашли через self-review после submit, force-pushed.|
| 2026-05-05 | `DMAIVEL_FEEDBACK_2026-05-05.md`  | community       | Feedback от dmaivel, два бага в логике, draft response, architectural question.|
| 2026-05-05 | `AGENT_BRIEF.md`                  | agent bootstrap | Контекст для LLM-агента в новой сессии. Что прочитать, что НЕ делать.         |
| 2026-05-05 | `TASK_DEEP_REVIEW_2026-05-05.md`  | task spec       | Задание для агента: 11 направлений deep review, формат отчёта.                |
| 2026-05-05 | `DEEP_REVIEW_2026-05-05.md`       | review report   | Findings F1-F7 + verified-clean C1-C5. F1 critical, F2-F5 medium, F6-F7 low.  |
| 2026-05-05 | `FOLLOWUP_REVIEW_2026-05-05.md`   | review report   | Delta findings D1-D9 + три architecture options A/B/C. Stop rule.             |
| 2026-05-05 | `ADDITIONAL_REVIEW_2026-05-05.md` | review report   | Cross-reference после DEEP+FOLLOWUP. Independent confirm + 2 small items.     |
| 2026-05-05 | `FINAL_REVIEW_2026-05-05.md`      | decision report | Final verdict, blocking B1-B3, recommended PR response and next code path.    |
| 2026-05-05 | `EXPERIMENTAL_V2_LOCAL.md`        | local feature   | Local-only experimental rtr-auto v2 implementation gated by IK_LLAMA_RTR_AUTO_V2 / `--experimental rtr-auto-v2=on`. |
| 2026-05-06 | `V3_DESIGN_2026-05-06.md`         | design          | Refined v3 policy after maintainer feedback (placement+quant-aware). Decision enum (KEEP/DISABLE/UNKNOWN, no NOT_APPLICABLE), placement resolver (regex_search, ncmoe/fit/merge_* → UNKNOWN), policy walk pseudocode, walk-through of representative cases, caveats, implementation roadmap. Frozen pending maintainer answer on mmap-coupling. |
| —          | `README.md`                       | index           | Общее описание директории, файлы, status.                                     |
| —          | `INDEX.md`                        | navigation      | Этот файл.                                                                    |

## Reading orders

### Если ты впервые в этом контексте (newcomer onboarding, ~30 минут)

1. `README.md` — что это за директория, общий контекст.
2. `ANALYSIS.md` — что такое `-rtr`, как устроен `auto` режим, почему
   нужен probe pass.
3. `POST_SUBMIT_BUG_2026-05-04.md` — почему мы относимся к
   behavioural-change PR'ам с осторожностью.
4. `DMAIVEL_FEEDBACK_2026-05-05.md` — какие два бага нашёл community,
   как они компенсируют друг друга при switch на available memory.
5. `DEEP_REVIEW_2026-05-05.md` секции «Findings» и «Verified clean».
6. `FOLLOWUP_REVIEW_2026-05-05.md` секцию «Architecture options A/B/C».
7. `ADDITIONAL_REVIEW_2026-05-05.md` — что независимо проверено.
8. `FINAL_REVIEW_2026-05-05.md` — итоговое решение по PR.

### Если ты LLM-агент в новой сессии

1. `AGENT_BRIEF.md` целиком — bootstrap.
2. Файлы в порядке указанном там (плюс `DEEP_REVIEW`, `FOLLOWUP_REVIEW`,
   `ADDITIONAL_REVIEW` для актуального snapshot'а ревью).
3. Конкретная задача в твоём prompt'е.

### Если тебе нужно срочно ответить на feedback от ikawrakow

1. `DMAIVEL_FEEDBACK_2026-05-05.md` секция «Architectural alternative».
2. `FOLLOWUP_REVIEW_2026-05-05.md` секция с тремя options A/B/C.
3. `ADDITIONAL_REVIEW_2026-05-05.md` секция «Open question for the
   maintainer».
4. `FINAL_REVIEW_2026-05-05.md` секция «Recommended PR response».
5. Текущий PR diff: `git diff origin/main..pr/rtr-auto-mode`.

## По темам

### Bugs / технические проблемы

- `POST_SUBMIT_BUG_2026-05-04.md` — `use_mmap` regression (FIXED).
- `DMAIVEL_FEEDBACK_2026-05-05.md` — `n_gpu_layers > 0` skip + total RAM
  metric (OPEN).
- `DEEP_REVIEW_2026-05-05.md` F1, F2 (same as dmaivel), F3-F7 (new).
- `FOLLOWUP_REVIEW_2026-05-05.md` D1-D9 (delta findings).
- `ADDITIONAL_REVIEW_2026-05-05.md` probe exception coverage.
- `FINAL_REVIEW_2026-05-05.md` B1-B3 (merge-blocking issues).

### Architecture decisions

- `DMAIVEL_FEEDBACK_2026-05-05.md` Point 4 (drop `auto`, make `-rtr 1`
  self-protective).
- `FOLLOWUP_REVIEW_2026-05-05.md` секция «Architecture options» (A keep
  auto / B self-protective / C placement-aware).
- `DEEP_REVIEW_2026-05-05.md` F4 (ABI surface для `repack_tensors_auto`).
- `ADDITIONAL_REVIEW_2026-05-05.md` «Open question for the maintainer»
  (probe-failure default permissive vs safety-first).
- `FINAL_REVIEW_2026-05-05.md` final recommendation and PR response shape.

### Agent / process

- `AGENT_BRIEF.md` — bootstrap для новых агентских сессий.
- `TASK_DEEP_REVIEW_2026-05-05.md` — пример детального task spec'а.
- `POST_SUBMIT_BUG_2026-05-04.md` секция «Recommended pre-submit
  checklist for behavioural-change PRs» — process lessons.

### Cross-platform

- `ANALYSIS.md` — Windows/Linux/macOS detection в исходном дизайне.
- `DMAIVEL_FEEDBACK_2026-05-05.md` Point 3 — какие APIs использовать
  для available memory на каждой OS.
- `FOLLOWUP_REVIEW_2026-05-05.md` D6 — cgroups v1/v2 для Linux
  containers.

### Quality / verified clean

- `DEEP_REVIEW_2026-05-05.md` C1-C5.
- `ADDITIONAL_REVIEW_2026-05-05.md` independent confirm + probe
  exception coverage.

## По статусу feature

| Статус            | Где смотреть                                                                                  |
|-------------------|-----------------------------------------------------------------------------------------------|
| FIXED             | `POST_SUBMIT_BUG_2026-05-04.md` (`use_mmap` regression).                                      |
| OPEN bug, known   | `DMAIVEL_FEEDBACK_2026-05-05.md` Points 2, 3. Также `DEEP_REVIEW` F1, F2.                     |
| OPEN architectural| `FOLLOWUP_REVIEW_2026-05-05.md` options A/B/C; `FINAL_REVIEW_2026-05-05.md` final recommendation. Awaiting ikawrakow. |
| Verified clean    | `DEEP_REVIEW_2026-05-05.md` C1-C5; `ADDITIONAL_REVIEW_2026-05-05.md`.                         |
| Held              | Все code changes на `pr/rtr-auto-mode` до решения maintainer'а. См. `FOLLOWUP_REVIEW_2026-05-05.md` «Stop rule». |
| Local opt-in      | `EXPERIMENTAL_V2_LOCAL.md` (на `feature/rtr-auto-v2`); `--experimental rtr-auto-v2=on`.       |
| Path A patch ready| `pr/rtr-auto-mode-v2` (off `origin/main`, HEAD `d336a4a23`, pushed only to `personal` mirror). См. EXPERIMENTAL_V2_LOCAL.md секция «Path A patch already prepared». Force-push в `fork` только при ответе maintainer'а или ≥ 2026-05-12 silence. |

## Key external links

- PR #1738: https://github.com/ikawrakow/ik_llama.cpp/pull/1738
- dmaivel comment:
  https://github.com/ikawrakow/ik_llama.cpp/pull/1738#issuecomment-4376231337
- Upstream fork (ours): https://github.com/AndrewMoryakov/ik_llama-pr
- Upstream contributor plan: `../strategy/UPSTREAM_CONTRIBUTOR_PLAN_2026-05-04.md`

## Decision tree — «что мне прочитать если…»

- «Хочу понять что такое `-rtr auto` вообще» → `ANALYSIS.md` секции
  «Problem context» + «Current implementation».
- «Хочу узнать какие баги уже найдены» → `POST_SUBMIT_BUG`
  (FIXED) + `DMAIVEL_FEEDBACK` (OPEN) + `DEEP_REVIEW` Findings.
- «Хочу узнать какие категории проверены и чисты» → `DEEP_REVIEW`
  Verified clean + `ADDITIONAL_REVIEW` independent confirm.
- «Хочу понять архитектурный выбор который ждёт maintainer» →
  `FOLLOWUP_REVIEW` Architecture options A/B/C + `FINAL_REVIEW`.
- «Хочу написать новый PR такого типа сам» → `ANALYSIS.md` (как
  готовиться) + `POST_SUBMIT_BUG` (что проверить) + `AGENT_BRIEF`
  (как делегировать LLM).
- «Хочу настроить агента на ещё одно ревью» → `AGENT_BRIEF.md` +
  написать task spec по образцу `TASK_DEEP_REVIEW_2026-05-05.md`.

## Цитирование (если ссылаться на конкретный finding в PR/комментариях)

- F1, F2, ..., F7 — `DEEP_REVIEW_2026-05-05.md`.
- C1, C2, ..., C5 — `DEEP_REVIEW_2026-05-05.md`.
- D1, D2, ..., D9 — `FOLLOWUP_REVIEW_2026-05-05.md`.
- Options A, B, C — `FOLLOWUP_REVIEW_2026-05-05.md`.
- B1, B2, B3 — `FINAL_REVIEW_2026-05-05.md`.
- Points 1-4 — `DMAIVEL_FEEDBACK_2026-05-05.md`.

## Maintenance

- Обновлять при добавлении нового файла в директории.
- Если файл устаревает (например feature shipped), переместить из
  «Open» в «Closed/Historical» секцию.
- Если статусы в `README.md` меняются, синхронизировать секцию «По
  статусу feature» здесь.
