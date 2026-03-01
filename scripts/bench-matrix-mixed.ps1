<#
.SYNOPSIS
    Unified MoE benchmark matrix for Zen4: rtr off/on/auto + pp/tg/pg + load probe.

.DESCRIPTION
    Runs llama-bench with a reproducible matrix that covers:
      - benchmark classes: in-RAM and swap-bound models
      - rtr modes: off/on/auto
      - paths: pp / tg / pg
      - configurable threads, fa, muge

    Produces:
      - results.jsonl (incremental, crash-safe)
      - results.json
      - results.csv
      - summary.md
      - run_info.json

.EXAMPLE
    # Smoke run (single model, reduced matrix)
    .\scripts\bench-matrix-mixed.ps1 -ModelsInRam "Z:\files\gguf\lmstudio-community\Qwen3-30B-A3B-GGUF\Qwen3-30B-A3B-Q4_K_M.gguf" -Threads 16 -Muge 0 -FaValues 1 -Reps 1 -RunLoadProbe

.EXAMPLE
    # Full run
    .\scripts\bench-matrix-mixed.ps1 -Reps 3 -Threads 8,16,24,32 -RtrModes off,on,auto -RunLoadProbe
#>

param(
    [string]$LlamaBench = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\build\bin\llama-bench.exe",
    [string]$OutDir = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\bench_results",
    [string[]]$ModelsInRam = @(
        "Z:\files\gguf\lmstudio-community\Qwen3-30B-A3B-GGUF\Qwen3-30B-A3B-Q4_K_M.gguf",
        "Z:\files\gguf\lmstudio-community\gpt-oss-20b-GGUF\gpt-oss-20b-MXFP4.gguf"
    ),
    [string[]]$ModelsSwapBound = @(
        "Z:\files\gguf\MiniMax-M2.5-80k-i1-GGUF\MiniMax-M2.5-80k-i1-UD-Q5_K_XL-00001-of-00008.gguf"
    ),
    [int[]]$Threads = @(8, 16, 24, 32),
    [int[]]$Muge = @(0, 1),
    [int[]]$FaValues = @(1),
    [string[]]$RtrModes = @("off", "on", "auto"),
    [int]$Reps = 3,
    [int]$TimeoutMinutes = 45,
    [int[]]$PPPrompts = @(512),
    [int[]]$TGTokens = @(128),
    [string[]]$PGCases = @("512:128"),
    [int]$Ngl = 0,
    [switch]$RunLoadProbe,
    [int]$LoadProbeThreads = 16,
    [int]$LoadProbeFa = 1,
    [int]$LoadProbeMuge = 0,
    [string]$Resume = ""
)

$ErrorActionPreference = "Continue"

function Get-Median {
    param([double[]]$Values)
    if (-not $Values -or $Values.Count -eq 0) { return [double]::NaN }
    $sorted = $Values | Sort-Object
    $n = $sorted.Count
    if ($n % 2 -eq 1) { return [double]$sorted[[int]($n / 2)] }
    $a = [double]$sorted[($n / 2) - 1]
    $b = [double]$sorted[$n / 2]
    return ($a + $b) / 2.0
}

function Convert-RtrModeToArg {
    param([string]$Mode)
    $m = $Mode.Trim().ToLowerInvariant()
    if ($m -eq "off" -or $m -eq "0") { return "0" }
    if ($m -eq "on" -or $m -eq "1") { return "1" }
    if ($m -eq "auto" -or $m -eq "2") { return "auto" }
    throw "Unsupported rtr mode: $Mode"
}

function Parse-ScenarioToPN {
    param([string]$Scenario)
    if ($Scenario -match "^pp:(\d+)$") {
        return @{ p = [int]$Matches[1]; n = 0; label = "pp$($Matches[1])"; kind = "pp" }
    }
    if ($Scenario -match "^tg:(\d+)$") {
        return @{ p = 0; n = [int]$Matches[1]; label = "tg$($Matches[1])"; kind = "tg" }
    }
    if ($Scenario -match "^pg:(\d+):(\d+)$") {
        return @{ p = [int]$Matches[1]; n = [int]$Matches[2]; label = "pg$($Matches[1]),$($Matches[2])"; kind = "pg" }
    }
    throw "Unsupported scenario: $Scenario"
}

