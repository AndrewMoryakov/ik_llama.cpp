#
# MiniMax M2.7 recipe-driven quantization runner.
#
# Usage:
#   .\run_recipe.ps1 -Source <bf16.gguf> -Output <out.gguf> [-Recipe .\recipes\ram_81_bf16.json] [-Imatrix <path>] [-DryRun]
#

param(
    [Parameter(Mandatory=$true)]
    [string]$Source,

    [Parameter(Mandatory=$true)]
    [string]$Output,

    [string]$Recipe = (Join-Path $PSScriptRoot "recipes\ram_81_bf16.json"),

    [string]$Imatrix = "",

    [string]$Quantize = "D:\build-zen4\bin\llama-quantize.exe",

    [ValidateSet("bf16", "q8_0")]
    [string]$SourceType = "bf16",

    [switch]$DryRun,
    [switch]$Estimate
)

$ErrorActionPreference = "Stop"

function Expand-Layers {
    param($Spec)
    $result = New-Object System.Collections.Generic.List[int]
    if ($Spec -is [array]) {
        foreach ($item in $Spec) { $result.Add([int]$item) }
        return $result
    }
    if ($Spec -is [int]) {
        $result.Add($Spec)
        return $result
    }
    foreach ($part in ([string]$Spec).Split(",")) {
        $part = $part.Trim()
        if (-not $part) { continue }
        if ($part.Contains("-")) {
            $bounds = $part.Split("-", 2)
            $start = [int]$bounds[0]
            $end = [int]$bounds[1]
            for ($i = $start; $i -le $end; $i++) { $result.Add($i) }
        } else {
            $result.Add([int]$part)
        }
    }
    return $result
}

function New-CustomQRules {
    param($Manifest)
    $rules = New-Object System.Collections.Generic.List[string]
    foreach ($zone in $Manifest.zones) {
        $layers = Expand-Layers $zone.layers
        $layerRegex = ($layers | Sort-Object -Unique) -join "|"
        foreach ($role in @("down", "gate", "up")) {
            $field = "ffn_${role}_exps"
            $qtype = [string]$zone.$field
            if ($qtype) {
                $rules.Add("blk\.($layerRegex)\.$field=$qtype")
            }
        }
    }
    return ($rules -join ",")
}

function Quote-Arg {
    param([string]$Value)
    if ($Value -match '^[A-Za-z0-9_./:\\-]+$') { return $Value }
    return "'" + ($Value -replace "'", "''") + "'"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $Recipe)) {
    Write-Error "Recipe not found: $Recipe"
    exit 1
}
if (-not (Test-Path $Quantize) -and -not $DryRun) {
    Write-Error "llama-quantize.exe not found. Build first: cmake --build build --target llama-quantize"
    exit 1
}
if (-not (Test-Path $Quantize) -and $DryRun) {
    Write-Warning "llama-quantize.exe not found at $Quantize; dry-run will print the intended command only."
}
if (-not (Test-Path $Source)) {
    Write-Error "Source model not found: $Source"
    exit 1
}
if ($Imatrix -and -not (Test-Path $Imatrix)) {
    Write-Error "Imatrix not found: $Imatrix"
    exit 1
}

$manifest = Get-Content $Recipe -Raw | ConvertFrom-Json
if ($manifest.layers -ne 62) {
    throw "Recipe declares $($manifest.layers) layers; expected 62."
}
if ($manifest.imatrix.required -and -not $Imatrix) {
    throw "Recipe requires a matching MiniMax M2.7 imatrix."
}
$layerCounts = @{}
foreach ($zone in $manifest.zones) {
    foreach ($layer in (Expand-Layers $zone.layers)) {
        if ($layer -lt 0 -or $layer -ge 62) { throw "Invalid layer $layer in $($zone.name)." }
        $layerCounts[$layer] = 1 + [int]$layerCounts[$layer]
    }
}
for ($layer = 0; $layer -lt 62; $layer++) {
    if ($layerCounts[$layer] -ne 1) { throw "Layer $layer must appear in exactly one zone." }
}
if (-not $DryRun -and -not $Estimate -and (Test-Path $Output)) {
    throw "Output already exists: $Output"
}

