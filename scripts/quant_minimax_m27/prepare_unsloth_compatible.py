"""Generate exact per-tensor GGUF quantization plans for the Unsloth runtime.

The Unsloth runtime accepts GGML types 0..66. This converts the existing
MiniMax M2.7 expert zone recipes to supported types while restoring all
non-expert tensors to their original BF16/F32 precision. The 88 GiB research
profile keeps attention at Q8_0 to limit its already tight RAM footprint.
"""

import argparse
import json
import re
from pathlib import Path

from measure_tensor_sizes import read_header


ROOT = Path(__file__).resolve().parent
SOURCE = Path(r"E:\Lm Models\unsloth\MiniMax-M2,7-BF16")
OUTPUT = ROOT / "unsloth_compatible"
RECIPES = {
    "compact": "compact_50_bf16.json",
    "balanced": "balanced_74_bf16.json",
    "ram_safe": "balanced_74_bf16.json",
    "ram81": "ram_81_bf16.json",
    "ram88": "ram_88_bf16.json",
}
REPLACEMENTS = {"iq3_ks": "iq3_s", "iq5_k": "q5_k"}
GGML_IDS = {
    "f32": 0, "bf16": 30, "q5_k": 13, "q8_0": 8, "iq1_s": 19,
    "iq2_xs": 17, "iq2_s": 22, "iq3_s": 21, "iq3_xxs": 18,
    "iq4_xs": 23,
}


def layers(spec):
    if isinstance(spec, list):
        return spec
    result = []
    for part in str(spec).split(","):
        ends = part.split("-")
        result.extend(range(int(ends[0]), int(ends[-1]) + 1))
    return result


def expert_type_map(recipe):
    output = {}
    for zone in recipe["zones"]:
        for layer in layers(zone["layers"]):
            for role in ("down", "gate", "up"):
                name = f"blk.{layer}.ffn_{role}_exps.weight"
                old = zone[f"ffn_{role}_exps"].lower()
                output[name] = REPLACEMENTS.get(old, old)
    if len(output) != 62 * 3:
        raise ValueError(f"Expected 186 expert tensors, found {len(output)}")
    return output


def tensor_type(tensor, experts, profile):
    name = tensor["name"]
    if name in experts:
        return experts[name]
    if name.startswith("blk.") and re.fullmatch(r"blk\.\d+\.attn_(q|k|v|output)\.weight", name):
        return "q8_0" if profile == "ram88" else "bf16"
    if tensor["type"] == 0:
        return "f32"
    if tensor["type"] == 30:
        return "bf16"
    raise ValueError(f"Unexpected source type for {name}: {tensor['type']}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    shards = sorted(args.source.glob("MiniMax-M2.7-BF16-*.gguf"))
    if len(shards) != 10:
        raise ValueError(f"Expected ten BF16 shards in {args.source}, found {len(shards)}")
    source = {}
    for shard in shards:
        _, tensors, _ = read_header(shard)
        for tensor in tensors:
            if tensor["name"] in source:
                raise ValueError(f"Duplicate tensor: {tensor['name']}")
            source[tensor["name"]] = tensor
    if len(source) != 809:
        raise ValueError(f"Expected 809 source tensors, found {len(source)}")
    args.output.mkdir(parents=True, exist_ok=True)
    for profile, filename in RECIPES.items():
        recipe = json.loads((ROOT / "recipes" / filename).read_text(encoding="utf-8"))
        experts = expert_type_map(recipe)
        if profile == "ram_safe":
            # Raise gate/up precision at both sensitive-zone boundaries,
            # retaining measured RAM headroom for a no-mmap Unsloth load.
            for layer in (*range(5, 10), *range(52, 57)):
                for role in ("gate", "up"):
                    experts[f"blk.{layer}.ffn_{role}_exps.weight"] = "iq3_xxs"
        if not experts.keys() <= source.keys():
            raise ValueError(f"Expert names absent in source for {profile}")
        plan = {name: tensor_type(tensor, experts, profile) for name, tensor in source.items()}
        if set(plan) != set(source):
            raise ValueError("Incomplete plan")
        if any(GGML_IDS[kind] >= 67 for kind in plan.values()):
            raise ValueError("Plan contains unsupported GGML type")
        plan_path = args.output / f"{profile}.tensor-types.txt"
        plan_path.write_text("\n".join(f"^{re.escape(name)}$={kind}" for name, kind in sorted(plan.items())) + "\n", encoding="ascii")
        manifest = {
            "profile": profile,
            "source_recipe": filename,
            "source_shards": len(shards),
            "source_tensors": len(source),
            "tensor_type_file": str(plan_path),
            "expert_type_substitutions": REPLACEMENTS,
            "ram_safe_changes": "gate/up IQ3_XXS in layers 5-9 and 52-56" if profile == "ram_safe" else None,
            "attention_type": "q8_0" if profile == "ram88" else "bf16",
            "embedding_output_type": "bf16",
            "router_norm_bias_type": "f32",
        }
        (args.output / f"{profile}.manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"{profile}: {len(plan)} exact tensor rules -> {plan_path}")


if __name__ == "__main__":
    main()
