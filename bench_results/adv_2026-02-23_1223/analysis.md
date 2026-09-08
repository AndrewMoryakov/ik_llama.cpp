> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# Advanced Benchmark Analysis (commit bd387a279)

- **Date:** 2026-02-23
- **CPU:** AMD Ryzen 9 7950X 16-Core (Zen 4, 2 CCD, 96 GB DDR5)
- **OS:** Windows 11 Pro
- **Build:** MSVC 2022, AVX-512, Release
- **Reps:** 2
- **Total time:** 17 min
- **Tests planned:** 54 (4 scenarios), **completed:** 30

---

## Test Matrix

| Scenario | Tests | Status |
|----------|-------|--------|
| KV-cache (f16 vs q8_0) | 24 | OK |
| t=32 | 6 | OK |
| Long context (PP 2048/4096/8192) | 18 | FAILED (`-c` not valid for llama-bench) |
| Mixed PG (pg 512,128) | 6 | FAILED (JSON parse error — multi-entry array) |

---

## 1. KV-Cache Quantization: f16 vs q8_0

Best configs used per model (from baseline): gpt-oss fa=1 muge=1 rtr=1; Qwen3 fa=1 rtr=1 muge=0; Llama fa=1 rtr=1.

### gpt-oss-20b

| Threads | Test | ctk=f16 | ctk=q8_0 | Delta |
|---------|------|---------|----------|-------|
| 8 | PP512 | 176.0 | 170.7 | **-3%** |
| 8 | TG128 | 19.3 | 19.4 | 0% |
| 16 | PP512 | 265.0 | 298.1 | **+12%** |
| 16 | TG128 | 23.3 | 23.3 | 0% |

### Qwen3-30B-A3B

| Threads | Test | ctk=f16 | ctk=q8_0 | Delta |
|---------|------|---------|----------|-------|
| 8 | PP512 | 181.8 | 181.7 | 0% |
| 8 | TG128 | 27.8 | 28.0 | +1% |
| 16 | PP512 | 303.6 | 316.7 | **+4%** |
| 16 | TG128 | 29.7 | 29.4 | -1% |

### Llama-3.1-8B

| Threads | Test | ctk=f16 | ctk=q8_0 | Delta |
|---------|------|---------|----------|-------|
| 8 | PP512 | 102.0 | 97.3 | **-5%** |
| 8 | TG128 | 7.6 | 7.6 | 0% |
| 16 | PP512 | 168.7 | 169.3 | 0% |
| 16 | TG128 | 8.3 | 8.3 | 0% |

### KV-Cache Conclusions

1. **TG не меняется** — KV-cache reads малая часть bandwidth при TG, квантизация не влияет.
2. **PP при t=16: q8_0 быстрее или равен f16.** gpt-oss +12%, Qwen3 +4%, Llama 0%. Причина: меньший объём данных KV-cache → меньше давления на память при многопоточном PP.
3. **PP при t=8: q8_0 чуть медленнее** для gpt-oss (-3%) и Llama (-5%). При меньшем числе потоков bandwidth не bottleneck, а dequant overhead заметнее.
4. **Рекомендация:** `ctk=q8_0` безопасен для использования — экономит ~50% памяти KV-cache без потери скорости при t>=16.

---

## 2. Thread Scaling: t=32 vs t=16 (Baseline)

Baseline t=16 values from previous run (best configs).

| Model | Test | t=16 (baseline) | t=32 | Delta | stddev t=32 |
|-------|------|-----------------|------|-------|-------------|
| gpt-oss-20b | PP512 | 289.5 | 338.0 | **+17%** | **205.8** |
| gpt-oss-20b | TG128 | 24.2 | 22.1 | **-9%** | 2.1 |
| Qwen3-30B-A3B | PP512 | 306.2 | 309.9 | +1% | 46.6 |
| Qwen3-30B-A3B | TG128 | 29.9 | 29.5 | -1% | 0.6 |
| Llama-3.1-8B | PP512 | 165.7 | 223.1 | **+35%** | 73.4 |
| Llama-3.1-8B | TG128 | 8.2 | 8.6 | +5% | 0.01 |

### Thread Scaling Conclusions (t=32)

1. **PP: Dense Llama выигрывает больше всех (+35%)**, gpt-oss +17%, Qwen3 flat. Dense модели лучше масштабируются по потокам для PP, т.к. нет expert routing overhead.
2. **TG: gpt-oss ухудшился (-9%)**, остальные flat. TG bandwidth-bound, лишние потоки создают contention.
3. **Огромный stddev при t=32** — gpt-oss: 205.8 (при avg 338), Llama: 73.4 (при avg 223). Это cross-CCD penalty на Zen4: при 32 потоках задействованы оба CCD, и планировщик ОС непредсказуемо распределяет нагрузку.
4. **Нестабильность делает t=32 ненадёжным.** Нужна NUMA-aware привязка потоков (PR06 из BACKLOG) для стабилизации.

---

## 3. Failed Scenarios — Root Causes

### Long Context (18 tests — ALL FAILED)

```
invalid parameter for argument: -c
```

`llama-bench` не поддерживает `-c` для задания размера контекста. Контекст автоматически определяется из `-p` (prompt length). Для тестирования длинного контекста достаточно увеличить `-p` (pp2048, pp4096, pp8192), что скрипт уже делал, но `-c` параметр вызвал ошибку до начала теста.

**Исправление:** убрать `-c $ctxSize` из bench-advanced.ps1.

### Mixed PG (6 tests — ALL FAILED)

```
PARSE ERROR / NO JSON
```

`-pg 512,128` возвращает JSON массив с двумя объектами (PP + TG результаты). Парсер скрипта ожидает однородный массив и ломается на формате вывода.

**Исправление:** обновить парсер для обработки multi-entry массивов от `-pg`.

---

## Summary Table

| Параметр | Влияние на PP | Влияние на TG | Рекомендация |
|----------|---------------|---------------|--------------|
| ctk=q8_0 | 0% to +12% (t=16) | 0% | **Использовать** — экономит память |
| t=32 (vs 16) | +1% to +35% | -9% to +5% | **Нестабильно** — высокий stddev |
| t=32 dense | **+35%** | +5% | Полезно для dense PP |
| t=32 MoE | +1-17% | -1 to -9% | Не рекомендуется |

---

## Next Steps

1. **Thread scaling тест (8, 16, 32, 42, 52, 64, 96)** — определить точку насыщения и оптимальный t для каждой модели.
2. **Исправить long-context тесты** — убрать `-c` параметр из bench-advanced.ps1.
3. **Исправить mixed-pg парсер** — обработка multi-entry JSON от `-pg`.
4. **NUMA/CCD pinning** (PR06) — стабилизировать результаты при t>16.



