# Benchmark Plan 2026-03-06

## Цель
Ребейзлайн после upstream sync, тест новых параметров, Large Pages.

## Модели
- gpt-oss-20b MXFP4 (in-RAM MoE)
- Qwen3-30B-A3B Q4_K_M (in-RAM MoE)
- gpt-oss-120b MXFP4 (in-RAM, большая)

## Шаги

### Шаг 1: Upstream merge (fused delta-net AVX512)
- [ ] `git merge origin/main` (3 коммита: fused delta-net AVX512, grammar fix, split mode fix)
- [ ] Resolve conflicts if any
- [ ] Build + verify

### Шаг 2: Baseline ребейзлайн
- [ ] gpt-oss-20b: pp512, tg128, t=16 fa=1 rtr=auto ctk=q8_0 muge=1
- [ ] Qwen3-30B: pp512, tg128, t=16 fa=1 rtr=auto ctk=q8_0 muge=0
- [ ] Сравнить с baseline 2026-02-22 (gpt-oss PP289.5/TG24.2, Qwen3 PP306.2/TG29.9)

### Шаг 3: ctv=q8_0
- [ ] gpt-oss-20b: добавить ctv=q8_0 vs ctv=f16
- [ ] Qwen3-30B: добавить ctv=q8_0 vs ctv=f16
- [ ] Оценить: PP/TG delta, экономия KV памяти

### Шаг 4: Batch size tuning (-b / -ub)
- [ ] gpt-oss-20b: b={512,1024,2048,4096} × ub={128,256,512}
- [ ] Qwen3-30B: b={512,1024,2048,4096} × ub={128,256,512}
- [ ] Найти оптимум PP (TG не зависит от batch size)

### Шаг 5: Large Pages (PR14)
- [ ] Relogon с SeLockMemoryPrivilege
- [ ] gpt-oss-20b: PP512+TG128, large pages on vs off
- [ ] Qwen3-30B: PP512+TG128, large pages on vs off
- [ ] gpt-oss-120b: PP512+TG128, large pages on vs off

## Общие параметры
- Hardware: Ryzen 9 7950X, 96 GB DDR5
- Repetitions: r=3 minimum
- Flags: `-v` для диагностики
- Базовый конфиг: t=16 fa=1 rtr=auto ctk=q8_0

## Предыдущие baseline (2026-02-22)
| Model | PP512 | TG128 | Config |
|-------|-------|-------|--------|
| gpt-oss-20b | 289.5 | 24.2 | fa=1 muge=1 rtr=1 t=16 |
| Qwen3-30B | 306.2 | 29.9 | fa=1 rtr=1 muge=0 t=16 |
| gpt-oss-120b | 161.1 | 17.2 | fa=1 rtr=auto muge=0 t=16 |

## MiniMax — отложен
Работа над MiniMax начнётся после завершения шагов 1-5.
