<#
.SYNOPSIS
    Step-0 baseline benchmark for MoE CPU-only disk-bound inference (ik_llama.cpp).

.DESCRIPTION
    Turnkey measurement harness. Runs llama-cli once with a fixed prompt/seed and
    records the numbers Step-0 of the spec needs, with a focus on the ONE metric no
    built-in tool provides: PHYSICAL disk bytes read per generated token in
    steady state (the target of every optimization: prefetch / pin / prune / -ser).

    Metric design (see analysis-3-step0-measurements.md, revision 2026-07-18):
      - A2: physical reads sampled from PhysicalDisk(<instance for the model's
            drive>), not _Total, to cut cross-drive noise. Falls back to _Total.
      - B2: disk counter is sampled with timestamps into a cumulative time series.
            The generation window is derived from llama's own gen tok/s + token
            count; the STEADY slope (dropping the first 30% of generation as the
            fault-in transient) divided by gen tok/s = steady bytes/token. One run.
      - Phase-1 metrics only: NO logical/cache_hit via ReadTransferCount. That
            counter cannot see mmap page faults (proven: it reported 5.7 MB while
            the disk moved 2.6 GB), so it is intentionally omitted. cache_hit will
            come later from LLAMA_MOE_STATS routing instrumentation (Phase 2).

    A per-sample sidecar CSV (<label>_<run>_<ts>.samples.csv) is written so the
    slope can be re-derived / audited and so a subtraction cross-check (NGen 64 vs
    320) can be computed post hoc.

    IMPORTANT: a meaningful steady-state disk number only exists when the model
    EXCEEDS RAM. On a model that fits in RAM, warm generation reads ~0 from disk.
    Real baseline = target box (Ryzen9 / 96 GB) + MiniMax-M2 (>RAM). On smaller
    machines this only validates harness mechanics.

.NOTES
    - COLD cache: use -ColdCache (needs EmptyStandbyList.exe / RAMMap on PATH,
      admin). Otherwise only the first run after boot is cold.
    - Do NOT use --no-mmap to "fix" anything: it loads the whole model into RAM
      and destroys the >RAM regime under study.
    - Run elevated if you pass --mlock.

.EXAMPLE
    .\step0-bench.ps1 -ModelPath D:\models\minimax-m2.7.gguf -Label baseline

