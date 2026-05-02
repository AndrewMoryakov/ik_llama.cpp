#!/usr/bin/env bash
#
# MiniMax M2.5 — Tapered-RAM v4 (~94 GiB)
# Budget redistribution: attention↓ experts↑
#
# Key change vs v3.1:
#   - attn_q: q8_0 → iq5_k (save ~370 MiB)
#   - attn_output: q8_0 → q5_K (save ~418 MiB)
#   - 18 layers sensitive-middle down_exps: iq3_ks → iq4_xs (spend ~2.74 GiB)
#   - Net: ~94 GiB (fills RAM budget)
#
# Zones (62 layers: blk.0 — blk.61):
#   Edge      [0-1, 60-61]   : down=iq5_k,  gate/up=iq4_xs
#   Bridge    [2-4, 57-59]   : down=iq4_xs,  gate/up=iq3_ks
#   Sensitive [5-13, 48-56]  : down=iq4_xs,  gate/up=iq3_ks  ← NEW
#   Core      [14-47]        : down=iq3_ks,  gate/up=iq3_ks
#
# Attention:
#   attn_q:      iq5_k  (was q8_0 in v3.1)
#   attn_k:      q8_0
#   attn_v:      q8_0
#   attn_output: q5_K   (was q8_0 in v3.1)
#
# Other:
#   Output head:   q8_0
#   Embeddings:    q8_0
#   Router:        f32
#   Norms:         f32
#
# Usage:
#   ./quantize_tapered_ram_v4.sh <source.gguf> <output.gguf> [imatrix.dat]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QUANTIZE="${SCRIPT_DIR}/../../build/bin/llama-quantize"

if [ ! -f "$QUANTIZE" ]; then
    QUANTIZE="${SCRIPT_DIR}/../../build/bin/llama-quantize.exe"
fi

if [ ! -f "$QUANTIZE" ]; then
    echo "ERROR: llama-quantize not found at ${SCRIPT_DIR}/../../build/bin/"
    exit 1
fi

SRC="${1:?Usage: $0 <source.gguf> <output.gguf> [imatrix.dat]}"
DST="${2:?Usage: $0 <source.gguf> <output.gguf> [imatrix.dat]}"
IMATRIX="${3:-}"

# --- Build regex rules (first match wins) ---

# Edge layers: 0, 1, 60, 61
EDGE_DOWN='blk\.(0|1|60|61)\.ffn_down_exps=iq5_k'
EDGE_GATE='blk\.(0|1|60|61)\.ffn_gate_exps=iq4_xs'
EDGE_UP='blk\.(0|1|60|61)\.ffn_up_exps=iq4_xs'

# Bridge layers: 2, 3, 4, 57, 58, 59
BRIDGE_DOWN='blk\.(2|3|4|57|58|59)\.ffn_down_exps=iq4_xs'
BRIDGE_GATE='blk\.(2|3|4|57|58|59)\.ffn_gate_exps=iq3_ks'
BRIDGE_UP='blk\.(2|3|4|57|58|59)\.ffn_up_exps=iq3_ks'

# Sensitive-middle layers: 5-13, 48-56 (18 layers) — down upgraded to iq4_xs
SENS_DOWN='blk\.([5-9]|1[0-3]|4[89]|5[0-6])\.ffn_down_exps=iq4_xs'
SENS_GATE='blk\.([5-9]|1[0-3]|4[89]|5[0-6])\.ffn_gate_exps=iq3_ks'
SENS_UP='blk\.([5-9]|1[0-3]|4[89]|5[0-6])\.ffn_up_exps=iq3_ks'

# Core layers 14-47: fall through to base ftype IQ3_KS

CUSTOM_RULES="${EDGE_DOWN},${EDGE_GATE},${EDGE_UP}"
CUSTOM_RULES="${CUSTOM_RULES},${BRIDGE_DOWN},${BRIDGE_GATE},${BRIDGE_UP}"
CUSTOM_RULES="${CUSTOM_RULES},${SENS_DOWN},${SENS_GATE},${SENS_UP}"

# --- Imatrix flag ---
IMATRIX_FLAG=""
if [ -n "$IMATRIX" ]; then
    IMATRIX_FLAG="--imatrix ${IMATRIX}"
fi

echo "============================================="
echo "  MiniMax M2.5 — Tapered-RAM v4 (~94 GiB)"
echo "============================================="
echo "Source:     $SRC"
echo "Output:     $DST"
echo "Imatrix:    ${IMATRIX:-none}"
echo ""
echo "Zone map:"
echo "  Edge      [0-1,60-61]   down=iq5_k   gate/up=iq4_xs"
echo "  Bridge    [2-4,57-59]   down=iq4_xs   gate/up=iq3_ks"
echo "  Sensitive [5-13,48-56]  down=iq4_xs   gate/up=iq3_ks"
echo "  Core      [14-47]       down=iq3_ks   gate/up=iq3_ks"
echo "  Attention q:            iq5_k"
echo "  Attention k/v:          q8_0"
echo "  Attention output:       q5_K"
echo "  Output head:            q8_0"
echo "  Embeddings:             q8_0"
echo "============================================="
echo ""

"$QUANTIZE" \
    $IMATRIX_FLAG \
    --allow-requantize \
    --output-tensor-type q8_0 \
    --token-embedding-type q8_0 \
    --attn-q-type iq5_k \
    --attn-k-type q8_0 \
    --attn-v-type q8_0 \
    --attn-output-type q5_K \
    --ffn-gate-inp-type f32 \
    --custom-q "$CUSTOM_RULES" \
    "$SRC" \
    "$DST" \
    IQ3_KS

echo ""
echo "Done: $DST"
