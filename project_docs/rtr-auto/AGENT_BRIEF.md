# Agent brief — `-rtr auto` PR review

Этот документ — bootstrap для LLM-агента в новой сессии, продолжающего
работу над PR #1738 (`-rtr auto` mode). Скопировать содержимое целиком
в начало сессии плюс конкретную задачу в конце.

---

## Контекст

Рабочая директория: `Z:\files\projects\ik_llama_proj\ik_llama.cpp`
Это форк `ikawrakow/ik_llama.cpp`. Ведётся upstream contribution
на feature `-rtr auto` (auto-disable run-time repack для swap-bound MoE).

PR #1738: https://github.com/ikawrakow/ik_llama.cpp/pull/1738
Текущий статус: OPEN, awaiting maintainer review.

## Что уже сделано

1. Initial commit с feature submitted 2026-05-04 (commit `f9e49b2c0`).
2. Self-review нашёл `use_mmap` regression bug, force-pushed fix
   (commit `0115ace21`).
3. Community член Ph0rk0z задал UX-вопрос про CLI syntax, ответили.
4. Community член dmaivel протестировал на реальной swap-bound
   конфигурации и нашёл два бага в нашей логике. Ответ ему
   подготовлен но НЕ отправлен. Фикс НЕ запушен. Ждём решения
   maintainer'а ikawrakow про architectural direction.

## Что прочитать перед ревью (в этом порядке)

1. `project_docs/rtr-auto/INDEX.md` — актуальная навигация, reading
   orders, статус feature.
2. `project_docs/rtr-auto/README.md` — общий контекст директории.
3. `project_docs/rtr-auto/ANALYSIS.md` — historical pre-submit
   research; читать как snapshot до post-submit findings.
4. `project_docs/rtr-auto/POST_SUBMIT_BUG_2026-05-04.md` — post-mortem
   `use_mmap` regression который нашли уже после submit.
5. `project_docs/rtr-auto/DMAIVEL_FEEDBACK_2026-05-05.md` — разбор
   feedback от dmaivel и draft response.
6. `project_docs/rtr-auto/DEEP_REVIEW_2026-05-05.md` — F1-F7,
   C1-C5, итоговый technical review.
7. `project_docs/rtr-auto/FOLLOWUP_REVIEW_2026-05-05.md` — D1-D9,
   architecture options A/B/C, stop rules.
8. `project_docs/rtr-auto/ADDITIONAL_REVIEW_2026-05-05.md` —
   independent confirmation плюс small patch items.
9. `project_docs/rtr-auto/FINAL_REVIEW_2026-05-05.md` — финальный
   verdict, recommended PR response, next code path.

После этого получить актуальное состояние PR:

```
gh pr view 1738 --repo ikawrakow/ik_llama.cpp
gh api repos/ikawrakow/ik_llama.cpp/issues/1738/comments
gh api repos/ikawrakow/ik_llama.cpp/pulls/1738/comments
gh api repos/ikawrakow/ik_llama.cpp/pulls/1738/reviews
```

И посмотреть git log на нашем dev и на ветке `pr/rtr-auto-mode`.
Последняя запушена в `personal/AndrewMoryakov/ik_llama-pr` через
remote `fork`.

## Текущий код feature

Реализация в:

- `common/common.cpp` — парсер `-rtr 0|1|auto` и `-rtra` alias.
- `common/common.h` — поле `repack_tensors_auto` в `gpt_params`.
- `include/llama.h` — поле `repack_tensors_auto` в `llama_model_params`.
- `src/llama.cpp` — `llama_get_total_ram_bytes()`,
  `llama_rtr_auto_should_disable()`, вызов из `llama_model_load`.
- `examples/llama-bench/llama-bench.cpp` — поддержка `-rtr auto` в bench.

## Известные открытые проблемы

1. dmaivel показал что наш `n_gpu_layers > 0` skip ничего не знает
   про `tensor_buft_overrides` и пропускает реальный swap-bound
   сценарий с `-ngl 99 -ot exps=CPU`. Точные детали в
   `DMAIVEL_FEEDBACK_2026-05-05.md`.
2. dmaivel также указал что мы меряем total RAM вместо available.
   Надо менять на `MEMORYSTATUSEX.ullAvailPhys` (Windows),
   `/proc/meminfo MemAvailable` плюс cgroup v1/v2 limits (Linux),
   `host_statistics64` (macOS).
3. dmaivel предложил архитектурную альтернативу: убрать `-rtr auto`
   режим, сделать сам `-rtr 1` self-protective. Это maintainer'ская
   call, не наша. Потенциальный rework PR.
4. Известный caveat: `probe.n_bytes` это размер всех весов на диске,
   не CPU-side bytes когда есть GPU offload. Available-RAM check
   частично компенсирует, но не идеально. Можно потом добавить
   точную оценку CPU-side через `tensor_buft_overrides` и
   `n_gpu_layers`.
5. Если maintainer выберет self-protective `-rtr`, нельзя просто
   добавить load-time guard: legacy parser уже ставит `use_mmap=false`.
   Нужно перенести mmap decision в load-time после safety-policy.

## Что НЕ делать

1. НЕ пушить изменения в PR без явного разрешения пользователя.
2. НЕ отправлять комменты в PR без одобрения текста.
3. НЕ делать force-push без явной причины и согласия.
4. НЕ закрывать PR.
5. НЕ переписывать фичу под архитектурную альтернативу dmaivel
   до ответа ikawrakow.

## Стилистика общения с upstream

В комментариях upstream PR избегать LLM-маркеров: длинных тире,
стрелок (→), эмодзи, шаблонных «I'd argue» / «happy to» / «key
observation», излишних markdown-таблиц где обычная проза справится.
Тон: разработчик к разработчику, прямо и кратко.

## Язык

С пользователем общаться на русском. Документы и code comments в репе
на английском. PR-комментарии в upstream на английском.

## Backup info

- Local branches: `dev` (наша интеграционная), `pr/rtr-auto-mode` (PR).
- Remote `personal` = `https://github.com/AndrewMoryakov/ik_llama.cpp.git`
  (личный mirror, не fork).
- Remote `fork` = `https://github.com/AndrewMoryakov/ik_llama-pr.git`
  (proper fork upstream'а, используется для PR).
- Commits на PR ветке: `f9e49b2c0` initial → `0115ace21` mmap fix.
- Последний commit на dev: проверь через `git log -1 dev`.

## Конкретная задача в этой сессии

[ПОДСТАВИТЬ ЗАДАЧУ]

Например:
- «Проверь не появилось ли новых комментариев в PR #1738 и предложи
  как реагировать»
- «Подготовь финальный фикс для available-RAM с тестами на macOS,
  но не пушь — покажи мне diff»
- «Сделай deep critical review feature с учётом всех 4 документов
  выше»
- «Обнови наш response для dmaivel с учётом X»
