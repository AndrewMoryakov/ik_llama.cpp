<#
.SYNOPSIS
    CPU topology benchmarks: CCD affinity, prompt length scaling, SMT analysis.

.DESCRIPTION
    Three scenarios on Ryzen 9 7950X (2 CCD x 8 cores x 2 SMT = 32 logical):
      1. CCD Affinity: pin to CCD0, CCD1, or no pinning (t=16)
      2. Prompt Length: PP 128..4096 throughput curve (t=16)
      3. SMT: 8 physical cores (no SMT) vs 16 logical (with SMT), pinned to CCD0

.EXAMPLE
    .\scripts\bench-cpu-topology.ps1
    .\scripts\bench-cpu-topology.ps1 -Reps 1
    .\scripts\bench-cpu-topology.ps1 -Resume "cpu_2026-02-23_1400"
#>

param(
    [string]$LlamaBench = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\build\bin\llama-bench.exe",
    [string]$OutDir     = "Z:\files\projects\ik_llama_proj\ik_llama.cpp\bench_results",
    [int]$Reps          = 2,
    [int]$TimeoutMinutes = 30,
    [string]$Resume     = ""
)

$ErrorActionPreference = "Continue"

# --- Ryzen 9 7950X topology ---
# CCD0: logical 0-15 (8 cores x 2 SMT)
# CCD1: logical 16-31 (8 cores x 2 SMT)
# Physical cores (no SMT): even-numbered logical = 0,2,4,6,8,10,12,14 on CCD0

$AFF_NONE     = [long]0            # no pinning (OS scheduler)
$AFF_CCD0     = [long]0xFFFF       # CCD0: logical 0-15
$AFF_CCD1     = [long]0xFFFF0000   # CCD1: logical 16-31
$AFF_CCD0_PHY = [long]0x5555       # CCD0 physical only: even bits 0,2,4,...14

# --- Models with best configs ---
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
    # === Scenario 1: CCD Affinity (t=16, PP512+TG128) ===
    foreach ($aff in @(
        @{ tag = "no-pin"; mask = $AFF_NONE; threads = 16 },
        @{ tag = "ccd0";   mask = $AFF_CCD0; threads = 16 },
        @{ tag = "ccd1";   mask = $AFF_CCD1; threads = 16 }
    )) {
        $TestCases += @{
            scenario = "ccd-affinity"
            model = $m; threads = $aff.threads
            pp = 512; tg = 0; affinity = $aff.mask
            desc = "$($m.name) t=$($aff.threads) $($aff.tag) pp512"
        }
        $TestCases += @{
            scenario = "ccd-affinity"
            model = $m; threads = $aff.threads
            pp = 0; tg = 128; affinity = $aff.mask
            desc = "$($m.name) t=$($aff.threads) $($aff.tag) tg128"
        }
    }

    # === Scenario 2: Prompt Length Scaling (t=16, no pin) ===
    foreach ($ppLen in @(128, 256, 512, 1024, 2048, 4096)) {
        $TestCases += @{
            scenario = "prompt-length"
            model = $m; threads = 16
            pp = $ppLen; tg = 0; affinity = $AFF_NONE
            desc = "$($m.name) t=16 pp$ppLen"
        }
    }

    # === Scenario 3: SMT (CCD0 pinned) ===
    foreach ($smt in @(
        @{ tag = "nosmt"; mask = $AFF_CCD0_PHY; threads = 8 },
        @{ tag = "smt";   mask = $AFF_CCD0;     threads = 16 }
    )) {
        $TestCases += @{
            scenario = "smt"
            model = $m; threads = $smt.threads
            pp = 512; tg = 0; affinity = $smt.mask
            desc = "$($m.name) t=$($smt.threads) $($smt.tag) pp512"
        }
        $TestCases += @{
            scenario = "smt"
            model = $m; threads = $smt.threads
            pp = 0; tg = 128; affinity = $smt.mask
            desc = "$($m.name) t=$($smt.threads) $($smt.tag) tg128"
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
    $timestamp = "cpu_" + (Get-Date -Format "yyyy-MM-dd_HHmm")
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
    scenarios = @("ccd-affinity", "prompt-length", "smt")
    models = @($ValidModels | ForEach-Object { $_.name })
    topology = @{
        ccd0_mask = "0x{0:X}" -f $AFF_CCD0
        ccd1_mask = "0x{0:X}" -f $AFF_CCD1
        ccd0_physical_mask = "0x{0:X}" -f $AFF_CCD0_PHY
    }
} | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $runDir "run_info.json") -Encoding UTF8

