from __future__ import annotations

import argparse
import gc
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

from .layout import (
    LAYOUT_SCHEMA,
    LAYOUT_VERSION,
    MODEL_SIGNATURE_SCHEME,
    LayoutError,
    ModelLayout,
    layout_fingerprint,
    model_signature,
)
from .io_utils import atomic_write_text, reject_output_alias


TENSOR_RE = re.compile(
    r"^blk\.(?P<layer>\d+)\.ffn_(?P<role>gate_up|gate|up|down)_exps\.weight$"
)
SHARD_RE = re.compile(r"^(?P<prefix>.+)-(?P<ordinal>\d{5})-of-(?P<count>\d{5})\.gguf$")
@dataclass(frozen=True)
class ShardScan:
    path: Path
    split_no: int | None
    split_count: int
    total_tensor_count: int | None
    data_offset: int
    alignment: int
    fields: dict[str, Any]
    tensors: tuple[dict[str, Any], ...]


def _field_value(reader: Any, key: str, default: Any = None) -> Any:
    field = reader.get_field(key)
    return default if field is None else field.contents()


def _import_gguf() -> Any:
    repo_root = Path(__file__).resolve().parents[2]
    vendored_root = (repo_root / "gguf-py").resolve()
    sys.path.insert(0, str(vendored_root))
    try:
        from gguf import GGUFReader
        import gguf
    except ImportError as exc:
        raise LayoutError(
            "vendored gguf-py dependencies are unavailable; install requirements.txt"
        ) from exc
    module_path = Path(gguf.__file__).resolve()
    if vendored_root not in module_path.parents:
        raise LayoutError(f"refusing non-vendored gguf module: {module_path}")
    return GGUFReader


def scan_shard(path: Path) -> ShardScan:
    GGUFReader = _import_gguf()
    reader = GGUFReader(path, mode="r")
    try:
        fields = {
            key: _field_value(reader, key)
            for key in (
                "general.architecture",
                "split.no",
                "split.count",
                "split.tensors.count",
            )
            if reader.get_field(key) is not None
        }
        architecture = fields.get("general.architecture")
        if architecture:
            fields[f"{architecture}.expert_count"] = _field_value(reader, f"{architecture}.expert_count")
            fields[f"{architecture}.block_count"] = _field_value(reader, f"{architecture}.block_count")
        tensors = tuple(
            {
                "name": tensor.name,
                "type": tensor.tensor_type.name,
                "type_id": int(tensor.tensor_type),
                "shape": tuple(int(v) for v in tensor.shape),
                "file_offset": int(tensor.data_offset),
                "n_bytes": int(tensor.n_bytes),
            }
            for tensor in reader.tensors
        )
        return ShardScan(
            path=path.resolve(),
            split_no=None if fields.get("split.no") is None else int(fields["split.no"]),
            split_count=int(fields.get("split.count", 1)),
            total_tensor_count=None if fields.get("split.tensors.count") is None else int(fields["split.tensors.count"]),
            data_offset=int(reader.data_offset),
            alignment=int(reader.alignment),
            fields=fields,
            tensors=tensors,
        )
    finally:
        del reader
        gc.collect()


def discover_shards(entry: Path, explicit: Sequence[Path] | None = None) -> list[Path]:
    if explicit:
        return [Path(path).resolve() for path in explicit]
    first = scan_shard(entry)
    if first.split_count <= 1:
        return [entry.resolve()]
    match = SHARD_RE.match(entry.name)
    if not match:
        raise LayoutError("split GGUF has no canonical -00001-of-000NN filename; pass --shard for every file")
    count = first.split_count
    if int(match.group("count")) != count:
        raise LayoutError("split.count disagrees with the shard filename")
    return [
        entry.with_name(f"{match.group('prefix')}-{index:05d}-of-{count:05d}.gguf").resolve()
        for index in range(1, count + 1)
    ]


