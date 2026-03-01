<#
.SYNOPSIS
    MoE benchmark matrix for ik_llama.cpp on Zen4 CPU.

.DESCRIPTION
    Runs llama-bench across a matrix of MoE models and parameters (threads, muge, rtr),
    collects JSON results, and generates a markdown summary.

    Results are saved incrementally (JSONL) after each test — safe against crashes.
    Supports resume: re-running the same timestamp skips already-completed tests.

.EXAMPLE
    # Full default run (4 models, all combos)
    .\scripts\bench-moe.ps1

    # Quick single-model test
    .\scripts\bench-moe.ps1 -Models "Z:\files\gguf\lmstudio-community\gpt-oss-20b-GGUF\gpt-oss-20b-MXFP4.gguf" -Threads 8 -Reps 1

    # Include large split models
    .\scripts\bench-moe.ps1 -IncludeLarge

    # Resume a previous interrupted run
    .\scripts\bench-moe.ps1 -Resume "2026-02-21_2300"
#>

param(
    [string]$LlamaBench  = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\build\bin\llama-bench.exe",
    [string]$ModelDir    = "Z:\files\gguf",
    [string[]]$Models    = @(),
    [string]$OutDir      = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\bench_results",
    [int[]]$Threads      = @(8, 16),
    [int[]]$Muge         = @(0, 1),
    [int[]]$Rtr          = @(0, 1),
    [int[]]$FlashAttnValues           = @(0, 1),
    [int]$Reps           = 3,
    [int]$PP             = 512,
    [int]$TG             = 128,
    [int]$TimeoutMinutes = 30,
    [string]$Resume      = "",
    [switch]$IncludeLarge,
    [switch]$TGOnly,
    [switch]$PPOnly
)

# Don't abort on non-terminating errors; we handle errors per-test.
$ErrorActionPreference = "Continue"

# --- Default models ---
$DefaultModels = @(
    "$ModelDir\lmstudio-community\gpt-oss-20b-GGUF\gpt-oss-20b-MXFP4.gguf",
    "$ModelDir\lmstudio-community\Qwen3-30B-A3B-GGUF\Qwen3-30B-A3B-Q4_K_M.gguf",
    "$ModelDir\lmstudio-community\Meta-Llama-3.1-8B-Instruct-GGUF\Meta-Llama-3.1-8B-Instruct-Q8_0.gguf"
)

$LargeModels = @(
    "$ModelDir\lmstudio-community\gpt-oss-120b-GGUF\gpt-oss-120b-MXFP4-00001-of-00002.gguf"
)

# Resolve model list
if ($Models.Count -eq 0) {
    $Models = $DefaultModels
    if ($IncludeLarge) {
        $Models += $LargeModels
    }
}

# Validate llama-bench exists
if (-not (Test-Path $LlamaBench)) {
    Write-Host "ERROR: llama-bench not found at: $LlamaBench" -ForegroundColor Red
    exit 1
}

# Validate models exist
$ValidModels = @()
foreach ($m in $Models) {
    if (Test-Path $m) {
        $ValidModels += $m
    } else {
        Write-Warning "Model not found, skipping: $m"
    }
}
if ($ValidModels.Count -eq 0) {
    Write-Host "ERROR: No valid models found." -ForegroundColor Red
    exit 1
}

# --- Create/resume output directory ---
if ($Resume -ne "") {
    # Accept both full path and timestamp-only
    if ([System.IO.Path]::IsPathRooted($Resume)) {
        $runDir = $Resume
    } else {
        $runDir = Join-Path $OutDir $Resume
    }
    if (-not (Test-Path $runDir)) {
        Write-Host "ERROR: Resume directory not found: $runDir" -ForegroundColor Red
        exit 1
    }
    $timestamp = Split-Path $runDir -Leaf
    Write-Host "Resuming run: $timestamp" -ForegroundColor Yellow
} else {
    $timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
    $runDir = Join-Path $OutDir $timestamp
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
}

