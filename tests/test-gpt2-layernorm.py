"""Build a tiny untrained GPT-2 fixture to exercise the FFN LayerNorm graph."""

import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "gguf-py"))
import gguf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cli", required=True)
    args = parser.parse_args()
    vocab = gguf.GGUFReader(root / "models/ggml-vocab-gpt-2.gguf")
    with tempfile.TemporaryDirectory(prefix="ik-gpt2-norm-") as directory:
        model = Path(directory) / "tiny-gpt2.gguf"
        timing = Path(directory) / "timing.ndjson"
        writer = gguf.GGUFWriter(model, "gpt2")
        for name, field in vocab.fields.items():
            if name.startswith("tokenizer."):
                subtype = field.types[-1] if field.types[0] == gguf.GGUFValueType.ARRAY else None
                writer.add_key_value(name, field.contents(), field.types[0], subtype)
        for name, value in (("block_count", 1), ("context_length", 256),
                            ("embedding_length", 32), ("feed_forward_length", 64),
                            ("attention.head_count", 2)):
            writer.add_uint32("gpt2." + name, value)
        writer.add_float32("gpt2.attention.layer_norm_epsilon", 1e-5)
        rng = np.random.default_rng(42)
        n_vocab = len(vocab.fields["tokenizer.ggml.tokens"].contents())
        shapes = {
            "token_embd.weight": (n_vocab, 32), "position_embd.weight": (256, 32),
            "output_norm.weight": (32,), "output_norm.bias": (32,), "output.weight": (n_vocab, 32),
            "blk.0.attn_norm.weight": (32,), "blk.0.attn_norm.bias": (32,),
            "blk.0.attn_qkv.weight": (96, 32), "blk.0.attn_qkv.bias": (96,),
            "blk.0.attn_output.weight": (32, 32), "blk.0.attn_output.bias": (32,),
            "blk.0.ffn_norm.weight": (32,), "blk.0.ffn_norm.bias": (32,),
            "blk.0.ffn_up.weight": (64, 32), "blk.0.ffn_up.bias": (64,),
            "blk.0.ffn_down.weight": (32, 64), "blk.0.ffn_down.bias": (32,),
        }
        for name, shape in shapes.items():
            if "norm.weight" in name:
                data = np.ones(shape, dtype=np.float32)
            elif "norm.bias" in name:
                data = np.full(shape, 0.2, dtype=np.float32)
            else:
                data = (0.02 * rng.standard_normal(shape)).astype(np.float32)
            writer.add_tensor(name, data)
        writer.write_header_to_file()
        writer.write_kv_data_to_file()
        writer.write_tensors_to_file()
        writer.close()
        run = subprocess.run(
            [args.cli, "-m", str(model), "-p", "hello world", "-n", "4", "-c", "256",
             "-t", "2", "-ngl", "0", "-s", "42", "--ignore-eos", "--no-display-prompt",
             "--token-timing", str(timing)], capture_output=True, timeout=60,
        )
        if run.returncode:
            raise AssertionError(run.stderr.decode(errors="replace")[-5000:])
        end = json.loads(timing.read_text().splitlines()[-1])
        assert end["complete"] and end["generated_tokens"] == 4, end
    print("GPT-2 FFN LayerNorm graph generated four tokens on a synthetic model")


if __name__ == "__main__":
    main()
