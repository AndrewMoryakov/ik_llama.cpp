"""Create a two-expert Llama model and check warmup across reused decode graphs."""

from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "gguf-py"))
import gguf


def write_model(path):
    writer = gguf.GGUFWriter(path, "llama")
    writer.add_context_length(128)
    writer.add_embedding_length(32)
    writer.add_block_count(1)
    writer.add_feed_forward_length(32)
    writer.add_head_count(1)
    writer.add_head_count_kv(1)
    writer.add_rope_dimension_count(32)
    writer.add_layer_norm_rms_eps(1e-5)
    writer.add_expert_count(2)
    writer.add_expert_used_count(1)
    writer.add_tokenizer_model("llama")
    writer.add_token_list(["<unk>", "<s>", "</s>", "a", "b", "c", "d", "e"])
    writer.add_token_scores([0.0] * 8)
    writer.add_token_types([2, 3, 3, 1, 1, 1, 1, 1])
    writer.add_bos_token_id(1)
    writer.add_eos_token_id(2)
    writer.add_unk_token_id(0)

    rng = np.random.default_rng(42)
    writer.add_tensor("token_embd.weight", rng.normal(0, 0.1, (8, 32)).astype(np.float32))
    for name in ("output_norm", "blk.0.attn_norm", "blk.0.ffn_norm"):
        writer.add_tensor(name + ".weight", np.ones(32, dtype=np.float32))
    for name in ("attn_q", "attn_k", "attn_v", "attn_output"):
        writer.add_tensor(f"blk.0.{name}.weight", rng.normal(0, 0.1, (32, 32)).astype(np.float32))
    writer.add_tensor("blk.0.ffn_gate_inp.weight", rng.normal(0, 0.1, (2, 32)).astype(np.float32))
    for name in ("ffn_gate_exps", "ffn_up_exps", "ffn_down_exps"):
        writer.add_tensor(f"blk.0.{name}.weight", rng.normal(0, 0.1, (2, 32, 32)).astype(np.float32))
    writer.write_header_to_file()
    writer.write_kv_data_to_file()
    writer.write_tensors_to_file()
    writer.close()


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as directory:
        fixture = Path(directory) / "moe.gguf"
        write_model(fixture)
        subprocess.run([sys.argv[1], str(fixture)], check=True, timeout=30)
