<#
.SYNOPSIS
    Capture one diagnostic Step0 run with the Windows Performance Recorder.

.DESCRIPTION
    This run is never part of the authoritative three-repeat tokens/s summary.
    It exists for WPA correlation of llama-cli PID, GGUF File I/O, Disk I/O and
    hard faults. Run elevated. Do not combine it with --moe-trace.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$LlamaCli,
    [Parameter(Mandatory = $true)] [string]$ModelPath,
    [Parameter(Mandatory = $true)] [string]$DiskInstance,
    [Parameter(Mandatory = $true)] [string]$OutputDirectory,
    [string]$Label = 'diagnostic_etw',
    [string]$Prompt = 'Write a detailed 1500-word technical tutorial on CPU memory hierarchies, SSD paging, and mixture-of-experts inference.',
    [ValidateRange(2, 1000000)] [int]$NGen = 512,
    [int]$Threads = 0,
    [int]$CtxSize = 4096,
    [string[]]$ExtraArgs = @(),
    [switch]$AllowSameDriveOutput
)

$ErrorActionPreference = 'Stop'

function Invoke-Wpr([string[]]$Arguments) {
    $oldPreference = $ErrorActionPreference
    $nativePreferenceExists = $null -ne (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)
    $oldNativePreference = if ($nativePreferenceExists) { $PSNativeCommandUseErrorActionPreference } else { $null }
    try {
        # Windows PowerShell 5.1 converts native stderr into error records. Do
        # not let EAP=Stop escape before exit status/output can be recorded.
        $ErrorActionPreference = 'Continue'
        if ($nativePreferenceExists) { $PSNativeCommandUseErrorActionPreference = $false }
        $output = (& wpr.exe @Arguments 2>&1 | Out-String).Trim()
        $exitCode = $LASTEXITCODE
        return [pscustomobject]@{
            command = @('wpr.exe') + $Arguments
            exit_code = $exitCode
            output = $output
        }
    } catch {
        return [pscustomobject]@{
            command = @('wpr.exe') + $Arguments
            exit_code = -1
            output = $_.Exception.Message
        }
    } finally {
        $ErrorActionPreference = $oldPreference
        if ($nativePreferenceExists) { $PSNativeCommandUseErrorActionPreference = $oldNativePreference }
    }
}

if (-not (Get-Command wpr.exe -ErrorAction SilentlyContinue)) {
    throw 'wpr.exe is required. Install the Windows Performance Toolkit.'
}

$model = (Resolve-Path -LiteralPath $ModelPath).Path
$cli = (Resolve-Path -LiteralPath $LlamaCli).Path
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (-not (Test-Path -LiteralPath $output)) {
    New-Item -ItemType Directory -Path $output | Out-Null
}
$output = (Resolve-Path -LiteralPath $output).Path
$modelRoot = [IO.Path]::GetPathRoot($model)
$outputRoot = [IO.Path]::GetPathRoot($output)
if (-not $AllowSameDriveOutput -and $modelRoot -eq $outputRoot) {
    throw "ETW output must not compete with the model drive '$modelRoot'. Use a different output drive."
}

