#
# MiniMax M2.5 — Tapered-RAM (~91 GiB)
# PowerShell wrapper for Windows.
#
# Usage:
#   .\quantize_tapered_ram.ps1 -Source <source.gguf> -Output <output.gguf> [-Imatrix <imatrix.dat>]
#

param(
    [Parameter(Mandatory=$true)]
    [string]$Source,

    [Parameter(Mandatory=$true)]
    [string]$Output,

    [string]$Imatrix = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Quantize = Join-Path $ScriptDir "..\..\build\bin\llama-quantize.exe"

if (-not (Test-Path $Quantize)) {
    Write-Error "llama-quantize.exe not found at $Quantize`nBuild first: cmake --build build --target llama-quantize"
    exit 1
}

# --- Regex rules (first match wins) ---
# Edge [0-1, 60-61]: down=iq5_k, gate/up=iq4_xs
# Bridge [2-4, 57-59]: down=iq4_xs, gate/up=iq3_ks
# Core [5-56]: base ftype IQ3_KS covers these

$rules = @(
    'blk\.(0|1|60|61)\.ffn_down_exps=iq5_k',
    'blk\.(0|1|60|61)\.ffn_gate_exps=iq4_xs',
    'blk\.(0|1|60|61)\.ffn_up_exps=iq4_xs',
    'blk\.(2|3|4|57|58|59)\.ffn_down_exps=iq4_xs',
    'blk\.(2|3|4|57|58|59)\.ffn_gate_exps=iq3_ks',
    'blk\.(2|3|4|57|58|59)\.ffn_up_exps=iq3_ks'
) -join ','

Write-Host "============================================="
Write-Host "  MiniMax M2.5 — Tapered-RAM (~91 GiB)"
Write-Host "============================================="
Write-Host "Source:     $Source"
Write-Host "Output:     $Output"
Write-Host "Imatrix:    $(if ($Imatrix) { $Imatrix } else { 'none' })"
Write-Host ""
Write-Host "Zone map:"
Write-Host "  Edge   [0-1,60-61]  down=iq5_k  gate/up=iq4_xs"
Write-Host "  Bridge [2-4,57-59]  down=iq4_xs  gate/up=iq3_ks"
Write-Host "  Core   [5-56]       down=iq3_ks  gate/up=iq3_ks"
Write-Host "  Attention/Norms:    q8_0"
Write-Host "  Output head:        q8_0"
Write-Host "  Embeddings:         iq4_k"
Write-Host "============================================="
Write-Host ""

$args_list = @("--allow-requantize")
if ($Imatrix) {
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

& $Quantize @args_list

Write-Host ""
Write-Host "Done: $Output"
