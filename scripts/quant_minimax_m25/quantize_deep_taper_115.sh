#!/usr/bin/env bash
#
# MiniMax M2.5 — Deep-Taper 115 (~115 GiB)
# Quality ceiling, ~20% RAM overflow. Five-zone ladder.
#
# Zones (62 layers: blk.0 — blk.61):
#   Edge             [0-3, 58-61]    : down_exps=iq5_k,  gate/up_exps=iq5_k
#   Bridge           [4-7, 54-57]    : down_exps=iq5_k,  gate/up_exps=iq4_xs
#   Middle-sensitive  [8-11, 50-53]  : down_exps=iq5_k,  gate/up_exps=iq4_xs
#   Middle-high      [12-16, 45-49]  : down_exps=iq5_k,  gate/up_exps=iq3_ks
#   Middle-core      [17-44]         : down_exps=iq4_xs,  gate/up_exps=iq3_ks
#
# Non-expert tensors:
#   Attention (all):  Q8_0  (via base ftype)
#   Norms / Router:   Q8_0  (via base ftype)
#   Output head:      Q8_0  (--output-tensor-type)
#   Embeddings:       Q8_0  (--token-embedding-type)
#
# Usage:
#   ./quantize_deep_taper_115.sh <source.gguf> <output.gguf> [imatrix.dat]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QUANTIZE="${SCRIPT_DIR}/../../build/bin/llama-quantize"

if [ ! -f "$QUANTIZE" ]; then
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

# Edge layers: 0, 1, 2, 3, 58, 59, 60, 61
EDGE_DOWN='blk\.(0|1|2|3|58|59|60|61)\.ffn_down_exps=iq5_k'
EDGE_GATE='blk\.(0|1|2|3|58|59|60|61)\.ffn_gate_exps=iq5_k'
EDGE_UP='blk\.(0|1|2|3|58|59|60|61)\.ffn_up_exps=iq5_k'

# Bridge layers: 4, 5, 6, 7, 54, 55, 56, 57
BRIDGE_DOWN='blk\.(4|5|6|7|54|55|56|57)\.ffn_down_exps=iq5_k'
BRIDGE_GATE='blk\.(4|5|6|7|54|55|56|57)\.ffn_gate_exps=iq4_xs'
BRIDGE_UP='blk\.(4|5|6|7|54|55|56|57)\.ffn_up_exps=iq4_xs'

# Middle-sensitive layers: 8, 9, 10, 11, 50, 51, 52, 53
MSENS_DOWN='blk\.(8|9|10|11|50|51|52|53)\.ffn_down_exps=iq5_k'
MSENS_GATE='blk\.(8|9|10|11|50|51|52|53)\.ffn_gate_exps=iq4_xs'
MSENS_UP='blk\.(8|9|10|11|50|51|52|53)\.ffn_up_exps=iq4_xs'

# Middle-high layers: 12, 13, 14, 15, 16, 45, 46, 47, 48, 49
MHIGH_DOWN='blk\.(1[2-6]|4[5-9])\.ffn_down_exps=iq5_k'
MHIGH_GATE='blk\.(1[2-6]|4[5-9])\.ffn_gate_exps=iq3_ks'
MHIGH_UP='blk\.(1[2-6]|4[5-9])\.ffn_up_exps=iq3_ks'

# Middle-core layers 17-44: down_exps=iq4_xs, gate/up_exps=iq3_ks
MCORE_DOWN='blk\.(1[7-9]|[23][0-9]|4[0-4])\.ffn_down_exps=iq4_xs'
MCORE_GATE='blk\.(1[7-9]|[23][0-9]|4[0-4])\.ffn_gate_exps=iq3_ks'
MCORE_UP='blk\.(1[7-9]|[23][0-9]|4[0-4])\.ffn_up_exps=iq3_ks'

CUSTOM_RULES="${EDGE_DOWN},${EDGE_GATE},${EDGE_UP}"
CUSTOM_RULES="${CUSTOM_RULES},${BRIDGE_DOWN},${BRIDGE_GATE},${BRIDGE_UP}"
CUSTOM_RULES="${CUSTOM_RULES},${MSENS_DOWN},${MSENS_GATE},${MSENS_UP}"
CUSTOM_RULES="${CUSTOM_RULES},${MHIGH_DOWN},${MHIGH_GATE},${MHIGH_UP}"
CUSTOM_RULES="${CUSTOM_RULES},${MCORE_DOWN},${MCORE_GATE},${MCORE_UP}"

# --- Imatrix flag ---
IMATRIX_FLAG=""
if [ -n "$IMATRIX" ]; then
    IMATRIX_FLAG="--imatrix ${IMATRIX}"
fi

echo "============================================="
echo "  MiniMax M2.5 — Deep-Taper 115 (~115 GiB)"
echo "============================================="
echo "Source:     $SRC"
echo "Output:     $DST"
echo "Imatrix:    ${IMATRIX:-none}"
echo ""
echo "Zone map:"
echo "  Edge       [0-3,58-61]    down=iq5_k   gate/up=iq5_k"
echo "  Bridge     [4-7,54-57]    down=iq5_k   gate/up=iq4_xs"
echo "  Mid-sens   [8-11,50-53]   down=iq5_k   gate/up=iq4_xs"
echo "  Mid-high   [12-16,45-49]  down=iq5_k   gate/up=iq3_ks"
echo "  Mid-core   [17-44]        down=iq4_xs   gate/up=iq3_ks"
echo "  Attention/Norms:          q8_0"
echo "  Output head:              q8_0"
echo "  Embeddings:               q8_0"
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