$allowedSourceTypes = @($manifest.source_types)
if ($allowedSourceTypes.Count -gt 0 -and $allowedSourceTypes -notcontains $SourceType) {
    Write-Error "Recipe $($manifest.id) allows source types: $($allowedSourceTypes -join ', '); got $SourceType"
    exit 1
}

try {
    $outDrive = Split-Path -Qualifier $Output
} catch {
    $outDrive = ""
}
if ($outDrive) {
    $drive = Get-PSDrive ($outDrive -replace ':','')
    $freeGB = [math]::Round($drive.Free / 1GB, 1)
} else {
    $freeGB = $null
}

$expectedGB = [double]$manifest.expected_output_gib
$rules = New-CustomQRules $manifest

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  $($manifest.label)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Source:       $Source"
Write-Host "  SourceType:   $SourceType"
Write-Host "  Output:       $Output"
Write-Host "  Imatrix:      $(if ($Imatrix) { $Imatrix } else { 'none' })"
Write-Host "  Recipe:       $Recipe"
Write-Host "  Expected:     ~$expectedGB GiB, BPW ~$($manifest.expected_bpw)"
Write-Host "  DryRun:       $DryRun"
if ($null -ne $freeGB) { Write-Host "  Free space:   ${freeGB} GB on $outDrive" }
Write-Host "  Architecture: 62 layers, 256 experts, top-8 routing"
Write-Host "========================================================" -ForegroundColor Cyan

if ($null -ne $freeGB -and $freeGB -lt ($expectedGB + 5)) {
    Write-Host "WARNING: only ${freeGB} GB free. Expected output is about ${expectedGB} GiB." -ForegroundColor Red
    $confirm = Read-Host "Continue? (y/n)"
    if ($confirm -ne 'y') { exit 0 }
}

$argsList = @()
if ($SourceType -eq "q8_0") {
    $argsList += "--allow-requantize"
}
if ($Imatrix) {
    $argsList += "--imatrix", $Imatrix
}
$argsList += "--output-tensor-type", $manifest.fixed_args.output_tensor_type
$argsList += "--token-embedding-type", $manifest.fixed_args.token_embedding_type
$argsList += "--attn-q-type", $manifest.fixed_args.attn_q_type
$argsList += "--attn-k-type", $manifest.fixed_args.attn_k_type
$argsList += "--attn-v-type", $manifest.fixed_args.attn_v_type
$argsList += "--attn-output-type", $manifest.fixed_args.attn_output_type
$argsList += "--ffn-gate-inp-type", $manifest.fixed_args.ffn_gate_inp_type
$argsList += "--custom-q", $rules
$argsList += $Source, $Output, $manifest.base_ftype

if ($DryRun) {
    $quotedArgs = $argsList | ForEach-Object { Quote-Arg $_ }
    Write-Host "DRY RUN: command only; output was not written." -ForegroundColor Yellow
    Write-Host "$Quantize $($quotedArgs -join ' ')"
    exit 0
}

if ($Estimate) {
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & $Quantize --dry-run @argsList } finally { $ErrorActionPreference = $previousErrorAction }
    exit $LASTEXITCODE
}

$startTime = Get-Date
# Windows PowerShell turns native stderr into NativeCommandError when redirected.
# The quantizer writes progress there, so use its exit code as the failure signal.
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try { & $Quantize @argsList } finally { $ErrorActionPreference = $previousErrorAction }
$exitCode = $LASTEXITCODE
$duration = (Get-Date) - $startTime

if ($exitCode -eq 0) {
    $outSize = [math]::Round((Get-Item $Output).Length / 1GB, 2)
    Write-Host "DONE: $Output (${outSize} GB), duration $("{0:hh\:mm\:ss}" -f $duration)" -ForegroundColor Green
} else {
    Write-Host "FAILED: llama-quantize exited with code $exitCode" -ForegroundColor Red
    exit $exitCode
}
