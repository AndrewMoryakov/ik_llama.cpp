"""Check fork-relevant quantizer layout invariants on the small model fixture."""

import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "gguf-py"))
import gguf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cli", required=True)
    parser.add_argument("--quantize", required=True)
    args = parser.parse_args()
    model = os.getenv("LLAMACPP_TEST_MODELFILE")
    if not model:
        return 77

    with tempfile.TemporaryDirectory(prefix="ik-quantize-invariants-") as directory:
        output = Path(directory) / "token-embedding-iq4-xs.gguf"
        result = subprocess.run(
            [args.quantize, "--token-embedding-type", "IQ4_XS",
             model, str(output), "F16"],
            capture_output=True, timeout=60,
        )
        error = result.stderr.decode(errors="replace")
        assert result.returncode == 0, error[-5000:]
        reader = gguf.GGUFReader(output)
        token = next(tensor for tensor in reader.tensors if tensor.name == "token_embd.weight")
        assert token.tensor_type == gguf.GGMLQuantizationType.IQ4_NL, token.tensor_type
        smoke = subprocess.run(
            [args.cli, "-m", str(output), "-p", "hello", "-n", "1", "-c", "128",
             "-t", "2", "-ngl", "0", "-s", "42", "--ignore-eos", "--no-display-prompt"],
            capture_output=True, timeout=60,
        )
        assert smoke.returncode == 0, smoke.stderr.decode(errors="replace")[-5000:]

    print("Token embeddings avoided row-interleaved IQ4_KS_R16 fallback")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
