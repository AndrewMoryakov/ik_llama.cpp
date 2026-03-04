<#
.SYNOPSIS
    Narrow confirm runner for gpt-oss-120b prompt-packed back-half.

.DESCRIPTION
    Runs four cases only:
      - pp512 baseline
      - pp512 prompt-packed back-half
      - pg512,128 baseline
      - pg512,128 prompt-packed back-half

    This is a confirm/productization gate, not a broad exploration matrix.
#>

param(
    [string]$LlamaBench = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\build\bin\llama-bench.exe",
    [string]$Model = "Z:\files\gguf\lmstudio-community\gpt-oss-120b-GGUF\gpt-oss-120b-MXFP4-00001-of-00002.gguf",
    [string]$OutDir = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\bench_results",
    [int]$Threads = 16,
    [int]$FlashAttn = 1,
    [int]$MergeUpGate = 0,
    [int]$Ngl = 0,
    [int]$Reps = 3,
    [int]$Warmup = 1,
    [int]$TimeoutMinutes = 300
)

$ErrorActionPreference = "Stop"

function Get-JsonFromBenchOutput {
    param([string]$Raw)
    if (-not $Raw -or $Raw.Trim().Length -eq 0) { return $null }
    $txt = $Raw
    $txt = $txt -replace '=+\s*Repacked\s+\d+\s+tensors', ''
    $txt = $txt -replace '=+\s*llama_init_from_model:[^\r\n]*', ''
    $txt = $txt -replace '=+\s*HAVE_FANCY_SIMD is defined', ''
    $start = $txt.IndexOf('[')
    $end = $txt.LastIndexOf(']')
    if ($start -lt 0 -or $end -lt $start) { return $null }
    return $txt.Substring($start, $end - $start + 1).Trim()
}

function Invoke-BenchRun {
    param(
        [string]$BenchExe,
        [string[]]$BenchArgs,
        [hashtable]$EnvMap,
        [int]$TimeoutSec
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $BenchExe
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.Arguments = (($BenchArgs | ForEach-Object {
        $arg = [string]$_
        if ($arg -match '\s') { '"' + $arg.Replace('"', '\"') + '"' } else { $arg }
    }) -join ' ')

    foreach ($key in @(
        'IK_LLAMA_PROMPT_PACKED_QKV',
        'IK_LLAMA_PROMPT_PACKED_QKV_PRESET',
        'IK_LLAMA_PROMPT_PACKED_QKV_RANGE'
    )) {
        [void]$psi.EnvironmentVariables.Remove($key)
    }
    if ($EnvMap) {
        foreach ($pair in $EnvMap.GetEnumerator()) {
            $psi.EnvironmentVariables[$pair.Key] = [string]$pair.Value
        }
    }

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()

    $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
    $stderrTask = $proc.StandardError.ReadToEndAsync()

    if (-not $proc.WaitForExit($TimeoutSec * 1000)) {
        try { $proc.Kill($true) } catch {}
        try { $proc.WaitForExit() } catch {}
        return @{ Ok = $false; ExitCode = -1; Stdout = ''; Stderr = 'timeout'; Reason = 'timeout' }
    }

    [System.Threading.Tasks.Task]::WaitAll($stdoutTask, $stderrTask)
    return @{
        Ok = $true
        ExitCode = [int]$proc.ExitCode
        Stdout = [string]$stdoutTask.Result
        Stderr = [string]$stderrTask.Result
        Reason = ''
    }
}

if (-not (Test-Path $LlamaBench)) { throw "llama-bench not found: $LlamaBench" }
if (-not (Test-Path $Model)) { throw "model not found: $Model" }

$runName = (Get-Date -Format 'yyyy-MM-dd_HHmmss') + '_gptoss120b_prompt_packed_confirm'
$runDir = Join-Path $OutDir $runName
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$resultsJsonl = Join-Path $runDir 'results.jsonl'
$resultsCsv = Join-Path $runDir 'results.csv'
$summaryMd = Join-Path $runDir 'summary.md'
$rows = @()
$timeoutSec = $TimeoutMinutes * 60

$cases = @(
    @{
        key = 'pp512_baseline'
        label = 'pp512 baseline'
        args = @('-p','512','-n','0')
        env = @{}
    },
    @{
        key = 'pp512_backhalf'
        label = 'pp512 prompt_packed_back_half'
        args = @('-p','512','-n','0')
        env = @{
            IK_LLAMA_PROMPT_PACKED_QKV = '1'
            IK_LLAMA_PROMPT_PACKED_QKV_PRESET = 'back-half'
        }
    },
    @{
        key = 'pg512_128_baseline'
        label = 'pg512,128 baseline'
        args = @('-pg','512,128')
        env = @{}
    },
    @{
        key = 'pg512_128_backhalf'
        label = 'pg512,128 prompt_packed_back_half'
        args = @('-pg','512,128')
        env = @{
            IK_LLAMA_PROMPT_PACKED_QKV = '1'
            IK_LLAMA_PROMPT_PACKED_QKV_PRESET = 'back-half'
        }
    }
)

$meta = [pscustomobject]@{
    purpose = 'gpt-oss-120b prompt-packed confirm'
    model = $Model
    threads = $Threads
    flash_attn = $FlashAttn
    muge = $MergeUpGate
    rtr = 'auto'
    reps = $Reps
    warmup = $Warmup
    cases = $cases | ForEach-Object { $_.label }
    started = (Get-Date).ToString('s')
}
$meta | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $runDir 'run_meta.json')

