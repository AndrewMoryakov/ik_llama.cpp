param(
    [Parameter(Mandatory = $true)]
    [string]$RunDir,
    [string]$LauncherDir = "",
    [int]$RefreshSec = 5
)

$ErrorActionPreference = "Stop"

function Get-LastLines {
    param(
        [string]$Path,
        [int]$Count = 8
    )
    if (-not (Test-Path $Path)) { return @() }
    try {
        return Get-Content -Path $Path -Tail $Count
    } catch {
        return @("<read error: $($_.Exception.Message)>")
    }
}

function Get-ActiveBenchProcesses {
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -like 'llama-bench*' } |
        Sort-Object StartTime |
        Select-Object Id, ProcessName, StartTime, Path
}

function Show-Section {
    param(
        [string]$Title,
        [string[]]$Lines
    )
    Write-Host ""
    Write-Host "== $Title ==" -ForegroundColor Cyan
    if (-not $Lines -or $Lines.Count -eq 0) {
        Write-Host "<empty>" -ForegroundColor DarkGray
        return
    }
    $Lines | ForEach-Object { Write-Host $_ }
}

function Get-RunStatus {
    param(
        [string]$RunDir,
        [string]$LauncherDir,
        [object[]]$ActiveBench
    )

    $resultsJsonl = Join-Path $RunDir 'results.jsonl'
    $resultsCsv = Join-Path $RunDir 'results.csv'
    $summaryMd = Join-Path $RunDir 'summary.md'
    $hasOutputs = (Test-Path $resultsJsonl) -or (Test-Path $resultsCsv) -or (Test-Path $summaryMd)
    $runFiles = @(Get-ChildItem -Path $RunDir -Force -ErrorAction SilentlyContinue)
    $runLogs = @($runFiles | Where-Object { $_.Name -like '*.log' })

    $stdoutLog = if ($LauncherDir) { Join-Path $LauncherDir 'launcher.stdout.log' } else { '' }
    $stderrLog = if ($LauncherDir) { Join-Path $LauncherDir 'launcher.stderr.log' } else { '' }
    $stdoutTail = if ($stdoutLog) { Get-LastLines -Path $stdoutLog -Count 8 } else { @() }
    $stderrTail = if ($stderrLog) { Get-LastLines -Path $stderrLog -Count 8 } else { @() }
    $launcherText = (($stdoutTail + $stderrTail) -join "`n")

    if ($ActiveBench -and $ActiveBench.Count -gt 0) {
        return @{ status = 'running'; reason = 'llama-bench process detected' }
    }

    if ($launcherText -match 'Running ') {
        return @{ status = 'waiting'; reason = 'launcher active or queued step without visible llama-bench process' }
    }

    if ($hasOutputs -or $runLogs.Count -gt 0) {
        return @{ status = 'finished'; reason = 'run directory contains outputs and no active llama-bench process' }
    }

    return @{ status = 'idle'; reason = 'no active process and no outputs yet' }
}

$RunDir = (Resolve-Path $RunDir).Path
if ($LauncherDir) {
    $LauncherDir = (Resolve-Path $LauncherDir).Path
}

while ($true) {
    Clear-Host
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "ik_llama benchmark watcher" -ForegroundColor Green
    Write-Host "Time: $now"
    Write-Host "RunDir: $RunDir"
    if ($LauncherDir) {
        Write-Host "LauncherDir: $LauncherDir"
    }

    $active = Get-ActiveBenchProcesses
    $runStatus = Get-RunStatus -RunDir $RunDir -LauncherDir $LauncherDir -ActiveBench $active
    Write-Host ""
    $statusColor = switch ($runStatus.status) {
        'running' { 'Green' }
        'waiting' { 'Yellow' }
        'finished' { 'Cyan' }
        default { 'DarkGray' }
    }
    Write-Host ("Status: {0} — {1}" -f $runStatus.status, $runStatus.reason) -ForegroundColor $statusColor
    Write-Host ""
    if ($active) {
        Write-Host "Active llama-bench processes:" -ForegroundColor Yellow
        $active | Format-Table -AutoSize | Out-String | Write-Host
    } else {
        Write-Host "Active llama-bench processes: none" -ForegroundColor Yellow
    }

    $items = @()
    if (Test-Path $RunDir) {
        $items = Get-ChildItem -Path $RunDir -Force | Sort-Object LastWriteTime
    }

    Write-Host ""
    Write-Host "Run directory files:" -ForegroundColor Yellow
    if ($items.Count -gt 0) {
        $items | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize | Out-String | Write-Host
    } else {
        Write-Host "<no files yet>" -ForegroundColor DarkGray
    }

    $resultsJsonl = Join-Path $RunDir 'results.jsonl'
    $resultsCsv = Join-Path $RunDir 'results.csv'
    $summaryMd = Join-Path $RunDir 'summary.md'

    Show-Section -Title "results.jsonl (tail)" -Lines (Get-LastLines -Path $resultsJsonl -Count 10)
    Show-Section -Title "results.csv (tail)" -Lines (Get-LastLines -Path $resultsCsv -Count 10)
    Show-Section -Title "summary.md (tail)" -Lines (Get-LastLines -Path $summaryMd -Count 20)

    if ($LauncherDir) {
        $stdoutLog = Join-Path $LauncherDir 'launcher.stdout.log'
        $stderrLog = Join-Path $LauncherDir 'launcher.stderr.log'
        Show-Section -Title "launcher.stdout.log (tail)" -Lines (Get-LastLines -Path $stdoutLog -Count 12)
        Show-Section -Title "launcher.stderr.log (tail)" -Lines (Get-LastLines -Path $stderrLog -Count 12)
    }

    Start-Sleep -Seconds $RefreshSec
}
