# `-rtr auto` — анализ перед submit upstream

**Дата**: 2026-05-04  
**Статус**: pre-submit research, не для PR yet  
**Тип фичи**: behavioural change (новый CLI mode), потенциально load-bearing для swap-bound use cases

---

> **Historical snapshot**: this file is the pre-submit analysis for the
> original PR shape. It intentionally contains assumptions that were later
> superseded by post-submit review and community feedback. For current status
> and decisions, read `INDEX.md`, `README.md`,
> `DMAIVEL_FEEDBACK_2026-05-05.md`, `DEEP_REVIEW_2026-05-05.md`,
> `FOLLOWUP_REVIEW_2026-05-05.md`, and
> `ADDITIONAL_REVIEW_2026-05-05.md`.
>
> Known superseded assumptions in this file:
> - macOS RAM detection was later added with `sysctl(HW_MEMSIZE)`;
> - `n_gpu_layers > 0` skip was later shown to miss `-ot exps=CPU`;
> - total physical RAM must be replaced by available/effective memory;
> - Linux container/cgroup behavior needs explicit handling and should not be
>   inferred from `_SC_PHYS_PAGES` alone.

---

## TL;DR

`-rtr auto` — третий режим флага `--run-time-repack` (помимо `0`/`off` и `1`/`on`).
При load model probe'ит размер модели и сравнивает с физическим RAM. Если
`model_size > 0.9 * phys_ram` — автоматически отключает rtr, предотвращая
известную регрессию −46–60% TG на swap-bound моделях.

**Текущий статус валидации**:

- ✅ In-RAM не регрессирует (верифицировано на Qwen3-30B Q4_K_M, r=3)
- ✅ Auto-disable срабатывает корректно на 123 GiB swap-bound (verified)
- ✅ Graceful fallback на probe failures (file not found)
- ⚠️ macOS RAM detection отсутствует (нужно добавить)
- ⚠️ `LLM_ARCH_MINIMAX_M2` legacy branch — нужно удалить
- 🔴 GPU+CPU offload: возможен false positive (auto-disable когда CPU-side малый)
- ⚠️ Только Windows тестирование, Linux только code review

**Решение**: feature **valid и safe**, но требует ~1 час cleanup до submit.

---

## 1. Problem context

### Что такое `-rtr`

`--run-time-repack` (CLI alias `-rtr`) — флаг в `ik_llama.cpp`. При
`-rtr 1` во время загрузки модели **переупаковывает тензоры** из стандартного
quant формата (например, `Q4_K`) в **row-interleaved** (`Q4_K_R4`,
`Q5_K_R4`, и т.д.).

Зачем: hand-tuned AVX-VNNI 256-bit GEMM kernels в `iqk_gemm_*.cpp` имеют
специальные пути для `_R4`/`_R8` форматов. Они дают +10–50% PP throughput
на in-RAM моделях.

Связанные upstream merges (из последнего sync 2026-05-02):

- #1467 — AVX-VNNI 256-bit для IQ4_NL R4
- #1474 — для IQ3_XXS, IQ3_S R4
- #1482 — для Q6_K R4
- #1472 — для Q3_K R4
- #1578 — Q4_K/Q5_K через `mul_mat_q8_1_r8_q8_2` AVX-512

### Известная регрессия на swap-bound моделях

