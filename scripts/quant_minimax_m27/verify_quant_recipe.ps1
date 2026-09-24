#
# Verify MiniMax M2.7 GGUF tensor types against a recipe manifest.
# Reads GGUF tensor metadata directly; does not require Python or llama-gguf-dump.
#
# Usage:
#   .\verify_quant_recipe.ps1 -Model <quantized.gguf> -Recipe .\recipes\<manifest>.json
#

param(
    [Parameter(Mandatory=$true)]
    [string]$Model,

    [string]$Recipe = (Join-Path $PSScriptRoot "recipes\ram_88_bf16.json"),

    [switch]$AllowEmpty,

    [int]$MaxErrors = 50
)

$ErrorActionPreference = "Stop"

$QuantTypeNames = @{
    0 = "f32"; 1 = "f16"; 2 = "q4_0"; 3 = "q4_1"; 6 = "q5_0"; 7 = "q5_1";
    8 = "q8_0"; 9 = "q8_1"; 10 = "q2_k"; 11 = "q3_k"; 12 = "q4_k";
    13 = "q5_k"; 14 = "q6_k"; 15 = "q8_k"; 16 = "iq2_xxs"; 17 = "iq2_xs";
    18 = "iq3_xxs"; 19 = "iq1_s"; 20 = "iq4_nl"; 21 = "iq3_s"; 22 = "iq2_s";
    23 = "iq4_xs"; 24 = "i8"; 25 = "i16"; 26 = "i32"; 27 = "i64"; 28 = "f64";
    29 = "iq1_m"; 30 = "bf16"; 31 = "q4_0_4_4"; 32 = "q4_0_4_8";
    33 = "q4_0_8_8";
    36 = "i2_s"; 39 = "mxfp4"; 41 = "q1_0_g128";
    97 = "q8_0_x4"; 98 = "q8_1_x4"; 99 = "q8_2_x4";
    133 = "q6_0"; 134 = "iq1_bn"; 135 = "iq2_bn"; 136 = "q8_k64";
    137 = "iq2_k"; 138 = "iq3_k"; 139 = "iq4_k"; 140 = "iq5_k"; 141 = "iq6_k";
    144 = "iq4_ks"; 145 = "iq2_ks"; 146 = "iq4_kss"; 147 = "q8_k16"; 148 = "q8_k32";
    149 = "q8_kr8"; 150 = "q8_k128"; 151 = "q8_kv"; 152 = "iq5_ks"; 153 = "iq2_kt";
    154 = "iq3_kt"; 155 = "iq4_kt"; 156 = "iq3_ks"; 157 = "iq2_kl"; 158 = "iq1_kt";
    202 = "q4_0_r8"; 206 = "q5_0_r4"; 208 = "q8_0_r8"; 210 = "q2_k_r4"; 211 = "q3_k_r4";
    212 = "q4_k_r4"; 213 = "q5_k_r4"; 214 = "q6_k_r4"; 216 = "iq2_xxs_r4";
    217 = "iq2_xs_r4"; 218 = "iq3_xxs_r4"; 219 = "iq1_s_r4"; 220 = "iq4_nl_r4";
    221 = "iq3_s_r4"; 222 = "iq2_s_r4"; 223 = "iq4_xs_r8"; 229 = "iq1_m_r4";
    230 = "bf16_r16"; 233 = "q6_0_r4"; 335 = "iq2_bn_r4"; 337 = "iq2_k_r4";
    338 = "iq3_k_r4"; 339 = "iq4_k_r4"; 340 = "iq5_k_r4"; 344 = "iq4_ks_r4";
    352 = "iq5_ks_r4"; 398 = "q8_kv_r8"; 399 = "q8_k_r8"
}

