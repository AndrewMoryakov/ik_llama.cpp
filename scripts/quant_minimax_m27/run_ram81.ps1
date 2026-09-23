# Quantize the revised RAM profile from the original M2.7 BF16 shards.
$ErrorActionPreference = "Stop"
$source = "E:\Lm Models\unsloth\MiniMax-M2,7-BF16\MiniMax-M2.7-BF16-00001-of-00010.gguf"
$imatrix = "E:\Lm Models\unsloth\MiniMax-M2,7-BF16\imatrix_minimax_m27_unsloth.dat"
$recipe = Join-Path $PSScriptRoot "recipes\ram_81_bf16.json"
$output = "E:\Lm Models\MiniMax-M2.7-RAM-81-BF16-imatrix.gguf"
$state = "$output.state.json"
if (Test-Path -LiteralPath $output) { throw "Refusing to overwrite $output" }
$started = (Get-Date).ToString("o")
[pscustomobject]@{ status="running"; started=$started; output=$output; recipe=$recipe; pid=$PID } |
    ConvertTo-Json | Set-Content -LiteralPath $state
& (Join-Path $PSScriptRoot "run_recipe.ps1") -Source $source -Output $output -Imatrix $imatrix -Recipe $recipe 1> "$output.quant.log" 2> "$output.quant.err.log"
if ($LASTEXITCODE -ne 0) { throw "Quantizer exit code $LASTEXITCODE" }
& (Join-Path $PSScriptRoot "verify_quant_recipe.ps1") -Model $output -Recipe $recipe 1> "$output.verify.log" 2> "$output.verify.err.log"
if ($LASTEXITCODE -ne 0) { throw "Verifier exit code $LASTEXITCODE" }
[pscustomobject]@{ status="verified"; started=$started; completed=(Get-Date).ToString("o"); output=$output; recipe=$recipe; bytes=(Get-Item -LiteralPath $output).Length; pid=$PID } |
    ConvertTo-Json | Set-Content -LiteralPath $state
