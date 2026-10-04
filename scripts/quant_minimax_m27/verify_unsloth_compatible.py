"""Check an r2 GGUF against its exact tensor plan and Unsloth GGML type range."""

import argparse
import collections
import json
import sys
from pathlib import Path

from measure_tensor_sizes import read_header
from prepare_unsloth_compatible import GGML_IDS, RECIPES, ROOT, SOURCE, expert_type_map, tensor_type

sys.path.insert(0, r"D:\ik_llama-unsloth\gguf-py")
import gguf  # noqa: E402 - use the installed Unsloth runtime's GGML block sizes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("profile", choices=RECIPES)
    parser.add_argument("model", type=Path)
    args = parser.parse_args()
    recipe = json.loads((ROOT / "recipes" / RECIPES[args.profile]).read_text(encoding="utf-8"))
    experts = expert_type_map(recipe)
    if args.profile == "ram_safe":
        for layer in (*range(5, 10), *range(52, 57)):
            for role in ("gate", "up"):
                experts[f"blk.{layer}.ffn_{role}_exps.weight"] = "iq3_xxs"
    source = {}
    for shard in sorted(SOURCE.glob("MiniMax-M2.7-BF16-*.gguf")):
        source.update({t["name"]: t for t in read_header(shard)[1]})
    _, tensors, header_end = read_header(args.model)
    actual = {t["name"]: t for t in tensors}
    if len(actual) != len(tensors) or set(actual) != set(source):
        raise ValueError(f"Tensor set mismatch: expected {len(source)}, got {len(tensors)}")
    mismatch = []
    counts = collections.Counter()
    final_tensor_end = 0
    for name, tensor in actual.items():
        expected = tensor_type(source[name], experts, args.profile)
        counts[expected] += 1
        if tensor["type"] != GGML_IDS[expected] or tensor["dims"] != source[name]["dims"]:
            mismatch.append((name, expected, tensor["type"], tensor["dims"]))
        if tensor["type"] >= 67:
            mismatch.append((name, "unsupported by Unsloth", tensor["type"]))
        block, width = gguf.GGML_QUANT_SIZES[gguf.GGMLQuantizationType(tensor["type"])]
        if tensor["count"] % block:
            mismatch.append((name, "invalid block count", tensor["count"], block))
        final_tensor_end = max(final_tensor_end, tensor["offset"] + tensor["count"] * width // block)
    if mismatch:
        raise ValueError(f"{len(mismatch)} tensor mismatches; first: {mismatch[:5]}")
    if args.model.stat().st_size < header_end + final_tensor_end:
        raise ValueError("Truncated GGUF tensor payload")
    print(json.dumps({"model": str(args.model), "tensors": len(tensors),
                      "bytes": args.model.stat().st_size, "types": dict(counts)}, indent=2))


if __name__ == "__main__":
    main()