.EXAMPLE
    .\step0-bench.ps1 -ModelPath D:\models\minimax-m2.7.gguf -Label topk6 `
        -ExtraArgs '--override-kv','minimax.expert_used_count=int:6'
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ModelPath,

    [string]$LlamaCli,

    [string]$Prompt = "Write a detailed 500-word essay about the history of computing, covering the mechanical era, the transistor, the microprocessor, and the modern age of AI.",
    [string]$PromptFile,

    [int]$NGen = 200,
    [int]$Threads = 0,
    [int]$CtxSize = 4096,

    # Extra passthrough args to llama-cli (the knob under test).
    [string[]]$ExtraArgs = @(),

    [string]$Label = "baseline",
    [string]$Csv = "$PSScriptRoot\step0-results.csv",
    [int]$Repeat = 1,

    # Fraction of the generation window treated as fault-in transient and dropped
    # before measuring the steady slope. 0.3 = drop first 30% of generated tokens.
    [double]$TransientFraction = 0.3,

    [switch]$ColdCache,
    [switch]$KeepLog
)

$ErrorActionPreference = 'Stop'

# --- Resolve llama-cli ---------------------------------------------------------
if (-not $LlamaCli) {
    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..") -ErrorAction SilentlyContinue
    $candidates = @(
        (Join-Path $repoRoot "build\bin\Release\llama-cli.exe"),
        (Join-Path $repoRoot "build\bin\llama-cli.exe"),
        (Join-Path $repoRoot "build\bin\Release\main.exe"),
        (Join-Path $repoRoot "build\bin\main.exe")
    )
    $LlamaCli = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
if (-not $LlamaCli -or -not (Test-Path $LlamaCli)) {
    throw "llama-cli not found. Pass -LlamaCli <path>. Tried repo build dirs."
}
if (-not (Test-Path $ModelPath)) { throw "Model not found: $ModelPath" }

$LlamaCli  = (Resolve-Path $LlamaCli).Path
$ModelPath = (Resolve-Path $ModelPath).Path

if ($PromptFile) {
    if (-not (Test-Path $PromptFile)) { throw "PromptFile not found: $PromptFile" }
    $Prompt = Get-Content -Raw -Path $PromptFile
}

# --- A2: map the model's drive to a PhysicalDisk perf-counter instance ---------
function Resolve-DiskInstance([string]$path) {
    $drive = ([IO.Path]::GetPathRoot($path)).TrimEnd('\').ToLower()   # e.g. "d:"
    try {
        $names = (Get-Counter '\PhysicalDisk(*)\Disk Read Bytes/sec' -ErrorAction Stop).CounterSamples.InstanceName
        $match = $names | Where-Object { $_ -ne '_total' -and $_.ToLower().Contains($drive) } | Select-Object -First 1
        if ($match) { return $match }
    } catch { }
    Write-Warning "Could not map '$drive' to a PhysicalDisk instance; using _Total (machine-wide, noisier)."
    return '_Total'
}
$diskInstance = Resolve-DiskInstance $ModelPath
$diskCounterPath = "\PhysicalDisk($diskInstance)\Disk Read Bytes/sec"

Write-Host "llama-cli : $LlamaCli"
Write-Host "model     : $ModelPath"
Write-Host "disk inst : $diskInstance"
Write-Host "label     : $Label   (x$Repeat)"
Write-Host "extra args: $($ExtraArgs -join ' ')"
Write-Host ""

# --- Optional cold-cache drop --------------------------------------------------
function Invoke-ColdCache {
    $tool = Get-Command EmptyStandbyList.exe -ErrorAction SilentlyContinue
    if ($tool) { Write-Host "[cold] EmptyStandbyList standbylist"; & $tool.Source standbylist | Out-Null; return }
    $ram = Get-Command RAMMap64.exe -ErrorAction SilentlyContinue
    if ($ram) { Write-Host "[cold] RAMMap -Et"; & $ram.Source -Et | Out-Null; return }
    Write-Warning "[cold] No EmptyStandbyList.exe / RAMMap64.exe on PATH - cache NOT dropped."
}

# --- Argument list -------------------------------------------------------------
function Build-Args {
    $a = @('-m', $ModelPath, '-c', "$CtxSize", '-n', "$NGen", '-p', $Prompt,
           '--no-display-prompt', '--seed', '42')
    if ($Threads -gt 0) { $a += @('-t', "$Threads") }
    $a += $ExtraArgs
    return $a
}

# --- Timing parser (ik_llama "llama_print_timings" / newer "llama_perf") --------
function Parse-Timings([string[]]$lines) {
    $r = [ordered]@{ PromptTps=$null; GenTps=$null; PromptTok=$null; GenTok=$null }
    foreach ($ln in $lines) {
        if ($ln -match 'prompt eval time\s*=\s*[\d.]+\s*ms\s*/\s*(\d+)\s*tokens.*?([\d.]+)\s*tokens per second') {
            $r.PromptTok = [int]$Matches[1]; $r.PromptTps = [double]$Matches[2]
        }
        elseif ($ln -match '(^|\s)eval time\s*=\s*[\d.]+\s*ms\s*/\s*(\d+)\s*(?:runs|tokens).*?([\d.]+)\s*tokens per second') {
            $r.GenTok = [int]$Matches[2]; $r.GenTps = [double]$Matches[3]
        }
    }
    return [pscustomobject]$r
}

# --- Linear interpolation of cumulative bytes at wall-clock time t --------------
function Cum-At($samples, [double]$tt) {
    $n = $samples.Count
    if ($n -eq 0) { return 0.0 }
    if ($tt -le $samples[0].t)     { return [double]$samples[0].cum }
    if ($tt -ge $samples[$n-1].t)  { return [double]$samples[$n-1].cum }
    for ($i = 1; $i -lt $n; $i++) {
        if ($samples[$i].t -ge $tt) {
            $a = $samples[$i-1]; $b = $samples[$i]
            $span = [double]($b.t - $a.t)
            if ($span -le 0) { return [double]$b.cum }
            $f = ($tt - $a.t) / $span
            return [double]$a.cum + $f * ([double]$b.cum - [double]$a.cum)
        }
    }
    return [double]$samples[$n-1].cum
}

# --- Robust CSV field quoting --------------------------------------------------
function CsvField($v) {
    $s = [string]$v
    if ($s -match '[",\r\n]') { return '"' + $s.Replace('"', '""') + '"' }
    return $s
}
function CsvRow([object[]]$fields) { ($fields | ForEach-Object { CsvField $_ }) -join ',' }

# --- CSV header ----------------------------------------------------------------
$header = @('timestamp','label','model','n_gen','threads','ctx','prompt_tps','gen_tps',
            'gen_tokens','wall_s','disk_instance','phys_total_MB','phys_pregen_MB',
            'phys_gen_steady_MB','phys_gen_bytes_per_tok','peak_ws_MB','extra_args')
if (-not (Test-Path $Csv)) { (CsvRow $header) | Out-File -FilePath $Csv -Encoding utf8 }

# --- Single run ----------------------------------------------------------------
function Invoke-OneRun([int]$idx) {
    if ($ColdCache) { Invoke-ColdCache }

    $stamp   = Get-Date -Format 'yyyyMMdd_HHmmss'
    $logPath = Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("step0_{0}_{1}_{2}.log" -f $Label, $idx, $stamp)
    $samPath = Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("step0_{0}_{1}_{2}.samples.csv" -f $Label, $idx, $stamp)

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $LlamaCli
    foreach ($ar in (Build-Args)) { $psi.ArgumentList.Add([string]$ar) }
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute        = $false

    $t0   = Get-Date
    $proc = [System.Diagnostics.Process]::Start($psi)
    $sbOut = $proc.StandardOutput.ReadToEndAsync()
    $sbErr = $proc.StandardError.ReadToEndAsync()

    # Timestamped cumulative disk-read series (rate integrated over real dt).
    $samples = New-Object System.Collections.Generic.List[object]
    $cum = 0.0
    $peakWs = 0L
    $prev = Get-Date
    while (-not $proc.HasExited) {
        try {
            $c   = Get-Counter -Counter $diskCounterPath -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop
            $now = Get-Date
            $dt  = ($now - $prev).TotalSeconds
            $cum += [double]$c.CounterSamples[0].CookedValue * $dt
            $prev = $now
            $samples.Add([pscustomobject]@{ t = ($now - $t0).TotalSeconds; cum = $cum })
        } catch { }
        try { $proc.Refresh(); if ($proc.PeakWorkingSet64 -gt $peakWs) { $peakWs = $proc.PeakWorkingSet64 } } catch { }
    }
    $proc.WaitForExit()
    $tEnd = ((Get-Date) - $t0).TotalSeconds

    $stdout = $sbOut.Result; $stderr = $sbErr.Result
    $allLines = ($stdout + "`n" + $stderr) -split "`r?`n"
    if ($KeepLog) { ($stdout + "`n" + $stderr) | Out-File -FilePath $logPath -Encoding utf8 }

    # Persist per-sample series (audit / post-hoc subtraction).
    ("t_s,cum_bytes") | Out-File -FilePath $samPath -Encoding utf8
    $samples | ForEach-Object { "{0:N3},{1:F0}" -f $_.t, $_.cum } | Add-Content -Path $samPath

    $t = Parse-Timings $allLines
    if (-not $t.GenTps) { Write-Warning "Could not parse generation tok/s. Check log: $logPath" }

    $genTok = if ($t.GenTok) { [int]$t.GenTok } else { $NGen }

    # B2: derive the generation window and measure the STEADY slope.
    $physTotalB = if ($samples.Count) { [double]$samples[$samples.Count-1].cum } else { 0.0 }
    $genDur = if ($t.GenTps -and $t.GenTps -gt 0) { $genTok / [double]$t.GenTps } else { 0.0 }
    if ($genDur -gt 0 -and $genDur -lt $tEnd -and $samples.Count -ge 3) {
        $genStart    = [math]::Max(0.0, $tEnd - $genDur)
        $steadyStart = $genStart + $TransientFraction * $genDur
        $physPregenB = Cum-At $samples $genStart
        $physSteadyB = (Cum-At $samples $tEnd) - (Cum-At $samples $steadyStart)
        $steadyDur   = $tEnd - $steadyStart
        $steadyTok   = if ($genDur -gt 0) { $genTok * ($steadyDur / $genDur) } else { 0 }
        $physGenBpt  = if ($steadyTok -gt 0) { [math]::Round($physSteadyB / $steadyTok, 0) } else { '' }
    } else {
        # Not enough signal to separate phases (e.g. model fits in RAM / too few samples).
        $physPregenB = $physTotalB; $physSteadyB = 0.0; $physGenBpt = ''
        Write-Warning "Steady-state window not resolvable (genDur=$([math]::Round($genDur,1))s, samples=$($samples.Count)). Reporting totals only."
    }

    $row = CsvRow @(
        (Get-Date -Format 's'), $Label, [IO.Path]::GetFileName($ModelPath),
        $NGen, $Threads, $CtxSize,
        $t.PromptTps, $t.GenTps, $genTok,
        [math]::Round($tEnd, 1), $diskInstance,
        [math]::Round($physTotalB / 1MB, 1),
        [math]::Round($physPregenB / 1MB, 1),
        [math]::Round($physSteadyB / 1MB, 1),
        $physGenBpt,
        [math]::Round($peakWs / 1MB, 0),
        ($ExtraArgs -join ' ')
    )
    Add-Content -Path $Csv -Value $row

    Write-Host ("[{0}] gen {1} t/s | steady {2} B/tok | disk total {3} MB (pregen {4}) | peak {5} MB | {6}s" -f `
        $Label, $t.GenTps, $physGenBpt,
        [math]::Round($physTotalB/1MB,1), [math]::Round($physPregenB/1MB,1),
        [math]::Round($peakWs/1MB,0), [math]::Round($tEnd,1))
}

for ($i = 1; $i -le $Repeat; $i++) {
    Write-Host "--- run $i/$Repeat ---"
    Invoke-OneRun $i
}

Write-Host ""
Write-Host "Done. Results: $Csv"
Write-Host "Per-sample series: step0_<label>_<run>_<ts>.samples.csv (for slope audit / subtraction)."
