"""Compare raw FP8 sidecar import with an equivalent native row-scaled GGUF."""

import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "gguf-py"))
import gguf


def write(path, reader, tensors):
    writer = gguf.GGUFWriter(path, reader.fields["general.architecture"].contents())
    for name, field in reader.fields.items():
        if name.startswith("GGUF.") or name in ("general.architecture", "general.file_type"):
            continue
        subtype = field.types[-1] if field.types[0] == gguf.GGUFValueType.ARRAY else None
        writer.add_key_value(name, field.contents(), field.types[0], subtype)
    for name, data, qtype in tensors:
        writer.add_tensor(name, data, raw_dtype=qtype)
    writer.write_header_to_file()
    writer.write_kv_data_to_file()
    writer.write_tensors_to_file()
    writer.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cli", required=True)
    args = parser.parse_args()
    model = os.getenv("LLAMACPP_TEST_MODELFILE")
    if not model:
        return 77
    reader = gguf.GGUFReader(model)
    raw, native = [], []
    count = 0
    for tensor in reader.tensors:
        if tensor.tensor_type == gguf.GGMLQuantizationType.F32 and tensor.data.ndim == 2:
            rows, width = tensor.data.shape
            scale = np.array([0.03125], dtype=np.float32)
            codes = np.where(tensor.data < 0, 0xb8, 0x38).astype(np.uint8)
            codes[np.abs(tensor.data) < scale[0] / 2] = 0
            header = np.zeros((rows, 16), dtype=np.uint8)
            header[:, :4] = scale.view(np.uint8)
            packed = np.concatenate((header, codes), axis=1)
            raw.append((tensor.name, codes, gguf.GGMLQuantizationType.F8_E4M3))
            raw.append((tensor.name.rsplit(".", 1)[0] + ".scale", scale, gguf.GGMLQuantizationType.F32))
            native.append((tensor.name, packed, gguf.GGMLQuantizationType.F8_E4M3_KS))
            count += 1
        else:
            item = (tensor.name, tensor.data, tensor.tensor_type)
            raw.append(item)
            native.append(item)
    assert count > 0
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        combined, imported, sidecar, packed = [root / (name + ".gguf") for name in ("raw", "trunk", "sidecar", "native")]
        write(combined, reader, raw)
        write(packed, reader, native)
        side_names = {"token_embd.weight", "token_embd.scale"}
        table = [item for item in raw if item[0] in side_names]
        trunk = [item for item in raw if item[0] not in side_names]
        assert len(table) == 2
        write(imported, reader, trunk)
        write(sidecar, reader, table)
        def run(path, extra=()):
            return subprocess.run([args.cli, "-m", str(path), "-p", "hello", "-n", "4", "-c", "128",
                "-t", "2", "-ngl", "0", "-s", "42", "--ignore-eos", "--no-display-prompt",
                "--fp8-precision", "w8a16", *extra], capture_output=True, timeout=60)
        reference = run(packed)
        assert reference.returncode == 0, reference.stderr[-5000:]
        for path, extra in [(combined, ()), (imported, ("--ngram-file", str(sidecar)))]:
            result = run(path, extra)
            assert result.returncode == 0, result.stderr[-5000:]
            assert result.stdout == reference.stdout
            assert b"mmap is off" in result.stderr
        write(imported, reader, trunk + [item for item in table if item[0].endswith(".scale")])
        duplicate = run(imported, ("--ngram-file", str(sidecar)))
        assert duplicate.returncode != 0 and b"token_embd.scale' is in both" in duplicate.stderr
    print(f"FP8 unified/sidecar/native parity passed for {count} tensors; duplicate scale rejected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
