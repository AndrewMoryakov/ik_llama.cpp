# Run matched wikitext-2 PPL measurements sequentially after quantization.
$ErrorActionPreference = "Stop"
$evaluate = Join-Path $PSScriptRoot "evaluate_ppl.ps1"
$models = @(
    "E:\Lm Models\AndrewM\MiniMax-M2.7-Core-IQ1_S-48GiB-r1\MiniMax-M2.7-Core-IQ1_S-48GiB-r1.gguf",
    "E:\Lm Models\AndrewM\MiniMax-M2.7-CoreDown-IQ2_S-GateUp-IQ2_XS-74GiB-r1\MiniMax-M2.7-CoreDown-IQ2_S-GateUp-IQ2_XS-74GiB-r1.gguf",
    "E:\Lm Models\AndrewM\MiniMax-M2.7-CoreDown-IQ3_KS-GateUp-IQ2_XS-81GiB-r1\MiniMax-M2.7-CoreDown-IQ3_KS-GateUp-IQ2_XS-81GiB-r1.gguf"
)
foreach ($model in $models) {
    $log = "$model.ppl32.log"
    if (Test-Path -LiteralPath $log) { throw "Refusing to overwrite $log" }
    & $evaluate -Model $model -Log $log -Chunks 32
    if ($LASTEXITCODE -ne 0) { throw "Perplexity failed for $model" }
}
