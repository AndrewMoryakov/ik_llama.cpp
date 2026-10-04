"""Read GGUF headers and report MiniMax tensor sizes without loading weights."""

import argparse
import collections
import json
import math
import struct
from pathlib import Path


WIDTHS = {0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1,
          10: 8, 11: 8, 12: 8}
TYPES = {0: (1, 4), 1: (1, 2), 30: (1, 2)}


def integer(file, fmt):
    size = struct.calcsize(fmt)
    data = file.read(size)
    if len(data) != size:
        raise EOFError(file.name)
    return struct.unpack("<" + fmt, data)[0]


def string(file):
    length = integer(file, "Q")
    return file.read(length).decode("utf-8")


def skip_value(file, kind):
    if kind in WIDTHS:
        file.seek(WIDTHS[kind], 1)
    elif kind == 8:
        file.seek(integer(file, "Q"), 1)
    elif kind == 9:
        item_kind = integer(file, "I")
        count = integer(file, "Q")
        if item_kind in WIDTHS:
            file.seek(WIDTHS[item_kind] * count, 1)
        else:
            for _ in range(count):
                skip_value(file, item_kind)
    else:
        raise ValueError(f"Unknown metadata type {kind}")


def read_header(path):
    with path.open("rb") as file:
        if file.read(4) != b"GGUF":
            raise ValueError(f"Not GGUF: {path}")
        version = integer(file, "I")
        tensor_count = integer(file, "Q")
        kv_count = integer(file, "Q")
        for _ in range(kv_count):
            string(file)
            skip_value(file, integer(file, "I"))
        tensors = []
        for _ in range(tensor_count):
            name = string(file)
            dims = [integer(file, "Q") for _ in range(integer(file, "I"))]
            kind = integer(file, "I")
            offset = integer(file, "Q")
            count = math.prod(dims)
            tensors.append(dict(name=name, dims=dims, type=kind, count=count,
                                offset=offset))
        return version, tensors, file.tell()


def category(name):
    if "ffn_down_exps" in name or "ffn_gate_exps" in name or "ffn_up_exps" in name:
        return "experts"
    if "ffn_gate_inp" in name:
        return "router"
    if "norm" in name:
        return "norms"
    if "attn_" in name:
        return "attention"
    if name == "token_embd.weight":
        return "embedding"
    if name == "output.weight":
        return "output"
    return "other"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+", type=Path)
    args = parser.parse_args()
    groups = collections.defaultdict(lambda: dict(count=0, bytes=0, types=collections.Counter()))
    subgroups = collections.defaultdict(lambda: dict(count=0, bytes=0, types=collections.Counter()))
    total = 0
    for path in args.files:
        version, tensors, header_end = read_header(path)
        local = 0
        for tensor in tensors:
            kind = tensor["type"]
            if kind not in TYPES:
                raise ValueError(f"Unexpected source type {kind}: {tensor['name']}")
            block, width = TYPES[kind]
            size = tensor["count"] * width // block
            group = category(tensor["name"])
            parts = tensor["name"].split(".")
            family = ".".join(parts[2:]) if parts[0] == "blk" else tensor["name"]
            for record in (groups[group], subgroups[family]):
                record["count"] += 1
                record["bytes"] += size
                record["types"][str(kind)] += 1
            local += size
        total += local
        print(json.dumps(dict(file=str(path), version=version, tensors=len(tensors),
                              header_end=header_end, payload_bytes=local,
                              file_bytes=path.stat().st_size)))
    def output(records):
        return {name: dict(row, types=dict(row["types"])) for name, row in sorted(records.items())}
    print(json.dumps(dict(total_payload_bytes=total, groups=output(groups),
                          subgroups=output(subgroups)), indent=2))


if __name__ == "__main__":
    main()