# --- Incremental results file (JSONL: one JSON object per line) ---
$jsonlPath = Join-Path $runDir "results.jsonl"

# Load already-completed test keys for resume
$completedKeys = @{}
if (Test-Path $jsonlPath) {
    Get-Content $jsonlPath -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -gt 0) {
            try {
                $obj = $line | ConvertFrom-Json
                $key = "$($obj.model_filename)|$($obj.n_threads)|$($obj.muge)|$($obj.repack)|$($obj.flash_attn)|$($obj.test)"
                $completedKeys[$key] = $true
            } catch {}
        }
    }
    if ($completedKeys.Count -gt 0) {
        Write-Host "Found $($completedKeys.Count) completed tests from previous run." -ForegroundColor Yellow
    }
}

# --- Collect run metadata ---
$commitHash = "unknown"
$repoRoot = Split-Path $LlamaBench -Parent
try {
    # Walk up from bin/ to repo root
    $repoRoot = Split-Path (Split-Path (Split-Path $LlamaBench -Parent) -Parent) -Parent
    $commitHash = (git -C $repoRoot rev-parse --short HEAD 2>$null)
    if (-not $commitHash) { $commitHash = "unknown" }
} catch {}

$cpuName = "unknown"
try {
    $cpuName = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim()
} catch {}

$ramGB = "unknown"
try {
    $ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
} catch {}

$runInfo = @{
    timestamp   = (Get-Date -Format "o")
    commit      = $commitHash
    cpu         = $cpuName
    ram_gb      = $ramGB
    os          = [System.Environment]::OSVersion.VersionString
    llama_bench = $LlamaBench
    models      = $ValidModels
    threads     = $Threads
    muge        = $Muge
    rtr         = $Rtr
    fa          = $FlashAttnValues
    reps        = $Reps
    pp          = $PP
    tg          = $TG
    timeout_min = $TimeoutMinutes
}
$runInfo | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $runDir "run_info.json") -Encoding UTF8

Write-Host "=== MoE Benchmark ===" -ForegroundColor Cyan
Write-Host "Commit:  $commitHash"
Write-Host "CPU:     $cpuName"
Write-Host "RAM:     ${ramGB} GB"
Write-Host "Models:  $($ValidModels.Count)"
Write-Host "Timeout: $TimeoutMinutes min per test"
Write-Host "Output:  $runDir"
Write-Host ""

# --- Build test matrix ---
$testTypes = @()
if (-not $TGOnly) { $testTypes += "pp" }
if (-not $PPOnly) { $testTypes += "tg" }

# --- Run benchmarks ---
$totalCombos = $ValidModels.Count * $Threads.Count * $Muge.Count * $Rtr.Count * $FlashAttnValues.Count * $testTypes.Count
$current = 0
$skipped = 0
$failed = 0
$succeeded = 0
$globalStart = Get-Date

