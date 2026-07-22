# ШАГ 0 — измерительный плейбук (Windows/PowerShell)

> **STATUS: HISTORICAL ANALYSIS, NOT AN EXECUTION RUNBOOK.** Do not execute the
> commands or cache policy in this file on the Ryzen target. They preserve the
> reasoning that led to the current harness. The only authoritative execution
> procedure is `step0/MINIMAX_TARGET_RUNBOOK.md`: one explicitly
> non-authoritative warm-up followed by three uncleared-cache baseline repeats,
> with separate token-timing, ETW and routing-trace diagnostics. Step0 can
> identify disk pressure but cannot distinguish achieved DRAM-bandwidth limits
> from compute without synchronized memory-controller evidence; report that
> resident-path split as `unresolved`.

Цель: подтвердить, диск-bound или RAM-bandwidth-bound текущий CPU-only инференс MiniMax M2.7 на ik_llama.cpp, до любых правок кода.

Проверено против репо: `llama-cli.exe`/`llama-bench.exe`/`llama-sweep-bench.exe` в `build\bin\`; `--mlock`/`--no-mmap` в `common/common.cpp:1461-1462,2718-2722`; `n_expert`/`n_expert_used`/`n_expert_shared` лог-строки в `src/llama.cpp:1958,2025,2051`; GGUF-ключи в `gguf-py/gguf/constants.py:88-90`; routed-эксперты `_exps` в `constants.py:446-448`, shared `_shexp` в `constants.py:441-443`; per-tensor `n_bytes` в `gguf-py/gguf/gguf_reader.py:104-105,328-362`.

## Шаг 1 — измерить текущий t/s (baseline decode)

Один устойчивый прогон, переиспользуемый в Шаге 2 (диск-счётчики сэмплятся поверх ТОГО ЖЕ decode). Без `--mlock`/`--no-mmap` — иначе модель зафиксируется в RAM и диск-чтения упадут в ноль.

```powershell
cd "O:\user files\Projects\ik_llama.cpp"

# Ориентировочно:
.\build\bin\llama-bench.exe -m "<MODEL_PATH>" -p 0 -n 128 -t 12 -r 3

# Основной устойчивый прогон для Шагов 1+2:
.\build\bin\llama-cli.exe -m "<MODEL_PATH>" -t 12 -n 300 `
  -p "Write a detailed 500-word essay about the history of computing." `
  --no-display-prompt 2> "$env:TEMP\llama-cli-step0.log"
```

Читайте `tg128` из `llama-bench` для ориентира; для точного t/s берите строку `llama_perf_context_print: eval time = ... (X.XX tokens per second)` из stderr `llama-cli`.

## Шаг 2 — Disk read MB/s во время decode → GB/токен

> **Канонический метод задаёт только `step0/MINIMAX_TARGET_RUNBOOK.md`.** Скрипт
> `step0/step0-bench.ps1` должен запускаться с точными аргументами и cache policy
> из runbook. Его
> `phys_gen_bytes_per_tok` — device-level **estimator**, не PID/file ground truth:
> `PhysicalDisk` включает другие reads/read-ahead, sampling идёт примерно раз в
> секунду, а fallback `_Total` ещё шумнее. Нужны тихий диск, pagefile на другом
> физическом устройстве,
> raw samples, ≥3 повтора/error bars и sensitivity `TransientFraction` 20/30/40%.
> Ручной сниппет ниже — **архивная иллюстрация, не fallback**. Он усредняет
> чтение по всему прогону и потому **смешивает load и generation** (`Start-Sleep
> 8` — грубый пропуск загрузки, не работает при model>RAM, где load размазан по
> всему прогону). Для target evidence следуйте runbook.

```powershell
cd "O:\user files\Projects\ik_llama.cpp"