function Read-GgufString {
    param([System.IO.BinaryReader]$Reader)
    $len = [int64]$Reader.ReadUInt64()
    $bytes = $Reader.ReadBytes($len)
    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Skip-GgufString {
    param([System.IO.BinaryReader]$Reader)
    $len = [int64]$Reader.ReadUInt64()
    $Reader.BaseStream.Seek($len, [System.IO.SeekOrigin]::Current) > $null
}

function Skip-GgufValue {
    param([System.IO.BinaryReader]$Reader, [uint32]$Type)
    switch ($Type) {
        0 { $Reader.BaseStream.Seek(1, [System.IO.SeekOrigin]::Current) > $null }
        1 { $Reader.BaseStream.Seek(1, [System.IO.SeekOrigin]::Current) > $null }
        2 { $Reader.BaseStream.Seek(2, [System.IO.SeekOrigin]::Current) > $null }
        3 { $Reader.BaseStream.Seek(2, [System.IO.SeekOrigin]::Current) > $null }
        4 { $Reader.BaseStream.Seek(4, [System.IO.SeekOrigin]::Current) > $null }
        5 { $Reader.BaseStream.Seek(4, [System.IO.SeekOrigin]::Current) > $null }
        6 { $Reader.BaseStream.Seek(4, [System.IO.SeekOrigin]::Current) > $null }
        7 { $Reader.BaseStream.Seek(1, [System.IO.SeekOrigin]::Current) > $null }
        8 { Skip-GgufString $Reader }
        9 {
            $itemType = $Reader.ReadUInt32()
            $count = [int64]$Reader.ReadUInt64()
            switch ($itemType) {
                0 { $Reader.BaseStream.Seek($count, [System.IO.SeekOrigin]::Current) > $null }
                1 { $Reader.BaseStream.Seek($count, [System.IO.SeekOrigin]::Current) > $null }
                2 { $Reader.BaseStream.Seek(2 * $count, [System.IO.SeekOrigin]::Current) > $null }
                3 { $Reader.BaseStream.Seek(2 * $count, [System.IO.SeekOrigin]::Current) > $null }
                4 { $Reader.BaseStream.Seek(4 * $count, [System.IO.SeekOrigin]::Current) > $null }
                5 { $Reader.BaseStream.Seek(4 * $count, [System.IO.SeekOrigin]::Current) > $null }
                6 { $Reader.BaseStream.Seek(4 * $count, [System.IO.SeekOrigin]::Current) > $null }
                7 { $Reader.BaseStream.Seek($count, [System.IO.SeekOrigin]::Current) > $null }
                8 {
                    for ($i = 0; $i -lt $count; $i++) {
                        $len = [int64]$Reader.ReadUInt64()
                        $Reader.BaseStream.Seek($len, [System.IO.SeekOrigin]::Current) > $null
                    }
                }
                10 { $Reader.BaseStream.Seek(8 * $count, [System.IO.SeekOrigin]::Current) > $null }
                11 { $Reader.BaseStream.Seek(8 * $count, [System.IO.SeekOrigin]::Current) > $null }
                12 { $Reader.BaseStream.Seek(8 * $count, [System.IO.SeekOrigin]::Current) > $null }
                default {
                    for ($i = 0; $i -lt $count; $i++) {
                        Skip-GgufValue $Reader $itemType
                    }
                }
            }
        }
        10 { $Reader.BaseStream.Seek(8, [System.IO.SeekOrigin]::Current) > $null }
        11 { $Reader.BaseStream.Seek(8, [System.IO.SeekOrigin]::Current) > $null }
        12 { $Reader.BaseStream.Seek(8, [System.IO.SeekOrigin]::Current) > $null }
        default { throw "Unsupported GGUF metadata value type: $Type" }
    }
}

function Read-GgufTensors {
    param([string]$Path)
    $fs = [System.IO.File]::OpenRead($Path)
    try {
        $reader = [System.IO.BinaryReader]::new($fs)
        $magic = [System.Text.Encoding]::ASCII.GetString($reader.ReadBytes(4))
        if ($magic -ne "GGUF") { throw "Not a GGUF file: $Path" }
        [void]$reader.ReadUInt32() # version
        $tensorCount = [int64]$reader.ReadUInt64()
        $kvCount = [int64]$reader.ReadUInt64()

        for ($i = 0; $i -lt $kvCount; $i++) {
            Skip-GgufString $reader
            $valueType = $reader.ReadUInt32()
            Skip-GgufValue $reader $valueType
        }

        $tensors = New-Object System.Collections.Generic.List[object]
        for ($i = 0; $i -lt $tensorCount; $i++) {
            $name = Read-GgufString $reader
            $nDims = $reader.ReadUInt32()
            for ($d = 0; $d -lt $nDims; $d++) { [void]$reader.ReadUInt64() }
            $typeId = [int]$reader.ReadUInt32()
            [void]$reader.ReadUInt64() # offset
            $typeName = if ($QuantTypeNames.ContainsKey($typeId)) { $QuantTypeNames[$typeId] } else { "unknown_$typeId" }
            $tensors.Add([pscustomobject]@{ Name = $name; Type = $typeName }) > $null
        }
        return $tensors
    } finally {
        $fs.Dispose()
    }
}

function Expand-Layers {
    param($Spec)
    $result = New-Object System.Collections.Generic.HashSet[int]
    if ($Spec -is [array]) {
        foreach ($item in $Spec) { [void]$result.Add([int]$item) }
        return $result
    }
    if ($Spec -is [int]) {
        [void]$result.Add($Spec)
        return $result
    }
    foreach ($part in ([string]$Spec).Split(",")) {
        $part = $part.Trim()
        if (-not $part) { continue }
        if ($part.Contains("-")) {
            $bounds = $part.Split("-", 2)
            $start = [int]$bounds[0]
            $end = [int]$bounds[1]
            for ($i = $start; $i -le $end; $i++) { [void]$result.Add($i) }
        } else {
            [void]$result.Add([int]$part)
        }
    }
    return $result
}

function Get-ExpectedType {
    param([string]$Name, $Manifest, [hashtable]$ExpertExpect)

    if ($Name -match 'blk\.(\d+)\.ffn_(down|gate|up)_exps(?:\.|$)') {
        $key = "$($Matches[1]):$($Matches[2])"
        if ($ExpertExpect.ContainsKey($key)) { return $ExpertExpect[$key] }
        return ([string]$Manifest.base_ftype).ToLowerInvariant()
    }
    if ($Name -match 'blk\.(\d+)\.attn_(q|k|v|output)(?:\.|$)') {
        $field = "attn_$($Matches[2])_type"
        return ([string]$Manifest.fixed_args.$field).ToLowerInvariant()
    }
    if ($Name -match 'blk\.(\d+)\.ffn_gate_inp(?:\.|$)') {
        return ([string]$Manifest.fixed_args.ffn_gate_inp_type).ToLowerInvariant()
    }
    if ($Name -match '(^|[.])token_embd($|[.])') {
        return ([string]$Manifest.fixed_args.token_embedding_type).ToLowerInvariant()
    }
    if ($Name -match '(^|[.])output($|[.])' -and $Name -notmatch 'output_norm') {
        return ([string]$Manifest.fixed_args.output_tensor_type).ToLowerInvariant()
    }
    return $null
}

if (-not (Test-Path $Model)) { throw "Model not found: $Model" }
if (-not (Test-Path $Recipe)) { throw "Recipe not found: $Recipe" }

$manifest = Get-Content $Recipe -Raw | ConvertFrom-Json
$expertExpect = @{}
foreach ($zone in $manifest.zones) {
    $layers = Expand-Layers $zone.layers
    foreach ($layer in $layers) {
        foreach ($role in @("down", "gate", "up")) {
            $field = "ffn_${role}_exps"
            $expertExpect["${layer}:${role}"] = ([string]$zone.$field).ToLowerInvariant()
        }
    }
}

$tensors = Read-GgufTensors $Model
$counts = @{}
$checkedCounts = @{}
$mismatches = New-Object System.Collections.Generic.List[object]
$checked = 0
$expertChecked = 0

foreach ($tensor in $tensors) {
    $type = $tensor.Type
    $counts[$type] = 1 + ($counts[$type] | ForEach-Object { if ($_ -eq $null) { 0 } else { $_ } })
    $expected = Get-ExpectedType $tensor.Name $manifest $expertExpect
    if ($null -eq $expected) { continue }
    $checked++
    if ($tensor.Name -match 'ffn_(down|gate|up)_exps') { $expertChecked++ }
    $checkedCounts[$type] = 1 + ($checkedCounts[$type] | ForEach-Object { if ($_ -eq $null) { 0 } else { $_ } })
    if ($type -ne $expected) {
        $mismatches.Add([pscustomobject]@{ Name = $tensor.Name; Expected = $expected; Actual = $type }) > $null
    }
}

Write-Host "Model:  $Model"
Write-Host "Recipe: $Recipe ($($manifest.id))"
Write-Host "Tensors total:   $($tensors.Count)"
Write-Host "Tensors checked: $checked"
Write-Host "Expert tensors:  $expertChecked"
Write-Host ""
Write-Host "All tensor type counts:"
$counts.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    Write-Host ("  {0,-10} {1}" -f $_.Key, $_.Value)
}
Write-Host ""
Write-Host "Checked tensor type counts:"
$checkedCounts.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    Write-Host ("  {0,-10} {1}" -f $_.Key, $_.Value)
}

if ($expertChecked -eq 0 -and -not $AllowEmpty) {
    Write-Host ""
    Write-Host "ERROR: no MiniMax expert FFN tensors were found. Refusing to pass a non-MiniMax or incomplete GGUF." -ForegroundColor Red
    exit 1
}

if ($mismatches.Count -gt 0) {
    Write-Host ""
    Write-Host "ERROR: $($mismatches.Count) tensor type mismatch(es)" -ForegroundColor Red
    $mismatches | Select-Object -First $MaxErrors | ForEach-Object {
        Write-Host "  $($_.Name): expected $($_.Expected), got $($_.Actual)"
    }
    if ($mismatches.Count -gt $MaxErrors) {
        Write-Host "  ... $($mismatches.Count - $MaxErrors) more"
    }
    exit 1
}

Write-Host ""
Write-Host "OK: checked tensors match recipe expectations." -ForegroundColor Green