foreach ($case in $cases) {
    $benchArgs = @(
        '-m', $Model,
        '-t', [string]$Threads,
        '-fa', [string]$FlashAttn,
        '-ngl', [string]$Ngl,
        '-rtr', 'auto',
        '-muge', [string]$MergeUpGate,
        '-r', [string]$Reps,
        '-w', [string]$Warmup,
        '-o', 'json'
    ) + $case.args

    $logPath = Join-Path $runDir ($case.key + '.log')
    Write-Host "Running $($case.key) ..." -ForegroundColor Cyan

    $started = Get-Date
    $res = Invoke-BenchRun -BenchExe $LlamaBench -BenchArgs $benchArgs -EnvMap $case.env -TimeoutSec $timeoutSec
    $finished = Get-Date

    $raw = ($res.Stdout + "`n" + $res.Stderr).Trim()
    Set-Content -Path $logPath -Value $raw

    $jsonText = Get-JsonFromBenchOutput $raw
    $jsonObj = $null
    if ($jsonText) {
        try { $jsonObj = $jsonText | ConvertFrom-Json } catch { $jsonObj = $null }
    }

    if ($jsonObj) {
        foreach ($item in $jsonObj) {
            $row = [pscustomobject]@{
                case = $case.key
                label = $case.label
                bench_test = [string]$item.test
                bench_n_prompt = [int]$item.n_prompt
                bench_n_gen = [int]$item.n_gen
                avg_ts = [double]$item.avg_ts
                avg_ns = [double]$item.avg_ns
                exit_code = $res.ExitCode
                ok = ($res.Ok -and $res.ExitCode -eq 0)
                started = $started.ToString('s')
                finished = $finished.ToString('s')
                elapsed_s = [math]::Round(($finished - $started).TotalSeconds, 1)
                log = [System.IO.Path]::GetFileName($logPath)
            }
            $rows += $row
            ($row | ConvertTo-Json -Compress) | Add-Content $resultsJsonl
        }
    } else {
        $row = [pscustomobject]@{
            case = $case.key
            label = $case.label
            bench_test = ''
            bench_n_prompt = 0
            bench_n_gen = 0
            avg_ts = [double]::NaN
            avg_ns = [double]::NaN
            exit_code = $res.ExitCode
            ok = ($res.Ok -and $res.ExitCode -eq 0)
            started = $started.ToString('s')
            finished = $finished.ToString('s')
            elapsed_s = [math]::Round(($finished - $started).TotalSeconds, 1)
            log = [System.IO.Path]::GetFileName($logPath)
        }
        $rows += $row
        ($row | ConvertTo-Json -Compress) | Add-Content $resultsJsonl
    }
}

$rows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $resultsCsv

$summary = @()
$summary += '# gpt-oss-120b prompt-packed confirm'
$summary += ''
$summary += "Model: $Model"
$summary += ''
$summary += '| case | bench_test | avg_ts | elapsed_s | ok | log |'
$summary += '|---|---|---:|---:|---|---|'
foreach ($row in ($rows | Sort-Object case, bench_test)) {
    $avg = if ([double]::IsNaN([double]$row.avg_ts)) { 'n/a' } else { ('{0:N6}' -f [double]$row.avg_ts) }
    $benchTest = if ([string]::IsNullOrWhiteSpace($row.bench_test)) { 'n/a' } else { $row.bench_test }
    $summary += "| $($row.case) | $benchTest | $avg | $($row.elapsed_s) | $($row.ok) | ``$($row.log)`` |"
}
Set-Content -Path $summaryMd -Value ($summary -join "`r`n")

Write-Host "Done: $runDir" -ForegroundColor Green
