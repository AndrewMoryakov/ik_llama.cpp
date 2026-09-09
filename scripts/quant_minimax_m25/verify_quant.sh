#!/usr/bin/env bash
#
# Verify quantization of a MiniMax M2.5 GGUF file.
# Prints tensor types for expert FFN layers grouped by zone,
# plus non-expert tensor types.
#
# Usage:
#   ./verify_quant.sh <quantized.gguf>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GGUF_DUMP="${SCRIPT_DIR}/../../build/bin/llama-gguf-dump"

if [ ! -f "$GGUF_DUMP" ]; then
    GGUF_DUMP="${SCRIPT_DIR}/../../build/bin/llama-gguf-dump.exe"
fi

# Fallback to gguf-py if binary not available
if [ ! -f "$GGUF_DUMP" ]; then
    echo "llama-gguf-dump not found, trying gguf-py..."
    python3 -m gguf.scripts.gguf_dump --no-tensors "$1" 2>/dev/null || \
    python -m gguf.scripts.gguf_dump --no-tensors "$1" 2>/dev/null || \
    { echo "ERROR: No GGUF inspection tool found"; exit 1; }
    exit 0
fi

MODEL="${1:?Usage: $0 <quantized.gguf>}"

echo "============================================="
echo "  Tensor type verification: $(basename "$MODEL")"
echo "============================================="
echo ""

# Dump tensor info and filter relevant lines
"$GGUF_DUMP" "$MODEL" 2>/dev/null | grep -E "(ffn_down_exps|ffn_gate_exps|ffn_up_exps|token_embd|output_norm|output |attn_)" | head -80

echo ""
echo "--- Summary: unique expert FFN types ---"
"$GGUF_DUMP" "$MODEL" 2>/dev/null | grep -oP 'ffn_(down|gate|up)_exps.*' | \
    sed 's/.*type = //' | sort | uniq -c | sort -rn

echo ""
echo "Done."
