# Historical batch that produced balanced_74 and the oversized ram_88 research
# variant. The selected RAM profile is run_ram81.ps1. Existing GGUF files are
# never overwritten. Check each .state.json and the batch stdout for verification.
$ErrorActionPreference = "Stop"

$source = "E:\Lm Models\unsloth\MiniMax-M2,7-BF16\MiniMax-M2.7-BF16-00001-of-00010.gguf"
$imatrix = "E:\Lm Models\unsloth\MiniMax-M2,7-BF16\imatrix_minimax_m27_unsloth.dat"
$runner = Join-Path $PSScriptRoot "run_recipe.ps1"
$verifier = Join-Path $PSScriptRoot "verify_quant_recipe.ps1"

$jobs = @(
    @{
        Name = "balanced_74"
        Recipe = Join-Path $PSScriptRoot "recipes\balanced_74_bf16.json"
        Output = "E:\Lm Models\AndrewM\MiniMax-M2.7-Balanced-74\MiniMax-M2.7-Balanced-74-BF16-imatrix.gguf"
    },
    @{
        Name = "ram_88"
        Recipe = Join-Path $PSScriptRoot "recipes\ram_88_bf16.json"
        Output = "E:\Lm Models\AndrewM\MiniMax-M2.7-RAM-88-Research\MiniMax-M2.7-RAM-88-BF16-imatrix.gguf"
    }
)

foreach ($job in $jobs) {
    $output = $job.Output
    $statePath = "$output.state.json"
    if (Test-Path -LiteralPath $output) {
        throw "Refusing to overwrite existing GGUF: $output"
    }
    $started = (Get-Date).ToString("o")
    [pscustomobject]@{
        name = $job.Name
        status = "running"
        started = $started
        output = $output
        recipe = $job.Recipe
        pid = $PID
    } | ConvertTo-Json | Set-Content -LiteralPath $statePath

    & $runner -Source $source -Output $output -Imatrix $imatrix -Recipe $job.Recipe 1> "$output.quant.log" 2> "$output.quant.err.log"
    if ($LASTEXITCODE -ne 0) {
        throw "$($job.Name) quantization failed with exit code $LASTEXITCODE"
    }
    if (-not (Test-Path -LiteralPath $output)) {
        throw "$($job.Name) produced no GGUF"
    }
    & $verifier -Model $output -Recipe $job.Recipe 1> "$output.verify.log" 2> "$output.verify.err.log"
    if ($LASTEXITCODE -ne 0) {
        throw "$($job.Name) tensor verification failed with exit code $LASTEXITCODE"
    }
    [pscustomobject]@{
        name = $job.Name
        status = "verified"
        started = $started
        completed = (Get-Date).ToString("o")
        output = $output
        recipe = $job.Recipe
        bytes = (Get-Item -LiteralPath $output).Length
        pid = $PID
    } | ConvertTo-Json | Set-Content -LiteralPath $statePath
}