$job = Start-Job -ScriptBlock {
    param($modelPath)
    & "O:\user files\Projects\ik_llama.cpp\build\bin\llama-cli.exe" `
      -m $modelPath -t 12 -n 300 `
      -p "Write a detailed 500-word essay about the history of computing." `
      --no-display-prompt 2> "$env:TEMP\llama-cli-step0.log"
} -ArgumentList "<MODEL_PATH>"

Start-Sleep -Seconds 8   # пропустить load-фазу (не decode)

$samples = @()
while ($job.State -eq 'Running') {
    $c = Get-Counter '\PhysicalDisk(*)\Disk Read Bytes/sec' -SampleInterval 1 -MaxSamples 1
    $samples += ($c.CounterSamples | Where-Object { $_.InstanceName -ne '_total' } |
                 Measure-Object -Property CookedValue -Sum).Sum
}
Wait-Job $job | Out-Null; Receive-Job $job | Out-Null; Remove-Job $job

$avgMBps = ($samples | Measure-Object -Average).Average / 1MB
"Average disk read: {0:N1} MB/s over {1} samples" -f $avgMBps, $samples.Count

$tokensPerSec = <ЗНАЧЕНИЕ_ИЗ_ШАГА_1>
$gbPerToken = ($avgMBps / 1024) / $tokensPerSec
"GB/token (from disk): {0:N4} GB" -f $gbPerToken
```

## Шаг 3 — Реальная полоса RAM (STREAM/MLC/AIDA64), EXPO on/off

This measures a separate peak-bandwidth calibration, not achieved DRAM
bandwidth during inference. It cannot by itself classify the live resident path
as RAM-bound rather than compute-bound. Do not reboot or change EXPO during the
Step0 evidence sequence; perform such A/B work only as a separately approved
follow-up with a new baseline.

Не входит в репо — скачать. Intel MLC работает и на AMD:
```powershell
.\mlc.exe --bandwidth_matrix
```
Записать `ALL Reads` GB/s. AIDA64 (`Tools → Cache & Memory Benchmark → Memory Read`) как GUI fallback. EXPO переключается **только в BIOS** (reboot обязателен): MLC с EXPO ON → перезагрузка, выключить EXPO → снова MLC → вернуть EXPO.

## Шаг 4 — GGUF метаданные: expert count/used/shared + реальные active bytes/token

**4a — быстрая проверка через движок:**
```powershell
.\build\bin\llama-cli.exe -m "<MODEL_PATH>" -n 1 -p "hi" --no-display-prompt 2>&1 | `
  Select-String "n_expert|n_expert_used|n_expert_shared"
```

**4b — сырые ключи через gguf-py:**
```powershell
python gguf-py\scripts\gguf_dump.py "<MODEL_PATH>" --markdown | `
  Select-String "expert_count|expert_used_count|expert_shared_count|architecture"
```

**4c — оценка logical active bytes/token (НЕ physical I/O).** MoE выбирает
только `n_expert_used` из `n_expert`, но точное число требует graph-aware
accounting: embedding `get_rows`, tied output и fused tensors нельзя надёжно
вывести только из размера всех GGUF tensors.

```
active_bytes/token ≈ Σ_layers(attn_* + norm_* + ffn_gate_inp + *_shexp)
                    + (n_expert_used/n_expert) × Σ_layers(ffn_gate_exps + ffn_down_exps + ffn_up_exps)
                    + token_embd + output
```

```python
import sys
sys.path.insert(0, r"O:\user files\Projects\ik_llama.cpp\gguf-py")
from gguf.gguf_reader import GGUFReader

MODEL_PATH = r"<MODEL_PATH>"
reader = GGUFReader(MODEL_PATH, "r")

def get_kv(suffix):
    for k, v in reader.fields.items():
        if k.endswith(suffix):
            return v.parts[v.data[0]][0] if v.data else None
    return None

n_expert = get_kv(".expert_count") or 1
n_expert_used = get_kv(".expert_used_count") or 1
n_expert_shared = get_kv(".expert_shared_count") or 0

routed_bytes = 0
always_bytes = 0
per_type = {}
for t in reader.tensors:
    nb = t.n_bytes
    per_type.setdefault(str(t.tensor_type), [0, 0])
    per_type[str(t.tensor_type)][0] += 1
    per_type[str(t.tensor_type)][1] += nb
    if any(s in t.name for s in (".ffn_gate_exps", ".ffn_down_exps",
                                 ".ffn_up_exps", ".ffn_gate_up_exps")):
        routed_bytes += nb
    else:
        always_bytes += nb

active_routed = routed_bytes * (n_expert_used / n_expert)
active_bytes_per_token = always_bytes + active_routed

print(f"n_expert={n_expert} n_expert_used={n_expert_used} n_expert_shared={n_expert_shared} "
      f"({'NO shared experts' if n_expert_shared == 0 else 'HAS shared experts'})")
print(f"always-active bytes = {always_bytes/1e9:.3f} GB")
print(f"routed total bytes  = {routed_bytes/1e9:.3f} GB")
print(f"routed active bytes = {active_routed/1e9:.3f} GB")
print(f"ACTIVE BYTES/TOKEN UPPER ESTIMATE = {active_bytes_per_token/1e9:.3f} GB")
for ty, (cnt, nb) in sorted(per_type.items(), key=lambda x: -x[1][1]):
    print(f"  {ty:10s} n={cnt:4d} {nb/1e9:8.3f} GB")
```

## Шаг 5 — mlock/VirtualLock проверка (не large pages)

```powershell
whoami /priv | Select-String "SeLockMemoryPrivilege"

.\build\bin\llama-cli.exe -m "<MODEL_PATH>" --mlock -n 1 -p "hi" --no-display-prompt 2>&1 | `
  Select-String "mlock|failed to mlock|failed to VirtualLock"
```
Источник предупреждений: `src/llama-mmap.cpp:576` (`failed to mlock`), `:599`
(`failed to VirtualLock`). Успешный `VirtualLock` закрепляет обычные страницы;
Windows mmap path не создаёт large pages (`use_thp` игнорируется).

## Итоговая таблица результатов (шаблон)

| # | Измерение | Источник | Результат | Проверяет |
|---|---|---|---|---|
| 1 | Baseline decode t/s | `llama-cli` eval time | `<X.XX t/s>` | текущая 1.5–2 t/s |
| 2 | Disk read MB/s | `Get-Counter` loop | `<Y MB/s>` | "диск-bound" |
| 2b | GB/token (disk) | Y/1024/X | `<Z GB>` | совпадает с 4c? |
| 3a/3b | RAM BW EXPO on/off | MLC `--bandwidth_matrix` | `<W1>/<W2> GB/s` | потолок RAM |
| 4a | n_expert/used/shared | llama-cli log | `<N/K/S>` | "нет shared экспертов" если S=0 |
| 4c | Logical bytes/token estimate | скрипт выше | `<A GB>` | recipe upper estimate; уточнить trace |
| 5a/5b | mlock privilege / success | `whoami /priv`, log | `<Enabled/Disabled>`, `<Yes/No>` | mmap-стратегия валидна |

Интерпретация: `Z≪A` показывает, что значительная доля logical bytes обслужена
не физическим чтением. Disk-bound нельзя объявлять только по `Z≈A`: нужны также
`Z×t/s`, disk active time/queue/read latency и hard-fault correlation относительно
измеренной для workload SSD-полосы. Даже небольшой miss volume может быть
latency-bound.

---

## Ревизия по итогам smoke-теста харнесса (2026-07-18)

Прогнали `step0/step0-bench.ps1` на маленькой модели (Qwen3-4B Q4_K_M, dense)
**только для проверки механики** — не для чисел. Скрипт отработал end-to-end:
запуск llama-cli, парсинг `llama_print_timings`, дисковый счётчик, запись CSV.
Строка CSV получилась, но вскрыла дефекты в самих метриках.

### Что вскрылось

1. **`Win32_Process.ReadTransferCount` не видит mmap.** `IO_COUNTERS` считает
   только явный `ReadFile`/`ReadFileEx`. llama.cpp грузит веса через mmap, а
   страничные фолты mmap обслуживает менеджер памяти. Process `PageFaultCount`
   смешивает soft+hard faults; hard-fault attribution требует ETW, а system-wide
   `Memory\Page Reads/sec` не привязан к PID. Этот трафик НЕ попадает в счётчики чтения
   процесса. В смоук-прогоне: `logical=5.7 МБ` (токенизатор/метаданные) против
   `phys=2613 МБ` реального mmap-трафика с диска. Итог `cache_hit = 1 −
   phys/logical = −458` — мусор. **Колонки `logical_read_MB` / `cache_hit_ratio`
   через ReadTransferCount принципиально нерабочие → под снос.** Переходить на
   `--no-mmap` ради спасения ReadTransferCount НЕЛЬЗЯ: он аллоцирует всю модель
   в RAM и несовместим с режимом model>RAM, который мы и изучаем.

2. **Load и generation слиты.** При `NGen=32` физические 2.6 ГБ — почти целиком
   одноразовая загрузка модели, а не подкачка экспертов на токен. `phys_bytes_per_tok`
   = load, размазанный на токены → бессмысленно. Нужен steady-state замер.

3. **Баг квотирования `extra_args`.** При пустых аргументах поле пишется как
   `",,"` (кавычка-запятая-запятая-кавычка) вместо `""`; при непустых аргументах
   это сдвинет все колонки при парсинге. Чиним при переписывании строки CSV.

4. **Ограничение (доминирует над всем):** установившийся дисковый трафик
   существует только при **model > RAM**. На модели ≤ RAM warm-генерация читает
   с диска ≈0, cold — лишь одноразовый load-транзиент. Режим «эксперты
   вытесняются и репейджатся каждый токен» — это масштаб MiniMax-M2 (>96 ГБ на
   нашем кванте). Замер валиден **только на целевой машине Ryzen9 / 96 ГБ + MiniMax-M2**;
   текущая smoke-машина — исключительно для проверки механики харнесса.

### Принятые решения (обсудили и взвесили)

- **A. Источник физического чтения → A2 estimator:** `PhysicalDisk(<инстанс SSD с моделью>)`
  вместо `_Total`. Дёшево, отсекает трафик других дисков; ловит mmap-фолты
  (device-level). Резерв — **A3 (ETW per-process disk I/O)**, если на целевой
  машине шум процессов на том же диске реально помешает. ETW должен
  коррелировать DiskIO + FileIO/GGUF path + memory hard faults/page-fault stacks:
  mmap paging I/O может быть приписан System/memory manager, а не PID llama.

- **B. Отделение load от steady-state → B2 estimator (наклон за один прогон):** логируем
  дисковый счётчик с таймстампами каждый ~1 с. Текущий скрипт **не получает
  живые phase markers**: он реконструирует `genStart = processEnd - tokens/tps`
  и предполагает равномерную скорость токенов. Поэтому teardown и variable
  token latency сдвигают окно. Следующая B3-инструментовка должна писать
  monotonic events: model-load/prompt/decode start/end и token index timestamps;
  после этого берём
  наклон (байт/с) на плато gen-фазы и делим на gen tok/s. Один cold-прогон
  (важно: для >RAM модели каждый cold — чтение ~100 ГБ, два прогона расточительны).
  Сырые посэмпловые данные сохраняем в отдельный лог — тогда при желании
  subtraction (B1: NGen 64 vs 320) считается пост-фактум.

- **C. logical / cache_hit → фазировать:**
  - *Фаза 1 (сейчас):* только физический steady-state `bytes/token` — это уже
    главная цель оптимизаций, работает и портируемо.
  - *Фаза 2 (позже):* `logical_touched = mmap-backed weight pages`, включая
    routed/shared/dense weights, но **не KV** (KV не GGUF-backed model traffic)
    из инструментовки `LLAMA_MOE_STATS`; `cache_hit = 1 − phys/logical`. Это
    полезное отношение, но не точный cache-hit ratio без path attribution:
    device reads включают page granularity/read-ahead/noise. Baseline trace также
    не переносится после top-k/SER/pruning — нужен trace каждого режима. Перед реализацией
    надо проверить, что именно печатает текущая `LLAMA_MOE_STATS` (есть ли
    суммарные touched-байты экспертов на токен/прогон).

### Новый набор колонок CSV (Фаза 1)

```
timestamp,label,model,n_gen,threads,ctx,prompt_tps,gen_tps,eval_runs,wall_s,
disk_instance,phys_total_MB,phys_pregen_MB,phys_gen_steady_MB,
phys_gen_bytes_per_tok,peak_ws_MB,extra_args,...,cache_policy,manifest_path
```

- `phys_total_MB` — всё device reading за процессное окно.
- `eval_runs` — reported `n_eval`, not sampled-token count. A normal completed
  `-n N` generation reports `N-1` eval runs because the first generated token
  is not included in `n_eval`.
- `phys_pregen_MB` — estimator накопленного чтения до реконструированного gen start.
- `phys_gen_steady_MB` — чтение после отброса transient части gen-окна.
- `phys_gen_bytes_per_tok` — ключевой текущий estimator; сохранять рядом метод,
  disk instance, sample interval, transient fraction и repeat statistics.
- Плюс отдельный per-sample лог `<label>_<run>_<ts>.csv` (таймстамп + кумулятивные
  байты) для расчёта наклона и пост-фактум subtraction.
- `extra_args` квотируется корректно (баг `",,"` устранён).
- CSV теперь хранит primary transient fraction, status/exit code, phase method,
  first/final counter sample timestamps и manifest path. Sensitivity 20/30/40%
  считается по одному raw series; repeat summary хранит median/min/max.

### Hardening before target-machine baseline (2026-07-21)

- CSV/sidecar serialization uses invariant culture, so a `ru-RU` Windows locale
  cannot turn decimal points into CSV separators.
- The harness validates the chosen `PhysicalDisk` counter before launching,
  requires an explicit instance when automatic mapping is ambiguous (except for
  an opt-in smoke-only `_Total` fallback), and forces CPU-only `-ngl 0`.
- Every run writes a raw log and JSON manifest: git head, executable identity,
  model size/timestamp (full model hash remains opt-in because reading 110 GB
  perturbs the cache), prompt hash, command, host identity, counters and
  cold-cache result.
- Failed/short/unparsed runs remain recorded with evidence but make the script
  fail; they are excluded from the repeat summary.
- Windows PowerShell 5.1 launch compatibility is retained through explicit
  Windows command-line quoting rather than `ProcessStartInfo.ArgumentList`.

### Статус харнесса

- ✅ A2/B2/C-фаза1 реализованы; authoritative baseline остаётся estimator с
  перечисленными ограничениями.
- ✅ B3-инструментовка реализована как отдельные диагностические lanes:
  `--token-timing` даёт синхронизированные CLI-ready интервалы и eval/sample
  deltas без eval callback; Step0 пишет latency/queue/IOPS, memory/CPU series;
  `step0-etw.ps1` сохраняет WPR GeneralProfile для PID/GGUF attribution.
- ⏳ B3 ещё требует живой проверки overhead и attribution на Ryzen/MiniMax.
  Authoritative lane сохраняет `phase_method=reconstructed_estimate...`, а
  token-timing lane маркируется
  `device_counter_interpolation_at_token_ready_boundaries_v1` и не
  входит в authoritative summary до interleaved OFF/ON gate.
- ⛔ Реальный baseline — ждёт целевой машины (Ryzen9/96 ГБ) + MiniMax-M2 (>RAM).
