#
# MiniMax M2.5 — Tapered-RAM (~91 GiB) — Interactive runner with progress
#
# Usage:
#   .\run_tapered_ram.ps1 [-Source <path>] [-Output <path>] [-Imatrix <path>]
#
# Defaults assume standard paths. Override as needed.
#

param(
    [string]$Source = "Z:\MiniMax_M2.5\MiniMax-M2.5-Q8_0-00001-of-00006.gguf",
    [string]$Output = "D:\MiniMax-M2.5-TaperedRAM.gguf",
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

# Check free space on output drive
$outDrive = (Split-Path -Qualifier $Output)
$drive = Get-PSDrive ($outDrive -replace ':','')
$freeGB = [math]::Round($drive.Free / 1GB, 1)
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  MiniMax M2.5 — Tapered-RAM (~91 GiB)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Source:      $Source"
Write-Host "  Output:      $Output"
Write-Host "  Imatrix:     $(if ($Imatrix) { $Imatrix } else { 'none (quality will be slightly lower)' })"
Write-Host "  Free space:  ${freeGB} GB on $outDrive"
Write-Host ""
Write-Host "  Zone map:" -ForegroundColor Yellow
Write-Host "    Edge   [0-1, 60-61]   down=iq5_k   gate/up=iq4_xs"
Write-Host "    Bridge [2-4, 57-59]   down=iq4_xs   gate/up=iq3_ks"
Write-Host "    Core   [5-56]         down=iq3_ks   gate/up=iq3_ks"
Write-Host "    Attention/Norms:      q8_0"
Write-Host "    Output head:          q8_0"
Write-Host "    Embeddings:           q8_0"
Write-Host ""
Write-Host "  Total tensors: 809"
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

if ($freeGB -lt 95) {
    Write-Host "  WARNING: Only ${freeGB} GB free. Need ~91 GB for output." -ForegroundColor Red
    $confirm = Read-Host "  Continue? (y/n)"
    if ($confirm -ne 'y') { exit 0 }
}

# Build custom-q rules
$rules = @(
    'blk\.(0|1|60|61)\.ffn_down_exps=iq5_k',
    'blk\.(0|1|60|61)\.ffn_gate_exps=iq4_xs',
    'blk\.(0|1|60|61)\.ffn_up_exps=iq4_xs',
    'blk\.(2|3|4|57|58|59)\.ffn_down_exps=iq4_xs',
    'blk\.(2|3|4|57|58|59)\.ffn_gate_exps=iq3_ks',
    'blk\.(2|3|4|57|58|59)\.ffn_up_exps=iq3_ks'
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

# Run with live output and progress tracking
$totalTensors = 809
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

    # Parse tensor progress: [  12/ 809]
    if ($line -match '^\[\s*(\d+)/\s*(\d+)\]') {
        $current = [int]$Matches[1]
        $total = [int]$Matches[2]
        $pct = [math]::Round(($current / $total) * 100, 1)
        $elapsed = (Get-Date) - $startTime
        $elapsedStr = "{0:hh\:mm\:ss}" -f $elapsed

        # Extract layer number
        $layerNum = -1
        if ($line -match 'blk\.(\d+)\.') {
            $layerNum = [int]$Matches[1]
        }

        # Show custom type usage prominently
        if ($line -match 'Using custom type (\S+)') {
            Write-Host "  [$current/$total] ${pct}% | $elapsedStr | CUSTOM: $($Matches[1]) " -NoNewline
            # Extract tensor name
            if ($line -match 'for tensor (\S+)') {
                Write-Host $Matches[1] -ForegroundColor Yellow
            } else {
                Write-Host ""
            }
        }
        # Show layer transitions
        elseif ($layerNum -ge 0 -and $layerNum -ne $lastLayer) {
            $lastLayer = $layerNum
            $zone = if ($layerNum -le 1 -or $layerNum -ge 60) { "EDGE" }
                    elseif ($layerNum -le 4 -or $layerNum -ge 57) { "BRIDGE" }
                    else { "CORE" }
            Write-Host "  [$current/$total] ${pct}% | $elapsedStr | Layer $layerNum ($zone)" -ForegroundColor Gray
        }
        # Show non-layer tensors (output, embeddings)
        elseif ($layerNum -lt 0 -and $line -match '(output|token_embd|output_norm)') {
            Write-Host "  [$current/$total] ${pct}% | $elapsedStr | $($Matches[1])" -ForegroundColor Magenta
        }
    }
    # Show converting lines for size info
    elseif ($line -match 'converting to') {
        # skip, size info follows
    }
    elseif ($line -match 'size =.*->') {
        # show compression ratio on same line as previous
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
