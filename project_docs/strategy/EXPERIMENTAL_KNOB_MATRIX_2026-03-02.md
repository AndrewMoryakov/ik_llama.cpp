# Experimental Knob Matrix - 2026-03-02

## Зачем нужен этот документ

Это canonical matrix для `Phase 1`.

Он фиксирует для каждого experimental knob шесть вещей:

1. `Applicability`
- для какого класса моделей knob имеет смысл по механике

2. `Runtime support today`
- где текущий код реально уже включает этот path

3. `Validated on`
- где уже есть benchmark-backed signal

4. `Confidence`
- насколько уверенно можно ожидать практическую пользу именно на уже протестированных моделях

5. `Risk`
- насколько knob безопасен как user-facing experiment

6. `Failure mode`
- что чаще всего идет не так, если включить knob вне правильного класса или без A/B

Ключевое правило:

- `Applicability` не равно `Validation`
- `Validation` не равно `universal support`
- `Runtime support today` может быть уже, чем theoretical applicability

---

## Матрица

| Knob | Applicability | Runtime support today | Validated on | Confidence | Risk | Failure mode |
|---|---|---|---|---|---|
| `SER` (`ser_enabled`, `ser_min`, `ser_thresh`) | `MoE` | `generic MoE runtime path` | `research-only` | `none` | `medium` | может не дать win, а при неудачном пороге менять router-side behavior без практической пользы |
| `Hot Expert Budget` | `MoE / huge-MoE` | `generic MoE hot-expert path` | `MiniMax partial` | `medium on MiniMax; none elsewhere` | `medium` | лишнее давление на RAM, удержание неправильного hot set |
| `Hot Expert Budget Mult` | `MoE / huge-MoE` | `generic MoE hot-expert path` | `research-only` | `none` | `medium` | слишком агрессивный множитель может раздуть hot set и увеличить RAM pressure без устойчивой пользы |
| `Hot Expert Selection` | `MoE / huge-MoE` | `generic MoE hot-expert path` | `MiniMax partial`, `gpt-oss-20b partial` | `medium on MiniMax; low on gpt-oss-20b; none elsewhere` | `medium` | knob подходит классу моделей, но benchmark-backed signal пока слабый и не baseline-changing |
| `Tail Window` | `MoE / huge-MoE` | `generic MoE hot-expert path` | `MiniMax partial`, `gpt-oss-20b partial` | `medium on MiniMax; low on gpt-oss-20b; none elsewhere` | `medium` | path теперь может реально включаться на compatible MoE, но signal пока слабый и легко уходит в шум или мелкий регресс |
| `Merge QKV` | `attention arch-specific` | `accepted broadly, effect arch-sensitive` | `research-only` | `none` | `medium` | слабый или отрицательный win из-за неудачного attention/layout path |
| `Prompt Packed QKV` | `Split-QKV` | `generic split-QKV manual path; auto-policy Qwen3MoE / gpt-oss-first` | `gpt-oss-120b useful`, `Qwen3MoE partial`, `gpt-oss-20b partial` | `medium on gpt-oss-120b; low on Qwen3MoE/gpt-oss-20b; none elsewhere` | `high` | дополнительная RAM, более долгий load/startup, и на части families prompt-side gain без strong mixed-path value |
| `Prompt Packed preset` | `Split-QKV` | `generic split-QKV manual path; auto-policy Qwen3MoE / gpt-oss-first` | `gpt-oss-120b useful`, `Qwen3MoE partial`, `gpt-oss-20b partial` | `medium on gpt-oss-120b; low on Qwen3MoE/gpt-oss-20b; none elsewhere` | `high` | family-неподходящий preset или suboptimal layer subset |
| `Prompt Packed range` | `Split-QKV` | `generic split-QKV manual path; auto-policy Qwen3MoE / gpt-oss-first` | `research-only outside current families` | `none outside tested families` | `high` | ручной диапазон может ухудшить RAM/load time или не дать useful prompt win |
| `Live Observability` | `All` | `dashboard-only tooling` | `helper/tooling` | `helper` | `low` | лишний trace noise, если нужен максимально чистый benchmark |
| `Experimental preset` | `All` | `dashboard helper` | `helper/tooling` | `helper` | `low` | может включить bundle, который пользователь не до конца понимает |
| `Link preset to validated settings` | `All` | `dashboard helper` | `helper/tooling` | `helper` | `low` | пресет может перестроить validated baseline шире, чем ожидал пользователь |
| `rtr-auto v2` (local, gated) | `All (works for MoE, no-op for dense)` | `load-time policy gated by IK_LLAMA_RTR_AUTO_V2 / --experimental rtr-auto-v2=on` | `Qwen3-30B-A3B`, `gpt-oss-20b/120b`, `Qwen3.5-27B Q8_0`, `Qwen3.5-397B-A17B`, `MiniMax M2.5 Tapered-RAM` | `medium across in-RAM MoE / huge swap-bound MoE / dense; multi-shard accumulation real-world confirmed` | `low` | probe failure / OS-query failure → safety-first WARN + disable; dense → NOT_APPLICABLE без побочных эффектов. Gated, default unchanged. Когда maintainer выберет path A, v2 portируется в upstream PR без gate. См. `project_docs/rtr-auto/EXPERIMENTAL_V2_LOCAL.md`. |

---

## Как читать матрицу

### 1. Пример: `Tail Window`

Правильная интерпретация такая:

- по механике это knob класса `MoE / huge-MoE locality`
- по текущему runtime today это `generic MoE hot-expert path`
- по validation это сейчас `MiniMax partial`

То есть:

- knob нельзя называть "только MiniMax по природе"
- но нельзя и делать вид, что one-family validation уже превращает его в validated default на всех MoE

### 2. Пример: `Prompt Packed QKV`

Правильная интерпретация такая:

- по механике это knob класса `Split-QKV`
- по текущему runtime today manual-path уже может включаться на совместимых split-QKV моделях
- но `auto` policy и benchmark-backed confidence все еще family-first для `Qwen3MoE / gpt-oss`
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