foreach ($model in $ValidModels) {
    $modelName = [System.IO.Path]::GetFileNameWithoutExtension($model)
    Write-Host "--- $modelName ---" -ForegroundColor Yellow

    foreach ($t in $Threads) {
        foreach ($mu in $Muge) {
            foreach ($rt in $Rtr) {
              foreach ($fa in $FlashAttnValues) {
                foreach ($testType in $testTypes) {
                    $current++
                    if ($testType -eq "pp") {
                        $pArg = $PP; $nArg = 0; $label = "pp$PP"
                    } else {
                        $pArg = 0; $nArg = $TG; $label = "tg$TG"
                    }

                    # Check if already completed (resume support)
                    $muBool = if ($mu -eq 1) { "True" } else { "False" }
                    $rtBool = if ($rt -eq 1) { "True" } else { "False" }
                    $faBool = if ($fa -eq 1) { "True" } else { "False" }
                    $resumeKey = "$model|$t|$muBool|$rtBool|$faBool|$label"
                    if ($completedKeys.ContainsKey($resumeKey)) {
                        $skipped++
                        Write-Host "  [$current/$totalCombos] t=$t muge=$mu rtr=$rt fa=$fa $label -> SKIP (done)" -ForegroundColor DarkGray
                        continue
                    }

                    $pct = [math]::Round(($current / $totalCombos) * 100)
                    Write-Host "  [$current/$totalCombos $pct%] t=$t muge=$mu rtr=$rt fa=$fa $label" -NoNewline

                    $benchArgs = @(
                        "-m", $model,
                        "-t", $t,
                        "-p", $pArg,
                        "-n", $nArg,
                        "-fa", $fa,
                        "-muge", $mu,
                        "-rtr", $rt,
                        "-ngl", 0,
                        "-r", $Reps,
                        "-w", 1,
                        "-o", "json"
                    )

                    $testStart = Get-Date
                    $stderrLog = Join-Path $runDir "stderr.log"

                    try {
                        # Run llama-bench as a background job with timeout.
                        # Using jobs because Start-Process redirect is unreliable on Windows,
                        # and async event capture loses data.
                        $benchArgsStr = ($benchArgs | ForEach-Object { "`"$_`"" }) -join " "
                        $job = Start-Job -ScriptBlock {
                            param($exe, $argsStr)
                            $psi = New-Object System.Diagnostics.ProcessStartInfo
                            $psi.FileName = $exe
                            $psi.Arguments = $argsStr
                            $psi.UseShellExecute = $false
                            $psi.RedirectStandardOutput = $true
                            $psi.RedirectStandardError = $true
                            $psi.CreateNoWindow = $true

                            $proc = New-Object System.Diagnostics.Process
                            $proc.StartInfo = $psi
                            [void]$proc.Start()

                            # Read stdout and stderr concurrently via tasks
                            $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
                            $stderrTask = $proc.StandardError.ReadToEndAsync()
                            $proc.WaitForExit()
                            [System.Threading.Tasks.Task]::WaitAll($stdoutTask, $stderrTask)

                            @{
                                ExitCode = $proc.ExitCode
                                Stdout   = $stdoutTask.Result
                                Stderr   = $stderrTask.Result
                            }
                        } -ArgumentList $LlamaBench, $benchArgsStr

                        $timeoutSec = $TimeoutMinutes * 60
                        $jobResult = $job | Wait-Job -Timeout $timeoutSec

                        if ($job.State -eq "Running") {
                            Stop-Job $job
                            Remove-Job $job -Force
                            $elapsed = [math]::Round(((Get-Date) - $testStart).TotalSeconds)
                            Write-Host " -> TIMEOUT (${elapsed}s)" -ForegroundColor Red
                            Add-Content $stderrLog "TIMEOUT: $model t=$t muge=$mu rtr=$rt $label after ${elapsed}s"
                            $failed++
                            continue
                        }

                        $result = Receive-Job $job
                        Remove-Job $job -Force

                        $rawOutput = $result.Stdout
                        $stderrContent = $result.Stderr
                        $exitCode = $result.ExitCode

                        # Log stderr if non-empty
                        if ($stderrContent -and $stderrContent.Trim().Length -gt 0) {
                            Add-Content $stderrLog "--- $modelName t=$t muge=$mu rtr=$rt $label ---"
                            Add-Content $stderrLog $stderrContent
                        }

                        if ($exitCode -ne 0) {
                            Write-Host " -> EXIT CODE $exitCode" -ForegroundColor Red
                            $failed++
                            continue
                        }

                        if (-not $rawOutput -or $rawOutput.Trim().Length -eq 0) {
                            Write-Host " -> EMPTY OUTPUT" -ForegroundColor Red
                            $failed++
                            continue
                        }

                        # llama-bench prints diagnostic lines (===..., HAVE_FANCY_SIMD, etc.)
                        # to stdout mixed into the JSON. Filter to only JSON-valid lines.
                        $lines = $rawOutput -split "`n" | Where-Object {
                            $line = $_.Trim()
                            $line.Length -gt 0 -and
                            $line -notmatch '^=+' -and
                            $line -notmatch 'HAVE_FANCY_SIMD' -and
                            $line -notmatch 'llama_init_from_model' -and
                            $line -notmatch 'llama_repack'
                        }
                        $json = ($lines -join "`n").Trim()

                        if (-not $json -or $json[0] -ne '[') {
                            Write-Host " -> NO JSON IN OUTPUT" -ForegroundColor Red
                            $failed++
                            continue
                        }

                        $parsed = $json | ConvertFrom-Json

                        if (-not $parsed) {
                            Write-Host " -> PARSE ERROR" -ForegroundColor Red
                            $failed++
                            continue
                        }

                        # Save each result immediately to JSONL (crash-safe)
                        foreach ($entry in $parsed) {
                            $line = $entry | ConvertTo-Json -Depth 5 -Compress
                            Add-Content $jsonlPath $line -Encoding UTF8
                        }

                        $elapsed = [math]::Round(((Get-Date) - $testStart).TotalSeconds)
                        $avgTs = ($parsed | Measure-Object -Property avg_ts -Average).Average
                        Write-Host " -> $([math]::Round($avgTs, 1)) t/s (${elapsed}s)" -ForegroundColor Green
                        $succeeded++

                    } catch {
                        Write-Host " -> ERROR: $_" -ForegroundColor Red
                        Add-Content $stderrLog "EXCEPTION: $model t=$t muge=$mu rtr=$rt $label : $_"
                        $failed++
                        # Clean up the job if it's still around
                        if ($job) {
                            Remove-Job $job -Force -ErrorAction SilentlyContinue
                        }
                    }
                }
              }
            }
        }
    }
}

$totalElapsed = [math]::Round(((Get-Date) - $globalStart).TotalMinutes, 1)

Write-Host ""
Write-Host "=== Run Complete ===" -ForegroundColor Cyan
Write-Host "Total time: $totalElapsed min"
Write-Host "Succeeded:  $succeeded"
Write-Host "Skipped:    $skipped (already done)"
Write-Host "Failed:     $failed"
Write-Host ""

# --- Load all results from JSONL for summary generation ---
$allResults = @()
if (Test-Path $jsonlPath) {
    Get-Content $jsonlPath -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -gt 0) {
            try {
                $allResults += ($line | ConvertFrom-Json)
            } catch {}
        }
    }
}