Из MEMORY (settled fact #5):

> rtr=1 на swap-bound моделях = **−46 до −60% TG**

**Механизм катастрофы**:

1. `-rtr 1` requires reading every tensor sequentially in RAM to repack
2. На swap-bound модели (`model_size > phys_ram`) эта последовательная
   операция загружает страницы из swap в RAM
3. Чтобы освободить место — OS вытесняет другие тензоры в swap
4. Когда дойдём до них в repack loop — снова swap-in, vicious cycle
5. После repack завершён, при actual inference каждый dispatch читает
   tensors которые уже снова в swap

**Эмпирические числа** (MiniMax M2.5 UD-Q5, 151 GiB на 96 GiB RAM):

- `-rtr 0`: tg32 ≈ **0.62 t/s** (baseline)
- `-rtr 1`: tg32 ≈ **0.30 t/s** (катастрофа — -52%)

### Почему пользователи попадают в эту ловушку

- Документация рекомендует `-rtr 1` для performance
- Никаких runtime warnings о deficit RAM
- Effect отсроченный — пользователь видит slow inference, не понимает почему
- Issue появляется регулярно в upstream

**Hypothesis: CLI safety net через `auto` mode сделает default behavior корректным**.

---

## 2. Current implementation walkthrough

Файлы (в нашем форке):

| Файл | Что делает |
|------|------------|
| `common/common.h` | поле `bool repack_tensors_auto = false` в `gpt_params` |
| `common/common.cpp` | парсер `-rtr auto` или `-rtra` alias |
| `common/common.cpp` | `mparams.repack_tensors_auto = params.repack_tensors_auto` в `common_model_params_to_llama` |
| `include/llama.h` | поле в `llama_model_params` |
| `src/llama.cpp` | `llama_get_total_ram_bytes()` — cross-platform RAM detection |
| `src/llama.cpp` | `llama_rtr_auto_should_disable()` — главная функция |
| `src/llama.cpp` | вызов из `llama_model_load`: если `should_disable=true` → `params.repack_tensors = false` |
| `examples/llama-bench/llama-bench.cpp` | `repack_auto` поле в bench scenarios |

### `llama_get_total_ram_bytes()` — RAM detection

```cpp
static uint64_t llama_get_total_ram_bytes() {
#if defined(_WIN32)
    MEMORYSTATUSEX mem_info;
    mem_info.dwLength = sizeof(mem_info);
    if (GlobalMemoryStatusEx(&mem_info)) {
        return (uint64_t) mem_info.ullTotalPhys;
    }
#elif defined(__linux__)
    long pages = sysconf(_SC_PHYS_PAGES);
    long page_size = sysconf(_SC_PAGE_SIZE);
    if (pages > 0 && page_size > 0) {
        return (uint64_t) pages * (uint64_t) page_size;
    }
#endif
    return 0;
}
```

**Покрытие**:
- ✅ Windows (`GlobalMemoryStatusEx().ullTotalPhys`)
- ✅ Linux (`sysconf(_SC_PHYS_PAGES) * sysconf(_SC_PAGE_SIZE)`)
- ❌ **macOS — отсутствует**, нужно `sysctl(CTL_HW, HW_MEMSIZE)`
- ❌ **FreeBSD/other Unix — отсутствует**, нужно `sysctlbyname("hw.physmem", ...)`

**Graceful degradation**: если все ifdef-ы false → return 0 → caller проверяет
`phys_ram == 0` и возвращает false (не auto-disable). Без RAM info нельзя
принять решение. Acceptable.

### `llama_rtr_auto_should_disable()` — decision function

```cpp
static bool llama_rtr_auto_should_disable(
    const std::string & fname,
    const llama_model_params & params,
    std::string & reason)
{
    if (!params.repack_tensors || !params.repack_tensors_auto) {
        return false;       // user said -rtr 0 or -rtr 1 explicitly
    }

    const uint64_t phys_ram = llama_get_total_ram_bytes();
    if (phys_ram == 0) {
        return false;       // unknown RAM, conservative
    }

    try {
        // Metadata-only probe: mmap + no repack to inspect arch/hparams cheaply.
        llama_model_loader probe(fname, params.ncmoe, /*use_mmap*/ true,
                /*check_tensors*/ false, /*repack_tensors*/ false,
                params.use_thp, params.merge_qkv, params.merge_up_gate_exps,
                params.defer_experts,
                params.kv_overrides, params.tensor_buft_overrides);

        llama_model probe_model;
        probe_model.hparams.vocab_only = params.vocab_only;
        llm_load_arch(probe, probe_model);
        llm_load_hparams(probe, probe_model);

        const bool is_moe = probe_model.hparams.n_expert > 0
                         && probe_model.hparams.n_expert_used > 0;
        const bool is_minimax_m2 = probe_model.arch == LLM_ARCH_MINIMAX_M2;
        if (!is_moe && !is_minimax_m2) {
            return false;   // dense models не trigger
        }

        const uint64_t model_bytes = (uint64_t) probe.n_bytes;
        if (model_bytes <= phys_ram * 9 / 10) {
            return false;   // помещается with margin
        }

        if (is_minimax_m2) {
            reason = format("MiniMax M2 model %.1f GiB > 90%% of RAM %.1f GiB", ...);
        } else {
            reason = format("MoE model %.1f GiB > 90%% of RAM %.1f GiB", ...);
        }
        return true;
    } catch (const std::exception & e) {
        LLAMA_LOG_WARN("%s: failed to evaluate --run-time-repack auto: %s\n",
                __func__, e.what());
        return false;       // probe error, conservative
    }
}
```

### Решение в `llama_model_load`

```cpp
if (params.repack_tensors && params.repack_tensors_auto) {
    std::string reason;
    if (llama_rtr_auto_should_disable(fname, params, reason)) {
        params.repack_tensors = false;
        LLAMA_LOG_INFO("%s: --run-time-repack auto: disabled (%s)\n",
                __func__, reason.c_str());
    } else {
        LLAMA_LOG_INFO("%s: --run-time-repack auto: keeping repack enabled\n",
                __func__);
    }
}
```

Прямолинейно: если auto должен disable — переключаем `repack_tensors` в
false до основной загрузки.

---

## 3. Verification results (2026-05-04)

### Test A: in-RAM не регрессирует ✅

Qwen3-30B-A3B Q4_K_M (17.35 GiB на 95.1 GiB RAM), r=3, smoke flags
(`-t 16 -fa 1 -p 512 -n 32`):

| Mode | PP512 (t/s) | TG32 (t/s) |
|------|------------|------------|
| `-rtr 0` (no repack) | 298.97 ± 34.31 | 29.77 ± 0.33 |
| `-rtr 1` (always repack) | 346.53 ± 2.72 | 31.70 ± 0.12 |
| `-rtr auto` | 360.19 ± 6.45 | 31.54 ± 0.20 |

**Лог при rtr=auto**: `--run-time-repack auto: keeping repack enabled` — auto
корректно решает not disable.

**Анализ**:
- `rtr=0` vs `rtr=1`: rtr даёт +16% PP, +6.5% TG — confirms что rtr **дает реальный gain on in-RAM**
- `rtr=1` vs `rtr=auto`: PP +3.9% (within stddev 6.5), TG identical (within 1%) — **no regression**

Заключение: на in-RAM модели auto-mode = rtr-1-mode по производительности.

### Test B: swap-bound auto-disable срабатывает ✅

MiniMax-M2.5-VariantA (123.6 GiB на 95.1 GiB RAM), `-rtr auto`:

```
llama_model_load: --run-time-repack auto: disabled
                  (MiniMax M2 model 123.6 GiB > 90% of RAM 95.1 GiB)
```

Корректное срабатывание:
- `123.6 GiB > 0.9 * 95.1 GiB = 85.59 GiB` → trigger ✓
- Reason message с правильными числами

⚠️ Заметим: текст «MiniMax M2 model» — из MINIMAX_M2 special branch, который
устаревший. Generic MoE check тоже сработает на этой модели (`n_expert > 0`).

### Test C: graceful fallback на probe failure ✅

Случайный test с несуществующим путём:
```
llama_rtr_auto_should_disable: failed to evaluate --run-time-repack auto:
    llama_model_loader: failed to load model from D:/.../missing.gguf
llama_model_load: --run-time-repack auto: keeping repack enabled
```

**Behavior**:
- Probe бросает exception (file not found)
- `catch` block логгирует warning
- Возвращает false → main load proceeds normally
- Main load также fails с тем же error (expected)

**Соображение**: «keeping repack enabled» message слегка misleading при probe
failure — мы не actually decided keep, мы fell back. Cosmetic. Можно поправить:

```cpp
LLAMA_LOG_INFO("%s: --run-time-repack auto: probe failed, defaulting to repack\n", __func__);
```

### Test D: probe overhead — qualitative

Probe = mmap + load_arch + load_hparams (metadata only, не loads tensors).
mmap'ing 123 GiB — это `mmap()` syscall + virtual address reservation, не
actual disk read. `load_arch` reads few KB of GGUF metadata. `load_hparams`
similarly small.

Empirical: на VariantA (123 GiB) probe message появляется в течение секунд после
запуска cli. Точное измерение не done, но clearly < 1 second.

Acceptable overhead для feature которая spasaет от −50% TG регрессии.

---

## 4. Cross-platform audit

### Tested

| Platform | Compiler | Status |
|----------|----------|--------|
| Windows 11 | MSVC 2022 | ✅ полная валидация — Test A, B, C |

### Code-reviewed but not tested

| Platform | Path | Notes |
|----------|------|-------|
| Linux | `sysconf(_SC_PHYS_PAGES) * sysconf(_SC_PAGE_SIZE)` | Standard POSIX, должно работать на всех Linux |
| WSL2 | Linux path | Reports VM RAM (не host) — это **правильное** поведение, т.к. инференс ограничен VM-памятью |
| Docker | Linux path | Reports container memory cgroup limit — также правильно |

### Missing

| Platform | Issue | Fix |
|----------|-------|-----|
| **macOS** | `_SC_PHYS_PAGES` не Apple, returns 0 | Добавить `sysctl` (см. ниже) |
| **FreeBSD** | Same | Аналогично через `sysctlbyname("hw.physmem", ...)` |
| **Other Unix** | Same | Можно либо graceful disable, либо добавить per-OS |

### macOS implementation needed

```cpp
#elif defined(__APPLE__)
    int mib[2] = {CTL_HW, HW_MEMSIZE};
    uint64_t mem;
    size_t len = sizeof(mem);
    if (sysctl(mib, 2, &mem, &len, NULL, 0) == 0) {
        return mem;
    }
#endif
```

Headers: `<sys/sysctl.h>`. Thread-safe. Available since macOS 10.x.

---

## 5. Edge cases and risks

### 5.1. GPU+CPU split (n_gpu_layers > 0) — 🔴 **критично**

**Сценарий**: пользователь имеет 96 GB RAM + 24 GB VRAM, использует
`-ngl 60` или `-ncmoe 50` чтобы offload часть тензоров на GPU. Модель = 120 GB
на диске, но CPU-side занимает только 25 GB.

**Текущее поведение**: `probe.n_bytes = 120 GB > 0.9 * 96 = 86 GB` → **auto-disable
trigger'ится** даже хотя CPU-side легко помещается в RAM.

**Это false positive**. Пользователь хочет rtr на CPU side, но получает
auto-disable. Регрессия для GPU+CPU users.

**Mitigation options**:

A. **Document as known limitation**:
   > For GPU+CPU split inference (`-ngl N` или `-cmoe`/`-ncmoe`), use explicit
   > `-rtr 0` или `-rtr 1` — auto mode is designed для pure CPU inference.

B. **Skip auto when n_gpu_layers > 0**:
   ```cpp
   if (params.n_gpu_layers > 0) return false;  // GPU offload active
   ```
   Conservative — auto никогда не triggers с GPU. User'у с GPU offload рекомендуется
   explicit `-rtr 1`.

C. **Estimate CPU-side bytes**:
   ```cpp
   // Подсчитать tensors которые pойдут на CPU
   // Учесть -ncmoe, -cmoe, tensor_buft_overrides
   ```
   Сложно, error-prone, можно ошибиться.

**Recommendation**: **B** (skip when GPU offload). Если пользователь хочет
auto safety-net на CPU side при GPU offload — это feature work, отдельный
follow-up.

### 5.2. `LLM_ARCH_MINIMAX_M2` legacy branch — 🟢 cleanup

```cpp
const bool is_minimax_m2 = probe_model.arch == LLM_ARCH_MINIMAX_M2;
if (!is_moe && !is_minimax_m2) return false;
```

Этот special-case был добавлен когда старая версия `MINIMAX_M2` не reportила
`n_expert > 0` корректно. Сейчас MiniMax M2.5 ведёт себя как нормальная MoE
(n_expert=256 для UD-Q5).

**Verification needed**: проверить что `LLM_ARCH_MINIMAX_M2` модели имеют
`hparams.n_expert > 0` после load_hparams. Если да — branch redundant.

**Action**: удалить branch, оставить только `is_moe` check. Убрать также
specific «MiniMax M2 model» message — generic «MoE model» message хватит.

### 5.3. Threshold 0.9 — magic number

**Why 90%**:
- 1.0 (model = RAM): уже на границе, risk of swap по другим apps
- 0.9: 10% buffer на kernel/other-apps overhead
- 0.8: too conservative, в-RAM models ~80-90 GB могут не попасть в auto path
- 0.95: too tight, easily over

**Empirical justification**: на нашем 96 GB Windows machine, OS + background
processes занимают ~5-10 GB. Так что 0.9 примерно matches «realistic 
available RAM for model».

**Alternative**: env var `LLAMA_RTR_AUTO_THRESHOLD=0.85` для customization.
Maintainer может попросить (или нет).

**Recommendation**: оставить 0.9 как hard-coded. В PR description обосновать.
Если maintainer попросит configurable — easy follow-up.

### 5.4. mmap interaction

С `--no-mmap` model полностью loaded в RAM up-front. Если model = 80 GB
(< 0.9 * 96 = 86), auto не triggers, но `--no-mmap` затрезервирует 80 GB
рабочей памяти, что может cause swap pressure on other apps. Borderline case.

С `--mmap` (default true): pages loaded on-demand. Model > RAM = swap-bound
behavior уже описано выше.

Auto не различает эти два mode — относится одинаково. Acceptable, поскольку
threshold 0.9 conservative для обеих моделей.

### 5.5. WSL2 / Docker / VM environments

`sysconf(_SC_PHYS_PAGES)` reports **VM-internal RAM**, не host. Если WSL2
сконфигурирован с 64 GB (когда host имеет 128 GB), наша auto будет сравнивать
model с 64 GB. **Это правильно** — внутри VM модель все равно ограничена
VM RAM.

User может тонно настроить WSL чтобы получить большую memory if needed
(.wslconfig). Это вне scope нашей feature.

### 5.6. Probe failure modes

| Failure | Behavior |
|---------|----------|
| File not found | Exception → catch → return false → main load also fails (same error) |
| Corrupt GGUF | Same |
| Insufficient permissions | Same |
| OOM during probe | Unlikely (metadata only), но possible — caught |
| Disk read error | Same |

Все handled через `catch (const std::exception & e)`. Conservative fallback OK.

### 5.7. False negatives

Сценарии где auto **не disable**, хотя возможно стоило:

- Model = 85 GB на 96 GB RAM. Threshold 86.4 → не triggers. Но если другие
  apps занимают 20 GB → реально 76 GB available → 85 GB model triggers swap.
  
  Mitigation: пользователь сам видит slow и переключает на `-rtr 0` manually.
  Auto это **safety net**, не perfect oracle.

- Dense (non-MoE) модель того же размера. Auto не triggers (мы скипаем dense).
  
  Why: rtr на dense models меньше чувствительный к swap, поскольку attention
  hot path mostly fits in cache даже с large weights. MoE worse case потому что
  random expert dispatch increases RAM working set.
  
  Maintainer может спросить «почему не для dense?» — потому что не было
  baseline regression observed для dense + swap. Можно расширить позже.

---

## 6. Anticipated maintainer questions

| Вопрос | Подготовленный ответ |
|--------|----------------------|
| «Почему 90%?» | Empirical buffer для kernel/OS/other apps. На 96 GB host typical free memory is ~85-90 GB. Conservative, defensible. Alternative: env var. |
| «Did you test on Linux?» | Code review only. `sysconf` path is POSIX standard. Need 30-min test on Linux box / Docker. Will do before submit. |
| «GPU offload?» | Known limitation — currently false positive on `n_gpu_layers > 0`. Will add `if (n_gpu_layers > 0) return false` or document. |
| «What about dense models?» | Skipped intentionally — no observed swap regression for dense. MoE worst-case due to random expert dispatch. Easy to extend if needed. |
| «Probe overhead?» | Metadata-only mmap, < 1s даже на 123 GiB файл. Negligible compared to full load (minutes). |
| «Threshold configurable?» | Hard-coded 0.9 для simplicity. Можно сделать env var `LLAMA_RTR_AUTO_THRESHOLD` если нужно. |
| «What if RAM detection fails?» | Returns 0 → caller returns false → behave as if `-rtr 1` (no safety net, but no harm). |
| «macOS support?» | Will add `sysctl(CTL_HW, HW_MEMSIZE)` path. |

---

## 7. Pre-submit cleanup checklist

| # | Action | Effort | Required |
|---|--------|--------|----------|
| 1 | Remove `LLM_ARCH_MINIMAX_M2` special branch | 5 мин | Yes — legacy hack |
| 2 | Add macOS RAM detection | 10 мин | Yes — cross-platform |
| 3 | Handle `n_gpu_layers > 0` (skip auto) | 10 мин | Yes — false positive |
| 4 | Cleanup probe-failure log message | 5 мин | Nice-to-have |
| 5 | Test on Linux (Docker container OK) | 30 мин | Yes — at least one Linux validation |
| 6 | Bench evidence в PR description | 15 мин | Yes — empirical proof |
| 7 | Document threshold rationale in PR description | 5 мин | Yes — pre-empt question |
| 8 | Optional: env var threshold customization | 15 мин | No — ждать feedback |

**Total**: ~1.5 hours до PR submit.

---

## 8. Open questions

1. **Should auto consider mmap state?** Currently no. Threshold same for mmap
   и no-mmap. Если no-mmap, polный RAM footprint up-front, что отличается от
   mmap pattern. Possibly should be more conservative for no-mmap.

2. **Should threshold differ for AVX-VNNI quants?** Some quants (Q4_K, Q5_K)
   benefit from R4 a lot. Others (IQ1_S, KT-quants) — less. Higher gain
   could justify riskier threshold.

3. **Should we also cover `--cpu-moe` / `--n-cpu-moe`?** These flags affect
   what runs on CPU. Currently we don't check them. Related to GPU offload
   issue.

4. **Should we expose `llama_rtr_auto_should_disable` in public API?** Currently
   `static` — only used internally. Could be useful for tools that want to
   query "would rtr be safe?" without running full load. Maintainer-defined.

5. **Should default `-rtr` be `auto` (vs current `0`)?** Would benefit all users
   automatically. But maintainer-level decision — changes default behavior.
   Better: submit auto as opt-in first, suggest as default later если accepted.

---

## 9. Risk summary for upstream review

| Risk | Severity | Status |
|------|----------|--------|
| Regression on in-RAM models | 🔴 Critical | ✅ Verified no regression |
| Auto-disable doesn't trigger when it should | 🔴 Critical | ✅ Verified triggers correctly on 123 GiB swap-bound |
| GPU offload false positive | 🟡 Medium | ⚠️ Need to handle (skip when n_gpu_layers > 0) |
| macOS users no benefit | 🟡 Medium | ⚠️ Need sysctl path |
| Probe failure breaks load | 🟢 Low | ✅ Verified graceful fallback |
| Threshold magic number | 🟢 Low | Defensible, can be configurable later |
| MINIMAX_M2 legacy hack | 🟢 Low | Easy to remove |
| Linux untested | 🟡 Medium | ⚠️ Need Docker test |
| WSL/VM behavior | 🟢 Low | Acceptable (VM-internal RAM is correct answer) |

---

## 10. Conclusion

`-rtr auto` — **valid и safe feature** для submitted upstream PR after addressing
3 cleanup items (~1.5 часа):

1. Remove MINIMAX_M2 legacy branch
2. Add macOS RAM detection
3. Handle GPU offload case (skip auto when n_gpu_layers > 0)

Additional desirable: Linux test через Docker.

Empirical validation:
- ✅ in-RAM не регрессирует
- ✅ swap-bound auto-disable triggers корректно
- ✅ probe failure graceful

Risks identified, all addressable. Maintainer concerns anticipated с готовыми
ответами.

**Не блокеры**: cosmetic log message tweak, threshold configurability, probe
overhead measurement.

После cleanup — submit как Tier 2 PR в [`UPSTREAM_CONTRIBUTOR_PLAN_2026-05-04.md`](../strategy/UPSTREAM_CONTRIBUTOR_PLAN_2026-05-04.md).
