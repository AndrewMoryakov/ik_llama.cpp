<#
.SYNOPSIS
    Targeted MiniMax benchmark runner for hot-expert budget and rtr policy.

.DESCRIPTION
    Runs a narrow matrix for MiniMax M2.5 with:
      - rtr modes: off / auto (or custom)
      - hot expert budgets: default and explicit overrides
      - scenarios: tg / pg

    Produces:
      - per-run .log files
      - results.jsonl
      - results.csv
      - summary.md

.EXAMPLE
    .\scripts\bench-minimax-hot-budget.ps1

.EXAMPLE
    .\scripts\bench-minimax-hot-budget.ps1 -Budgets default,16,24,32 -RtrModes off,auto -Scenarios tg:128,pg:512:128
#>

param(
    [string]$LlamaBench = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\build\bin\llama-bench.exe",
    [string]$Model = "D:\ggufs\un\minimax2.5-m2\MiniMax-M2.5-UD-Q5_K_XL-00001-of-00005.gguf",
    [string]$OutDir = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\bench_results",
    [string[]]$Budgets = @("default", "16", "24", "32"),
    [string[]]$RtrModes = @("off", "auto"),
    [string[]]$Scenarios = @("tg:128", "pg:512:128"),
    [int]$Threads = 16,
    [int]$FlashAttn = 1,
    [int]$MergeUpGate = 0,
    [int]$Ngl = 0,
    [int]$Reps = 1,
    [int]$Warmup = 1,
    [int]$TimeoutMinutes = 180
)

$ErrorActionPreference = "Stop"

function Convert-RtrModeToArg {
    param([string]$Mode)
    switch ($Mode.ToLowerInvariant()) {
        "off" { return "off" }
        "on"  { return "on" }
        "auto" { return "auto" }
        default { throw "Unsupported rtr mode: $Mode" }
    }
}

function Parse-Scenario {
    param([string]$Scenario)
    if ($Scenario -match '^tg:(\d+)$') {
        return @{ kind = 'tg'; args = @('-p','0','-n',$Matches[1]); label = "tg$($Matches[1])" }
    }
    if ($Scenario -match '^pg:(\d+):(\d+)$') {
        return @{ kind = 'pg'; args = @('-pg',"$($Matches[1]),$($Matches[2])"); label = "pg$($Matches[1]),$($Matches[2])" }
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
        [hashtable]$EnvOverrides,
        [int]$TimeoutSec
    )

    $job = Start-Job -ScriptBlock {
        param($exe, $argArray, $envTable)
        foreach ($kv in $envTable.GetEnumerator()) {
            if ($null -eq $kv.Value -or $kv.Value -eq '') {
                Remove-Item "Env:$($kv.Key)" -ErrorAction SilentlyContinue
            } else {
                Set-Item "Env:$($kv.Key)" ([string]$kv.Value)
            }
        }

        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $exe
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        foreach ($arg in $argArray) { [void]$psi.ArgumentList.Add([string]$arg) }

        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $psi
        [void]$proc.Start()

        $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
        $stderrTask = $proc.StandardError.ReadToEndAsync()
        $proc.WaitForExit()
        [System.Threading.Tasks.Task]::WaitAll($stdoutTask, $stderrTask)

        @{
            ExitCode = $proc.ExitCode
            Stdout = $stdoutTask.Result
            Stderr = $stderrTask.Result
        }
    } -ArgumentList $BenchExe, $BenchArgs, $EnvOverrides

    $null = Wait-Job $job -Timeout $TimeoutSec
    if ($job.State -eq 'Running') {
        Stop-Job $job | Out-Null
        Remove-Job $job -Force | Out-Null
        return @{ Ok = $false; ExitCode = -1; Stdout = ''; Stderr = 'timeout'; Reason = 'timeout' }
    }

    $res = Receive-Job $job
    Remove-Job $job -Force | Out-Null
    return @{ Ok = $true; ExitCode = [int]$res.ExitCode; Stdout = [string]$res.Stdout; Stderr = [string]$res.Stderr; Reason = '' }
}

