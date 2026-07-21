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

    [ValidateRange(1, 1000000)]
    [int]$NGen = 512,
    [int]$Threads = 0,
    [int]$CtxSize = 4096,

    # Extra passthrough args to llama-cli (the knob under test).
    [string[]]$ExtraArgs = @(),

    [string]$Label = "baseline",
    [string]$Csv = "$PSScriptRoot\step0-results.csv",
    [ValidateRange(1, 1000)]
    [int]$Repeat = 1,

    # Fraction of the generation window treated as fault-in transient and dropped
    # before measuring the steady slope. 0.3 = drop first 30% of generated tokens.
    [ValidateRange(0.0, 0.99)]
    [double]$TransientFraction = 0.3,

    # Recalculate the same raw sample series at these fractions. This is a
    # sensitivity analysis, not additional expensive model runs.
    [double[]]$SensitivityTransientFractions = @(0.2, 0.3, 0.4),

    # Name from \PhysicalDisk(*)\Disk Read Bytes/sec. Supply this on the target
    # machine after checking the counter instances; automatic mapping is only a
    # convenience heuristic.
    [string]$DiskInstance,
    [switch]$AllowTotalDiskFallback,

    # Full hashing of a >100 GB GGUF is deliberately opt-in: it pollutes the
    # page cache and changes the workload being measured.
    [switch]$HashModel,

    [switch]$ColdCache,
    [switch]$KeepLog
)

$ErrorActionPreference = 'Stop'
$InvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture

foreach ($fraction in $SensitivityTransientFractions) {
    if ($fraction -lt 0.0 -or $fraction -ge 1.0) {
        throw "SensitivityTransientFractions values must be in [0, 1): $fraction"
    }
}

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
    if ($AllowTotalDiskFallback) {
        Write-Warning "Could not map '$drive' to a PhysicalDisk instance; using _Total (machine-wide, noisy)."
        return '_Total'
    }
    throw "Could not map '$drive' to a PhysicalDisk instance. Inspect Get-Counter '\PhysicalDisk(*)\Disk Read Bytes/sec' and pass -DiskInstance explicitly, or use -AllowTotalDiskFallback only for a non-production smoke run."
}
$diskInstance = if ($DiskInstance) { $DiskInstance } else { Resolve-DiskInstance $ModelPath }
$diskCounterPath = "\PhysicalDisk($diskInstance)\Disk Read Bytes/sec"
try { Get-Counter -Counter $diskCounterPath -MaxSamples 1 -ErrorAction Stop | Out-Null }
catch { throw "Disk counter '$diskCounterPath' is not available. Pass a valid -DiskInstance from Get-Counter '\PhysicalDisk(*)\Disk Read Bytes/sec'." }

Write-Host "llama-cli : $LlamaCli"
Write-Host "model     : $ModelPath"
Write-Host "disk inst : $diskInstance"
Write-Host "label     : $Label   (x$Repeat)"
Write-Host "extra args: $($ExtraArgs -join ' ')"
Write-Host "transient : primary=$TransientFraction sensitivity=$($SensitivityTransientFractions -join ',')"
Write-Host ""

# --- Optional cold-cache drop --------------------------------------------------
function Invoke-ColdCache {
    $tool = Get-Command EmptyStandbyList.exe -ErrorAction SilentlyContinue
    if ($tool) {
        Write-Host "[cold] EmptyStandbyList standbylist"
        & $tool.Source standbylist | Out-Null
        if ($LASTEXITCODE -ne 0) { return "EmptyStandbyList failed exit=$LASTEXITCODE" }
        return 'EmptyStandbyList standbylist'
    }
    $ram = Get-Command RAMMap64.exe -ErrorAction SilentlyContinue
    if ($ram) {
        Write-Host "[cold] RAMMap -Et"
        & $ram.Source -Et | Out-Null
        if ($LASTEXITCODE -ne 0) { return "RAMMap failed exit=$LASTEXITCODE" }
        return 'RAMMap -Et'
    }
    Write-Warning "[cold] No EmptyStandbyList.exe / RAMMap64.exe on PATH - cache NOT dropped."
    return 'requested_but_tool_unavailable'
}

