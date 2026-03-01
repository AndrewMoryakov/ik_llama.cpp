<#
.SYNOPSIS
    Thread scaling benchmark: test thread counts 8..96 with best configs only.

.DESCRIPTION
    Tests how PP and TG scale with increasing thread counts on Zen4 dual-CCD.
    Uses best-known flag configs per model from baseline analysis.

.EXAMPLE
    .\scripts\bench-thread-scaling.ps1
    .\scripts\bench-thread-scaling.ps1 -Reps 1
    .\scripts\bench-thread-scaling.ps1 -Resume "thr_2026-02-23_1500"
#>

param(
    [string]$LlamaBench = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\build\bin\llama-bench.exe",
    [string]$OutDir     = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\bench_results",
    [int]$Reps          = 2,
    [int]$TimeoutMinutes = 30,
    [string]$Resume     = ""
)

$ErrorActionPreference = "Continue"

# --- Thread counts to test ---
$ThreadCounts = @(8, 16, 32, 42, 52, 64, 96)

# --- Models with their best configs from baseline ---
$Models = @(
    @{
        path = "Z:\files\gguf\lmstudio-community\gpt-oss-20b-GGUF\gpt-oss-20b-MXFP4.gguf"
        name = "gpt-oss-20b"
        fa = 1; muge = 1; rtr = 1
    },
    @{
        path = "Z:\files\gguf\lmstudio-community\Qwen3-30B-A3B-GGUF\Qwen3-30B-A3B-Q4_K_M.gguf"
        name = "Qwen3-30B-A3B"
        fa = 1; muge = 0; rtr = 1
    },
    @{
        path = "Z:\files\gguf\lmstudio-community\Meta-Llama-3.1-8B-Instruct-GGUF\Meta-Llama-3.1-8B-Instruct-Q8_0.gguf"
        name = "Llama-3.1-8B"
        fa = 1; muge = 0; rtr = 1
    }
)

# Validate
if (-not (Test-Path $LlamaBench)) {
    Write-Host "ERROR: llama-bench not found at: $LlamaBench" -ForegroundColor Red
    exit 1
}
$ValidModels = @()
foreach ($m in $Models) {
    if (Test-Path $m.path) { $ValidModels += $m }
    else { Write-Warning "Model not found, skipping: $($m.path)" }
}
if ($ValidModels.Count -eq 0) { Write-Host "ERROR: No valid models." -ForegroundColor Red; exit 1 }

# --- Build test cases ---
$TestCases = @()

foreach ($m in $ValidModels) {
    foreach ($t in $ThreadCounts) {
        # PP512
        $TestCases += @{
            model = $m
            threads = $t
            pp = 512; tg = 0
            desc = "$($m.name) t=$t pp512"
        }
        # TG128
        $TestCases += @{
            model = $m
            threads = $t
            pp = 0; tg = 128
            desc = "$($m.name) t=$t tg128"
        }
    }
}

# --- Output directory ---
if ($Resume -ne "") {
    if ([System.IO.Path]::IsPathRooted($Resume)) { $runDir = $Resume }
    else { $runDir = Join-Path $OutDir $Resume }
    if (-not (Test-Path $runDir)) { Write-Host "ERROR: Resume dir not found: $runDir" -ForegroundColor Red; exit 1 }
    $timestamp = Split-Path $runDir -Leaf
    Write-Host "Resuming run: $timestamp" -ForegroundColor Yellow
} else {
    $timestamp = "thr_" + (Get-Date -Format "yyyy-MM-dd_HHmm")
    $runDir = Join-Path $OutDir $timestamp
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
}

$jsonlPath = Join-Path $runDir "results.jsonl"

# Load completed keys for resume
$completedKeys = @{}
if (Test-Path $jsonlPath) {
    Get-Content $jsonlPath -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -gt 0) {
            try {
                $obj = $line | ConvertFrom-Json
                if ($obj.bench_desc) { $completedKeys[$obj.bench_desc] = $true }
            } catch {}
        }
    }
    if ($completedKeys.Count -gt 0) {
        Write-Host "Found $($completedKeys.Count) completed tests." -ForegroundColor Yellow
    }
}

# --- Metadata ---
$commitHash = "unknown"
try {
    $repoRoot = Split-Path (Split-Path (Split-Path $LlamaBench -Parent) -Parent) -Parent
    $commitHash = (git -C $repoRoot rev-parse --short HEAD 2>$null)
    if (-not $commitHash) { $commitHash = "unknown" }
} catch {}

$cpuName = "unknown"
try { $cpuName = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim() } catch {}
$ramGB = "unknown"
try { $ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1) } catch {}

@{
    timestamp = (Get-Date -Format "o")
    commit = $commitHash
    cpu = $cpuName
    ram_gb = $ramGB
    reps = $Reps
    timeout_min = $TimeoutMinutes
    test_count = $TestCases.Count
    thread_counts = $ThreadCounts
    models = @($ValidModels | ForEach-Object { $_.name })
} | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $runDir "run_info.json") -Encoding UTF8

