<#
.SYNOPSIS
    Confirm MiniMax tail-window locality experiment.

.DESCRIPTION
    Runs a narrow A/B matrix for MiniMax:
      - baseline (default hot-expert selection)
      - tail-window=16

    Intended as a confirm pass on more realistic workloads after the short
    `pg32,4` signal. Uses `llama-bench` with JSON output and writes raw logs,
    JSONL, CSV and a markdown summary.
#>

param(
    [string]$LlamaBench = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\build\bin\llama-bench.exe",
    [string]$Model = "D:\ggufs\un\minimax2.5-m2\MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005.gguf",
    [string]$OutDir = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\bench_results",
    [string[]]$Scenarios = @("tg:128", "pg:512:128"),
    [int]$Threads = 16,
    [int]$FlashAttn = 1,
    [int]$MergeUpGate = 0,
    [int]$Ngl = 0,
    [int]$Reps = 3,
    [int]$Warmup = 1,
    [int]$TimeoutMinutes = 180
)

$ErrorActionPreference = "Stop"

function Parse-Scenario {
    param([string]$Scenario)
    if ($Scenario -match '^tg:(\d+)$') {
        return @{
            kind = 'tg'
            label = "tg$($Matches[1])"
            args = @('-p', '0', '-n', $Matches[1])
        }
    }
    if ($Scenario -match '^pg:(\d+):(\d+)$') {
        return @{
            kind = 'pg'
            label = "pg$($Matches[1]),$($Matches[2])"
            args = @('-pg', "$($Matches[1]),$($Matches[2])")
        }
    }
    throw "Unsupported scenario: $Scenario"
}

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
        'IK_LLAMA_HOT_EXPERT_SELECTION',
        'IK_LLAMA_HOT_EXPERT_TAIL_WINDOW',
        'IK_LLAMA_HOT_EXPERT_BUDGET',
        'IK_LLAMA_HOT_EXPERT_BUDGET_MULT'
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

$runName = (Get-Date -Format 'yyyy-MM-dd_HHmmss') + '_minimax_locality_confirm'
$runDir = Join-Path $OutDir $runName
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$runMeta = [pscustomobject]@{
    branch = (& git -C (Split-Path -Parent $LlamaBench | Split-Path -Parent | Split-Path -Parent) branch --show-current 2>$null)
    model = $Model
    scenarios = $Scenarios
    threads = $Threads
    flash_attn = $FlashAttn
    rtr = 'auto'
    muge = $MergeUpGate
    reps = $Reps
    warmup = $Warmup
    started = (Get-Date).ToString('s')
}
$runMeta | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $runDir 'run_meta.json')

$resultsJsonl = Join-Path $runDir 'results.jsonl'
$resultsCsv = Join-Path $runDir 'results.csv'
$summaryMd = Join-Path $runDir 'summary.md'
$rows = @()
$timeoutSec = $TimeoutMinutes * 60

$configs = @(
    @{
        key = 'baseline'
        label = 'baseline_default'
        env = @{}
    },
    @{
        key = 'tail16'
        label = 'tail_window_16'
        env = @{
            IK_LLAMA_HOT_EXPERT_SELECTION = 'tail-window'
            IK_LLAMA_HOT_EXPERT_TAIL_WINDOW = '16'
        }
    }
)

foreach ($scenario in $Scenarios) {
    $sc = Parse-Scenario $scenario
    foreach ($cfg in $configs) {
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
        ) + $sc.args

        $tag = "{0}_{1}" -f $sc.label.Replace(',', '_'), $cfg.key
        $logPath = Join-Path $runDir ($tag + '.log')

        Write-Host "Running $tag ..." -ForegroundColor Cyan
        $started = Get-Date
        $res = Invoke-BenchRun -BenchExe $LlamaBench -BenchArgs $benchArgs -EnvMap $cfg.env -TimeoutSec $timeoutSec
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
                    config = $cfg.label
                    scenario = $sc.label
                    scenario_kind = $sc.kind
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
                config = $cfg.label
                scenario = $sc.label
                scenario_kind = $sc.kind
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
}

$rows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $resultsCsv

$summary = @()
$summary += '# MiniMax Locality Confirm'
$summary += ''
$summary += "Model: $Model"
$summary += ''
$summary += '| config | scenario | bench_test | avg_ts | elapsed_s | ok | log |'
$summary += '|---|---|---|---:|---:|---|---|'
foreach ($row in ($rows | Sort-Object scenario, config, bench_test)) {
    $avg = if ([double]::IsNaN([double]$row.avg_ts)) { 'n/a' } else { ('{0:N6}' -f [double]$row.avg_ts) }
    $benchTest = if ([string]::IsNullOrWhiteSpace($row.bench_test)) { 'n/a' } else { $row.bench_test }
    $summary += "| $($row.config) | $($row.scenario) | $benchTest | $avg | $($row.elapsed_s) | $($row.ok) | ``$($row.log)`` |"
}
Set-Content -Path $summaryMd -Value ($summary -join "`r`n")

Write-Host "Done: $runDir" -ForegroundColor Green
