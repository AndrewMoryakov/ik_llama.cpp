#
# MiniMax M2.5 — Deep-Taper 115 (~115 GiB)
# PowerShell wrapper for Windows.
#
# Usage:
#   .\quantize_deep_taper_115.ps1 -Source <source.gguf> -Output <output.gguf> [-Imatrix <imatrix.dat>]
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
# Edge       [0-3, 58-61]   : down=iq5_k, gate/up=iq5_k
# Bridge     [4-7, 54-57]   : down=iq5_k, gate/up=iq4_xs
# Mid-sens   [8-11, 50-53]  : down=iq5_k, gate/up=iq4_xs
# Mid-high   [12-16, 45-49] : down=iq5_k, gate/up=iq3_ks
# Mid-core   [17-44]        : down=iq4_xs, gate/up=iq3_ks

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

Write-Host "============================================="
Write-Host "  MiniMax M2.5 — Deep-Taper 115 (~115 GiB)"
Write-Host "============================================="
Write-Host "Source:     $Source"
Write-Host "Output:     $Output"
Write-Host "Imatrix:    $(if ($Imatrix) { $Imatrix } else { 'none' })"
Write-Host ""
Write-Host "Zone map:"
Write-Host "  Edge       [0-3,58-61]    down=iq5_k   gate/up=iq5_k"
Write-Host "  Bridge     [4-7,54-57]    down=iq5_k   gate/up=iq4_xs"
Write-Host "  Mid-sens   [8-11,50-53]   down=iq5_k   gate/up=iq4_xs"
Write-Host "  Mid-high   [12-16,45-49]  down=iq5_k   gate/up=iq3_ks"
Write-Host "  Mid-core   [17-44]        down=iq4_xs   gate/up=iq3_ks"
Write-Host "  Attention/Norms:          q8_0"
Write-Host "  Output head:              q8_0"
Write-Host "  Embeddings:               q8_0"
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