# --- Also save as a single JSON array for convenience ---
$resultsPath = Join-Path $runDir "results.json"
if ($allResults.Count -eq 1) {
    # Force array wrapper for single result
    "[$($allResults[0] | ConvertTo-Json -Depth 5)]" | Set-Content $resultsPath -Encoding UTF8
} elseif ($allResults.Count -gt 0) {
    $allResults | ConvertTo-Json -Depth 5 | Set-Content $resultsPath -Encoding UTF8
} else {
    "[]" | Set-Content $resultsPath -Encoding UTF8
}
Write-Host "Results: $resultsPath ($($allResults.Count) entries)" -ForegroundColor Cyan

# --- Generate summary markdown ---
$summaryPath = Join-Path $runDir "summary.md"
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# MoE Benchmark Results")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- **Date:** $timestamp")
[void]$sb.AppendLine("- **Commit:** $commitHash")
[void]$sb.AppendLine("- **CPU:** $cpuName")
[void]$sb.AppendLine("- **RAM:** ${ramGB} GB")
[void]$sb.AppendLine("- **Repetitions:** $Reps")
[void]$sb.AppendLine("- **Total time:** $totalElapsed min")
[void]$sb.AppendLine("")

if ($allResults.Count -eq 0) {
    [void]$sb.AppendLine("No results collected.")
} else {
    # Group by test type
    foreach ($testType in $testTypes) {
        if ($testType -eq "pp") {
            [void]$sb.AppendLine("## Prompt Processing (pp$PP)")
        } else {
            [void]$sb.AppendLine("## Token Generation (tg$TG)")
        }
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("| Model | Threads | muge | rtr | fa | avg t/s | stddev |")
        [void]$sb.AppendLine("|-------|---------|------|-----|----|---------|--------|")

        $testLabel = if ($testType -eq "pp") { "pp$PP" } else { "tg$TG" }
        $filtered = $allResults | Where-Object { $_.test -eq $testLabel }

        foreach ($r in $filtered) {
            $name = if ($r.model_filename) {
                [System.IO.Path]::GetFileNameWithoutExtension($r.model_filename)
            } else { "?" }
            if ($name.Length -gt 40) { $name = $name.Substring(0, 37) + "..." }

            $avgTs = [math]::Round($r.avg_ts, 1)
            $stdTs = [math]::Round($r.stddev_ts, 2)
            $threads = $r.n_threads
            $mugeVal = if ($null -ne $r.muge) { $r.muge } else { "?" }
            $rtrVal = if ($null -ne $r.repack) { $r.repack } else { "?" }
            $faVal = if ($null -ne $r.flash_attn) { $r.flash_attn } else { "?" }
            [void]$sb.AppendLine("| $name | $threads | $mugeVal | $rtrVal | $faVal | $avgTs | $stdTs |")
        }
        [void]$sb.AppendLine("")
    }

    # Best configs section
    [void]$sb.AppendLine("## Best Configurations")
    [void]$sb.AppendLine("")

    $modelGroups = $allResults | Group-Object model_filename
    foreach ($group in $modelGroups) {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($group.Name)
        if ($name.Length -gt 50) { $name = $name.Substring(0, 47) + "..." }
        [void]$sb.AppendLine("### $name")

        foreach ($testType in $testTypes) {
            $testLabel = if ($testType -eq "pp") { "pp$PP" } else { "tg$TG" }
            $testResults = $group.Group | Where-Object { $_.test -eq $testLabel }
            if ($testResults) {
                $best = $testResults | Sort-Object avg_ts -Descending | Select-Object -First 1
                $avgTs = [math]::Round($best.avg_ts, 1)
                [void]$sb.AppendLine("- **$testLabel best:** $avgTs t/s (t=$($best.n_threads), muge=$($best.muge), rtr=$($best.repack), fa=$($best.flash_attn))")
            }
        }
        [void]$sb.AppendLine("")
    }
}

