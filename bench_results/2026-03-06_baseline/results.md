# Benchmark Results 2026-03-06

Build: efc3b239d (merge upstream: fused delta-net AVX512, grammar fix, split mode fix)
Large Pages: ENABLED (2048 KB) — НЕ было в baseline 2026-02-22
Config base: t=16 fa=1 rtr=auto ctk=q8_0, r=3

## Шаг 2: Baseline ребейзлайн

| Model | PP512 t/s | TG128 t/s |
|-------|-----------|-----------|
| gpt-oss-20b MXFP4 | 281.16 ± 28.64 | 23.85 ± 0.08 |
| Qwen3-30B-A3B Q4_K_M | 316.81 ± 1.62 | 30.10 ± 0.01 |
| gpt-oss-120b MXFP4 | 160.77 ± 10.03 | 17.07 ± 0.10 |

### Сравнение с baseline 2026-02-22 (bd387a279, без Large Pages)

| Model | PP512 old | PP512 new | Δ PP | TG old | TG new | Δ TG |
|-------|-----------|-----------|------|--------|--------|------|
| gpt-oss-20b | 289.5 | 281.2 | −2.9% | 24.2 | 23.85 | −1.4% |
| Qwen3-30B | 306.2 | 316.8 | +3.5% | 29.9 | 30.10 | +0.7% |
| gpt-oss-120b | 161.1 | 160.8 | −0.2% | 17.2 | 17.07 | −0.8% |

Примечание: старый gpt-oss baseline использовал `rtr=1 muge=1`, а сейчас `rtr=auto muge=0`.
gpt-oss PP stddev высокий (28.64) — CCD scheduling noise, разница в пределах шума.
Qwen3 стабильное улучшение — вероятно Large Pages + upstream fused delta-net.

## Шаг 3: ctv=q8_0 vs ctv=f16

| Model | ctv | PP512 t/s | TG128 t/s |
|-------|-----|-----------|-----------|
| gpt-oss-20b | f16 | 281.16 ± 28.64 | 23.85 ± 0.08 |
| gpt-oss-20b | q8_0 | 276.73 ± 38.08 | 24.17 ± 0.15 |
| Qwen3-30B | f16 | 316.81 ± 1.62 | 30.10 ± 0.01 |
| Qwen3-30B | q8_0 | 315.27 ± 1.73 | 29.86 ± 0.22 |

**Вывод**: ctv=q8_0 нейтрален. PP в пределах шума, TG ±1%.
Безопасно использовать для экономии 50% V-cache памяти при длинных контекстах.

## Шаг 4: Batch size tuning (-ub)

### gpt-oss-20b (PP512, rtr=auto, ctk=q8_0)
| ub | PP512 t/s |
|----|-----------|
| 128 | 215.9 ± 22.3 |
| 256 | 248.6 ± 27.6 |
| **512** | **279.9 ± 25.5** |
| 768 | 275.9 ± 32.4 |
| 1024 | 275.1 ± 35.2 |

### Qwen3-30B (PP512, rtr=auto, ctk=q8_0)
| ub | PP512 t/s |
|----|-----------|
| 128 | 287.8 ± 2.6 |
| 256 | 305.8 ± 1.7 |
| **512** | **313.9 ± 2.0** |
| 1024 | 312.6 ± 0.8 |

**Вывод**: ub=512 (default) оптимален. ub<512 замедляет PP на 10-25%. ub>512 не помогает.
-b не влияет при pp <= b (ожидаемо).

## Регрессия: `-muge` crash на gpt-oss-20b

`-muge` (с или без `-rtr`) вызывает crash (exit 127, без вывода) на gpt-oss-20b MXFP4.
НЕ регрессия текущего merge — баг существовал на всех коммитах (bd387a279, 15134e83c, efc3b239d).
Вероятная причина: Large Pages (включены сейчас) взаимодействуют с muge allocation.

## Шаг 5: Large Pages

Large Pages уже активны (SeLockMemoryPrivilege предоставлен ранее).
Нужен контрольный замер без large pages: `-thp 0` или отключение privilege.
