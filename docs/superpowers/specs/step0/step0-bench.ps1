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
            drive>), not _Total, to cut cross-drive noise. _Total is available
            only through an explicit smoke-test opt-in.
      - B2: disk counter is sampled with timestamps into a cumulative time series.
            The generation window is derived from llama's own gen tok/s +
            reported eval-run count; the STEADY slope (dropping the first 30% as the
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
    [string]$CachePolicy = "unspecified",
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

    # Diagnostic-only low-overhead CLI timing sidecar. Keep separate from the
    # authoritative three-run summary until the target overhead A/B passes.
    [switch]$TokenTiming,

    # Explicit evidence labeling for warm-up, ETW, smoke, and other diagnostic
    # invocations. TokenTiming implies this automatically, but other diagnostic
    # wrappers must opt in rather than relying on a descriptive label.
    [switch]$NonAuthoritative,
    [string]$NonAuthoritativeReason = 'diagnostic_or_warmup',

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
if ($TokenTiming -and $NGen -lt 2) {
    throw '-TokenTiming requires NGen >= 2 so at least one generated decode interval exists.'
}
$authoritativeSummaryEligible = -not ([bool]$TokenTiming -or [bool]$NonAuthoritative)
if (-not $authoritativeSummaryEligible -and [string]::IsNullOrWhiteSpace($NonAuthoritativeReason)) {
    throw 'Non-authoritative evidence requires a non-empty -NonAuthoritativeReason.'
}

# --- Resolve llama-cli ---------------------------------------------------------
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..") -ErrorAction SilentlyContinue
if (-not $LlamaCli) {
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
if ($diskInstance -eq '_Total' -and -not $AllowTotalDiskFallback) {
    throw "PhysicalDisk(_Total) is machine-wide and is forbidden for an authoritative run. Pass -AllowTotalDiskFallback only for a non-production smoke run."
}
$diskCounterPath = "\PhysicalDisk($diskInstance)\Disk Read Bytes/sec"
try { Get-Counter -Counter $diskCounterPath -MaxSamples 1 -ErrorAction Stop | Out-Null }
catch { throw "Disk counter '$diskCounterPath' is not available. Pass a valid -DiskInstance from Get-Counter '\PhysicalDisk(*)\Disk Read Bytes/sec'." }

# Keep the physical-read counter authoritative, but collect the other diagnostics
# in the same PDH query so their timestamps are comparable and the sampler does
# not add one second of blocking per counter. Auxiliary counters are fail-soft:
# unsupported paths are omitted and bad samples become empty fields.
$auxCounterPaths = [ordered]@{
    disk_avg_sec_read                 = "\PhysicalDisk($diskInstance)\Avg. Disk sec/Read"
    disk_avg_read_queue               = "\PhysicalDisk($diskInstance)\Avg. Disk Read Queue Length"
    disk_reads_per_sec                = "\PhysicalDisk($diskInstance)\Disk Reads/sec"
    disk_avg_bytes_read               = "\PhysicalDisk($diskInstance)\Avg. Disk Bytes/Read"
    mem_available_bytes               = '\Memory\Available Bytes'
    mem_committed_bytes               = '\Memory\Committed Bytes'
    mem_pages_input_per_sec           = '\Memory\Pages Input/sec'
    cpu_actual_mhz                    = '\Processor Information(_Total)\Actual Frequency'
    cpu_processor_performance_pct     = '\Processor Information(_Total)\% Processor Performance'
}
function Test-FiniteNonnegative([object]$Value) {
    if ($null -eq $Value) { return $false }
    $d = [double]$Value
    return -not [double]::IsNaN($d) -and -not [double]::IsInfinity($d) -and $d -ge 0.0
}
function Find-CounterSample($CounterResult, [string]$Path) {
    $suffix = $Path.ToLowerInvariant()
    return $CounterResult.CounterSamples | Where-Object {
        $_.Path -and $_.Path.ToLowerInvariant().EndsWith($suffix)
    } | Select-Object -First 1
}

$counterAvailability = [ordered]@{}
$availableAuxCounterPaths = New-Object System.Collections.Generic.List[string]
foreach ($entry in $auxCounterPaths.GetEnumerator()) {
    $available = $false
    $errorText = $null
    try {
        $probe = Get-Counter -Counter $entry.Value -MaxSamples 1 -ErrorAction Stop
        $sample = Find-CounterSample $probe $entry.Value
        if ($null -ne $sample -and $sample.Status -eq 0 -and (Test-FiniteNonnegative $sample.CookedValue)) {
            $available = $true
            $availableAuxCounterPaths.Add($entry.Value)
        } else {
            $errorText = 'probe returned a missing, bad-status, or non-finite sample'
        }
    } catch { $errorText = $_.Exception.Message }
    $counterAvailability[$entry.Key] = [ordered]@{
        path = $entry.Value
        available = $available
        probe_error = $errorText
    }
}
$sampleCounterPaths = @($diskCounterPath) + @($availableAuxCounterPaths)

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
function Build-Args([string]$TokenTimingPath) {
    for ($i = 0; $i -lt $ExtraArgs.Count; $i++) {
        $arg = $ExtraArgs[$i]
        if ($arg -match '^(?:--no-mmap|--moe-trace(?:=|$)|--token-timing(?:=|$)|-rtr(?:=|$)|--run-time-repack(?:=|$)|-rtra(?:=|$)|--run-time-repack-auto(?:=|$)|-muge(?:=|$)|--merge-up-gate-experts(?:=|$))') {
            throw "Step0 controls mmap/repack and diagnostic modes explicitly. This passthrough option is forbidden: $arg"
        }
        if ($arg -match '^(?:-ngl|--gpu-layers|--n-gpu-layers)=(.+)$') {
            if ($Matches[1] -ne '0') { throw "Step0 baseline is CPU-only. Do not override $($ExtraArgs[$i]) with a non-zero value." }
        } elseif ($arg -in @('-ngl', '--gpu-layers', '--n-gpu-layers')) {
            if (($i + 1) -ge $ExtraArgs.Count -or $ExtraArgs[$i + 1] -ne '0') {
                throw "Step0 baseline is CPU-only. Do not override $($ExtraArgs[$i]) with a non-zero value."
            }
        }
    }
    $a = @('-m', $ModelPath, '-c', "$CtxSize", '-n', "$NGen", '-p', $Prompt,
           '--no-display-prompt', '--seed', '42', '-ngl', '0')
    if ($Threads -gt 0) { $a += @('-t', "$Threads") }
    if ($TokenTimingPath) { $a += @('--token-timing', $TokenTimingPath) }
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
    $r = [ordered]@{ PromptTps=$null; GenTps=$null; PromptTok=$null; EvalRuns=$null }
    foreach ($ln in $lines) {
        if ($ln -match 'prompt eval time\s*=\s*[\d.]+\s*ms\s*/\s*(\d+)\s*tokens.*?([\d.]+)\s*tokens per second') {
            $r.PromptTok = [int]$Matches[1]; $r.PromptTps = [double]$Matches[2]
        }
        elseif ($ln -match '(^|\s)eval time\s*=\s*[\d.]+\s*ms\s*/\s*(\d+)\s*(runs|tokens).*?([\d.]+)\s*tokens per second') {
            # Two different lines can match here, and they count different things.
            #   "runs"   - llama_print_timings, prints ctx->n_eval directly.
            #   "tokens" - main.cpp own summary (upstream 0a415bde, 2026-07-06),
            #              prints n_decoded. The first generated token comes out
            #              of the prompt batch, which increments n_p_eval and not
            #              n_eval, so n_eval = n_decoded - 1.
            # That commit also made llama_print_timings conditional, so on a
            # normal generation the "runs" line is not emitted at all.
            $parsed = [int]$Matches[2]
            $r.EvalRuns = if ($Matches[3] -eq 'runs') { $parsed } else { [math]::Max(0, $parsed - 1) }
            $r.GenTps = [double]$Matches[4]
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

function Get-SteadyMetric($samples, [double]$genStart, [double]$genEnd, [int]$evalRuns, [double]$fraction) {
    if ($samples.Count -lt 3) { return [pscustomobject]@{ status='insufficient_samples'; bytes=0.0; bpt=$null } }
    # This is B2 integration of a device-level rate counter. It is not proof of
    # exact phase coverage; only future live phase markers/ETW can establish B3.
    $steadyStart = $genStart + $fraction * ($genEnd - $genStart)
    $steadyDur = $genEnd - $steadyStart
    $steadyTok = $evalRuns * ($steadyDur / ($genEnd - $genStart))
    if ($steadyTok -le 0) { return [pscustomobject]@{ status='invalid_window'; bytes=0.0; bpt=$null } }
    $bytes = (Cum-At $samples $genEnd) - (Cum-At $samples $steadyStart)
    return [pscustomobject]@{ status='ok'; bytes=$bytes; bpt=[math]::Round($bytes / $steadyTok, 0) }
}
function Convert-UnixMicroseconds([int64]$value) {
    $milliseconds = [int64][math]::Floor($value / 1000.0)
    $remainderUs = $value - $milliseconds * 1000
    return [DateTimeOffset]::FromUnixTimeMilliseconds($milliseconds).AddTicks($remainderUs * 10)
}
function Read-TokenTiming(
    [string]$Path, [int]$ReportedEvalRuns, [DateTime]$HarnessStart,
    [double]$ProcessElapsedSeconds, [string]$ExpectedModelPath
) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Token timing sidecar was not published: $Path" }
    $records = @(Get-Content -LiteralPath $Path | Where-Object { $_.Trim() } | ForEach-Object { $_ | ConvertFrom-Json })
    if ($records.Count -lt 3 -or $records[0].type -ne 'header' -or $records[-1].type -ne 'end') {
        throw 'Token timing sidecar has no valid header/interval/footer sequence.'
    }
    $header = $records[0]
    $footer = $records[-1]
    $intervals = @($records[1..($records.Count - 2)])
    if ($header.version -ne 1 -or $header.clock -ne 'monotonic_us' -or -not $footer.complete) {
        throw 'Token timing sidecar version/clock/completion is invalid.'
    }
    $recordedModel = [IO.Path]::GetFullPath([string]$header.model_path)
    $expectedModel = [IO.Path]::GetFullPath($ExpectedModelPath)
    if (-not $recordedModel.Equals($expectedModel, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Token timing model identity mismatch: '$recordedModel' != '$expectedModel'."
    }
    if ([int64]$footer.intervals -ne $intervals.Count -or
        [int64]$footer.generated_tokens -ne ($intervals.Count + 1) -or
        [int64]$footer.n_eval -ne $intervals.Count -or
        [int64]$footer.llama_reported_n_eval -ne $ReportedEvalRuns -or
        $intervals.Count -ne $ReportedEvalRuns) {
        throw 'Token timing footer counts do not match the CLI reported eval runs.'
    }
    $previousReady = $null
    $firstReadyOffsetUs = $null
    for ($i = 0; $i -lt $intervals.Count; $i++) {
        $item = $intervals[$i]
        if ($item.type -ne 'interval' -or [int64]$item.index -ne $i -or
            -not (Test-FiniteNonnegative $item.ready_offset_us) -or
            -not (Test-FiniteNonnegative $item.inter_ready_us) -or [double]$item.inter_ready_us -le 0 -or
            -not (Test-FiniteNonnegative $item.eval_us) -or
            -not (Test-FiniteNonnegative $item.sample_us)) {
            throw "Invalid token timing interval at index $i."
        }
        $ready = [int64]$item.ready_offset_us
        $interReady = [int64]$item.inter_ready_us
        $intervalStart = $ready - $interReady
        if ($i -eq 0) {
            $firstReadyOffsetUs = $intervalStart
        } else {
            if ($intervalStart -ne $previousReady) {
                throw "Broken token timing interval chain at index $i."
            }
            if ([int64]$item.input_token_id -ne [int64]$intervals[$i - 1].output_token_id) {
                throw "Broken token timing input/output token chain at index $i."
            }
        }
        if ($null -ne $previousReady -and $ready -le $previousReady) {
            throw "Non-monotonic token timing ready offset at index $i."
        }
        $previousReady = $ready
    }
    if ($firstReadyOffsetUs -lt 0) { throw 'Token timing first-ready offset precedes its monotonic anchor.' }
    $anchorUtc = Convert-UnixMicroseconds ([int64]$header.anchor_utc_unix_us)
    $anchorElapsedS = ($anchorUtc.UtcDateTime - $HarnessStart.ToUniversalTime()).TotalSeconds
    $firstReadyElapsedS = $anchorElapsedS + $firstReadyOffsetUs / 1000000.0
    $lastReadyElapsedS = $anchorElapsedS + [int64]$intervals[-1].ready_offset_us / 1000000.0
    if ($firstReadyElapsedS -lt 0 -or $lastReadyElapsedS -le $firstReadyElapsedS -or
        $lastReadyElapsedS -gt $ProcessElapsedSeconds) {
        throw "Token timing window [$firstReadyElapsedS, $lastReadyElapsedS] is outside process elapsed [0, $ProcessElapsedSeconds]."
    }
    return [pscustomobject]@{
        path = $Path
        header = $header
        footer = $footer
        intervals = $intervals
        anchor_elapsed_s = $anchorElapsedS
        first_ready_offset_us = $firstReadyOffsetUs
        first_ready_elapsed_s = $firstReadyElapsedS
        last_ready_elapsed_s = $lastReadyElapsedS
    }
}
function Get-TimedSteadyMetric($samples, $timing, [double]$fraction) {
    $count = $timing.intervals.Count
    if ($samples.Count -lt 3 -or $count -le 0) {
        return [pscustomobject]@{ status='insufficient_samples'; bytes=0.0; bpt=$null; start=$null; end=$null; intervals=0 }
    }
    $drop = [int][math]::Floor($count * $fraction)
    if ($drop -ge $count) { $drop = $count - 1 }
    $start = if ($drop -eq 0) {
        [double]$timing.first_ready_elapsed_s
    } else {
        [double]$timing.anchor_elapsed_s + [int64]$timing.intervals[$drop - 1].ready_offset_us / 1000000.0
    }
    $end = [double]$timing.last_ready_elapsed_s
    $remaining = $count - $drop
    if ($start -lt 0 -or $end -le $start -or $remaining -le 0) {
        return [pscustomobject]@{ status='invalid_token_timing_window'; bytes=0.0; bpt=$null; start=$start; end=$end; intervals=$remaining }
    }
    $bytes = (Cum-At $samples $end) - (Cum-At $samples $start)
    return [pscustomobject]@{ status='ok'; bytes=$bytes; bpt=[math]::Round($bytes / $remaining, 0); start=$start; end=$end; intervals=$remaining }
}
function Get-TokenTimingStats($timing) {
    if ($null -eq $timing) { return $null }
    $inter = @($timing.intervals | ForEach-Object { [double]$_.inter_ready_us / 1000.0 })
    $eval = @($timing.intervals | ForEach-Object { [double]$_.eval_us / 1000.0 })
    $sample = @($timing.intervals | ForEach-Object { [double]$_.sample_us / 1000.0 })
    return [ordered]@{
        semantics = 'diagnostic CLI-ready cadence; inter_ready includes loop/output plus eval and sampling'
        interval_count = $timing.intervals.Count
        inter_ready_ms = [ordered]@{ p50=Get-Percentile $inter 50; p95=Get-Percentile $inter 95; p99=Get-Percentile $inter 99; max=Get-Maximum $inter }
        eval_ms = [ordered]@{ p50=Get-Percentile $eval 50; p95=Get-Percentile $eval 95; p99=Get-Percentile $eval 99; max=Get-Maximum $eval }
        sample_ms = [ordered]@{ p50=Get-Percentile $sample 50; p95=Get-Percentile $sample 95; p99=Get-Percentile $sample 99; max=Get-Maximum $sample }
    }
}
function Get-Median([double[]]$values) {
    if ($values.Count -eq 0) { return $null }
    $sorted = @($values | Sort-Object)
    $middle = [int]($sorted.Count / 2)
    if (($sorted.Count % 2) -eq 1) { return $sorted[$middle] }
    return ($sorted[$middle - 1] + $sorted[$middle]) / 2.0
}
function Get-Percentile([double[]]$values, [double]$percentile) {
    if ($values.Count -eq 0) { return $null }
    $sorted = @($values | Sort-Object)
    if ($sorted.Count -eq 1) { return [double]$sorted[0] }
    $position = ($percentile / 100.0) * ($sorted.Count - 1)
    $lower = [math]::Floor($position)
    $upper = [math]::Ceiling($position)
    if ($lower -eq $upper) { return [double]$sorted[$lower] }
    $weight = $position - $lower
    return [double]$sorted[$lower] + $weight * ([double]$sorted[$upper] - [double]$sorted[$lower])
}
function Get-Values($samples, [string]$property) {
    return @($samples | ForEach-Object {
        $value = $_.$property
        if (Test-FiniteNonnegative $value) { [double]$value }
    })
}
function Get-Minimum([double[]]$values) {
    if ($values.Count -eq 0) { return $null }
    return ($values | Measure-Object -Minimum).Minimum
}
function Get-Maximum([double[]]$values) {
    if ($values.Count -eq 0) { return $null }
    return ($values | Measure-Object -Maximum).Maximum
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
function Divide-OrNull([object]$value, [double]$divisor) {
    if ($null -eq $value) { return $null }
    return [double]$value / $divisor
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
function Get-ModelIdentity([string]$Path, [switch]$WithHash) {
    $entry = Get-Item -LiteralPath $Path
    $files = @($entry.FullName)
    if ($entry.Name -match '^(?<stem>.+)-(?<index>\d{5})-of-(?<count>\d{5})\.gguf$') {
        $count = [int]$Matches['count']
        $stem = $Matches['stem']
        $files = for ($i = 1; $i -le $count; $i++) {
            $candidate = Join-Path $entry.DirectoryName ("{0}-{1:D5}-of-{2:D5}.gguf" -f $stem, $i, $count)
            if (-not (Test-Path -LiteralPath $candidate)) { throw "Missing canonical model shard: $candidate" }
            (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    $shards = @($files | ForEach-Object { Get-FileIdentity $_ -WithHash:$WithHash })
    return [pscustomobject][ordered]@{
        entry_path = $entry.FullName
        shard_count = $shards.Count
        total_size_bytes = [int64](($shards | Measure-Object -Property size_bytes -Sum).Sum)
        shards = $shards
    }
}
function Get-GitHead([string]$Root) {
    try { return (& git -C $Root rev-parse HEAD 2>$null).Trim() } catch { return $null }
}
function Get-HostIdentity([string]$TargetModelPath) {
    $result = [ordered]@{ probe_errors = [ordered]@{} }
    try {
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
        $result.os_caption = $os.Caption
        $result.os_version = $os.Version
        $result.memory_bytes = [int64]$os.TotalVisibleMemorySize * 1KB
    } catch { $result.probe_errors.operating_system = $_.Exception.Message }
    try {
        $cpus = @(Get-CimInstance Win32_Processor -ErrorAction Stop)
        $physical = @($cpus).Count
        $cores = [int](($cpus | Measure-Object -Property NumberOfCores -Sum).Sum)
        $logical = [int](($cpus | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum)
        $result.cpu_names = @($cpus | ForEach-Object { $_.Name })
        $result.physical_processor_packages = $physical
        $result.physical_cores = $cores
        $result.logical_processors = $logical
        $result.logical_to_core_ratio = if ($cores -gt 0) { $logical / [double]$cores } else { $null }
    } catch { $result.probe_errors.processors = $_.Exception.Message }
    try {
        $result.dimms = @(Get-CimInstance Win32_PhysicalMemory -ErrorAction Stop | ForEach-Object {
            [ordered]@{
                device_locator = $_.DeviceLocator
                capacity_bytes = [int64]$_.Capacity
                speed_mts = $_.Speed
                configured_clock_mts = $_.ConfiguredClockSpeed
                manufacturer = $_.Manufacturer
                part_number = if ($_.PartNumber) { $_.PartNumber.Trim() } else { $null }
            }
        })
    } catch { $result.probe_errors.dimms = $_.Exception.Message }
    try {
        $result.pagefiles = @(Get-CimInstance Win32_PageFileUsage -ErrorAction Stop | ForEach-Object {
            [ordered]@{
                path = $_.Name
                allocated_mb = $_.AllocatedBaseSize
                current_usage_mb = $_.CurrentUsage
                peak_usage_mb = $_.PeakUsage
            }
        })
        $result.pagefile_snapshot_utc = [DateTime]::UtcNow.ToString('o', $InvariantCulture)
    } catch { $result.probe_errors.pagefiles = $_.Exception.Message }
    try {
        $result.storage_inventory = @(Get-CimInstance Win32_DiskDrive -ErrorAction Stop | ForEach-Object {
            [ordered]@{
                index = $_.Index
                model = $_.Model
                serial_number = if ($_.SerialNumber) { $_.SerialNumber.Trim() } else { $null }
                firmware_revision = $_.FirmwareRevision
                interface_type = $_.InterfaceType
                media_type = $_.MediaType
                size_bytes = [int64]$_.Size
            }
        })
    } catch { $result.probe_errors.storage_inventory = $_.Exception.Message }
    try {
        $root = [IO.Path]::GetPathRoot($TargetModelPath).TrimEnd('\')
        $logicalDisk = Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='{0}'" -f $root.Replace("'", "''")) -ErrorAction Stop
        if ($logicalDisk) {
            $partition = Get-CimAssociatedInstance -InputObject $logicalDisk -Association Win32_LogicalDiskToPartition -ErrorAction Stop | Select-Object -First 1
            $drive = if ($partition) { Get-CimAssociatedInstance -InputObject $partition -Association Win32_DiskDriveToDiskPartition -ErrorAction Stop | Select-Object -First 1 } else { $null }
            $result.model_drive_resolution = [ordered]@{
                model_root = $root
                disk_index = if ($drive) { $drive.Index } else { $null }
                disk_model = if ($drive) { $drive.Model } else { $null }
                disk_serial_number = if ($drive -and $drive.SerialNumber) { $drive.SerialNumber.Trim() } else { $null }
                disk_firmware_revision = if ($drive) { $drive.FirmwareRevision } else { $null }
                status = if ($drive) { 'resolved' } else { 'unresolved' }
            }
        } else { throw "No Win32_LogicalDisk for model root '$root'" }
    } catch {
        $result.model_drive_resolution = [ordered]@{ model_root = [IO.Path]::GetPathRoot($TargetModelPath); status = 'unavailable' }
        $result.probe_errors.model_drive_resolution = $_.Exception.Message
    }
    try {
        $powerPlan = (& powercfg.exe /getactivescheme 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) { throw "powercfg exited with $LASTEXITCODE`: $powerPlan" }
        $guid = if ($powerPlan -match '[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}') { $Matches[0] } else { $null }
        $result.active_power_plan = [ordered]@{ raw = $powerPlan; guid = $guid }
    } catch { $result.probe_errors.active_power_plan = $_.Exception.Message }
    return $result
}

$hostIdentity = Get-HostIdentity $ModelPath

# --- CSV header ----------------------------------------------------------------
$header = @('timestamp','label','model','n_gen','threads','ctx','prompt_tps','gen_tps',
            'eval_runs','wall_s','disk_instance','phys_total_MB','phys_pregen_MB',
            'phys_gen_steady_MB','phys_gen_bytes_per_tok','peak_ws_MB','extra_args',
            'status','exit_code','phase_method','first_counter_sample_s','final_counter_sample_s',
            'transient_fraction','sensitivity_bpt','cache_policy','process_id',
            'median_process_cpu_pct_host','max_process_cpu_pct_host','max_sampled_private_MB',
            'active_disk_samples','median_sampled_interval_avg_read_latency_ms',
            'p95_sampled_interval_avg_read_latency_ms','max_sampled_interval_avg_read_queue',
            'median_disk_reads_per_sec','min_available_memory_MB','max_committed_memory_MB',
            'median_cpu_actual_mhz','min_cpu_actual_mhz','median_cpu_performance_pct',
            'authoritative_summary_eligible','token_timing_path',
            'inter_ready_ms_p50','inter_ready_ms_p95','inter_ready_ms_p99',
            'eval_ms_p50','eval_ms_p95','eval_ms_p99',
            'sample_ms_p50','sample_ms_p95','sample_ms_p99',
            'manifest_path')
$expectedHeader = CsvRow $header
if (-not (Test-Path $Csv)) {
    $expectedHeader | Out-File -FilePath $Csv -Encoding utf8
} elseif ((Get-Content -LiteralPath $Csv -TotalCount 1) -ne $expectedHeader) {
    throw "Existing CSV '$Csv' has a different schema. Preserve it and pass a new -Csv path for step0-manifest-v2 results."
}

# --- Single run ----------------------------------------------------------------
function Invoke-OneRun([int]$idx) {
    $coldCacheResult = if ($ColdCache) { Invoke-ColdCache } else { 'not_requested' }

    $stamp   = Get-Date -Format 'yyyyMMdd_HHmmss'
    $logPath = Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("step0_{0}_{1}_{2}.log" -f $Label, $idx, $stamp)
    $samPath = Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("step0_{0}_{1}_{2}.samples.csv" -f $Label, $idx, $stamp)
    $manPath = Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("step0_{0}_{1}_{2}.manifest.json" -f $Label, $idx, $stamp)
    $tokPath = if ($TokenTiming) { Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("step0_{0}_{1}_{2}.token-timing.ndjson" -f $Label, $idx, $stamp) } else { $null }
    $argsForRun = Build-Args $tokPath

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $LlamaCli
    $psi.Arguments = ConvertTo-WindowsCommandLine $argsForRun
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute        = $false

    $t0   = Get-Date
    $proc = [System.Diagnostics.Process]::Start($psi)
    $processId = $proc.Id
    $processStartUtc = try { $proc.StartTime.ToUniversalTime().ToString('o', $InvariantCulture) } catch { $t0.ToUniversalTime().ToString('o', $InvariantCulture) }
    $sbOut = $proc.StandardOutput.ReadToEndAsync()
    $sbErr = $proc.StandardError.ReadToEndAsync()
    # Establish a real cumulative CPU baseline promptly after launch. Assuming
    # zero here would attribute an arbitrary launch-to-first-sample slice using
    # an imprecise wall-clock origin.
    $initialProcCpuSeconds = 0.0
    $initialProcSampleT = ((Get-Date) - $t0).TotalSeconds
    $initialProcWs = $null
    $initialProcPrivate = $null
    try {
        $proc.Refresh()
        $initialProcCpuSeconds = $proc.TotalProcessorTime.TotalSeconds
        $initialProcWs = $proc.WorkingSet64
        $initialProcPrivate = $proc.PrivateMemorySize64
        $initialProcSampleT = ((Get-Date) - $t0).TotalSeconds
    } catch { }

    # Timestamped cumulative disk-read series (rate integrated over real dt).
    $samples = New-Object System.Collections.Generic.List[object]
    $cum = 0.0
    $peakWs = 0L
    $prev = Get-Date
    $firstCounterSampleS = $null
    $counterSamplingFailed = $false
    $counterErrors = New-Object System.Collections.Generic.List[string]
    $auxRuntimeIssues = [ordered]@{}
    foreach ($name in $auxCounterPaths.Keys) { $auxRuntimeIssues[$name] = 0 }
    $logicalCpuCount = if ($hostIdentity.logical_processors -and $hostIdentity.logical_processors -gt 0) {
        [int]$hostIdentity.logical_processors
    } else { [Environment]::ProcessorCount }
    $prevProcCpuSeconds = $initialProcCpuSeconds
    $prevProcSampleT = $initialProcSampleT
    if ($null -ne $initialProcWs) { $peakWs = [int64]$initialProcWs }
    $peakPrivate = if ($null -ne $initialProcPrivate) { [int64]$initialProcPrivate } else { 0L }
    $samples.Add([pscustomobject][ordered]@{
        t = 0.0; cum = 0.0; disk_read_bytes_per_sec = $null
        disk_avg_sec_read = $null; disk_avg_read_queue = $null
        disk_reads_per_sec = $null; disk_avg_bytes_read = $null
        mem_available_bytes = $null; mem_committed_bytes = $null
        mem_pages_input_per_sec = $null; cpu_actual_mhz = $null
        cpu_processor_performance_pct = $null; process_cpu_seconds = $initialProcCpuSeconds
        process_cpu_pct_host = $null; process_working_set_bytes = $initialProcWs
        process_private_bytes = $initialProcPrivate
    })
    while (-not $proc.HasExited) {
        try {
            $c   = Get-Counter -Counter $sampleCounterPaths -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop
            $now = Get-Date
            $primarySample = Find-CounterSample $c $diskCounterPath
            if ($null -eq $primarySample -or $primarySample.Status -ne 0 -or -not (Test-FiniteNonnegative $primarySample.CookedValue)) {
                throw "Primary disk counter returned a missing, bad-status, or non-finite sample."
            }
            $dt  = ($now - $prev).TotalSeconds
            $primaryRate = [double]$primarySample.CookedValue
            $cum += $primaryRate * $dt
            $prev = $now
            $sampleT = ($now - $t0).TotalSeconds
            $values = [ordered]@{}
            foreach ($entry in $auxCounterPaths.GetEnumerator()) {
                $value = $null
                if ($counterAvailability[$entry.Key].available) {
                    $sample = Find-CounterSample $c $entry.Value
                    if ($null -ne $sample -and $sample.Status -eq 0 -and (Test-FiniteNonnegative $sample.CookedValue)) {
                        $value = [double]$sample.CookedValue
                    } else { $auxRuntimeIssues[$entry.Key] = [int]$auxRuntimeIssues[$entry.Key] + 1 }
                }
                $values[$entry.Key] = $value
            }
            $procCpuSeconds = $null
            $procCpuPctHost = $null
            $procWs = $null
            $procPrivate = $null
            try {
                $proc.Refresh()
                $procCpuSeconds = $proc.TotalProcessorTime.TotalSeconds
                $procWs = $proc.WorkingSet64
                $procPrivate = $proc.PrivateMemorySize64
                $procDt = $sampleT - $prevProcSampleT
                if ($procDt -gt 0 -and $logicalCpuCount -gt 0) {
                    $procCpuPctHost = 100.0 * ($procCpuSeconds - $prevProcCpuSeconds) / $procDt / $logicalCpuCount
                    if (-not (Test-FiniteNonnegative $procCpuPctHost)) { $procCpuPctHost = $null }
                }
                $prevProcCpuSeconds = $procCpuSeconds
                $prevProcSampleT = $sampleT
                if ($procWs -gt $peakWs) { $peakWs = $procWs }
                if ($procPrivate -gt $peakPrivate) { $peakPrivate = $procPrivate }
            } catch { }
            $samples.Add([pscustomobject][ordered]@{
                t = $sampleT; cum = $cum; disk_read_bytes_per_sec = $primaryRate
                disk_avg_sec_read = $values.disk_avg_sec_read
                disk_avg_read_queue = $values.disk_avg_read_queue
                disk_reads_per_sec = $values.disk_reads_per_sec
                disk_avg_bytes_read = $values.disk_avg_bytes_read
                mem_available_bytes = $values.mem_available_bytes
                mem_committed_bytes = $values.mem_committed_bytes
                mem_pages_input_per_sec = $values.mem_pages_input_per_sec
                cpu_actual_mhz = $values.cpu_actual_mhz
                cpu_processor_performance_pct = $values.cpu_processor_performance_pct
                process_cpu_seconds = $procCpuSeconds
                process_cpu_pct_host = $procCpuPctHost
                process_working_set_bytes = $procWs
                process_private_bytes = $procPrivate
            })
            if ($null -eq $firstCounterSampleS) { $firstCounterSampleS = $sampleT }
        } catch {
            $counterSamplingFailed = $true
            $counterErrors.Add($_.Exception.Message)
            # Never apply a later one-second rate to a multi-second gap.
            $prev = Get-Date
        }
        try { $proc.Refresh(); if ($proc.PeakWorkingSet64 -gt $peakWs) { $peakWs = $proc.PeakWorkingSet64 } } catch { }
    }
    $proc.WaitForExit()
    $tEnd = ((Get-Date) - $t0).TotalSeconds
    $processEndUtc = try { $proc.ExitTime.ToUniversalTime().ToString('o', $InvariantCulture) } catch { [DateTime]::UtcNow.ToString('o', $InvariantCulture) }
    $exitCode = $proc.ExitCode

    # Take a final rate sample. Get-Counter may itself span about one second, so
    # this can extend past process exit; the key metric interpolates at tEnd and
    # remains explicitly a reconstructed device-level estimate.
    try {
        $c = Get-Counter -Counter $sampleCounterPaths -MaxSamples 1 -ErrorAction Stop
        $now = Get-Date
        $primarySample = Find-CounterSample $c $diskCounterPath
        if ($null -eq $primarySample -or $primarySample.Status -ne 0 -or -not (Test-FiniteNonnegative $primarySample.CookedValue)) {
            throw "Final primary disk counter returned a missing, bad-status, or non-finite sample."
        }
        $dt = ($now - $prev).TotalSeconds
        if ($dt -gt 0) {
            $primaryRate = [double]$primarySample.CookedValue
            $cum += $primaryRate * $dt
            $sampleT = ($now - $t0).TotalSeconds
            $values = [ordered]@{}
            foreach ($entry in $auxCounterPaths.GetEnumerator()) {
                $value = $null
                if ($counterAvailability[$entry.Key].available) {
                    $sample = Find-CounterSample $c $entry.Value
                    if ($null -ne $sample -and $sample.Status -eq 0 -and (Test-FiniteNonnegative $sample.CookedValue)) {
                        $value = [double]$sample.CookedValue
                    } else { $auxRuntimeIssues[$entry.Key] = [int]$auxRuntimeIssues[$entry.Key] + 1 }
                }
                $values[$entry.Key] = $value
            }
            $samples.Add([pscustomobject][ordered]@{
                t = $sampleT; cum = $cum; disk_read_bytes_per_sec = $primaryRate
                disk_avg_sec_read = $values.disk_avg_sec_read
                disk_avg_read_queue = $values.disk_avg_read_queue
                disk_reads_per_sec = $values.disk_reads_per_sec
                disk_avg_bytes_read = $values.disk_avg_bytes_read
                mem_available_bytes = $values.mem_available_bytes
                mem_committed_bytes = $values.mem_committed_bytes
                mem_pages_input_per_sec = $values.mem_pages_input_per_sec
                cpu_actual_mhz = $values.cpu_actual_mhz
                cpu_processor_performance_pct = $values.cpu_processor_performance_pct
                process_cpu_seconds = $null; process_cpu_pct_host = $null
                process_working_set_bytes = $null; process_private_bytes = $null
            })
            if ($null -eq $firstCounterSampleS) { $firstCounterSampleS = $sampleT }
        }
    } catch {
        $counterSamplingFailed = $true
        $counterErrors.Add($_.Exception.Message)
        Write-Warning "Final disk-counter sample failed: $($_.Exception.Message)"
    }

    $stdout = $sbOut.Result; $stderr = $sbErr.Result
    $allLines = ($stdout + "`n" + $stderr) -split "`r?`n"
    # Raw output is evidence for timing parsing and termination behavior; keep it
    # for every run. -KeepLog remains accepted for backward-compatible callers.
    ($stdout + "`n" + $stderr) | Out-File -FilePath $logPath -Encoding utf8

    # Persist per-sample series (audit / post-hoc subtraction).
    $sampleHeader = @('t_s','cum_bytes','disk_read_bytes_per_sec','disk_avg_sec_read',
        'disk_avg_read_queue','disk_reads_per_sec','disk_avg_bytes_read',
        'mem_available_bytes','mem_committed_bytes','mem_pages_input_per_sec',
        'cpu_actual_mhz','cpu_processor_performance_pct','process_cpu_seconds',
        'process_cpu_pct_host','process_working_set_bytes','process_private_bytes')
    (CsvRow $sampleHeader) | Out-File -FilePath $samPath -Encoding utf8
    $samples | ForEach-Object {
        CsvRow @(
            (Inv $_.t '0.000'), (Inv $_.cum '0'), (Inv $_.disk_read_bytes_per_sec '0.0'),
            (Inv $_.disk_avg_sec_read '0.########'), (Inv $_.disk_avg_read_queue),
            (Inv $_.disk_reads_per_sec), (Inv $_.disk_avg_bytes_read '0'),
            (Inv $_.mem_available_bytes '0'), (Inv $_.mem_committed_bytes '0'),
            (Inv $_.mem_pages_input_per_sec), (Inv $_.cpu_actual_mhz),
            (Inv $_.cpu_processor_performance_pct), (Inv $_.process_cpu_seconds),
            (Inv $_.process_cpu_pct_host), (Inv $_.process_working_set_bytes '0'),
            (Inv $_.process_private_bytes '0')
        )
    } | Add-Content -Path $samPath

    $t = Parse-Timings $allLines
    if ($exitCode -ne 0) { Write-Warning "llama-cli exited with $exitCode. Failure log: $logPath" }
    if (-not $t.GenTps) { Write-Warning "Could not parse generation tok/s. Check log: $logPath" }

    $evalRuns = if ($t.EvalRuns) { [int]$t.EvalRuns } else { 0 }
    # llama timing n_eval counts decode evaluations after the first generated
    # token. A completed -n N run therefore normally reports N-1 eval runs.
    $expectedEvalRuns = [math]::Max(0, $NGen - 1)
    $tokenTimingData = $null
    $tokenTimingError = $null
    if ($TokenTiming -and $exitCode -eq 0 -and $evalRuns -gt 0) {
        try { $tokenTimingData = Read-TokenTiming $tokPath $evalRuns $t0 $tEnd $ModelPath }
        catch { $tokenTimingError = $_.Exception.Message }
    }
    $tokenTimingStats = Get-TokenTimingStats $tokenTimingData
    $physTotalB = if ($samples.Count) { [double]$samples[$samples.Count-1].cum } else { 0.0 }
    $physPregenB = $physTotalB
    $physSteadyB = 0.0
    $physGenBpt = $null
    $provisionalStatus = if ($TokenTiming) { 'provisional_token_timed_device_estimate' } else { 'provisional_reconstructed' }
    $runStatus = $provisionalStatus
    $phaseMethod = if ($TokenTiming) { 'device_counter_interpolation_at_token_ready_boundaries_v1' } else { 'reconstructed_estimate_from_end_and_reported_tps' }
    $genDur = if ($t.GenTps -and $t.GenTps -gt 0 -and $evalRuns -gt 0) { $evalRuns / [double]$t.GenTps } else { 0.0 }
    $sensitivity = New-Object System.Collections.Generic.List[string]
    $diagnosticWindowStart = $null
    $diagnosticWindowEnd = $null

    if ($ColdCache -and $coldCacheResult -notin @('EmptyStandbyList standbylist', 'RAMMap -Et')) {
        $runStatus = 'cold_cache_failed'
    } elseif ($exitCode -ne 0) {
        $runStatus = 'process_failed'
    } elseif ($counterSamplingFailed) {
        $runStatus = 'counter_sampling_failed'
    } elseif ($TokenTiming -and ($tokenTimingError -or $null -eq $tokenTimingData)) {
        $runStatus = 'token_timing_invalid'
        Write-Warning "Token timing evidence is invalid: $tokenTimingError"
    } elseif ($evalRuns -le 0 -or $genDur -le 0 -or $genDur -ge $tEnd) {
        $runStatus = 'timings_unparsed_or_invalid'
    } else {
        $genStart = if ($TokenTiming) { [double]$tokenTimingData.first_ready_elapsed_s } else { [math]::Max(0.0, $tEnd - $genDur) }
        $physPregenB = Cum-At $samples $genStart
        $primary = if ($TokenTiming) {
            Get-TimedSteadyMetric $samples $tokenTimingData $TransientFraction
        } else {
            Get-SteadyMetric $samples $genStart $tEnd $evalRuns $TransientFraction
        }
        $diagnosticWindowStart = if ($TokenTiming) { $primary.start } else { $genStart + $TransientFraction * ($tEnd - $genStart) }
        $diagnosticWindowEnd = if ($TokenTiming) { $primary.end } else { $tEnd }
        if ($primary.status -eq 'ok') {
            $physSteadyB = $primary.bytes
            $physGenBpt = $primary.bpt
        } else {
            $runStatus = $primary.status
            Write-Warning "Steady-state metric withheld: $runStatus."
        }
        foreach ($fraction in $SensitivityTransientFractions) {
            $metric = if ($TokenTiming) {
                Get-TimedSteadyMetric $samples $tokenTimingData $fraction
            } else {
                Get-SteadyMetric $samples $genStart $tEnd $evalRuns $fraction
            }
            $value = if ($metric.status -eq 'ok') { Inv $metric.bpt '0' } else { $metric.status }
            $sensitivity.Add("$(Inv $fraction '0.00'):$value")
        }
        if ($evalRuns -lt $expectedEvalRuns -and $runStatus -eq $provisionalStatus) {
            $runStatus = 'short_generation'
            Write-Warning "Generation reported $evalRuns eval runs; a full -n $NGen run normally reports at least $expectedEvalRuns. Do not treat this as an equivalent baseline run."
        }
    }

    # These percentiles describe one-second interval averages, not individual
    # I/O latency distributions. Exclude idle intervals from read diagnostics.
    $diagnosticSamples = if ($null -ne $diagnosticWindowStart) {
        @($samples | Where-Object { $_.t -ge $diagnosticWindowStart -and $_.t -le $diagnosticWindowEnd })
    } else { @($samples.ToArray()) }
    $activeDiskSamples = @($diagnosticSamples | Where-Object {
        (Test-FiniteNonnegative $_.disk_reads_per_sec) -and [double]$_.disk_reads_per_sec -gt 0.0
    })
    $latencyMs = @($activeDiskSamples | ForEach-Object {
        if (Test-FiniteNonnegative $_.disk_avg_sec_read) { 1000.0 * [double]$_.disk_avg_sec_read }
    })
    $queueValues = Get-Values $activeDiskSamples 'disk_avg_read_queue'
    $readIopsValues = Get-Values $activeDiskSamples 'disk_reads_per_sec'
    $bytesPerReadValues = Get-Values $activeDiskSamples 'disk_avg_bytes_read'
    $processCpuValues = Get-Values $diagnosticSamples 'process_cpu_pct_host'
    $processWsValues = Get-Values $diagnosticSamples 'process_working_set_bytes'
    $processPrivateValues = Get-Values $diagnosticSamples 'process_private_bytes'
    $availableMemoryValues = Get-Values $diagnosticSamples 'mem_available_bytes'
    $committedMemoryValues = Get-Values $diagnosticSamples 'mem_committed_bytes'
    $pagesInputValues = Get-Values $diagnosticSamples 'mem_pages_input_per_sec'
    $actualFrequencyValues = Get-Values $diagnosticSamples 'cpu_actual_mhz'
    $processorPerformanceValues = Get-Values $diagnosticSamples 'cpu_processor_performance_pct'
    $diagnostics = [ordered]@{
        semantics = if ($TokenTiming) {
            'one-second whole-device/host samples in an exact CLI-ready token window; device counters remain interpolated and latency percentile is not per-I/O'
        } else {
            'one-second whole-device/host samples in the reconstructed steady decode window; latency percentile is not a per-I/O percentile'
        }
        reconstructed_window_start_s = $diagnosticWindowStart
        reconstructed_window_end_s = $diagnosticWindowEnd
        sample_count = $diagnosticSamples.Count
        active_disk_sample_count = $activeDiskSamples.Count
        disk_sampled_interval_avg_read_latency_ms = [ordered]@{
            median = Get-Median $latencyMs
            p95 = Get-Percentile $latencyMs 95
            max = Get-Maximum $latencyMs
        }
        disk_sampled_interval_avg_read_queue = [ordered]@{
            median = Get-Median $queueValues
            p95 = Get-Percentile $queueValues 95
            max = Get-Maximum $queueValues
        }
        disk_reads_per_sec = [ordered]@{ median = Get-Median $readIopsValues; p95 = Get-Percentile $readIopsValues 95; max = Get-Maximum $readIopsValues }
        disk_avg_bytes_per_read = [ordered]@{ median = Get-Median $bytesPerReadValues; p95 = Get-Percentile $bytesPerReadValues 95 }
        process_cpu_pct_host_normalized = [ordered]@{ median = Get-Median $processCpuValues; max = Get-Maximum $processCpuValues }
        process_working_set_bytes = [ordered]@{ peak = Get-Maximum $processWsValues }
        process_private_bytes = [ordered]@{ maximum_sampled = Get-Maximum $processPrivateValues }
        host_available_memory_bytes = [ordered]@{ minimum = Get-Minimum $availableMemoryValues; median = Get-Median $availableMemoryValues }
        host_committed_memory_bytes = [ordered]@{ maximum = Get-Maximum $committedMemoryValues; median = Get-Median $committedMemoryValues }
        host_pages_input_per_sec = [ordered]@{ median = Get-Median $pagesInputValues; p95 = Get-Percentile $pagesInputValues 95; max = Get-Maximum $pagesInputValues }
        cpu_actual_frequency_mhz = [ordered]@{ minimum = Get-Minimum $actualFrequencyValues; median = Get-Median $actualFrequencyValues }
        cpu_processor_performance_pct = [ordered]@{ minimum = Get-Minimum $processorPerformanceValues; median = Get-Median $processorPerformanceValues }
    }

    $sha256 = [Security.Cryptography.SHA256]::Create()
    try { $promptHash = ([BitConverter]::ToString($sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($Prompt)))).Replace('-', '') }
    finally { $sha256.Dispose() }
    $manifest = [ordered]@{
        schema = 'step0-manifest-v2'
        started_at_local = $t0.ToString('o', $InvariantCulture)
        started_at_utc = $t0.ToUniversalTime().ToString('o', $InvariantCulture)
        process_id = $processId
        process_start_utc = $processStartUtc
        process_end_utc = $processEndUtc
        process_elapsed_seconds = $tEnd
        process_metric_baseline_t_s = $initialProcSampleT
        status = $runStatus
        exit_code = $exitCode
        phase_method = $phaseMethod
        authoritative_summary_eligible = $authoritativeSummaryEligible
        evidence_class = if ($authoritativeSummaryEligible) { 'authoritative_candidate' } else { 'diagnostic_non_authoritative' }
        non_authoritative_reason = if ($authoritativeSummaryEligible) { $null } elseif ($TokenTiming) { 'token_timing_diagnostic' } else { $NonAuthoritativeReason }
        git_head = Get-GitHead $repoRoot
        executable = Get-FileIdentity $LlamaCli -WithHash
        model = Get-ModelIdentity $ModelPath -WithHash:$HashModel
        prompt_sha256 = $promptHash
        command = @($LlamaCli) + $argsForRun
        disk_instance = $diskInstance
        counter_path = $diskCounterPath
        sampled_counter_paths = $sampleCounterPaths
        auxiliary_counter_availability = $counterAvailability
        auxiliary_counter_runtime_bad_samples = $auxRuntimeIssues
        counter_validation = 'validated_before_launch'
        counter_sampling_status = if ($counterSamplingFailed) { 'failed' } else { 'ok' }
        counter_sampling_errors = @($counterErrors)
        sample_interval_seconds = 1
        cold_cache_requested = [bool]$ColdCache
        cold_cache_result = $coldCacheResult
        cache_policy = $CachePolicy
        transient_fraction = $TransientFraction
        sensitivity_transient_fractions = $SensitivityTransientFractions
        requested_n_gen = $NGen
        expected_eval_runs = $expectedEvalRuns
        reported_eval_runs = $evalRuns
        integration_origin_s = 0.0
        first_counter_sample_s = $firstCounterSampleS
        final_counter_sample_s = $samples[$samples.Count - 1].t
        diagnostics = $diagnostics
        token_timing = if ($TokenTiming) {
            [ordered]@{
                requested = $true
                path = $tokPath
                parse_error = $tokenTimingError
                header = if ($tokenTimingData) { $tokenTimingData.header } else { $null }
                footer = if ($tokenTimingData) { $tokenTimingData.footer } else { $null }
                first_ready_elapsed_s = if ($tokenTimingData) { $tokenTimingData.first_ready_elapsed_s } else { $null }
                last_ready_elapsed_s = if ($tokenTimingData) { $tokenTimingData.last_ready_elapsed_s } else { $null }
                latency = $tokenTimingStats
            }
        } else { [ordered]@{ requested = $false } }
        host = $hostIdentity
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manPath -Encoding utf8

    $row = CsvRow @(
        (Get-Date -Format 's'), $Label, [IO.Path]::GetFileName($ModelPath),
        (Inv $NGen '0'), (Inv $Threads '0'), (Inv $CtxSize '0'),
        (Inv $t.PromptTps), (Inv $t.GenTps), (Inv $evalRuns '0'),
        (Inv $tEnd '0.0'), $diskInstance,
        (Inv ($physTotalB / 1MB) '0.0'),
        (Inv ($physPregenB / 1MB) '0.0'),
        (Inv ($physSteadyB / 1MB) '0.0'),
        (Inv $physGenBpt '0'),
        (Inv ($peakWs / 1MB) '0'),
        ($ExtraArgs -join ' '),
        $runStatus, (Inv $exitCode '0'), $phaseMethod,
        (Inv $firstCounterSampleS '0.000'), (Inv $samples[$samples.Count - 1].t '0.000'),
        (Inv $TransientFraction '0.00'), ($sensitivity -join ';'), $CachePolicy,
        (Inv $processId '0'),
        (Inv $diagnostics.process_cpu_pct_host_normalized.median),
        (Inv $diagnostics.process_cpu_pct_host_normalized.max),
        (Inv ($peakPrivate / 1MB) '0'),
        (Inv $diagnostics.active_disk_sample_count '0'),
        (Inv $diagnostics.disk_sampled_interval_avg_read_latency_ms.median),
        (Inv $diagnostics.disk_sampled_interval_avg_read_latency_ms.p95),
        (Inv $diagnostics.disk_sampled_interval_avg_read_queue.max),
        (Inv $diagnostics.disk_reads_per_sec.median),
        (Inv (Divide-OrNull $diagnostics.host_available_memory_bytes.minimum 1MB)),
        (Inv (Divide-OrNull $diagnostics.host_committed_memory_bytes.maximum 1MB)),
        (Inv $diagnostics.cpu_actual_frequency_mhz.median),
        (Inv $diagnostics.cpu_actual_frequency_mhz.minimum),
        (Inv $diagnostics.cpu_processor_performance_pct.median),
        $(if ($authoritativeSummaryEligible) { 'true' } else { 'false' }),
        $tokPath,
        (Inv $(if ($tokenTimingStats) { $tokenTimingStats.inter_ready_ms.p50 } else { $null })),
        (Inv $(if ($tokenTimingStats) { $tokenTimingStats.inter_ready_ms.p95 } else { $null })),
        (Inv $(if ($tokenTimingStats) { $tokenTimingStats.inter_ready_ms.p99 } else { $null })),
        (Inv $(if ($tokenTimingStats) { $tokenTimingStats.eval_ms.p50 } else { $null })),
        (Inv $(if ($tokenTimingStats) { $tokenTimingStats.eval_ms.p95 } else { $null })),
        (Inv $(if ($tokenTimingStats) { $tokenTimingStats.eval_ms.p99 } else { $null })),
        (Inv $(if ($tokenTimingStats) { $tokenTimingStats.sample_ms.p50 } else { $null })),
        (Inv $(if ($tokenTimingStats) { $tokenTimingStats.sample_ms.p95 } else { $null })),
        (Inv $(if ($tokenTimingStats) { $tokenTimingStats.sample_ms.p99 } else { $null })),
        $manPath
    )
    Add-Content -Path $Csv -Value $row

    Write-Host ("[{0}] status {1} | gen {2} t/s | steady {3} B/tok | disk total {4} MB (pregen {5}) | peak {6} MB | {7}s" -f `
        $Label, $runStatus, $t.GenTps, $physGenBpt,
        [math]::Round($physTotalB/1MB,1), [math]::Round($physPregenB/1MB,1),
        [math]::Round($peakWs/1MB,0), [math]::Round($tEnd,1))
    return [pscustomobject]@{
        status = $runStatus
        gen_tps = $t.GenTps
        phys_gen_bytes_per_tok = $physGenBpt
        process_cpu_pct_host = $diagnostics.process_cpu_pct_host_normalized.median
        sampled_interval_avg_read_latency_ms = $diagnostics.disk_sampled_interval_avg_read_latency_ms.median
        sampled_interval_p95_avg_read_latency_ms = $diagnostics.disk_sampled_interval_avg_read_latency_ms.p95
        minimum_available_memory_bytes = $diagnostics.host_available_memory_bytes.minimum
        maximum_committed_memory_bytes = $diagnostics.host_committed_memory_bytes.maximum
        cpu_actual_mhz = $diagnostics.cpu_actual_frequency_mhz.median
        authoritative_summary_eligible = $authoritativeSummaryEligible
        manifest_path = $manPath
    }
}

$runResults = @()
$sessionStamp = Get-Date -Format 'yyyyMMdd_HHmmss'
for ($i = 1; $i -le $Repeat; $i++) {
    Write-Host "--- run $i/$Repeat ---"
    $runResults += Invoke-OneRun $i
}

$valid = @($runResults | Where-Object { $_.status -in @('provisional_reconstructed', 'provisional_token_timed_device_estimate') -and $null -ne $_.phys_gen_bytes_per_tok })
$summaryPath = Join-Path ([IO.Path]::GetDirectoryName($Csv)) ("{0}_{1}_{2}.summary.csv" -f [IO.Path]::GetFileNameWithoutExtension($Csv), $Label, $sessionStamp)
$summaryHeader = 'label,n_runs,n_valid,authoritative_summary_eligible,median_gen_tps,min_gen_tps,max_gen_tps,median_phys_gen_bytes_per_tok,min_phys_gen_bytes_per_tok,max_phys_gen_bytes_per_tok,median_process_cpu_pct_host,median_sampled_interval_avg_read_latency_ms,median_run_p95_sampled_interval_avg_read_latency_ms,min_available_memory_MB,max_committed_memory_MB,median_cpu_actual_mhz,phase_method'
$tps = @($valid | ForEach-Object { [double]$_.gen_tps })
$bpt = @($valid | ForEach-Object { [double]$_.phys_gen_bytes_per_tok })
$summaryProcCpu = @($valid | ForEach-Object { if ($null -ne $_.process_cpu_pct_host) { [double]$_.process_cpu_pct_host } })
$summaryLatency = @($valid | ForEach-Object { if ($null -ne $_.sampled_interval_avg_read_latency_ms) { [double]$_.sampled_interval_avg_read_latency_ms } })
$summaryP95Latency = @($valid | ForEach-Object { if ($null -ne $_.sampled_interval_p95_avg_read_latency_ms) { [double]$_.sampled_interval_p95_avg_read_latency_ms } })
$summaryAvailable = @($valid | ForEach-Object { if ($null -ne $_.minimum_available_memory_bytes) { [double]$_.minimum_available_memory_bytes } })
$summaryCommitted = @($valid | ForEach-Object { if ($null -ne $_.maximum_committed_memory_bytes) { [double]$_.maximum_committed_memory_bytes } })
$summaryCpuMhz = @($valid | ForEach-Object { if ($null -ne $_.cpu_actual_mhz) { [double]$_.cpu_actual_mhz } })
$summary = CsvRow @(
    $Label, (Inv $runResults.Count '0'), (Inv $valid.Count '0'), $(if ($authoritativeSummaryEligible) { 'true' } else { 'false' }),
    (Inv (Get-Median $tps)), (Inv (($tps | Measure-Object -Minimum).Minimum)), (Inv (($tps | Measure-Object -Maximum).Maximum)),
    (Inv (Get-Median $bpt) '0'), (Inv (($bpt | Measure-Object -Minimum).Minimum) '0'), (Inv (($bpt | Measure-Object -Maximum).Maximum) '0'),
    (Inv (Get-Median $summaryProcCpu)),
    (Inv (Get-Median $summaryLatency)),
    (Inv (Get-Median $summaryP95Latency)),
    (Inv (Divide-OrNull (Get-Minimum $summaryAvailable) 1MB)),
    (Inv (Divide-OrNull (Get-Maximum $summaryCommitted) 1MB)),
    (Inv (Get-Median $summaryCpuMhz)),
    $(if ($TokenTiming) { 'device_counter_interpolation_at_token_ready_boundaries_v1' } else { 'reconstructed_estimate_from_end_and_reported_tps' })
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