# --- Argument list -------------------------------------------------------------
function Build-Args {
    for ($i = 0; $i -lt $ExtraArgs.Count; $i++) {
        if ($ExtraArgs[$i] -match '^(?:-ngl|--gpu-layers)=(.+)$') {
            if ($Matches[1] -ne '0') { throw "Step0 baseline is CPU-only. Do not override $($ExtraArgs[$i]) with a non-zero value." }
        } elseif ($ExtraArgs[$i] -in @('-ngl', '--gpu-layers')) {
            if (($i + 1) -ge $ExtraArgs.Count -or $ExtraArgs[$i + 1] -ne '0') {
                throw "Step0 baseline is CPU-only. Do not override $($ExtraArgs[$i]) with a non-zero value."
            }
        }
    }
    $a = @('-m', $ModelPath, '-c', "$CtxSize", '-n', "$NGen", '-p', $Prompt,
           '--no-display-prompt', '--seed', '42', '-ngl', '0')
    if ($Threads -gt 0) { $a += @('-t', "$Threads") }
    $a += $ExtraArgs
    return $a
}

# ProcessStartInfo.ArgumentList requires PowerShell 7/.NET Core. This quoting
# implementation keeps the harness runnable on the Windows PowerShell 5.1 that
# commonly ships with target Windows machines.
function Quote-WindowsArgument([string]$Argument) {
    if ($Argument.Length -eq 0) { return '""' }
    if ($Argument -notmatch '[\s"]') { return $Argument }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('"')
    $slashes = 0
    foreach ($ch in $Argument.ToCharArray()) {
        if ($ch -eq '\') { $slashes++; continue }
        if ($ch -eq '"') {
            [void]$sb.Append((('\' * (2 * $slashes + 1)) -join ''))
            [void]$sb.Append('"')
            $slashes = 0
            continue
        }
        if ($slashes -gt 0) { [void]$sb.Append((('\' * $slashes) -join '')); $slashes = 0 }
        [void]$sb.Append($ch)
    }
    if ($slashes -gt 0) { [void]$sb.Append((('\' * (2 * $slashes)) -join '')) }
    [void]$sb.Append('"')
    return $sb.ToString()
}
function ConvertTo-WindowsCommandLine([string[]]$Arguments) {
    return (($Arguments | ForEach-Object { Quote-WindowsArgument ([string]$_) }) -join ' ')
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

function Get-SteadyMetric($samples, [double]$genStart, [double]$genEnd, [int]$genTok, [double]$fraction) {
    if ($samples.Count -lt 3) { return [pscustomobject]@{ status='insufficient_samples'; bytes=0.0; bpt=$null } }
    # This is B2 integration of a device-level rate counter. It is not proof of
    # exact phase coverage; only future live phase markers/ETW can establish B3.
    $steadyStart = $genStart + $fraction * ($genEnd - $genStart)
    $steadyDur = $genEnd - $steadyStart
    $steadyTok = $genTok * ($steadyDur / ($genEnd - $genStart))
    if ($steadyTok -le 0) { return [pscustomobject]@{ status='invalid_window'; bytes=0.0; bpt=$null } }
    $bytes = (Cum-At $samples $genEnd) - (Cum-At $samples $steadyStart)
    return [pscustomobject]@{ status='ok'; bytes=$bytes; bpt=[math]::Round($bytes / $steadyTok, 0) }
}
function Get-Median([double[]]$values) {
    if ($values.Count -eq 0) { return $null }
    $sorted = @($values | Sort-Object)
    $middle = [int]($sorted.Count / 2)
    if (($sorted.Count % 2) -eq 1) { return $sorted[$middle] }
    return ($sorted[$middle - 1] + $sorted[$middle]) / 2.0
}

# --- Robust CSV field quoting --------------------------------------------------
function CsvField($v) {
    $s = [string]$v
    if ($s -match '[",\r\n]') { return '"' + $s.Replace('"', '""') + '"' }
    return $s
}
function CsvRow([object[]]$fields) { ($fields | ForEach-Object { CsvField $_ }) -join ',' }
function Inv([object]$value, [string]$format = '0.########') {
    if ($null -eq $value -or ($value -is [string] -and $value.Length -eq 0)) { return '' }
    if ($value -is [System.IFormattable]) { return $value.ToString($format, $InvariantCulture) }
    return [string]$value
}
function Get-FileIdentity([string]$Path, [switch]$WithHash) {
    $item = Get-Item -LiteralPath $Path
    $result = [ordered]@{
        path = $item.FullName
        size_bytes = $item.Length
        last_write_utc = $item.LastWriteTimeUtc.ToString('o', $InvariantCulture)
    }
    if ($WithHash) { $result.sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
    return [pscustomobject]$result
}
function Get-GitHead([string]$Root) {
    try { return (& git -C $Root rev-parse HEAD 2>$null).Trim() } catch { return $null }
}
function Get-HostIdentity {
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    return [ordered]@{
        os_caption = $os.Caption
        os_version = $os.Version
        cpu_name = $cpu.Name
        logical_processors = $cpu.NumberOfLogicalProcessors
        memory_bytes = [int64]$os.TotalVisibleMemorySize * 1KB
    }
}

# --- CSV header ----------------------------------------------------------------
$header = @('timestamp','label','model','n_gen','threads','ctx','prompt_tps','gen_tps',
            'gen_tokens','wall_s','disk_instance','phys_total_MB','phys_pregen_MB',
            'phys_gen_steady_MB','phys_gen_bytes_per_tok','peak_ws_MB','extra_args',
            'status','exit_code','phase_method','first_counter_sample_s','final_counter_sample_s',
            'transient_fraction','sensitivity_bpt','manifest_path')
$expectedHeader = CsvRow $header
if (-not (Test-Path $Csv)) {
    $expectedHeader | Out-File -FilePath $Csv -Encoding utf8
} elseif ((Get-Content -LiteralPath $Csv -TotalCount 1) -ne $expectedHeader) {
    throw "Existing CSV '$Csv' has a different schema. Preserve it and pass a new -Csv path for step0-manifest-v1 results."
}

# --- Single run ----------------------------------------------------------------
function Invoke-OneRun([int]$idx) {
    $coldCacheResult = if ($ColdCache) { Invoke-ColdCache } else { 'not_requested' }

    $stamp   = Get-Date -Format 'yyyyMMdd_HHmmss'
    $logPath = Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("step0_{0}_{1}_{2}.log" -f $Label, $idx, $stamp)
    $samPath = Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("step0_{0}_{1}_{2}.samples.csv" -f $Label, $idx, $stamp)
    $manPath = Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("step0_{0}_{1}_{2}.manifest.json" -f $Label, $idx, $stamp)
    $argsForRun = Build-Args

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $LlamaCli
    $psi.Arguments = ConvertTo-WindowsCommandLine $argsForRun
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
    $firstCounterSampleS = $null
    $samples.Add([pscustomobject]@{ t = 0.0; cum = 0.0 })
    while (-not $proc.HasExited) {
        try {
            $c   = Get-Counter -Counter $diskCounterPath -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop
            $now = Get-Date
            $dt  = ($now - $prev).TotalSeconds
            $cum += [double]$c.CounterSamples[0].CookedValue * $dt
            $prev = $now
            $sampleT = ($now - $t0).TotalSeconds
            $samples.Add([pscustomobject]@{ t = $sampleT; cum = $cum })
            if ($null -eq $firstCounterSampleS) { $firstCounterSampleS = $sampleT }
        } catch { }
        try { $proc.Refresh(); if ($proc.PeakWorkingSet64 -gt $peakWs) { $peakWs = $proc.PeakWorkingSet64 } } catch { }
    }
    $proc.WaitForExit()
    $tEnd = ((Get-Date) - $t0).TotalSeconds
    $exitCode = $proc.ExitCode

    # Take an immediate final sample. Without this the previous 1 s sample can
    # end before process teardown and silently flatten the reconstructed window.
    try {
        $c = Get-Counter -Counter $diskCounterPath -MaxSamples 1 -ErrorAction Stop
        $now = Get-Date
        $dt = ($now - $prev).TotalSeconds
        if ($dt -gt 0) {
            $cum += [double]$c.CounterSamples[0].CookedValue * $dt
            $sampleT = ($now - $t0).TotalSeconds
            $samples.Add([pscustomobject]@{ t = $sampleT; cum = $cum })
            if ($null -eq $firstCounterSampleS) { $firstCounterSampleS = $sampleT }
        }
    } catch { Write-Warning "Final disk-counter sample failed: $($_.Exception.Message)" }

    $stdout = $sbOut.Result; $stderr = $sbErr.Result
    $allLines = ($stdout + "`n" + $stderr) -split "`r?`n"
    # Raw output is evidence for timing parsing and termination behavior; keep it
    # for every run. -KeepLog remains accepted for backward-compatible callers.
    ($stdout + "`n" + $stderr) | Out-File -FilePath $logPath -Encoding utf8

    # Persist per-sample series (audit / post-hoc subtraction).
    ("t_s,cum_bytes") | Out-File -FilePath $samPath -Encoding utf8
    $samples | ForEach-Object { "$(Inv $_.t '0.000'),$(Inv $_.cum '0')" } | Add-Content -Path $samPath

    $t = Parse-Timings $allLines
    if ($exitCode -ne 0) { Write-Warning "llama-cli exited with $exitCode. Failure log: $logPath" }
    if (-not $t.GenTps) { Write-Warning "Could not parse generation tok/s. Check log: $logPath" }

    $genTok = if ($t.GenTok) { [int]$t.GenTok } else { 0 }
    $physTotalB = if ($samples.Count) { [double]$samples[$samples.Count-1].cum } else { 0.0 }
    $physPregenB = $physTotalB
    $physSteadyB = 0.0
    $physGenBpt = $null
    $runStatus = 'provisional_reconstructed'
    $phaseMethod = 'reconstructed_estimate_from_end_and_reported_tps'
    $genDur = if ($t.GenTps -and $t.GenTps -gt 0 -and $genTok -gt 0) { $genTok / [double]$t.GenTps } else { 0.0 }
    $sensitivity = New-Object System.Collections.Generic.List[string]

    if ($ColdCache -and $coldCacheResult -notin @('EmptyStandbyList standbylist', 'RAMMap -Et')) {
        $runStatus = 'cold_cache_failed'
    } elseif ($exitCode -ne 0) {
        $runStatus = 'process_failed'
    } elseif ($genTok -le 0 -or $genDur -le 0 -or $genDur -ge $tEnd) {
        $runStatus = 'timings_unparsed_or_invalid'
    } else {
        $genStart = [math]::Max(0.0, $tEnd - $genDur)
        $physPregenB = Cum-At $samples $genStart
        $primary = Get-SteadyMetric $samples $genStart $tEnd $genTok $TransientFraction
        if ($primary.status -eq 'ok') {
            $physSteadyB = $primary.bytes
            $physGenBpt = $primary.bpt
        } else {
            $runStatus = $primary.status
            Write-Warning "Steady-state metric withheld: $runStatus."
        }
        foreach ($fraction in $SensitivityTransientFractions) {
            $metric = Get-SteadyMetric $samples $genStart $tEnd $genTok $fraction
            $value = if ($metric.status -eq 'ok') { Inv $metric.bpt '0' } else { $metric.status }
            $sensitivity.Add("$(Inv $fraction '0.00'):$value")
        }
        if ($genTok -lt $NGen -and $runStatus -eq 'provisional_reconstructed') {
            $runStatus = 'short_generation'
            Write-Warning "Generation stopped at $genTok of requested $NGen tokens; do not treat this as an equivalent baseline run."
        }
    }

    $sha256 = [Security.Cryptography.SHA256]::Create()
    try { $promptHash = ([BitConverter]::ToString($sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($Prompt)))).Replace('-', '') }
    finally { $sha256.Dispose() }
    $manifest = [ordered]@{
        schema = 'step0-manifest-v1'
        started_at_local = $t0.ToString('o', $InvariantCulture)
        status = $runStatus
        exit_code = $exitCode
        phase_method = $phaseMethod
        git_head = Get-GitHead $repoRoot
        executable = Get-FileIdentity $LlamaCli -WithHash
        model = Get-FileIdentity $ModelPath -WithHash:$HashModel
        prompt_sha256 = $promptHash
        command = @($LlamaCli) + $argsForRun
        disk_instance = $diskInstance
        counter_path = $diskCounterPath
        counter_validation = 'validated_before_launch'
        sample_interval_seconds = 1
        cold_cache_requested = [bool]$ColdCache
        cold_cache_result = $coldCacheResult
        transient_fraction = $TransientFraction
        sensitivity_transient_fractions = $SensitivityTransientFractions
        integration_origin_s = 0.0
        first_counter_sample_s = $firstCounterSampleS
        final_counter_sample_s = $samples[$samples.Count - 1].t
        host = Get-HostIdentity
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manPath -Encoding utf8

    $row = CsvRow @(
        (Get-Date -Format 's'), $Label, [IO.Path]::GetFileName($ModelPath),
        (Inv $NGen '0'), (Inv $Threads '0'), (Inv $CtxSize '0'),
        (Inv $t.PromptTps), (Inv $t.GenTps), (Inv $genTok '0'),
        (Inv $tEnd '0.0'), $diskInstance,
        (Inv ($physTotalB / 1MB) '0.0'),
        (Inv ($physPregenB / 1MB) '0.0'),
        (Inv ($physSteadyB / 1MB) '0.0'),
        (Inv $physGenBpt '0'),
        (Inv ($peakWs / 1MB) '0'),
        ($ExtraArgs -join ' '),
        $runStatus, (Inv $exitCode '0'), $phaseMethod,
        (Inv $firstCounterSampleS '0.000'), (Inv $samples[$samples.Count - 1].t '0.000'),
        (Inv $TransientFraction '0.00'), ($sensitivity -join ';'), $manPath
    )
    Add-Content -Path $Csv -Value $row

    Write-Host ("[{0}] status {1} | gen {2} t/s | steady {3} B/tok | disk total {4} MB (pregen {5}) | peak {6} MB | {7}s" -f `
        $Label, $runStatus, $t.GenTps, $physGenBpt,
        [math]::Round($physTotalB/1MB,1), [math]::Round($physPregenB/1MB,1),
        [math]::Round($peakWs/1MB,0), [math]::Round($tEnd,1))
    return [pscustomobject]@{ status=$runStatus; gen_tps=$t.GenTps; phys_gen_bytes_per_tok=$physGenBpt; manifest_path=$manPath }
}

$runResults = @()
$sessionStamp = Get-Date -Format 'yyyyMMdd_HHmmss'
for ($i = 1; $i -le $Repeat; $i++) {
    Write-Host "--- run $i/$Repeat ---"
    $runResults += Invoke-OneRun $i
}

$valid = @($runResults | Where-Object { $_.status -eq 'provisional_reconstructed' -and $null -ne $_.phys_gen_bytes_per_tok })
$summaryPath = Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("{0}_{1}_{2}.summary.csv" -f [IO.Path]::GetFileNameWithoutExtension($Csv), $Label, $sessionStamp)
$summaryHeader = 'label,n_runs,n_valid,median_gen_tps,min_gen_tps,max_gen_tps,median_phys_gen_bytes_per_tok,min_phys_gen_bytes_per_tok,max_phys_gen_bytes_per_tok,phase_method'
$tps = @($valid | ForEach-Object { [double]$_.gen_tps })
$bpt = @($valid | ForEach-Object { [double]$_.phys_gen_bytes_per_tok })
$summary = CsvRow @(
    $Label, (Inv $runResults.Count '0'), (Inv $valid.Count '0'),
    (Inv (Get-Median $tps)), (Inv (($tps | Measure-Object -Minimum).Minimum)), (Inv (($tps | Measure-Object -Maximum).Maximum)),
    (Inv (Get-Median $bpt) '0'), (Inv (($bpt | Measure-Object -Minimum).Minimum) '0'), (Inv (($bpt | Measure-Object -Maximum).Maximum) '0'),
    'reconstructed_estimate_from_end_and_reported_tps'
)
$summaryHeader | Out-File -FilePath $summaryPath -Encoding utf8
$summary | Add-Content -Path $summaryPath

Write-Host ""
Write-Host "Done. Results: $Csv"
Write-Host "Per-sample series: step0_<label>_<run>_<ts>.samples.csv (for slope audit / subtraction)."
Write-Host "Repeat summary (valid provisional runs only): $summaryPath"
if ($valid.Count -ne $runResults.Count) {
    $statuses = ($runResults | ForEach-Object { $_.status }) -join ', '
    throw "One or more Step0 runs are not valid provisional measurements: $statuses. Evidence was preserved in the CSV, manifests, and logs."
}
