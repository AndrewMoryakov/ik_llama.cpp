<#
.SYNOPSIS
    Targeted Phase 3 validation runner for generalized runtime knobs.

.DESCRIPTION
    Runs narrow A/B matrices for:
      - gpt-oss-20b hot-expert sanity
      - gpt-oss-20b prompt-packed sanity
      - gpt-oss-120b prompt-packed heavy sanity
      - Qwen3-30B-A3B prompt-packed validation

    The script writes raw logs, JSONL, CSV and a markdown summary.
#>

param(
    [string]$LlamaBench = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\build\bin\llama-bench.exe",
    [string]$OutDir = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\bench_results",
    [int]$Threads = 16,
    [int]$FlashAttn = 1,
    [int]$MergeUpGate = 0,
    [int]$Ngl = 0,
    [int]$Warmup = 1,
    [int]$TimeoutMinutes = 240
)

$ErrorActionPreference = 'Stop'

function Parse-Scenario {
    param([string]$Scenario)
    if ($Scenario -match '^tg:(\d+)$') {
        return @{ kind = 'tg'; label = "tg$($Matches[1])"; args = @('-p','0','-n',$Matches[1]) }
    }
    if ($Scenario -match '^pp:(\d+)$') {
        return @{ kind = 'pp'; label = "pp$($Matches[1])"; args = @('-p',$Matches[1],'-n','0') }
    }
    if ($Scenario -match '^pg:(\d+):(\d+)$') {
        return @{ kind = 'pg'; label = "pg$($Matches[1]),$($Matches[2])"; args = @('-pg',"$($Matches[1]),$($Matches[2])") }
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
        'IK_LLAMA_HOT_EXPERT_BUDGET_MULT',
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

$runName = (Get-Date -Format 'yyyy-MM-dd_HHmmss') + '_phase3_validation'
$runDir = Join-Path $OutDir $runName
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$resultsJsonl = Join-Path $runDir 'results.jsonl'
$resultsCsv = Join-Path $runDir 'results.csv'
$summaryMd = Join-Path $runDir 'summary.md'
$rows = @()
$timeoutSec = $TimeoutMinutes * 60

$cases = @(
    @{
        label = 'gptoss20b_hot_experts'
        model = 'Z:\files\gguf\lmstudio-community\gpt-oss-20b-GGUF\gpt-oss-20b-MXFP4.gguf'
        rtr = 'auto'
        reps = 2
        scenarios = @('pg:128:32')
        configs = @(
            @{ key='baseline'; label='baseline'; env=@{} },
            @{ key='full'; label='full_prompt'; env=@{ IK_LLAMA_HOT_EXPERT_SELECTION='full-prompt' } },
            @{ key='tail16'; label='tail_window_16'; env=@{ IK_LLAMA_HOT_EXPERT_SELECTION='tail-window'; IK_LLAMA_HOT_EXPERT_TAIL_WINDOW='16' } }
        )
    },
    @{
        label = 'gptoss20b_prompt_packed'
        model = 'Z:\files\gguf\lmstudio-community\gpt-oss-20b-GGUF\gpt-oss-20b-MXFP4.gguf'
        rtr = 'auto'
        reps = 3
        scenarios = @('pp:512','pg:512:128')
        configs = @(
            @{ key='baseline'; label='baseline'; env=@{} },
            @{ key='backhalf'; label='prompt_packed_back_half'; env=@{ IK_LLAMA_PROMPT_PACKED_QKV='1'; IK_LLAMA_PROMPT_PACKED_QKV_PRESET='back-half' } }
        )
    },
    @{
        label = 'gptoss120b_prompt_packed'
        model = 'Z:\files\gguf\lmstudio-community\gpt-oss-120b-GGUF\gpt-oss-120b-MXFP4-00001-of-00002.gguf'
        rtr = 'auto'
        reps = 1
        scenarios = @('pp:512','pg:512:128')
        configs = @(
            @{ key='baseline'; label='baseline'; env=@{} },
            @{ key='backhalf'; label='prompt_packed_back_half'; env=@{ IK_LLAMA_PROMPT_PACKED_QKV='1'; IK_LLAMA_PROMPT_PACKED_QKV_PRESET='back-half' } }
        )
    },
    @{
        label = 'qwen30ba3b_prompt_packed'
        model = 'Z:\files\gguf\lmstudio-community\Qwen3-30B-A3B-GGUF\Qwen3-30B-A3B-Q4_K_M.gguf'
        rtr = 'auto'
        reps = 3
        scenarios = @('pp:512','pg:512:128')
        configs = @(
            @{ key='baseline'; label='baseline'; env=@{} },
            @{ key='fronthalf'; label='prompt_packed_front_half'; env=@{ IK_LLAMA_PROMPT_PACKED_QKV='1'; IK_LLAMA_PROMPT_PACKED_QKV_PRESET='front-half' } }
        )
    }
)

$meta = [pscustomobject]@{
    phase = 'phase3'
    purpose = 'targeted validation without minimax'
    started = (Get-Date).ToString('s')
    threads = $Threads
    flash_attn = $FlashAttn
    muge = $MergeUpGate
    cases = $cases | ForEach-Object { [pscustomobject]@{ label=$_.label; model=$_.model; rtr=$_.rtr; reps=$_.reps; scenarios=$_.scenarios; configs=($_.configs.label) } }
}
$meta | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $runDir 'run_meta.json')

foreach ($case in $cases) {
    if (-not (Test-Path $case.model)) { throw "model not found: $($case.model)" }
    foreach ($scenario in $case.scenarios) {
        $sc = Parse-Scenario $scenario
        foreach ($cfg in $case.configs) {
            $benchArgs = @(
                '-m', $case.model,
                '-t', [string]$Threads,
                '-fa', [string]$FlashAttn,
                '-ngl', [string]$Ngl,
                '-rtr', [string]$case.rtr,
                '-muge', [string]$MergeUpGate,
                '-r', [string]$case.reps,
                '-w', [string]$Warmup,
                '-o', 'json'
            ) + $sc.args

            $tag = '{0}_{1}_{2}' -f $case.label, $sc.label.Replace(',', '_'), $cfg.key
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
                        case = $case.label
                        config = $cfg.label
                        scenario = $sc.label
                        scenario_kind = $sc.kind
                        bench_test = [string]$item.test
                        bench_n_prompt = [int]$item.n_prompt
                        bench_n_gen = [int]$item.n_gen
                        rtr = [string]$case.rtr
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
                    case = $case.label
                    config = $cfg.label
                    scenario = $sc.label
                    scenario_kind = $sc.kind
                    bench_test = ''
                    bench_n_prompt = 0
                    bench_n_gen = 0
                    rtr = [string]$case.rtr
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
$summary += '# Phase 3 Validation (no MiniMax)'
$summary += ''
$summary += '| case | config | scenario | bench_test | rtr | avg_ts | elapsed_s | ok | log |'
$summary += '|---|---|---|---|---|---:|---:|---|---|'
foreach ($row in ($rows | Sort-Object case, scenario, config, bench_test)) {
    $avg = if ([double]::IsNaN([double]$row.avg_ts)) { 'n/a' } else { ('{0:N6}' -f [double]$row.avg_ts) }
    $benchTest = if ([string]::IsNullOrWhiteSpace($row.bench_test)) { 'n/a' } else { $row.bench_test }
    $summary += "| $($row.case) | $($row.config) | $($row.scenario) | $benchTest | $($row.rtr) | $avg | $($row.elapsed_s) | $($row.ok) | ``$($row.log)`` |"
}
Set-Content -Path $summaryMd -Value ($summary -join "`r`n")

Write-Host "Done: $runDir" -ForegroundColor Green
