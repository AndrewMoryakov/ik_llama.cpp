# ШАГ 0 — измерительный плейбук (Windows/PowerShell)

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

**4c — реальные active bytes/token (НЕ file size, НЕ плоский bpw).** MoE читает только `n_expert_used` из `n_expert` роутинг-экспертов за токен:

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
    if any(s in t.name for s in (".ffn_gate_exps", ".ffn_down_exps", ".ffn_up_exps")):
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
print(f"ACTIVE BYTES/TOKEN  = {active_bytes_per_token/1e9:.3f} GB")
for ty, (cnt, nb) in sorted(per_type.items(), key=lambda x: -x[1][1]):
    print(f"  {ty:10s} n={cnt:4d} {nb/1e9:8.3f} GB")
```

## Шаг 5 — Large-pages / mlock проверка

```powershell
whoami /priv | Select-String "SeLockMemoryPrivilege"

.\build\bin\llama-cli.exe -m "<MODEL_PATH>" --mlock -n 1 -p "hi" --no-display-prompt 2>&1 | `
  Select-String "mlock|failed to mlock|failed to VirtualLock"
```
Источник предупреждений: `src/llama-mmap.cpp:576` (`failed to mlock`), `:599` (`failed to VirtualLock`, через `VirtualLock` `:595`). Нет предупреждений = mlock прошёл полностью.

## Итоговая таблица результатов (шаблон)

| # | Измерение | Источник | Результат | Проверяет |
|---|---|---|---|---|
| 1 | Baseline decode t/s | `llama-cli` eval time | `<X.XX t/s>` | текущая 1.5–2 t/s |
| 2 | Disk read MB/s | `Get-Counter` loop | `<Y MB/s>` | "диск-bound" |
| 2b | GB/token (disk) | Y/1024/X | `<Z GB>` | совпадает с 4c? |
| 3a/3b | RAM BW EXPO on/off | MLC `--bandwidth_matrix` | `<W1>/<W2> GB/s` | потолок RAM |
| 4a | n_expert/used/shared | llama-cli log | `<N/K/S>` | "нет shared экспертов" если S=0 |
| 4c | Active bytes/token | скрипт выше | `<A GB>` | реальный рецепт, не 4bpw |
| 5a/5b | mlock privilege / success | `whoami /priv`, log | `<Enabled/Disabled>`, `<Yes/No>` | mmap-стратегия валидна |

Интерпретация: Z≈A (±20-30%) → диск-bound, стратегия A/B валидна. Z≪A → часть весов уже в page cache; сравнить A/X с W1 — если близко, RAM-bandwidth-bound, pivot на bytes/token.