def _validate_shards(scans: list[ShardScan]) -> list[ShardScan]:
    if not scans:
        raise LayoutError("no GGUF shards supplied")
    expected_count = scans[0].split_count
    if expected_count != len(scans):
        raise LayoutError(f"expected {expected_count} shards, got {len(scans)}")
    if expected_count > 1:
        numbers = [scan.split_no for scan in scans]
        if any(number is None for number in numbers) or \
                any(scan.split_count != expected_count for scan in scans) or \
                sorted(int(number) for number in numbers) != list(range(expected_count)):
            raise LayoutError("split.no/count metadata is inconsistent")
        scans.sort(key=lambda scan: int(scan.split_no))
    names: set[str] = set()
    total = 0
    totals = {scan.total_tensor_count for scan in scans if scan.total_tensor_count is not None}
    if len(totals) > 1:
        raise LayoutError("split.tensors.count metadata is inconsistent")
    expected_total = next(iter(totals), None)
    metadata_keys = {"general.architecture"}
    architectures = {scan.fields.get("general.architecture") for scan in scans if scan.fields.get("general.architecture")}
    if len(architectures) > 1:
        raise LayoutError("general.architecture metadata is inconsistent across shards")
    for architecture in architectures:
        metadata_keys.update({f"{architecture}.expert_count", f"{architecture}.block_count"})
    for key in metadata_keys:
        values = {scan.fields.get(key) for scan in scans if scan.fields.get(key) is not None}
        if len(values) > 1:
            raise LayoutError(f"{key} metadata is inconsistent across shards")
    for scan in scans:
        if not scan.path.exists():
            raise LayoutError(f"missing shard: {scan.path}")
        total += len(scan.tensors)
        for tensor in scan.tensors:
            if tensor["name"] in names:
                raise LayoutError(f"duplicate tensor across shards: {tensor['name']}")
            names.add(tensor["name"])
    if expected_total is not None and total != expected_total:
        raise LayoutError(f"split.tensors.count={expected_total}, scanned {total}")
    return scans


