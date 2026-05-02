# Post-Merge Backlog — 2026-05-02

Список follow-up'ов после успешного upstream-sync merge'а (`afaa7e04d`,
190 коммитов, +55% PP на Qwen3-30B, +54.7% PP на gpt-oss-20b).

Каждый item самостоятелен — выполнять в любом порядке, в отдельной сессии.

---

## 1. Surface 4 новых upstream-флагов в dashboard UI

**Зачем**: после merge'а dashboard знает 4 новых knob'а (n_cpu_moe, defer_experts,
dry_run, minilog) только в evidence-layer, но не в command-генерации и не в UI.
Пользователь не может выбрать их через dashboard.

**Контекст**: evidence-entries уже добавлены (commit `9f0d352ab`). 123/123 теста
проходят. Нужны handlers для surfacing.

**Что нужно сделать**:
1. `dashboard/dashboard-command.js`: handlers для генерации CLI-аргументов
   ```js
   if (s.n_cpu_moe > 0) args.push('--n-cpu-moe', s.n_cpu_moe);
   if (s.defer_experts) args.push('--defer-experts');
   if (s.dry_run) args.push('--dry-run');
   if (s.minilog) args.push('--minilog');
   ```
2. `dashboard/dashboard.html` (или experimental-knob form блок): UI controls
   (числовое поле для n_cpu_moe, чекбоксы для остальных)
3. `dashboard/dashboard-i18n.js`: RU/EN texts labels и tooltips
4. `dashboard/test/`: расширить command.test.js и rules.test.js на новые knobs

**Оценка**: ~1–2 часа. Без benchmark-данных подтверждающих perf-вин — оставить
validation: `'research'` / `'helper'`.

**Связанные документы**:
- `dashboard/POST_MERGE_AUDIT_2026-05-02.md` — детальный backlog для этой работы

---

## 2. gpt-oss-120b r=3 baseline rerun

**Зачем**: post-merge baseline (`bench_results/2026-05-02_post_merge_baseline/`)
содержит только Qwen3-30B и gpt-oss-20b. Для gpt-oss-120b (3-я основная in-RAM
модель) пост-merge числа не получены — память хранит pre-merge результаты:

```
Pre-merge (r=3): PP512 160.8 / TG128 17.07 (ctk=q8_0)
                 PP512 183.1 / TG128 16.76 (ctk=q4_0, recommended baseline)
```

**Что нужно сделать**: запустить `llama-bench -m gpt-oss-120b -t 16 -fa 1 -rtr 1
-ctk q4_0 -p 512 -n 32 -r 3`, сохранить в
`bench_results/2026-05-02_post_merge_baseline/gpt_oss_120b.log`, обновить
`summary.md` той же директории.

**Оценка**: ~30 минут (модель крупнее, загрузка дольше).

**Гипотеза**: ожидаем подобный +55% PP gain (#1578 AVX-512 Q4_K direct hit
работает и на 120b если ctk=q4_0; #1707 small-batch MoE тоже релевантен).

---

## 3. Закоммитить eval/ framework и связанные scripts

**Зачем**: качественная eval-инфраструктура (V1–V4 test suites, MiniMax vs
Qwen3-42B comparison) активно использовалась для validation Tapered-RAM,
но остаётся untracked в личном workspace.

**Что нужно сделать**:
1. Просмотреть `eval/` (scripts + docs + results) — определить что pubishable
2. Возможно вынести `bench_results/eval_v*/` (raw results) в gitignore — это
   тяжёлые JSON-логи measurement archives
3. Закоммитить framework: `eval/scripts/run_*.py`, `eval/docs/EVAL_*.md`,
   `eval/README.md`
4. Скрипты в корне `scripts/`: `run_eval_*.py` (7 файлов), `analyze_expert_stats.py`

**Оценка**: ~30 минут (выбор что включать + одиночный коммит).

**Решение для следующей сессии**: или коммитим framework без results, или
делаем большой коммит включая выбранные значимые results (например,
`eval_v4_comparison.md` — итоговый comparison док).

---

## 4. Cleanup: удалить safety-ветку через 2 недели

**Зачем**: `safety/pre-upstream-merge-2026-05-02` создана как страховка отката.
По соглашению AGENTS.md — safety-ветки временные, удалять когда merge доказал
стабильность.

**Когда**: ≥2026-05-16 (через 2 недели после merge).

**Условия удаления**:
- Никаких regression-репортов от использования post-merge кода
- Хотя бы одна successful production-load с post-merge билдом
- Нет открытых вопросов по поведению нового кода

**Что нужно сделать**:
```
git branch -d safety/pre-upstream-merge-2026-05-02
git push personal --delete safety/pre-upstream-merge-2026-05-02
```

**Не удалять**: `milestone/upstream-sync-2026-05-02` — это frozen reference
point, остаётся постоянно (как `milestone/2026-03-01-logical-snapshot`).

---

## Приоритезация

Если выполнять по одному, рекомендуемый порядок:

1. **#2 (gpt-oss-120b rerun)** — самое быстрое (30 мин), даёт полную картину
   post-merge baseline для всех 3 in-RAM моделей.
2. **#1 (dashboard surface)** — наибольший impact (4 новых knob становятся
   user-accessible). 1–2 часа.
3. **#3 (eval/ commit)** — низкий impact (framework работает локально без
   commit'a), но нормализует tracked state.
4. **#4 (safety cleanup)** — wait until 2026-05-16 минимум.

---

## Не в этом backlog'е

Items вне scope post-merge — это **другая работа** не относящаяся к sync:
- Phase 4 AVX-512 micro-optimizations (план в `archive/`, отложено)
- Tail-blend дальнейшие эксперименты (negative result, закрыто)
- Новые quant recipes для других моделей кроме MiniMax M2.5
- Любая research/* работа

Эти треки имеют свои отдельные документы.