function Get-JsonFromBenchOutput {
    param([string]$Raw)
    if (-not $Raw -or $Raw.Trim().Length -eq 0) { return $null }
    $txt = $Raw
    # llama-bench may inject these markers both on standalone lines and inline with JSON.
    $txt = $txt -replace '=+\s*Repacked\s+\d+\s+tensors', ''
    $txt = $txt -replace '=+\s*llama_init_from_model:[^\r\n]*', ''
    $txt = $txt -replace '=+\s*HAVE_FANCY_SIMD is defined', ''

    $start = $txt.IndexOf('[')
    $end = $txt.LastIndexOf(']')
    if ($start -lt 0 -or $end -lt $start) { return $null }

    $json = $txt.Substring($start, $end - $start + 1).Trim()
    if (-not $json -or $json[0] -ne '[') { return $null }
    return $json
}

function Invoke-Bench {
    param(
        [string]$BenchExe,
        [string[]]$BenchArgs,
        [int]$TimeoutSec
    )
    $argsStr = ($BenchArgs | ForEach-Object { "`"$_`"" }) -join " "
    $job = Start-Job -ScriptBlock {
        param($exe, $argLine)
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $exe
        $psi.Arguments = $argLine
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true

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
    } -ArgumentList $BenchExe, $argsStr

    $wait = $job | Wait-Job -Timeout $TimeoutSec
    if ($job.State -eq "Running") {
        Stop-Job $job | Out-Null
        Remove-Job $job -Force | Out-Null
        return @{
            Ok = $false
            Reason = "timeout"
            ExitCode = -1
            Stdout = ""
            Stderr = ""
        }
    }

    $res = Receive-Job $job
    Remove-Job $job -Force | Out-Null
    return @{
        Ok = $true
        Reason = ""
        ExitCode = [int]$res.ExitCode
        Stdout = [string]$res.Stdout
        Stderr = [string]$res.Stderr
    }
}

if (-not (Test-Path $LlamaBench)) {
    Write-Host "ERROR: llama-bench not found: $LlamaBench" -ForegroundColor Red
    exit 1
}

$validInRam = @()
foreach ($m in $ModelsInRam) {
    if (Test-Path $m) { $validInRam += $m } else { Write-Warning "in-RAM model missing: $m" }
}
$validSwap = @()
foreach ($m in $ModelsSwapBound) {
    if (Test-Path $m) { $validSwap += $m } else { Write-Warning "swap-bound model missing: $m" }
}
if ($validInRam.Count -eq 0 -and $validSwap.Count -eq 0) {
    Write-Host "ERROR: no valid models found in either class." -ForegroundColor Red
    exit 1
}

$modelRows = @()
foreach ($m in $validInRam) {
    $modelRows += [pscustomobject]@{ path = $m; class = "in_ram" }
}
foreach ($m in $validSwap) {
    $modelRows += [pscustomobject]@{ path = $m; class = "swap_bound" }
}

$scenarioRows = @()
foreach ($pp in $PPPrompts) {
    $scenarioRows += "pp:$pp"
}
foreach ($tg in $TGTokens) {
    $scenarioRows += "tg:$tg"
}
foreach ($pg in $PGCases) {
    if ($pg -match "^(\d+):(\d+)$") {
        $scenarioRows += "pg:$($Matches[1]):$($Matches[2])"
    } else {
        Write-Warning "Skipping invalid PG case '$pg' (expected P:N)"
    }
}

if ($scenarioRows.Count -eq 0) {
    Write-Host "ERROR: scenario matrix is empty." -ForegroundColor Red
    exit 1
}

if ($Resume -ne "") {
    if ([System.IO.Path]::IsPathRooted($Resume)) {
        $runDir = $Resume
    } else {
        $runDir = Join-Path $OutDir $Resume
    }
    if (-not (Test-Path $runDir)) {
        Write-Host "ERROR: resume folder not found: $runDir" -ForegroundColor Red
        exit 1
    }
    $timestamp = Split-Path $runDir -Leaf
    Write-Host "Resuming run: $timestamp" -ForegroundColor Yellow
} else {
    $timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
    $runDir = Join-Path $OutDir $timestamp
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
}

$jsonlPath = Join-Path $runDir "results.jsonl"
$stderrLog = Join-Path $runDir "stderr.log"
$completed = @{}

if (Test-Path $jsonlPath) {
    Get-Content $jsonlPath -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0) { return }
        try {
            $obj = $line | ConvertFrom-Json
            $key = "$($obj.model_filename)|$($obj.bench_class)|$($obj.scenario)|$($obj.n_threads)|$($obj.muge)|$($obj.flash_attn)|$($obj.rtr_mode)"
            $completed[$key] = $true
        } catch {}
    }
}

$repoRoot = "unknown"
$commit = "unknown"
try {
    $repoRoot = Split-Path (Split-Path (Split-Path $LlamaBench -Parent) -Parent) -Parent
    $commit = (git -C $repoRoot rev-parse --short HEAD 2>$null)
    if (-not $commit) { $commit = "unknown" }
} catch {}

$cpuName = "unknown"
$ramGB = "unknown"
try { $cpuName = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim() } catch {}
try { $ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1) } catch {}

$runInfo = @{
    timestamp = (Get-Date -Format "o")
    commit = $commit
    cpu = $cpuName
    ram_gb = $ramGB
    os = [System.Environment]::OSVersion.VersionString
    llama_bench = $LlamaBench
    out_dir = $runDir
    models = $modelRows
    threads = $Threads
    muge = $Muge
    fa = $FaValues
    rtr_modes = $RtrModes
    reps = $Reps
    scenarios = $scenarioRows
    timeout_minutes = $TimeoutMinutes
    run_load_probe = [bool]$RunLoadProbe
}
$runInfo | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $runDir "run_info.json") -Encoding UTF8

Write-Host "=== Matrix+Mixed Benchmark ===" -ForegroundColor Cyan
Write-Host "Commit:  $commit"
Write-Host "CPU:     $cpuName"
Write-Host "RAM:     ${ramGB} GB"
Write-Host "Models:  $($modelRows.Count)"
Write-Host "Output:  $runDir"
Write-Host ""

$matrix = @()
foreach ($m in $modelRows) {
    foreach ($t in $Threads) {
        foreach ($mu in $Muge) {
            foreach ($fa in $FaValues) {
                foreach ($rtrMode in $RtrModes) {
                    foreach ($sc in $scenarioRows) {
                        $matrix += [pscustomobject]@{
                            model = $m.path
                            class = $m.class
                            threads = $t
                            muge = $mu
                            fa = $fa
                            rtr_mode = $rtrMode
                            scenario = $sc
                        }
                    }
                }
            }
        }
    }
}

$total = $matrix.Count
$okCount = 0
$failCount = 0
$skipCount = 0
$startGlobal = Get-Date
$timeoutSec = $TimeoutMinutes * 60

for ($i = 0; $i -lt $matrix.Count; $i++) {
    $row = $matrix[$i]
    $pn = Parse-ScenarioToPN $row.scenario
    $model = $row.model
    $modelName = [System.IO.Path]::GetFileNameWithoutExtension($model)
    $rtrArg = Convert-RtrModeToArg $row.rtr_mode
    $key = "$model|$($row.class)|$($row.scenario)|$($row.threads)|$($row.muge)|$($row.fa)|$($row.rtr_mode)"

    if ($completed.ContainsKey($key)) {
        $skipCount++
        Write-Host "[$($i+1)/$total] SKIP $modelName $($pn.label) t=$($row.threads) muge=$($row.muge) fa=$($row.fa) rtr=$($row.rtr_mode)" -ForegroundColor DarkGray
        continue
    }

    Write-Host "[$($i+1)/$total] RUN  $modelName $($pn.label) t=$($row.threads) muge=$($row.muge) fa=$($row.fa) rtr=$($row.rtr_mode)" -NoNewline
    $benchArgs = @(
        "-m", $model,
        "-t", $row.threads,
        "-p", $pn.p,
        "-n", $pn.n,
        "-fa", $row.fa,
        "-muge", $row.muge,
        "-rtr", $rtrArg,
        "-ngl", $Ngl,
        "-r", $Reps,
        "-w", 1,
        "-o", "json"
    )

    $start = Get-Date
    $res = Invoke-Bench -BenchExe $LlamaBench -BenchArgs $benchArgs -TimeoutSec $timeoutSec
    $elapsedSec = [math]::Round(((Get-Date) - $start).TotalSeconds, 3)

    if (-not $res.Ok) {
        Write-Host " -> $($res.Reason)" -ForegroundColor Red
        Add-Content $stderrLog "TIMEOUT $model $($pn.label) t=$($row.threads) muge=$($row.muge) fa=$($row.fa) rtr=$($row.rtr_mode)"
        $failCount++
        continue
    }

    if ($res.Stderr -and $res.Stderr.Trim().Length -gt 0) {
        Add-Content $stderrLog "--- $modelName $($pn.label) t=$($row.threads) muge=$($row.muge) fa=$($row.fa) rtr=$($row.rtr_mode) ---"
        Add-Content $stderrLog $res.Stderr
    }
    if ($res.ExitCode -ne 0) {
        Write-Host " -> exit=$($res.ExitCode)" -ForegroundColor Red
        $failCount++
        continue
    }

    $json = Get-JsonFromBenchOutput $res.Stdout
    if (-not $json) {
        Write-Host " -> no-json" -ForegroundColor Red
        $failCount++
        continue
    }

    try {
        $entries = $json | ConvertFrom-Json
        if (-not $entries) {
            Write-Host " -> parse-error" -ForegroundColor Red
            $failCount++
            continue
        }
        foreach ($e in $entries) {
            $e | Add-Member -NotePropertyName bench_class -NotePropertyValue $row.class -Force
            $e | Add-Member -NotePropertyName scenario -NotePropertyValue $row.scenario -Force
            $e | Add-Member -NotePropertyName scenario_kind -NotePropertyValue $pn.kind -Force
            $e | Add-Member -NotePropertyName rtr_mode -NotePropertyValue $row.rtr_mode -Force
            $e | Add-Member -NotePropertyName wall_seconds -NotePropertyValue $elapsedSec -Force
            $line = $e | ConvertTo-Json -Depth 7 -Compress
            Add-Content $jsonlPath $line -Encoding UTF8
        }
        $avgTs = ($entries | Measure-Object -Property avg_ts -Average).Average
        Write-Host (" -> {0} t/s ({1}s)" -f ([math]::Round($avgTs, 2)), $elapsedSec) -ForegroundColor Green
        $okCount++
        $completed[$key] = $true
    } catch {
        Write-Host " -> parse-exception" -ForegroundColor Red
        Add-Content $stderrLog "EXCEPTION $model $($pn.label) t=$($row.threads) muge=$($row.muge) fa=$($row.fa) rtr=$($row.rtr_mode): $_"
        $failCount++
    }
}

if ($RunLoadProbe) {
    Write-Host ""
    Write-Host "=== Load Probe ===" -ForegroundColor Cyan
    foreach ($m in $modelRows) {
        foreach ($rtrMode in $RtrModes) {
            $rtrArg = Convert-RtrModeToArg $rtrMode
            $probeScenario = "load:0:1"
            $probeKey = "$($m.path)|$($m.class)|$probeScenario|$LoadProbeThreads|$LoadProbeMuge|$LoadProbeFa|$rtrMode"
            if ($completed.ContainsKey($probeKey)) {
                Write-Host "SKIP load-probe $([System.IO.Path]::GetFileNameWithoutExtension($m.path)) rtr=$rtrMode" -ForegroundColor DarkGray
                continue
            }
            $modelName = [System.IO.Path]::GetFileNameWithoutExtension($m.path)
            Write-Host "RUN  load-probe $modelName rtr=$rtrMode" -NoNewline
            $probeArgs = @(
                "-m", $m.path,
                "-t", $LoadProbeThreads,
                "-p", 0,
                "-n", 1,
                "-fa", $LoadProbeFa,
                "-muge", $LoadProbeMuge,
                "-rtr", $rtrArg,
                "-ngl", $Ngl,
                "-r", 1,
                "-w", 0,
                "-o", "json"
            )
            $probeStart = Get-Date
            $probeRes = Invoke-Bench -BenchExe $LlamaBench -BenchArgs $probeArgs -TimeoutSec $timeoutSec
            $probeElapsed = [math]::Round(((Get-Date) - $probeStart).TotalSeconds, 3)
            if (-not $probeRes.Ok -or $probeRes.ExitCode -ne 0) {
                Write-Host " -> fail" -ForegroundColor Red
                $failCount++
                continue
            }
            $probeJson = Get-JsonFromBenchOutput $probeRes.Stdout
            if (-not $probeJson) {
                Write-Host " -> no-json" -ForegroundColor Red
                $failCount++
                continue
            }
            try {
                $probeEntries = $probeJson | ConvertFrom-Json
                foreach ($e in $probeEntries) {
                    $e | Add-Member -NotePropertyName bench_class -NotePropertyValue $m.class -Force
                    $e | Add-Member -NotePropertyName scenario -NotePropertyValue $probeScenario -Force
                    $e | Add-Member -NotePropertyName scenario_kind -NotePropertyValue "load_probe" -Force
                    $e | Add-Member -NotePropertyName rtr_mode -NotePropertyValue $rtrMode -Force
                    $e | Add-Member -NotePropertyName wall_seconds -NotePropertyValue $probeElapsed -Force
                    $line = $e | ConvertTo-Json -Depth 7 -Compress
                    Add-Content $jsonlPath $line -Encoding UTF8
                }
                Write-Host " -> ${probeElapsed}s" -ForegroundColor Green
                $okCount++
                $completed[$probeKey] = $true
            } catch {
                Write-Host " -> parse-exception" -ForegroundColor Red
                $failCount++
            }
        }
    }
}

$all = @()
if (Test-Path $jsonlPath) {
    Get-Content $jsonlPath -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0) { return }
        try {
            $all += ($line | ConvertFrom-Json)
        } catch {}
    }
}

$resultsJson = Join-Path $runDir "results.json"
if ($all.Count -eq 0) {
    "[]" | Set-Content $resultsJson -Encoding UTF8
} elseif ($all.Count -eq 1) {
    "[$($all[0] | ConvertTo-Json -Depth 7)]" | Set-Content $resultsJson -Encoding UTF8
} else {
    $all | ConvertTo-Json -Depth 7 | Set-Content $resultsJson -Encoding UTF8
}

$rows = @()
foreach ($e in $all) {
    $rows += [pscustomobject]@{
        model = $e.model_filename
        model_name = if ($e.model_filename) { [System.IO.Path]::GetFileNameWithoutExtension($e.model_filename) } else { "?" }
        bench_class = $e.bench_class
        scenario = $e.scenario
        scenario_kind = $e.scenario_kind
        test = $e.test
        rtr_mode = $e.rtr_mode
        n_threads = $e.n_threads
        muge = $e.muge
        flash_attn = $e.flash_attn
        avg_ts = $e.avg_ts
        stddev_ts = $e.stddev_ts
        wall_seconds = $e.wall_seconds
    }
}

$csvPath = Join-Path $runDir "results.csv"
$rows | Export-Csv -NoTypeInformation -Encoding UTF8 $csvPath

$summaryPath = Join-Path $runDir "summary.md"
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# Matrix + Mixed Benchmark Summary")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- Date: $timestamp")
[void]$sb.AppendLine("- Commit: $commit")
[void]$sb.AppendLine("- CPU: $cpuName")
[void]$sb.AppendLine("- RAM: ${ramGB} GB")
[void]$sb.AppendLine("- Rows: $($rows.Count)")
[void]$sb.AppendLine("- Success: $okCount, Failed: $failCount, Skipped: $skipCount")
[void]$sb.AppendLine("")

if ($rows.Count -eq 0) {
    [void]$sb.AppendLine("No benchmark rows captured.")
} else {
    [void]$sb.AppendLine("## Aggregate (Median avg_ts)")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| class | scenario | rtr | rows | median t/s | mean t/s |")
    [void]$sb.AppendLine("|---|---|---|---:|---:|---:|")

    $aggGroups = $rows | Where-Object { $_.scenario_kind -ne "load_probe" } | Group-Object bench_class,scenario,rtr_mode
    foreach ($g in $aggGroups | Sort-Object Name) {
        $parts = $g.Name -split ", "
        $class = $parts[0]
        $scenario = $parts[1]
        $rtr = $parts[2]
        $vals = @($g.Group | ForEach-Object { [double]$_.avg_ts })
        $median = Get-Median $vals
        $mean = ($vals | Measure-Object -Average).Average
        [void]$sb.AppendLine("| $class | $scenario | $rtr | $($vals.Count) | $([math]::Round($median, 3)) | $([math]::Round($mean, 3)) |")
    }
    [void]$sb.AppendLine("")

    [void]$sb.AppendLine("## Best rtr by class+scenario")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| class | scenario | best rtr | median t/s |")
    [void]$sb.AppendLine("|---|---|---|---:|")

    $byClassScenario = $rows | Where-Object { $_.scenario_kind -ne "load_probe" } | Group-Object bench_class,scenario
    foreach ($g in $byClassScenario | Sort-Object Name) {
        $bestMode = ""
        $bestMedian = -1.0
        $modes = $g.Group | Group-Object rtr_mode
        foreach ($mg in $modes) {
            $vals = @($mg.Group | ForEach-Object { [double]$_.avg_ts })
            $median = Get-Median $vals
            if ($median -gt $bestMedian) {
                $bestMedian = $median
                $bestMode = $mg.Name
            }
        }
        $parts = $g.Name -split ", "
        [void]$sb.AppendLine("| $($parts[0]) | $($parts[1]) | $bestMode | $([math]::Round($bestMedian, 3)) |")
    }
    [void]$sb.AppendLine("")

    if ($RunLoadProbe) {
        [void]$sb.AppendLine("## Load Probe (wall_seconds)")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("| class | model | rtr | runs | median sec |")
        [void]$sb.AppendLine("|---|---|---|---:|---:|")
        $loadRows = $rows | Where-Object { $_.scenario_kind -eq "load_probe" }
        $loadGroups = $loadRows | Group-Object bench_class,model_name,rtr_mode
        foreach ($lg in $loadGroups | Sort-Object Name) {
            $vals = @($lg.Group | ForEach-Object { [double]$_.wall_seconds })
            $median = Get-Median $vals
            $parts = $lg.Name -split ", "
            [void]$sb.AppendLine("| $($parts[0]) | $($parts[1]) | $($parts[2]) | $($vals.Count) | $([math]::Round($median, 3)) |")
        }
        [void]$sb.AppendLine("")
    }
}

$totalMin = [math]::Round(((Get-Date) - $startGlobal).TotalMinutes, 2)
[void]$sb.AppendLine("## Run Stats")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- Total elapsed: ${totalMin} min")
[void]$sb.AppendLine("- Timeout per test: $TimeoutMinutes min")
[void]$sb.AppendLine("")
$sb.ToString() | Set-Content $summaryPath -Encoding UTF8

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Elapsed: ${totalMin} min"
Write-Host "OK: $okCount  FAIL: $failCount  SKIP: $skipCount"
Write-Host "results.jsonl: $jsonlPath"
Write-Host "results.json : $resultsJson"
Write-Host "results.csv  : $csvPath"
Write-Host "summary.md   : $summaryPath"
