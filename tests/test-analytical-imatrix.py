"""Exercise analytical-imatrix generation and its quantizer integration."""

import argparse
import math
import os
from pathlib import Path
import struct
import subprocess
import tempfile


def read_imatrix(path: Path):
    data = memoryview(path.read_bytes())
    offset = 0

    def take(fmt):
        nonlocal offset
        size = struct.calcsize(fmt)
        assert offset + size <= len(data)
        value = struct.unpack_from(fmt, data, offset)
        offset += size
        return value[0] if len(value) == 1 else value

    entries = take("=i")
    assert entries > 0
    names = []
    for _ in range(entries):
        name_len = take("=i")
        assert 0 < name_len < 4096
        name = bytes(data[offset:offset + name_len]).decode()
        offset += name_len
        assert take("=i") == 1
        count = take("=i")
        assert count > 0
        values = struct.unpack_from(f"={count}f", data, offset)
        offset += count * 4
        assert all(math.isfinite(value) and value >= 0 for value in values)
        names.append(name)
    return names


def run(command, timeout=120):
    result = subprocess.run(command, capture_output=True, timeout=timeout)
    error = result.stderr.decode(errors="replace")
    assert result.returncode == 0, error[-8000:]
    return error


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--quantize", required=True)
    args = parser.parse_args()
    model = os.getenv("LLAMACPP_TEST_MODELFILE")
    if not model:
        return 77

    with tempfile.TemporaryDirectory(prefix="ik-analytical-imatrix-") as directory:
        root = Path(directory)
        imatrix = root / "analytical.dat"
        quantized = root / "estimated-iq2_kt.gguf"
        run([args.quantize, "--analytical-imatrix", str(imatrix), model])
        names = read_imatrix(imatrix)
        run([args.quantize, "--estimate-imatrix", model, str(quantized), "IQ2_KT", "2"])
        assert quantized.stat().st_size > 0
        print(f"analytical imatrix: {len(names)} entries; estimated IQ2_KT quantization passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