Write-Host "=== Thread Scaling Benchmarks ===" -ForegroundColor Cyan
Write-Host "Commit:    $commitHash"
Write-Host "CPU:       $cpuName"
Write-Host "RAM:       $ramGB GB"
Write-Host "Models:    $($ValidModels.Count)"
Write-Host "Threads:   $($ThreadCounts -join ', ')"
Write-Host "Tests:     $($TestCases.Count)"
Write-Host "Reps:      $Reps"
Write-Host "Timeout:   $TimeoutMinutes min"
Write-Host "Output:    $runDir"
Write-Host ""

# --- Run ---
$total = $TestCases.Count
$current = 0
$skipped = 0
$failed = 0
$succeeded = 0
$globalStart = Get-Date

foreach ($tc in $TestCases) {
    $current++

    # Resume check
    if ($completedKeys.ContainsKey($tc.desc)) {
        $skipped++
        Write-Host "  [$current/$total] $($tc.desc) -> SKIP (done)" -ForegroundColor DarkGray
        continue
    }

    $pct = [math]::Round(($current / $total) * 100)
    Write-Host "  [$current/$total $pct%] $($tc.desc)" -NoNewline

    $m = $tc.model
    $benchArgs = @(
        "-m", $m.path,
        "-t", $tc.threads,
        "-fa", $m.fa,
        "-muge", $m.muge,
        "-rtr", $m.rtr,
        "-ngl", 0,
        "-r", $Reps,
        "-w", 1,
        "-p", $tc.pp,
        "-n", $tc.tg,
        "-o", "json"
    )

    $testStart = Get-Date
    $stderrLog = Join-Path $runDir "stderr.log"

    try {
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
            $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
            $stderrTask = $proc.StandardError.ReadToEndAsync()
            $proc.WaitForExit()
            [System.Threading.Tasks.Task]::WaitAll($stdoutTask, $stderrTask)
            @{ ExitCode = $proc.ExitCode; Stdout = $stdoutTask.Result; Stderr = $stderrTask.Result }
        } -ArgumentList $LlamaBench, $benchArgsStr

        $timeoutSec = $TimeoutMinutes * 60
        $null = $job | Wait-Job -Timeout $timeoutSec

        if ($job.State -eq "Running") {
            Stop-Job $job; Remove-Job $job -Force
            $elapsed = [math]::Round(((Get-Date) - $testStart).TotalSeconds)
            Write-Host " -> TIMEOUT (${elapsed}s)" -ForegroundColor Red
            Add-Content $stderrLog "TIMEOUT: $($tc.desc) after ${elapsed}s"
            $failed++; continue
        }

        $result = Receive-Job $job; Remove-Job $job -Force
        $rawOutput = $result.Stdout
        $stderrContent = $result.Stderr
        $exitCode = $result.ExitCode

        if ($stderrContent -and $stderrContent.Trim().Length -gt 0) {
            Add-Content $stderrLog "--- $($tc.desc) ---"
            Add-Content $stderrLog $stderrContent
        }

        if ($exitCode -ne 0) {
            Write-Host " -> EXIT CODE $exitCode" -ForegroundColor Red
            $failed++; continue
        }

        if (-not $rawOutput -or $rawOutput.Trim().Length -eq 0) {
            Write-Host " -> EMPTY OUTPUT" -ForegroundColor Red
            $failed++; continue
        }

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
            Write-Host " -> NO JSON" -ForegroundColor Red
            $failed++; continue
        }

        $parsed = $json | ConvertFrom-Json
        if (-not $parsed) {
            Write-Host " -> PARSE ERROR" -ForegroundColor Red
            $failed++; continue
        }

        # Augment with metadata and save
        foreach ($entry in $parsed) {
            $entry | Add-Member -NotePropertyName "bench_desc" -NotePropertyValue $tc.desc -Force
            $line = $entry | ConvertTo-Json -Depth 5 -Compress
            Add-Content $jsonlPath $line -Encoding UTF8
        }

        $elapsed = [math]::Round(((Get-Date) - $testStart).TotalSeconds)
        $avgTs = ($parsed | Measure-Object -Property avg_ts -Average).Average
        Write-Host " -> $([math]::Round($avgTs, 1)) t/s (${elapsed}s)" -ForegroundColor Green
        $succeeded++

    } catch {
        Write-Host " -> ERROR: $_" -ForegroundColor Red
        Add-Content $stderrLog "EXCEPTION: $($tc.desc) : $_"
        $failed++
        if ($job) { Remove-Job $job -Force -ErrorAction SilentlyContinue }
    }
}

$totalElapsed = [math]::Round(((Get-Date) - $globalStart).TotalMinutes, 1)

Write-Host ""
Write-Host "=== Run Complete ===" -ForegroundColor Cyan
Write-Host "Total time: $totalElapsed min"
Write-Host "Succeeded:  $succeeded"
Write-Host "Skipped:    $skipped (already done)"
Write-Host "Failed:     $failed"

