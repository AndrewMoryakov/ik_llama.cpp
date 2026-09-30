param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('compact','balanced','ram_safe','ram81','ram88')]
    [string]$Profile,
    [switch]$Estimate,
    [int]$MaxWorkingSetGiB = 48,
    [string]$Quantize = 'D:\ik_llama-unsloth\build\bin\Release\llama-quantize.exe'
)

$ErrorActionPreference = 'Stop'
$sourceDir = 'E:\Lm Models\unsloth\MiniMax-M2,7-BF16'
$source = Join-Path $sourceDir 'MiniMax-M2.7-BF16-00001-of-00010.gguf'
$imatrix = Join-Path $sourceDir 'imatrix_minimax_m27_unsloth.dat'
$plan = Join-Path $PSScriptRoot "unsloth_compatible\$Profile.tensor-types.txt"
$name = switch ($Profile) {
    'compact'  { 'MiniMax-M2.7-Compat-Core-IQ1_S-ServiceBF16-r2' }
    'balanced' { 'MiniMax-M2.7-Compat-CoreDown-IQ2_S-ServiceBF16-r2' }
    'ram_safe' { 'MiniMax-M2.7-Compat-SensitiveGateUp-IQ3_XXS-ServiceBF16-r2' }
    'ram81'    { 'MiniMax-M2.7-Compat-CoreDown-IQ3_S-ServiceBF16-r2' }
    'ram88'    { 'MiniMax-M2.7-Compat-CoreDown-IQ3_S-AttnQ8-r2' }
}
$baseType = if ($Profile -eq 'compact') { 'IQ1_S' } elseif ($Profile -in @('balanced', 'ram_safe')) { 'IQ2_XS' } else { 'IQ3_S' }
$folder = Join-Path 'E:\Lm Models\AndrewM' $name
$output = Join-Path $folder "$name.gguf"
$log = Join-Path $folder 'quantization.log'

foreach ($path in @($Quantize, $source, $imatrix, $plan)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Missing required path: $path" }
}
if (-not $Estimate -and (Test-Path -LiteralPath $output)) {
    throw "Output exists: $output"
}

$arguments = @(
    '--imatrix', $imatrix,
    '--output-tensor-type', 'bf16',
    '--token-embedding-type', 'bf16',
    '--tensor-type-file', $plan,
    '--max-buffer-size', '512',
    $source, $output, $baseType, '16'
)
if ($Estimate) { $arguments = @('--dry-run') + $arguments }

Write-Host "Profile: $Profile"
Write-Host "Output:  $output"
Write-Host "Plan:    $plan"
Write-Host "Binary:  $Quantize"
if ($Estimate) {
    & $Quantize @arguments 2>&1 | Select-String 'quant size|model size|loaded .*importance|error|invalid' | Select-Object -Last 12
    if ($LASTEXITCODE -ne 0) { throw "Quantizer exited $LASTEXITCODE" }
} else {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    $quotedArguments = ($arguments | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ' '
    $process = Start-Process -FilePath $Quantize -ArgumentList $quotedArguments -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $log -RedirectStandardError "$log.err"
    try {
        $process.MaxWorkingSet = [int64]$MaxWorkingSetGiB * 1GB
        Write-Host "Working set limit: $MaxWorkingSetGiB GiB"
    } catch {
        Write-Warning "Could not set working set limit: $_"
    }
    while (-not $process.WaitForExit(30000)) {
        # Windows treats MaxWorkingSet as advisory; reapplying it trims pages
        # accumulated while sequentially reading the 426 GiB source GGUF.
        try { $process.MaxWorkingSet = [int64]$MaxWorkingSetGiB * 1GB } catch {
            Write-Warning "Could not trim quantizer working set: $_"
        }
    }
    if ($process.ExitCode -ne 0) { throw "Quantizer exited $($process.ExitCode); see $log and $log.err" }
    if (-not (Test-Path -LiteralPath $output)) { throw "Quantizer returned success but output is missing: $output" }
    Get-Item -LiteralPath $output | Select-Object FullName,Length
    Write-Host "Logs: $log and $log.err"
}
