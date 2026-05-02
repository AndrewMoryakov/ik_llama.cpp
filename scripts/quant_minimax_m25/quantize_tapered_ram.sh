#!/usr/bin/env bash
#
# MiniMax M2.5 — Tapered-RAM (~91 GiB)
# Daily-driver under 96 GB RAM, two-step taper geometry.
#
# Zones (62 layers: blk.0 — blk.61):
#   Edge   [0-1, 60-61]  : down_exps=iq5_k,  gate/up_exps=iq4_xs
#   Bridge [2-4, 57-59]  : down_exps=iq4_xs,  gate/up_exps=iq3_ks
#   Core   [5-56]        : down_exps=iq3_ks,  gate/up_exps=iq3_ks
#
# Non-expert tensors:
#   Attention (all):  Q8_0  (via base ftype)
#   Norms / Router:   Q8_0  (via base ftype)
#   Output head:      Q8_0  (--output-tensor-type)
#   Embeddings:       iq4_k (--token-embedding-type)
#
# Usage:
#   ./quantize_tapered_ram.sh <source.gguf> <output.gguf> [imatrix.dat]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QUANTIZE="${SCRIPT_DIR}/../../build/bin/llama-quantize"

if [ ! -f "$QUANTIZE" ]; then
    # Try Windows .exe
    QUANTIZE="${SCRIPT_DIR}/../../build/bin/llama-quantize.exe"
fi

if [ ! -f "$QUANTIZE" ]; then
    echo "ERROR: llama-quantize not found at ${SCRIPT_DIR}/../../build/bin/"
    echo "Build the project first: cmake --build build --target llama-quantize"
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

# Core layers 5-56: down_exps=iq3_ks, gate/up_exps=iq3_ks
# These fall through to the base ftype (IQ3_KS), so we set base=IQ3_KS
# and override everything else upward.

CUSTOM_RULES="${EDGE_DOWN},${EDGE_GATE},${EDGE_UP},${BRIDGE_DOWN},${BRIDGE_GATE},${BRIDGE_UP}"

# --- Imatrix flag ---
IMATRIX_FLAG=""
if [ -n "$IMATRIX" ]; then
    IMATRIX_FLAG="--imatrix ${IMATRIX}"
fi

echo "============================================="
echo "  MiniMax M2.5 — Tapered-RAM (~91 GiB)"
echo "============================================="
echo "Source:     $SRC"
echo "Output:     $DST"
echo "Imatrix:    ${IMATRIX:-none}"
echo ""
echo "Zone map:"
echo "  Edge   [0-1,60-61]  down=iq5_k  gate/up=iq4_xs"
echo "  Bridge [2-4,57-59]  down=iq4_xs  gate/up=iq3_ks"
echo "  Core   [5-56]       down=iq3_ks  gate/up=iq3_ks"
echo "  Attention/Norms:    q8_0"
echo "  Output head:        q8_0"
echo "  Embeddings:         q8_0"
echo "============================================="
echo ""

"$QUANTIZE" \
    $IMATRIX_FLAG \
    --allow-requantize \
    --output-tensor-type q8_0 \
    --token-embedding-type q8_0 \
    --attn-q-type q8_0 \
    --attn-k-type q8_0 \
    --attn-v-type q8_0 \
    --attn-output-type q8_0 \
    --ffn-gate-inp-type f32 \
    --custom-q "$CUSTOM_RULES" \
    "$SRC" \
    "$DST" \
    IQ3_KS

echo ""
echo "Done: $DST"