if (-not (Test-Path $LlamaBench)) { throw "llama-bench not found: $LlamaBench" }
if (-not (Test-Path $Model)) { throw "model not found: $Model" }

$runName = (Get-Date -Format 'yyyy-MM-dd_HHmmss') + '_minimax_hot_budget_long'
$runDir = Join-Path $OutDir $runName
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$resultsJsonl = Join-Path $runDir 'results.jsonl'
$resultsCsv = Join-Path $runDir 'results.csv'
$summaryMd = Join-Path $runDir 'summary.md'

$rows = @()
$timeoutSec = $TimeoutMinutes * 60

foreach ($scenario in $Scenarios) {
    $sc = Parse-Scenario $scenario
    foreach ($rtr in $RtrModes) {
        foreach ($budget in $Budgets) {
            $envOverrides = @{}
            $budgetLabel = $budget
            if ($budget -eq 'default') {
                $envOverrides['IK_LLAMA_HOT_EXPERT_BUDGET'] = $null
            } else {
                $envOverrides['IK_LLAMA_HOT_EXPERT_BUDGET'] = [string]$budget
            }

            $benchArgs = @(
                '-m', $Model,
                '-t', [string]$Threads,
                '-fa', [string]$FlashAttn,
                '-ngl', [string]$Ngl,
                '-rtr', (Convert-RtrModeToArg $rtr),
                '-muge', [string]$MergeUpGate,
                '-r', [string]$Reps,
                '-w', [string]$Warmup,
                '-o', 'json'
            ) + $sc.args

            $tag = "{0}_{1}_budget_{2}" -f $sc.label.Replace(',','_'), $rtr, $budgetLabel
            $logPath = Join-Path $runDir ($tag + '.log')

            Write-Host "Running $tag ..." -ForegroundColor Cyan
            $started = Get-Date
            $res = Invoke-BenchRun -BenchExe $LlamaBench -BenchArgs $benchArgs -EnvOverrides $envOverrides -TimeoutSec $timeoutSec
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
                        scenario = $sc.label
                        scenario_kind = $sc.kind
                        bench_test = [string]$item.test
                        bench_n_prompt = [int]$item.n_prompt
                        bench_n_gen = [int]$item.n_gen
                        rtr = $rtr
                        budget = $budgetLabel
                        budget_env = if ($budget -eq 'default') { '' } else { [string]$budget }
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
                    scenario = $sc.label
                    scenario_kind = $sc.kind
                    bench_test = ''
                    bench_n_prompt = 0
                    bench_n_gen = 0
                    rtr = $rtr
                    budget = $budgetLabel
                    budget_env = if ($budget -eq 'default') { '' } else { [string]$budget }
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
}

$rows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $resultsCsv

$summary = @()
$summary += '# MiniMax Hot Budget Long Run'
$summary += ''
$summary += "Model: $Model"
$summary += ''
$summary += '## Results'
$summary += ''
foreach ($scenarioGroup in ($rows | Group-Object scenario)) {
    $summary += "### $($scenarioGroup.Name)"
    $summary += ''
    $summary += '| bench_test | rtr | budget | avg_ts | elapsed_s | ok | log |'
    $summary += '|---|---|---:|---:|---:|---|---|'
    foreach ($row in ($scenarioGroup.Group | Sort-Object bench_test, rtr, @{Expression={ if ($_.budget -eq 'default') { -1 } else { [int]$_.budget } }})) {
        $avg = if ([double]::IsNaN([double]$row.avg_ts)) { 'n/a' } else { ('{0:N6}' -f [double]$row.avg_ts) }
        $benchTest = if ([string]::IsNullOrWhiteSpace($row.bench_test)) { 'n/a' } else { $row.bench_test }
        $summary += "| $benchTest | $($row.rtr) | $($row.budget) | $avg | $($row.elapsed_s) | $($row.ok) | ``$($row.log)`` |"
    }
    $summary += ''
}

Set-Content -Path $summaryMd -Value ($summary -join "`r`n")
Write-Host "Done: $runDir" -ForegroundColor Green
