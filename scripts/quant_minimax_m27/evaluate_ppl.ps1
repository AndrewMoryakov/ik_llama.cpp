# Matched wikitext-2 perplexity run for completed MiniMax M2.7 GGUF files.
param(
    [Parameter(Mandatory=$true)][string]$Model,
    [Parameter(Mandatory=$true)][string]$Log,
    [int]$Chunks = 32,
    [switch]$Mmap
)

$ErrorActionPreference = "Stop"
$binary = "D:\build-zen4\bin\llama-perplexity.exe"
$corpus = "D:\wikitext-2-raw\wiki.test.raw"
if (-not (Test-Path -LiteralPath $Model)) { throw "Model missing: $Model" }
if (-not (Test-Path -LiteralPath $binary)) { throw "Binary missing: $binary" }
if (-not (Test-Path -LiteralPath $corpus)) { throw "Corpus missing: $corpus" }
if (Test-Path -LiteralPath $Log) { throw "Refusing to overwrite PPL log: $Log" }

$arguments = @(
    "-m", $Model,
    "-f", $corpus,
    "-c", "512",
    "-b", "512",
    "-ub", "512",
    "-t", "16",
    "-ngl", "0",
    "--chunks", [string]$Chunks
)
if (-not $Mmap) { $arguments += "--no-mmap" }

& $binary @arguments 1> $Log 2> "$Log.err"
if ($LASTEXITCODE -ne 0) { throw "Perplexity exited with code $LASTEXITCODE" }
