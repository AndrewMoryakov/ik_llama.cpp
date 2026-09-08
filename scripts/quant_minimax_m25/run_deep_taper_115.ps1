#
# MiniMax M2.5 — Deep-Taper 115 (~115 GiB) — Interactive runner with progress
#
# Usage:
#   .\run_deep_taper_115.ps1 [-Source <path>] [-Output <path>] [-Imatrix <path>]
#
# Defaults assume standard paths. Override as needed.
#

param(
    [string]$Source = "Z:\MiniMax_M2.5\MiniMax-M2.5-Q8_0-00001-of-00006.gguf",
    [string]$Output = "D:\MiniMax-M2.5-DeepTaper115.gguf",
    [string]$Imatrix = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Quantize = Join-Path $ScriptDir "..\..\build\bin\llama-quantize.exe"

if (-not (Test-Path $Quantize)) {
    Write-Error "llama-quantize.exe not found. Build first."
    exit 1
}

if (-not (Test-Path $Source)) {
    Write-Error "Source model not found: $Source"
    exit 1
}

# Check free space
$outDrive = (Split-Path -Qualifier $Output)
$drive = Get-PSDrive ($outDrive -replace ':','')
$freeGB = [math]::Round($drive.Free / 1GB, 1)
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  MiniMax M2.5 — Deep-Taper 115 (~115 GiB)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Source:      $Source"
Write-Host "  Output:      $Output"
Write-Host "  Imatrix:     $(if ($Imatrix) { $Imatrix } else { 'none (quality will be slightly lower)' })"
Write-Host "  Free space:  ${freeGB} GB on $outDrive"
Write-Host ""
Write-Host "  Zone map:" -ForegroundColor Yellow
Write-Host "    Edge       [0-3, 58-61]    down=iq5_k   gate/up=iq5_k"
Write-Host "    Bridge     [4-7, 54-57]    down=iq5_k   gate/up=iq4_xs"
Write-Host "    Mid-sens   [8-11, 50-53]   down=iq5_k   gate/up=iq4_xs"
Write-Host "    Mid-high   [12-16, 45-49]  down=iq5_k   gate/up=iq3_ks"
Write-Host "    Mid-core   [17-44]         down=iq4_xs   gate/up=iq3_ks"
Write-Host "    Attention/Norms:           q8_0"
Write-Host "    Output head:               q8_0"
Write-Host "    Embeddings:                q8_0"
Write-Host ""
Write-Host "  Total tensors: 809"
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

if ($freeGB -lt 120) {
    Write-Host "  WARNING: Only ${freeGB} GB free. Need ~115 GB for output." -ForegroundColor Red
    $confirm = Read-Host "  Continue? (y/n)"
    if ($confirm -ne 'y') { exit 0 }
}

# Build custom-q rules
$rules = @(
    'blk\.(0|1|2|3|58|59|60|61)\.ffn_down_exps=iq5_k',
    'blk\.(0|1|2|3|58|59|60|61)\.ffn_gate_exps=iq5_k',
    'blk\.(0|1|2|3|58|59|60|61)\.ffn_up_exps=iq5_k',
    'blk\.(4|5|6|7|54|55|56|57)\.ffn_down_exps=iq5_k',
    'blk\.(4|5|6|7|54|55|56|57)\.ffn_gate_exps=iq4_xs',
    'blk\.(4|5|6|7|54|55|56|57)\.ffn_up_exps=iq4_xs',
    'blk\.(8|9|10|11|50|51|52|53)\.ffn_down_exps=iq5_k',
    'blk\.(8|9|10|11|50|51|52|53)\.ffn_gate_exps=iq4_xs',
    'blk\.(8|9|10|11|50|51|52|53)\.ffn_up_exps=iq4_xs',
    'blk\.(1[2-6]|4[5-9])\.ffn_down_exps=iq5_k',
    'blk\.(1[2-6]|4[5-9])\.ffn_gate_exps=iq3_ks',
    'blk\.(1[2-6]|4[5-9])\.ffn_up_exps=iq3_ks',
    'blk\.(1[7-9]|[23][0-9]|4[0-4])\.ffn_down_exps=iq4_xs',
    'blk\.(1[7-9]|[23][0-9]|4[0-4])\.ffn_gate_exps=iq3_ks',
    'blk\.(1[7-9]|[23][0-9]|4[0-4])\.ffn_up_exps=iq3_ks'
) -join ','

# Build args
$args_list = @("--allow-requantize")
if ($Imatrix -and (Test-Path $Imatrix)) {
    $args_list += "--imatrix", $Imatrix
}
$args_list += "--output-tensor-type", "q8_0"
$args_list += "--token-embedding-type", "q8_0"
$args_list += "--attn-q-type", "q8_0"
$args_list += "--attn-k-type", "q8_0"
$args_list += "--attn-v-type", "q8_0"
$args_list += "--attn-output-type", "q8_0"
$args_list += "--ffn-gate-inp-type", "f32"
$args_list += "--custom-q", $rules
$args_list += $Source, $Output, "IQ3_KS"

$startTime = Get-Date
Write-Host "  Started: $($startTime.ToString('HH:mm:ss'))" -ForegroundColor Green
Write-Host ""

# Zone classification function for Deep-Taper
function Get-Zone($layer) {
    if ($layer -le 3 -or $layer -ge 58) { return "EDGE" }
    if ($layer -le 7 -or ($layer -ge 54 -and $layer -le 57)) { return "BRIDGE" }
    if ($layer -le 11 -or ($layer -ge 50 -and $layer -le 53)) { return "MID-SENS" }
    if ($layer -le 16 -or ($layer -ge 45 -and $layer -le 49)) { return "MID-HIGH" }
    return "MID-CORE"
}

# Run with live output and progress tracking
$process = New-Object System.Diagnostics.Process
$process.StartInfo.FileName = $Quantize
$process.StartInfo.Arguments = ($args_list | ForEach-Object {
    if ($_ -match '\s|\\') { "`"$_`"" } else { $_ }
}) -join ' '
$process.StartInfo.UseShellExecute = $false
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true
$process.StartInfo.CreateNoWindow = $false
$process.Start() | Out-Null

$lastLayer = -1
while (-not $process.StandardOutput.EndOfStream) {
    $line = $process.StandardOutput.ReadLine()

    if ($line -match '^\[\s*(\d+)/\s*(\d+)\]') {
        $current = [int]$Matches[1]
        $total = [int]$Matches[2]
        $pct = [math]::Round(($current / $total) * 100, 1)
        $elapsed = (Get-Date) - $startTime
        $elapsedStr = "{0:hh\:mm\:ss}" -f $elapsed

        $layerNum = -1
        if ($line -match 'blk\.(\d+)\.') {
            $layerNum = [int]$Matches[1]
        }

        if ($line -match 'Using custom type (\S+)') {
            Write-Host "  [$current/$total] ${pct}% | $elapsedStr | CUSTOM: $($Matches[1]) " -NoNewline
            if ($line -match 'for tensor (\S+)') {
                Write-Host $Matches[1] -ForegroundColor Yellow
            } else {
                Write-Host ""
            }
        }
        elseif ($layerNum -ge 0 -and $layerNum -ne $lastLayer) {
            $lastLayer = $layerNum
            $zone = Get-Zone $layerNum
            Write-Host "  [$current/$total] ${pct}% | $elapsedStr | Layer $layerNum ($zone)" -ForegroundColor Gray
        }
        elseif ($layerNum -lt 0 -and $line -match '(output|token_embd|output_norm)') {
            Write-Host "  [$current/$total] ${pct}% | $elapsedStr | $($Matches[1])" -ForegroundColor Magenta
        }
    }
}

$process.WaitForExit()
$stderr = $process.StandardError.ReadToEnd()
if ($stderr) { Write-Host $stderr -ForegroundColor Red }

$endTime = Get-Date
$duration = $endTime - $startTime
$durationStr = "{0:hh\:mm\:ss}" -f $duration

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan

if ($process.ExitCode -eq 0) {
    $outSize = [math]::Round((Get-Item $Output).Length / 1GB, 2)
    Write-Host "  DONE" -ForegroundColor Green
    Write-Host "  Output:   $Output"
    Write-Host "  Size:     ${outSize} GB"
    Write-Host "  Duration: $durationStr"
} else {
    Write-Host "  FAILED (exit code $($process.ExitCode))" -ForegroundColor Red
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
