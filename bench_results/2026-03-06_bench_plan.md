# Benchmark Plan 2026-03-06

## Цель
Ребейзлайн после upstream sync, тест новых параметров, Large Pages.

## Модели
- gpt-oss-20b MXFP4 (in-RAM MoE)
- Qwen3-30B-A3B Q4_K_M (in-RAM MoE)
- gpt-oss-120b MXFP4 (in-RAM, большая)

## Шаги

### Шаг 1: Upstream merge (fused delta-net AVX512) ✅
- [x] `git merge origin/main` — 3 коммита, clean merge, efc3b239d
- [x] Build clean, exit 0

### Шаг 2: Baseline ребейзлайн ✅
- [x] gpt-oss-20b: PP512 281.2, TG128 23.85 (rtr=auto, muge=0 — muge crashит!)
- [x] Qwen3-30B: PP512 316.8, TG128 30.10
- [x] gpt-oss-120b: PP512 160.8, TG128 17.07
- [x] Все три стабильны vs baseline (±3%, в пределах шума)

### Шаг 3: ctv=q8_0 ✅
- [x] gpt-oss-20b: ctv=q8_0 нейтрален (PP 276.7, TG 24.17)
- [x] Qwen3-30B: ctv=q8_0 нейтрален (PP 315.3, TG 29.86)
- [x] **Вывод: безопасно для экономии V-cache памяти**

### Шаг 4: Batch size tuning (-ub) ✅
- [x] gpt-oss-20b: ub=512 оптимален, ub<512 = -10-25% PP
- [x] Qwen3-30B: ub=512 оптимален
- [x] **Вывод: default ub=512 уже оптимален, не менять**

### Шаг 5: Large Pages (PR14) ✅ (частично)
- [x] SeLockMemoryPrivilege уже активен — large pages работают автоматически
- [ ] Контрольный замер без large pages невозможен (нет runtime-флага для отключения)
- [x] Все текущие замеры УЖЕ с large pages

### Найденные проблемы
- **РЕГРЕССИЯ**: `-muge` crash (exit 127) на gpt-oss-20b. Любая комбинация с -muge крашится.

## Общие параметры
- Hardware: Ryzen 9 7950X, 96 GB DDR5
- Repetitions: r=3
- Flags: large pages enabled
- Базовый конфиг: t=16 fa=1 rtr=auto ctk=q8_0

## Baseline сравнение

| Model | PP512 old (Feb22) | PP512 new (Mar06) | Δ PP | TG old | TG new | Δ TG |
|-------|-------------------|-------------------|------|--------|--------|------|
| gpt-oss-20b | 289.5 | 281.2 | −2.9% | 24.2 | 23.85 | −1.4% |
| Qwen3-30B | 306.2 | 316.8 | +3.5% | 29.9 | 30.10 | +0.7% |
| gpt-oss-120b | 161.1 | 160.8 | −0.2% | 17.2 | 17.07 | −0.8% |

## MiniMax — отложен
Работа над MiniMax начнётся после завершения шагов 1-5.
