# Run matched wikitext-2 PPL measurements sequentially after quantization.
$ErrorActionPreference = "Stop"
$evaluate = Join-Path $PSScriptRoot "evaluate_ppl.ps1"
$models = @(
    "E:\Lm Models\MiniMax-M2.7-Compact-50-BF16-imatrix.gguf",
    "E:\Lm Models\MiniMax-M2.7-Balanced-74-BF16-imatrix.gguf",
    "E:\Lm Models\MiniMax-M2.7-RAM-81-BF16-imatrix.gguf"
)
foreach ($model in $models) {
    $log = "$model.ppl32.log"
    if (Test-Path -LiteralPath $log) { throw "Refusing to overwrite $log" }
    & $evaluate -Model $model -Log $log -Chunks 32
    if ($LASTEXITCODE -ne 0) { throw "Perplexity failed for $model" }
}
