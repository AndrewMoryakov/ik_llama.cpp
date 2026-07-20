from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


LAYOUT_SCHEMA = "ik_llama.moe_expert_layout"
LAYOUT_VERSION = 1
MODEL_SIGNATURE_SCHEME = "fnv1a64-expert-layout-v1"


def model_signature(rows: Iterable[str]) -> str:
    value = 0xCBF29CE484222325
    for row in rows:
        for byte in row.encode("utf-8"):
            value ^= byte
            value = (value * 0x100000001B3) & 0xFFFFFFFFFFFFFFFF
    return f"{value:016x}"


def layout_fingerprint(document: dict[str, Any]) -> str:
    """Hash the normalized offset-bearing subset that is present in a manifest."""
    model = document["model"]
    shards = sorted(document["shards"], key=lambda item: item["id"])
    layers = sorted(document["layers"], key=lambda item: item["layer"])
    payload = {
        "architecture": model["architecture"],
        "n_layers": model["n_layers"],
        "n_experts": model["n_experts"],
        "shards": [
            {"id": item["id"], "size_bytes": item["size_bytes"], "split_no": item.get("split_no")}
            for item in shards
        ],
        "layers": [
            {
                "layer": layer["layer"],
                "representation": layer["representation"],
                "tensors": [
                    {
                        key: tensor[key]
                        for key in (
                            "role", "name", "shard_id", "type", "type_id", "shape",
                            "file_offset", "n_bytes", "n_experts", "expert_stride_bytes",
                        )
                    }
                    for tensor in layer["tensors"]
                ],
            }
            for layer in layers
        ],
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


class LayoutError(ValueError):
    pass


def _require_int(value: Any, name: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise LayoutError(f"{name} must be an integer >= {minimum}")
    return value


@dataclass(frozen=True)
class ByteRange:
    shard_id: int
    offset: int
    length: int
    role: str
    tensor: str

    @property
    def end(self) -> int:
        return self.offset + self.length


@dataclass(frozen=True)
class TensorLayout:
    layer: int
    role: str
    name: str
    shard_id: int
    ggml_type: str
    type_id: int
    shape: tuple[int, ...]
    file_offset: int
    n_bytes: int
    n_experts: int
    expert_stride_bytes: int

    def range_for(self, expert: int) -> ByteRange:
        if expert < 0 or expert >= self.n_experts:
            raise LayoutError(
                f"expert {expert} is outside [0,{self.n_experts}) for {self.name}"
            )
        return ByteRange(
            shard_id=self.shard_id,
            offset=self.file_offset + expert * self.expert_stride_bytes,
            length=self.expert_stride_bytes,
            role=self.role,
            tensor=self.name,
        )


class ModelLayout:
    def __init__(self, document: dict[str, Any]):
        self.document = document
        if document.get("schema") != LAYOUT_SCHEMA or document.get("version") != LAYOUT_VERSION:
            raise LayoutError("unsupported layout schema/version")

        model = document.get("model")
        if not isinstance(model, dict):
            raise LayoutError("layout.model must be an object")
        self.architecture = str(model.get("architecture", ""))
        self.n_layers = _require_int(model.get("n_layers"), "model.n_layers", minimum=1)
        self.n_experts = _require_int(model.get("n_experts"), "model.n_experts", minimum=1)
        self.fingerprint = str(model.get("fingerprint", ""))
        self.model_signature_scheme = str(model.get("model_signature_scheme", ""))
        self.model_signature = str(model.get("model_signature", ""))
        if not self.architecture or not self.fingerprint:
            raise LayoutError("model.architecture/fingerprint must be non-empty")
        if self.model_signature_scheme != MODEL_SIGNATURE_SCHEME or not self.model_signature:
            raise LayoutError("unsupported or missing model signature")

        shards = document.get("shards")
        if not isinstance(shards, list) or not shards:
            raise LayoutError("layout.shards must be a non-empty array")
        self.shards: dict[int, dict[str, Any]] = {}
        for index, shard in enumerate(shards):
            if not isinstance(shard, dict):
                raise LayoutError(f"shards[{index}] must be an object")
            shard_id = _require_int(shard.get("id"), f"shards[{index}].id")
            if shard_id in self.shards:
                raise LayoutError(f"duplicate shard id {shard_id}")
            size = _require_int(shard.get("size_bytes"), f"shards[{index}].size_bytes", minimum=1)
            copy = dict(shard)
            copy["size_bytes"] = size
            self.shards[shard_id] = copy

        layers = document.get("layers")
        if not isinstance(layers, list) or not layers:
            raise LayoutError("layout.layers must be a non-empty array")
        self.layers: dict[int, tuple[TensorLayout, ...]] = {}
        for layer_entry in layers:
            if not isinstance(layer_entry, dict):
                raise LayoutError("each layer entry must be an object")
            layer = _require_int(layer_entry.get("layer"), "layer.layer")
            if layer >= self.n_layers or layer in self.layers:
                raise LayoutError(f"invalid or duplicate layer {layer}")
            tensors_doc = layer_entry.get("tensors")
            if not isinstance(tensors_doc, list) or not tensors_doc:
                raise LayoutError(f"layer {layer} has no tensors")
            tensors: list[TensorLayout] = []
            roles: set[str] = set()
            for item in tensors_doc:
                tensor = self._parse_tensor(layer, item)
                if tensor.role in roles:
                    raise LayoutError(f"duplicate role {tensor.role} in layer {layer}")
                roles.add(tensor.role)
                tensors.append(tensor)
            representation = layer_entry.get("representation")
            expected = {"gate", "up", "down"} if representation == "separate" else {"gate_up", "down"}
            if representation not in ("separate", "fused") or roles != expected:
                raise LayoutError(f"incomplete/invalid expert representation in layer {layer}")
            by_role = {tensor.role: tensor for tensor in tensors}
            if representation == "separate":
                gate, up, down = by_role["gate"], by_role["up"], by_role["down"]
                if gate.shape != up.shape or gate.shape[0] != down.shape[1] or gate.shape[1] != down.shape[0]:
                    raise LayoutError(f"incompatible gate/up/down shapes in layer {layer}")
            else:
                gate_up, down = by_role["gate_up"], by_role["down"]
                if gate_up.shape[0] != down.shape[1] or gate_up.shape[1] != 2 * down.shape[0]:
                    raise LayoutError(f"incompatible gate_up/down shapes in layer {layer}")
            tensors.sort(key=lambda item: ({"gate": 0, "up": 1, "gate_up": 0, "down": 2}[item.role], item.name))
            self.layers[layer] = tuple(tensors)

        payloads: dict[int, list[tuple[int, int, str]]] = {}
        for tensors in self.layers.values():
            for tensor in tensors:
                payloads.setdefault(tensor.shard_id, []).append(
                    (tensor.file_offset, tensor.file_offset + tensor.n_bytes, tensor.name)
                )
        for shard_id, ranges in payloads.items():
            previous_end = -1
            for start, end, name in sorted(ranges):
                if start < previous_end:
                    raise LayoutError(f"overlapping tensor payload in shard {shard_id}: {name}")
                previous_end = end

        signature_rows = (
            f"{layer}|{tensor.role}|{tensor.name}|{tensor.type_id}|"
            f"{','.join(str(value) for value in tensor.shape)}|{tensor.n_bytes}\n"
            for layer, tensors in sorted(self.layers.items())
            for tensor in tensors
        )
        if model_signature(signature_rows) != self.model_signature:
            raise LayoutError("model signature does not match layout tensors")
        if layout_fingerprint(document) != self.fingerprint:
            raise LayoutError("layout fingerprint does not match shard/tensor offsets")

    def _parse_tensor(self, layer: int, item: Any) -> TensorLayout:
        if not isinstance(item, dict):
            raise LayoutError(f"tensor entry in layer {layer} must be an object")
        shape_doc = item.get("shape")
        if not isinstance(shape_doc, list) or len(shape_doc) != 3:
            raise LayoutError(f"{item.get('name', 'tensor')} must have rank 3")
        shape = tuple(_require_int(v, "tensor.shape", minimum=1) for v in shape_doc)
        n_experts = _require_int(item.get("n_experts"), "tensor.n_experts", minimum=1)
        stride = _require_int(item.get("expert_stride_bytes"), "tensor.expert_stride_bytes", minimum=1)
        n_bytes = _require_int(item.get("n_bytes"), "tensor.n_bytes", minimum=1)
        type_id = _require_int(item.get("type_id"), "tensor.type_id")
        offset = _require_int(item.get("file_offset"), "tensor.file_offset")
        shard_id = _require_int(item.get("shard_id"), "tensor.shard_id")
        if shard_id not in self.shards:
            raise LayoutError(f"tensor references unknown shard {shard_id}")
        if n_experts != self.n_experts or shape[2] != self.n_experts:
            raise LayoutError(f"expert count mismatch for {item.get('name', 'tensor')}")
        if n_bytes != n_experts * stride:
            raise LayoutError(f"n_bytes != n_experts * stride for {item.get('name', 'tensor')}")
        if offset + n_bytes > self.shards[shard_id]["size_bytes"]:
            raise LayoutError(f"tensor exceeds shard size: {item.get('name', 'tensor')}")
        name = str(item.get("name", ""))
        ggml_type = str(item.get("type", ""))
        if not name or not ggml_type:
            raise LayoutError("tensor.name/type must be non-empty")
        return TensorLayout(
            layer=layer,
            role=str(item.get("role", "")),
            name=name,
            shard_id=shard_id,
            ggml_type=ggml_type,
            type_id=type_id,
            shape=shape,
            file_offset=offset,
            n_bytes=n_bytes,
            n_experts=n_experts,
            expert_stride_bytes=stride,
        )

    def ranges_for(self, layer: int, expert: int) -> tuple[ByteRange, ...]:
        try:
            tensors = self.layers[layer]
        except KeyError as exc:
            raise LayoutError(f"trace references unknown/non-MoE layer {layer}") from exc
        return tuple(tensor.range_for(expert) for tensor in tensors)

    def all_ranges_for(self, selected: Iterable[tuple[int, int]]) -> list[ByteRange]:
        result: list[ByteRange] = []
        for layer, expert in selected:
            result.extend(self.ranges_for(layer, expert))
        return result


def load_layout(path: str | Path) -> ModelLayout:
    source = Path(path)
    try:
        document = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise LayoutError(f"cannot read layout {source}: {exc}") from exc
    if not isinstance(document, dict):
        raise LayoutError("layout root must be an object")
    return ModelLayout(document)
