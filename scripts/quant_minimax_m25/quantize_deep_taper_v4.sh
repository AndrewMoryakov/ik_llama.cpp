#!/usr/bin/env bash
#
# MiniMax M2.5 — Deep-Taper v4 (~114 GiB, BPW ~4.26)
# Five-zone ladder with attention budget redistributed to experts.
#
# Zones (62 layers: blk.0 — blk.61):
#   Edge      [0-3, 58-61]   (8):  down=iq5_k,  gate/up=iq5_k
#   Bridge    [4-7, 54-57]   (8):  down=iq5_k,  gate/up=iq4_xs
#   Mid-sens  [8-13, 48-53]  (12): down=iq5_k,  gate/up=iq4_xs
#   Mid-high  [14-17, 44-47] (8):  down=iq5_k,  gate/up=iq3_ks
#   Core      [18-43]        (26): down=iq4_xs,  gate/up=iq3_ks
#
# Attention (redistributed from q8_0):
#   attn_q:      iq5_k
#   attn_k:      q8_0
#   attn_v:      q8_0
#   attn_output: q5_K
#
# Other:
#   Output head:   q8_0
#   Embeddings:    q8_0
#   Router:        f32
#
# Usage:
#   ./quantize_deep_taper_v4.sh <source.gguf> <output.gguf> [imatrix.dat]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QUANTIZE="${SCRIPT_DIR}/../../build/bin/llama-quantize"
if [ ! -f "$QUANTIZE" ]; then
    QUANTIZE="${SCRIPT_DIR}/../../build/bin/llama-quantize.exe"
fi
if [ ! -f "$QUANTIZE" ]; then
    echo "ERROR: llama-quantize not found"; exit 1
fi

SRC="${1:?Usage: $0 <source.gguf> <output.gguf> [imatrix.dat]}"
DST="${2:?Usage: $0 <source.gguf> <output.gguf> [imatrix.dat]}"
IMATRIX="${3:-}"

# --- Regex rules (first match wins) ---

# Edge [0-3, 58-61]: all iq5_k
EDGE='blk\.(0|1|2|3|58|59|60|61)\.ffn_down_exps=iq5_k'
EDGE="${EDGE},blk\.(0|1|2|3|58|59|60|61)\.ffn_gate_exps=iq5_k"
EDGE="${EDGE},blk\.(0|1|2|3|58|59|60|61)\.ffn_up_exps=iq5_k"

# Bridge [4-7, 54-57]: down=iq5_k, gate/up=iq4_xs
BRIDGE='blk\.(4|5|6|7|54|55|56|57)\.ffn_down_exps=iq5_k'
BRIDGE="${BRIDGE},blk\.(4|5|6|7|54|55|56|57)\.ffn_gate_exps=iq4_xs"
BRIDGE="${BRIDGE},blk\.(4|5|6|7|54|55|56|57)\.ffn_up_exps=iq4_xs"

# Mid-sens [8-13, 48-53]: down=iq5_k, gate/up=iq4_xs
MSENS='blk\.([89]|1[0-3]|4[89]|5[0-3])\.ffn_down_exps=iq5_k'
MSENS="${MSENS},blk\.([89]|1[0-3]|4[89]|5[0-3])\.ffn_gate_exps=iq4_xs"
MSENS="${MSENS},blk\.([89]|1[0-3]|4[89]|5[0-3])\.ffn_up_exps=iq4_xs"

# Mid-high [14-17, 44-47]: down=iq5_k, gate/up=iq3_ks
MHIGH='blk\.(1[4-7]|4[4-7])\.ffn_down_exps=iq5_k'
MHIGH="${MHIGH},blk\.(1[4-7]|4[4-7])\.ffn_gate_exps=iq3_ks"
MHIGH="${MHIGH},blk\.(1[4-7]|4[4-7])\.ffn_up_exps=iq3_ks"

# Core [18-43]: down=iq4_xs, gate/up=iq3_ks
CORE='blk\.(1[89]|[23][0-9]|4[0-3])\.ffn_down_exps=iq4_xs'
CORE="${CORE},blk\.(1[89]|[23][0-9]|4[0-3])\.ffn_gate_exps=iq3_ks"
CORE="${CORE},blk\.(1[89]|[23][0-9]|4[0-3])\.ffn_up_exps=iq3_ks"

CUSTOM_RULES="${EDGE},${BRIDGE},${MSENS},${MHIGH},${CORE}"

IMATRIX_FLAG=""
if [ -n "$IMATRIX" ]; then
    IMATRIX_FLAG="--imatrix ${IMATRIX}"
fi

echo "============================================="
echo "  MiniMax M2.5 — Deep-Taper v4 (~114 GiB)"
echo "  BPW ~4.26 | 5 zones | attention redistributed"
echo "============================================="
echo "Source:     $SRC"
echo "Output:     $DST"
echo "Imatrix:    ${IMATRIX:-none}"
echo ""
echo "Zone map:"
echo "  Edge      [0-3,58-61]   (8)  down=iq5_k   gate/up=iq5_k"
echo "  Bridge    [4-7,54-57]   (8)  down=iq5_k   gate/up=iq4_xs"
echo "  Mid-sens  [8-13,48-53]  (12) down=iq5_k   gate/up=iq4_xs"
echo "  Mid-high  [14-17,44-47] (8)  down=iq5_k   gate/up=iq3_ks"
echo "  Core      [18-43]       (26) down=iq4_xs   gate/up=iq3_ks"
echo "  Attention q: iq5_k | k/v: q8_0 | output: q5_K"
echo "  Embeddings/Output head: q8_0"
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