$sb.ToString() | Set-Content $summaryPath -Encoding UTF8
Write-Host "Summary: $summaryPath" -ForegroundColor Cyan
Write-Host ""

# --- Console summary ---
if ($allResults.Count -gt 0) {
    Write-Host "=== Quick Summary ===" -ForegroundColor Cyan
    $modelGroups = $allResults | Group-Object model_filename
    foreach ($group in $modelGroups) {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($group.Name)
        if ($name.Length -gt 35) { $name = $name.Substring(0, 32) + "..." }
        Write-Host "  $name" -ForegroundColor Yellow

        foreach ($testType in $testTypes) {
            $testLabel = if ($testType -eq "pp") { "pp$PP" } else { "tg$TG" }
            $testResults = $group.Group | Where-Object { $_.test -eq $testLabel }
            if ($testResults) {
                $best = $testResults | Sort-Object avg_ts -Descending | Select-Object -First 1
                $worst = $testResults | Sort-Object avg_ts | Select-Object -First 1
                Write-Host "    $testLabel : $([math]::Round($worst.avg_ts,1)) - $([math]::Round($best.avg_ts,1)) t/s  (best: t=$($best.n_threads) muge=$($best.muge) rtr=$($best.repack) fa=$($best.flash_attn))"
            }
        }
    }
}

Write-Host ""
Write-Host "Done. Full results: $runDir" -ForegroundColor Green