$status = Invoke-Wpr -Arguments @('-status')
if ($status.exit_code -ne 0) {
    throw "Cannot query WPR status: $($status.output)"
}
# WPR status text is localized. Recognize the tested English idle form and fail
# closed for every unknown/localized text rather than cancelling somebody
# else's session. Keep this script ASCII-only for Windows PowerShell 5.1.
$idle = $status.output -match '(?i)not recording'
if (-not $idle) {
    throw "WPR may already be recording (or returned an unrecognized localized status). Stop it manually; this wrapper will not cancel an existing session. Status: $($status.output)"
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$etlPath = Join-Path $output ("step0_{0}_{1}.etl" -f $Label, $stamp)
$csvPath = Join-Path $output ("step0_{0}_{1}.csv" -f $Label, $stamp)
$captureManifest = Join-Path $output ("step0_{0}_{1}.etw.json" -f $Label, $stamp)
$bench = Join-Path $PSScriptRoot 'step0-bench.ps1'

$record = [ordered]@{
    schema = 'step0-etw-capture-v1'
    diagnostic_only = $true
    authoritative_summary_eligible = $false
    profile = 'GeneralProfile'
    status_probe = $status
    capture_start_utc = $null
    capture_stop_utc = $null
    start = $null
    stop = $null
    cancel = $null
    benchmark_error = $null
    benchmark_csv = $csvPath
    benchmark_manifest = $null
    process_id = $null
    process_start_utc = $null
    process_end_utc = $null
    model_entry_path = $null
    etl_path = $etlPath
    etl_usable = $false
}

$started = $false
$benchmarkError = $null
$start = Invoke-Wpr -Arguments @('-start', 'GeneralProfile', '-filemode')
$record.start = $start
$record.capture_start_utc = [DateTimeOffset]::UtcNow.ToString('o')
if ($start.exit_code -ne 0) {
    $record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $captureManifest -Encoding utf8
    throw "WPR start failed: $($start.output)"
}
$started = $true

try {
    $benchArgs = @{
        LlamaCli = $cli
        ModelPath = $model
        DiskInstance = $DiskInstance
        Label = $Label
        CachePolicy = 'diagnostic_etw_not_authoritative'
        NGen = $NGen
        Threads = $Threads
        CtxSize = $CtxSize
        Prompt = $Prompt
        Repeat = 1
        Csv = $csvPath
        ExtraArgs = $ExtraArgs
        NonAuthoritative = $true
        NonAuthoritativeReason = 'etw_diagnostic'
    }
    & $bench @benchArgs
} catch {
    $benchmarkError = $_
    $record.benchmark_error = $_.Exception.Message
} finally {
    if ($started) {
        $stop = Invoke-Wpr -Arguments @('-stop', $etlPath)
        $record.stop = $stop
        $record.capture_stop_utc = [DateTimeOffset]::UtcNow.ToString('o')
        if ($stop.exit_code -eq 0 -and (Test-Path -LiteralPath $etlPath) -and
            (Get-Item -LiteralPath $etlPath).Length -gt 0) {
            $record.etl_usable = $true
        } else {
            $record.cancel = Invoke-Wpr -Arguments @('-cancel')
            $record.etl_usable = $false
        }
    }
    try {
        if (Test-Path -LiteralPath $csvPath) {
            $row = Import-Csv -LiteralPath $csvPath | Select-Object -Last 1
            if ($row -and $row.manifest_path -and (Test-Path -LiteralPath $row.manifest_path)) {
                $benchmarkManifest = Get-Content -Raw -LiteralPath $row.manifest_path | ConvertFrom-Json
                $record.benchmark_manifest = $row.manifest_path
                $record.process_id = $benchmarkManifest.process_id
                $record.process_start_utc = $benchmarkManifest.process_start_utc
                $record.process_end_utc = $benchmarkManifest.process_end_utc
                $record.model_entry_path = $benchmarkManifest.model.entry_path
            }
        }
        if (-not $record.benchmark_manifest) {
            throw 'Step0 benchmark manifest provenance was not found.'
        }
    } catch {
        if ($null -eq $benchmarkError) { $benchmarkError = $_ }
        if (-not $record.benchmark_error) {
            $record.benchmark_error = "Could not attach benchmark manifest provenance: $($_.Exception.Message)"
        }
    }
    $record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $captureManifest -Encoding utf8
}

if (-not $record.etl_usable) {
    throw "WPR did not produce a usable ETL. See $captureManifest"
}
if ($null -ne $benchmarkError) {
    throw "Benchmark failed, but ETL and metadata were preserved. See $captureManifest. Original error: $($benchmarkError.Exception.Message)"
}

Write-Host "Diagnostic ETL: $etlPath"
Write-Host "Capture metadata: $captureManifest"
Write-Host 'Open the ETL in WPA and correlate the manifest llama-cli PID with GGUF File I/O, Disk I/O and hard faults.'
