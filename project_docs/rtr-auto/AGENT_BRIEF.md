> # STOP — этот бриф устарел 2026-09-10
>
> **Не выполняйте инструкции ниже.** Раздел «Threshold для autonomous proceed»
> велит при молчании мейнтейнера force-push`ить патч из `pr/rtr-auto-mode-v2`
> в `pr/rtr-auto-mode`. Условие сработало 2026-05-12, но:
>
> - PR #1738 **закрыт 2026-09-08**, upstream функцию не взял;
> - обе ветки `pr/rtr-auto-mode*` удалены, сохранены тегами `archive/pr/*`;
> - реализация в форке живёт на `dev` и это уже продвинутая v2 **без**
>   env-гейта: `llama_rtr_status` с AUTO_KEEP / AUTO_DISABLE / AUTO_UNKNOWN,
>   `llama_rtr_auto_should_disable` возвращает решение, а не bool.
>
> Ничего не «held», никто не ждёт ответа мейнтейнера, ветки для push нет.
>
> Текущее устройство работы: `FORK_WORKFLOW.md`.
> Разбор состояния rtr-auto: `docs/sessions/2026-09-08-upstream-merge/RAPTOR_MERGE_ANALYSIS_AND_PLAN.md` §10.

---

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

## Что уже сделано (актуально на 2026-05-05)

1. Initial commit с feature submitted 2026-05-04 (commit `f9e49b2c0`).
2. Self-review нашёл `use_mmap` regression bug, force-pushed fix
   (commit `0115ace21`). PR #1738 head стоит на этом.
3. Community член Ph0rk0z задал UX-вопрос про CLI syntax, ответили.
4. Community член dmaivel (collaborator) протестировал на реальной
   swap-bound конфигурации и нашёл два бага. Также EDIT-нул свой
   комментарий с пунктом про uncertainty-должна-default-в-disable.
5. **Posted response 2026-05-05 05:39 UTC** на dmaivel и ikawrakow:
   https://github.com/ikawrakow/ik_llama.cpp/pull/1738#issuecomment-4376786508
   Acknowledged оба бага + Point 5, предложили focused 5-step fix,
   спросили ikawrakow выбрать path (a)/(b)/(c). PR код не тронут.
6. **v2 fix имплементирован локально на `dev`** за experimental gate
   (`feature/rtr-auto-v2`, merged commit `b58fe6583`). Активируется
   через `--experimental rtr-auto-v2=on` или env `IK_LLAMA_RTR_AUTO_V2=1`.
   Validated на 6 model classes. Default behavior на dev unchanged.
7. **Path A patch уже подготовлен** на ветке `pr/rtr-auto-mode-v2`
   (off latest `origin/main`, HEAD `d336a4a23`). Smoke-verified
   (Qwen3-30B KEEP, MiniMax DISABLE, Qwen3.5-27B NOT_APPLICABLE).
   Pushed только в `personal` mirror, НЕ в `fork` remote — чтобы
   не trigger'нуть PR force-push раньше времени.
8. **Issue #1740 posted** для Item 2.2 (JSON metrics endpoint):
   https://github.com/ikawrakow/ik_llama.cpp/issues/1740
9. **Tier 3 scan выполнен 2026-05-05** — 0 quick wins из 45 open
   issues. См. UPSTREAM_CONTRIBUTOR_PLAN_2026-05-04.md Item 3.1.
10. **Maintainer ответил 2026-05-06 05:57 UTC** конкретным
    направлением: «consider actually available RAM, take into
    account tensor overrides and quantization types (use only
    tensors that will get repacked when computing required
    memory)». Также упомянул alternative workflow: offline
    `llama-quantize --repack` + mmap. См. полный текст в PR thread.
11. **Posted v3 plan reply 2026-05-06 11:45 UTC**:
    https://github.com/ikawrakow/ik_llama.cpp/pull/1738#issuecomment-4387595944
    Описали v3 design (walk `probe.weights`, filter by
    `iqk_repacked_type()`, resolve placement via
    `tensor_buft_overrides`/`n_gpu_layers`/`-ncmoe`, compare
    CPU-resident repackable bytes against available memory).
    Flag'нули one architectural question: loader forces
    `use_mmap=false` when `repack_tensors=true`, so KEEP based on
    repackable bytes alone may still cause swap on huge total.
    Предложили AND-check total CPU-resident bytes как secondary
    gate (path b). Disclosure'нули CPU-only без GPU — runtime
    test для `-ngl 99 -ot exps=CPU` невозможен локально.
    **Awaiting maintainer answer на mmap question перед coding v3 patch.**

## Threshold для autonomous proceed

Если ikawrakow молчит ≥ 5 рабочих дней с 2026-05-05 (примерно
2026-05-12), proceed по path A автоматически: force-push v2 patch
из `pr/rtr-auto-mode-v2` на `pr/rtr-auto-mode` через `fork` remote.
Procedure описана в EXPERIMENTAL_V2_LOCAL.md секция «Force-push
procedure».

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
10. `project_docs/rtr-auto/EXPERIMENTAL_V2_LOCAL.md` — описание v2
    local feature (gated), bench results, six-model validation,
    force-push procedure для path A.
11. `project_docs/rtr-auto/V3_DESIGN_2026-05-06.md` — refined v3
    design после maintainer feedback. **Замораживает** policy
    layout до того как maintainer ответит на mmap-coupling
    question. Содержит decision enum (KEEP/DISABLE/UNKNOWN),
    placement resolver, policy walk pseudocode, walk-through
    representative cases, caveats. Это primary reference при
    написании v3 patch когда maintainer ответит.

Также в strategy:

- `project_docs/strategy/UPSTREAM_CONTRIBUTOR_PLAN_2026-05-04.md` —
  актуальный статус всех Tier 1/2 PRs, Item 2.1 (#1738) и Item 2.2
  (#1740) с deatils.

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
6. НЕ путать `personal` remote и `fork` remote. `personal` =
   `AndrewMoryakov/ik_llama.cpp` (mirror, не GitHub fork). `fork` =
   `AndrewMoryakov/ik_llama-pr` (proper fork, отслеживается PR'ами).
   Push в `fork` triggers PR force-push если branch уже трекается
   PR'ом (как `pr/rtr-auto-mode` для #1738).
7. НЕ пушить `pr/rtr-auto-mode-v2` в `fork` без явного решения
   maintainer'а path A или истечения 5-day silence threshold.

## Стилистика общения с upstream

В комментариях upstream PR избегать LLM-маркеров: длинных тире,
стрелок (→), эмодзи, шаблонных «I'd argue» / «happy to» / «key
observation», излишних markdown-таблиц где обычная проза справится.
Тон: разработчик к разработчику, прямо и кратко.

## Язык

С пользователем общаться на русском. Документы и code comments в репе
на английском. PR-комментарии в upstream на английском.

## Backup info

- Local branches:
  - `dev` (наша интеграционная, head на момент написания: `d574d5395`)
  - `pr/rtr-auto-mode` (текущий PR head `0115ace21`, замёрджен в `fork`)
  - `pr/rtr-auto-mode-v2` (path A patch ready, head `d336a4a23`,
    pushed only в `personal`)
- Remote `personal` = `https://github.com/AndrewMoryakov/ik_llama.cpp.git`
  (личный mirror, не fork).
- Remote `fork` = `https://github.com/AndrewMoryakov/ik_llama-pr.git`
  (proper fork upstream'а, используется для PR).
- Commits на PR ветке: `f9e49b2c0` initial, `0115ace21` mmap fix.
- Последний commit на dev: проверь через `git log -1 dev`.

## Active upstream threads (на момент 2026-05-05)

- **PR #1738** (`-rtr auto`): submitted, waiting on maintainer.
  Posted dmaivel response 2026-05-05. Path A patch готов на
  `pr/rtr-auto-mode-v2`. Threshold ~2026-05-12 для autonomous
  proceed.
- **Issue #1740** (JSON metrics endpoint): posted 2026-05-05,
  waiting on maintainer reaction. PR не пишем до согласия.

Перед действиями с любым из этих thread'ов проверь актуальное
состояние через `gh`:

```
gh pr view 1738 --repo ikawrakow/ik_llama.cpp --comments
gh issue view 1740 --repo ikawrakow/ik_llama.cpp --comments
```

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