Write-Host "=== CPU Topology Benchmarks ===" -ForegroundColor Cyan
Write-Host "Commit:    $commitHash"
Write-Host "CPU:       $cpuName"
Write-Host "RAM:       $ramGB GB"
Write-Host "Models:    $($ValidModels.Count)"
Write-Host "Tests:     $($TestCases.Count)"
Write-Host "Scenarios: ccd-affinity, prompt-length, smt"
Write-Host "Reps:      $Reps"
Write-Host "Timeout:   $TimeoutMinutes min"
Write-Host "Output:    $runDir"
Write-Host ""
Write-Host "Affinity masks:" -ForegroundColor Gray
Write-Host "  CCD0 (all):      0x$("{0:X}" -f $AFF_CCD0)" -ForegroundColor Gray
Write-Host "  CCD1 (all):      0x$("{0:X}" -f $AFF_CCD1)" -ForegroundColor Gray
Write-Host "  CCD0 (phys only):0x$("{0:X}" -f $AFF_CCD0_PHY)" -ForegroundColor Gray
Write-Host ""

# --- Run ---
$total = $TestCases.Count
$current = 0
$skipped = 0
$failed = 0
$succeeded = 0
$globalStart = Get-Date
$currentScenario = ""

foreach ($tc in $TestCases) {
    $current++

    if ($tc.scenario -ne $currentScenario) {
        $currentScenario = $tc.scenario
        Write-Host ""
        Write-Host "--- Scenario: $currentScenario ---" -ForegroundColor Yellow
    }

    # Resume check
    if ($completedKeys.ContainsKey($tc.desc)) {
        $skipped++
        Write-Host "  [$current/$total] $($tc.desc) -> SKIP (done)" -ForegroundColor DarkGray
        continue
    }

    $pct = [math]::Round(($current / $total) * 100)
    $affLabel = if ($tc.affinity -gt 0) { " aff=0x$("{0:X}" -f $tc.affinity)" } else { "" }
    Write-Host "  [$current/$total $pct%] $($tc.desc)$affLabel" -NoNewline

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
        $affinityMask = $tc.affinity

        $job = Start-Job -ScriptBlock {
            param($exe, $argsStr, $affMask)
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

            # Set processor affinity if specified
            if ($affMask -gt 0) {
                try {
                    $proc.ProcessorAffinity = [IntPtr]$affMask
                } catch {
                    # Affinity setting failed — continue without it
                }
            }

            $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
            $stderrTask = $proc.StandardError.ReadToEndAsync()
            $proc.WaitForExit()
            [System.Threading.Tasks.Task]::WaitAll($stdoutTask, $stderrTask)
            @{ ExitCode = $proc.ExitCode; Stdout = $stdoutTask.Result; Stderr = $stderrTask.Result }
        } -ArgumentList $LlamaBench, $benchArgsStr, $affinityMask

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
            $entry | Add-Member -NotePropertyName "bench_scenario" -NotePropertyValue $tc.scenario -Force
            $entry | Add-Member -NotePropertyName "bench_desc" -NotePropertyValue $tc.desc -Force
            $entry | Add-Member -NotePropertyName "bench_affinity" -NotePropertyValue $tc.affinity -Force
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
[void]$sb.AppendLine("# CPU Topology Benchmark Results")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- **Date:** $timestamp")
[void]$sb.AppendLine("- **Commit:** $commitHash")
[void]$sb.AppendLine("- **CPU:** $cpuName")
[void]$sb.AppendLine("- **RAM:** $ramGB GB")
[void]$sb.AppendLine("- **Reps:** $Reps")
[void]$sb.AppendLine("- **Total time:** $totalElapsed min")
[void]$sb.AppendLine("")

# Group by scenario
$scenarios = $allResults | Group-Object bench_scenario
foreach ($sg in $scenarios) {
    [void]$sb.AppendLine("## Scenario: $($sg.Name)")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Description | avg t/s | stddev |")
    [void]$sb.AppendLine("|-------------|---------|--------|")

    foreach ($r in $sg.Group) {
        $avgTs = [math]::Round($r.avg_ts, 1)
        $stdTs = [math]::Round($r.stddev_ts, 2)
        [void]$sb.AppendLine("| $($r.bench_desc) | $avgTs | $stdTs |")
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
    Write-Host "=== Quick Summary ===" -ForegroundColor Cyan
    foreach ($sg in $scenarios) {
        Write-Host "  [$($sg.Name)]" -ForegroundColor Yellow
        foreach ($r in $sg.Group) {
            $stdStr = if ($r.stddev_ts -gt 10) { " (!!)" } elseif ($r.stddev_ts -gt 3) { " (!)" } else { "" }
            Write-Host "    $($r.bench_desc): $([math]::Round($r.avg_ts, 1)) t/s  sd=$([math]::Round($r.stddev_ts, 1))$stdStr"
        }
    }
}

Write-Host ""
Write-Host "Done. Full results: $runDir" -ForegroundColor Green