# --- Load all results ---
$allResults = @()
if (Test-Path $jsonlPath) {
    Get-Content $jsonlPath -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -gt 0) { try { $allResults += ($line | ConvertFrom-Json) } catch {} }
    }
}

# Save combined JSON
$resultsPath = Join-Path $runDir "results.json"
if ($allResults.Count -le 1) {
    "[$($allResults | ForEach-Object { $_ | ConvertTo-Json -Depth 5 })]" | Set-Content $resultsPath -Encoding UTF8
} else {
    $allResults | ConvertTo-Json -Depth 5 | Set-Content $resultsPath -Encoding UTF8
}

# --- Generate summary ---
$summaryPath = Join-Path $runDir "summary.md"
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# Thread Scaling Benchmark Results")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- **Date:** $timestamp")
[void]$sb.AppendLine("- **Commit:** $commitHash")
[void]$sb.AppendLine("- **CPU:** $cpuName")
[void]$sb.AppendLine("- **RAM:** $ramGB GB")
[void]$sb.AppendLine("- **Reps:** $Reps")
[void]$sb.AppendLine("- **Total time:** $totalElapsed min")
[void]$sb.AppendLine("- **Thread counts:** $($ThreadCounts -join ', ')")
[void]$sb.AppendLine("")

# Group by model
$modelGroups = $allResults | Group-Object { ($_.bench_desc -split ' ')[0] }
foreach ($mg in $modelGroups) {
    [void]$sb.AppendLine("## $($mg.Name)")
    [void]$sb.AppendLine("")

    # PP table
    [void]$sb.AppendLine("### Prompt Processing (PP512)")
    [void]$sb.AppendLine("")
    $header = "| Threads |"
    $sep = "|---------|"
    $header += " avg t/s | stddev |"
    $sep += "---------|--------|"
    [void]$sb.AppendLine($header)
    [void]$sb.AppendLine($sep)

    $ppResults = $mg.Group | Where-Object { $_.bench_desc -match 'pp512' } | Sort-Object { [int]($_.bench_desc -replace '.*t=(\d+).*','$1') }
    foreach ($r in $ppResults) {
        $threads = ($r.bench_desc -replace '.*t=(\d+).*','$1')
        $avgTs = [math]::Round($r.avg_ts, 1)
        $stdTs = [math]::Round($r.stddev_ts, 2)
        [void]$sb.AppendLine("| $threads | $avgTs | $stdTs |")
    }
    [void]$sb.AppendLine("")

    # TG table
    [void]$sb.AppendLine("### Token Generation (TG128)")
    [void]$sb.AppendLine("")
    $header = "| Threads |"
    $sep = "|---------|"
    $header += " avg t/s | stddev |"
    $sep += "---------|--------|"
    [void]$sb.AppendLine($header)
    [void]$sb.AppendLine($sep)

    $tgResults = $mg.Group | Where-Object { $_.bench_desc -match 'tg128' } | Sort-Object { [int]($_.bench_desc -replace '.*t=(\d+).*','$1') }
    foreach ($r in $tgResults) {
        $threads = ($r.bench_desc -replace '.*t=(\d+).*','$1')
        $avgTs = [math]::Round($r.avg_ts, 1)
        $stdTs = [math]::Round($r.stddev_ts, 2)
        [void]$sb.AppendLine("| $threads | $avgTs | $stdTs |")
    }
    [void]$sb.AppendLine("")
}

$sb.ToString() | Set-Content $summaryPath -Encoding UTF8
Write-Host ""
Write-Host "Results: $resultsPath ($($allResults.Count) entries)" -ForegroundColor Cyan
Write-Host "Summary: $summaryPath" -ForegroundColor Cyan

# --- Console summary ---
if ($allResults.Count -gt 0) {
    Write-Host ""
    Write-Host "=== Thread Scaling Summary ===" -ForegroundColor Cyan
    foreach ($mg in $modelGroups) {
        Write-Host "  [$($mg.Name)]" -ForegroundColor Yellow
        Write-Host "    PP512:" -ForegroundColor Gray
        $ppResults = $mg.Group | Where-Object { $_.bench_desc -match 'pp512' } | Sort-Object { [int]($_.bench_desc -replace '.*t=(\d+).*','$1') }
        foreach ($r in $ppResults) {
            $threads = ($r.bench_desc -replace '.*t=(\d+).*','$1')
            Write-Host "      t=$threads : $([math]::Round($r.avg_ts, 1)) t/s"
        }
        Write-Host "    TG128:" -ForegroundColor Gray
        $tgResults = $mg.Group | Where-Object { $_.bench_desc -match 'tg128' } | Sort-Object { [int]($_.bench_desc -replace '.*t=(\d+).*','$1') }
        foreach ($r in $tgResults) {
            $threads = ($r.bench_desc -replace '.*t=(\d+).*','$1')
            Write-Host "      t=$threads : $([math]::Round($r.avg_ts, 1)) t/s"
        }
    }
}

Write-Host ""
Write-Host "Done. Full results: $runDir" -ForegroundColor Green