def build_document(scans: list[ShardScan], *, strict: bool = True) -> dict[str, Any]:
    scans = _validate_shards(scans)
    metadata_scan = next((scan for scan in scans if scan.fields.get("general.architecture")), None)
    if metadata_scan is None:
        raise LayoutError("general.architecture is missing")
    architecture = str(metadata_scan.fields["general.architecture"])
    n_experts_value = metadata_scan.fields.get(f"{architecture}.expert_count")
    n_layers_value = metadata_scan.fields.get(f"{architecture}.block_count")
    if n_experts_value is None or n_layers_value is None:
        raise LayoutError("expert_count/block_count metadata is missing")
    n_experts = int(n_experts_value)
    n_layers = int(n_layers_value)
    if n_experts <= 0 or n_layers <= 0:
        raise LayoutError("expert_count/block_count must be positive")

    shard_docs: list[dict[str, Any]] = []
    by_layer: dict[int, dict[str, dict[str, Any]]] = defaultdict(dict)
    for shard_id, scan in enumerate(scans):
        size = scan.path.stat().st_size
        shard_docs.append({
            "id": shard_id,
            "path": str(scan.path),
            "size_bytes": size,
            "data_offset": scan.data_offset,
            "alignment": scan.alignment,
            "split_no": scan.split_no,
        })
        payloads = sorted((tensor["file_offset"], tensor["file_offset"] + tensor["n_bytes"], tensor["name"]) for tensor in scan.tensors)
        previous_end = 0
        for start, end, name in payloads:
            if end > size:
                raise LayoutError(f"tensor exceeds shard size: {name}")
            if start < previous_end:
                raise LayoutError(f"overlapping tensor payload: {name}")
            previous_end = end
        for tensor in scan.tensors:
            match = TENSOR_RE.match(tensor["name"])
            if not match:
                continue
            layer = int(match.group("layer"))
            role = match.group("role")
            if role in by_layer[layer]:
                raise LayoutError(f"duplicate role {role} in layer {layer}")
            shape = tensor["shape"]
            if len(shape) != 3 or shape[2] != n_experts or tensor["n_bytes"] % n_experts != 0:
                raise LayoutError(f"unsupported merged expert layout: {tensor['name']}")
            by_layer[layer][role] = {
                "role": role,
                "name": tensor["name"],
                "shard_id": shard_id,
                "type": tensor["type"],
                "type_id": tensor["type_id"],
                "shape": list(shape),
                "file_offset": tensor["file_offset"],
                "n_bytes": tensor["n_bytes"],
                "n_experts": n_experts,
                "expert_stride_bytes": tensor["n_bytes"] // n_experts,
            }

    if not by_layer:
        raise LayoutError("no canonical merged MoE expert tensors found")

    layer_docs: list[dict[str, Any]] = []
    for layer, roles in sorted(by_layer.items()):
        if layer >= n_layers:
            raise LayoutError(f"expert tensor layer {layer} exceeds block_count {n_layers}")
        role_set = set(roles)
        if role_set == {"gate", "up", "down"}:
            representation = "separate"
            gate, up, down = roles["gate"], roles["up"], roles["down"]
            if gate["shape"] != up["shape"] or gate["shape"][0] != down["shape"][1] or gate["shape"][1] != down["shape"][0]:
                raise LayoutError(f"incompatible gate/up/down shapes in layer {layer}")
            order = ("gate", "up", "down")
        elif role_set == {"gate_up", "down"}:
            representation = "fused"
            gate_up, down = roles["gate_up"], roles["down"]
            if gate_up["shape"][0] != down["shape"][1] or gate_up["shape"][1] != 2 * down["shape"][0]:
                raise LayoutError(f"incompatible gate_up/down shapes in layer {layer}")
            order = ("gate_up", "down")
        else:
            message = f"incomplete or ambiguous expert tensors in layer {layer}: {sorted(role_set)}"
            if strict:
                raise LayoutError(message)
            continue
        layer_docs.append({
            "layer": layer,
            "representation": representation,
            "tensors": [roles[role] for role in order],
        })

    signature_rows = [
        f"{layer['layer']}|{tensor['role']}|{tensor['name']}|{tensor['type_id']}|"
        f"{','.join(str(value) for value in tensor['shape'])}|{tensor['n_bytes']}\n"
        for layer in layer_docs
        for tensor in layer["tensors"]
    ]
    document = {
        "schema": LAYOUT_SCHEMA,
        "version": LAYOUT_VERSION,
        "model": {
            "architecture": architecture,
            "n_layers": n_layers,
            "n_experts": n_experts,
            "fingerprint": "pending",
            "model_signature_scheme": MODEL_SIGNATURE_SCHEME,
            "model_signature": model_signature(signature_rows),
        },
        "shards": shard_docs,
        "layers": layer_docs,
    }
    document["model"]["fingerprint"] = layout_fingerprint(document)
    ModelLayout(document)  # final schema/range validation
    return document


def build_layout(entry: Path, *, strict: bool = True, explicit_shards: Sequence[Path] | None = None) -> dict[str, Any]:
    paths = discover_shards(entry, explicit_shards)
    missing = [path for path in paths if not path.exists()]
    if missing:
        raise LayoutError(f"missing shard: {missing[0]}")
    return build_document([scan_shard(path) for path in paths], strict=strict)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build a compact per-expert byte-range manifest from GGUF metadata")
    parser.add_argument("--model", required=True, type=Path, help="GGUF file or any canonical split shard")
    parser.add_argument("--shard", action="append", type=Path, default=[], help="explicit shard path (repeat for noncanonical names)")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--no-strict", action="store_true", help="skip incomplete MoE layers instead of failing")
    args = parser.parse_args(argv)
    try:
        document = build_layout(args.model, strict=not args.no_strict, explicit_shards=args.shard or None)
        shard_paths = [Path(shard["path"]) for shard in document["shards"]]
        reject_output_alias(args.output, shard_paths, description="a GGUF shard")
        atomic_write_text(args.output, json.dumps(document, indent=2, sort_keys=True) + "\n")
    except (LayoutError, OSError, ValueError) as exc:
        parser.error(str(exc))
    total = sum(tensor["n_bytes"] for layer in document["layers"] for tensor in layer["tensors"])
    print(f"wrote {args.output}: {len(document['shards'])} shard(s), {len(document['layers'])} MoE layer(s), {total} expert bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
