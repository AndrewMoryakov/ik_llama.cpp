param(
    [Parameter(Mandatory=$true)][int]$ProcessId,
    [int]$LimitGiB = 48
)

$ErrorActionPreference = 'Stop'
$process = Get-Process -Id $ProcessId -ErrorAction Stop
$started = $process.StartTime
while ($true) {
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process -or $process.StartTime -ne $started) { break }
    try {
        $process.MaxWorkingSet = [int64]$LimitGiB * 1GB
    } catch {
        Write-Warning "Cannot trim process ${ProcessId}: $_"
    }
    Start-Sleep -Seconds 20
}
