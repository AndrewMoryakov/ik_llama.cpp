"""Generate a type-40 fixture with shared row scales and smoke its import."""

import argparse
import ctypes
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "gguf-py"))
import gguf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cli", required=True)
    parser.add_argument("--quantize", required=True)
    parser.add_argument("--library", required=True)
    args = parser.parse_args()
    model = os.getenv("LLAMACPP_TEST_MODELFILE")
    if not model:
        return 77
    reader = gguf.GGUFReader(model)
    library = ctypes.CDLL(args.library)
    quantize = library.ggml_quantize_chunk
    quantize.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p,
                        ctypes.c_int64, ctypes.c_int64, ctypes.c_int64, ctypes.c_void_p, ctypes.c_void_p]
    quantize.restype = ctypes.c_size_t
    with tempfile.TemporaryDirectory(prefix="ik-nvfp4-import-") as directory:
        fixture = Path(directory) / "raw-nvfp4.gguf"
        timing = Path(directory) / "timing.ndjson"
        writer = gguf.GGUFWriter(fixture, reader.fields["general.architecture"].contents())
        for name, field in reader.fields.items():
            if name.startswith("GGUF.") or name in ("general.architecture", "general.file_type"):
                continue
            subtype = field.types[-1] if field.types[0] == gguf.GGUFValueType.ARRAY else None
            writer.add_key_value(name, field.contents(), field.types[0], subtype)
        converted = 0
        for tensor in reader.tensors:
            if tensor.tensor_type == gguf.GGMLQuantizationType.F32 and tensor.data.ndim == 2 and tensor.data.shape[1] % 64 == 0:
                data = np.array(tensor.data, copy=True)
                maxima = np.max(np.abs(data), axis=1, keepdims=True)
                data /= np.where(maxima > 0, maxima, 1.0)
                data[maxima[:, 0] == 0, 0] = 1.0
                rows, width = data.shape
                packed = np.empty((rows, 4 + width // 64 * 36), dtype=np.uint8)
                size = quantize(int(gguf.GGMLQuantizationType.NVFP4_KS), data.ctypes.data,
                                packed.ctypes.data, 0, rows, width, None, None)
                assert size == packed.nbytes
                scales = packed[:, :4].copy().view(np.float32).reshape(-1)
                assert np.all(scales == scales[0])
                writer.add_tensor(tensor.name, packed[:, 4:].copy(), raw_dtype=gguf.GGMLQuantizationType.NVFP4)
                base = tensor.name.rsplit(".", 1)[0]
                writer.add_tensor(base + ".scale", np.array([scales[0]], dtype=np.float32))
                writer.add_tensor(base + ".input_scale", np.ones(1, dtype=np.float32))
                converted += 1
            else:
                writer.add_tensor(tensor.name, tensor.data, raw_dtype=tensor.tensor_type)
        assert converted > 0
        writer.write_header_to_file()
        writer.write_kv_data_to_file()
        writer.write_tensors_to_file()
        writer.close()
        result = subprocess.run(
            [args.cli, "-m", str(fixture), "-p", "hello", "-n", "4", "-c", "128",
             "-t", "2", "-ngl", "0", "-s", "42", "--ignore-eos", "--no-display-prompt",
             "--token-timing", str(timing)], capture_output=True, timeout=60,
        )
        error = result.stderr.decode(errors="replace")
        assert result.returncode == 0, error[-5000:]
        assert "mmap is off" in error and "consumed" in error
        end = json.loads(timing.read_text().splitlines()[-1])
        assert end["complete"] and end["generated_tokens"] == 4

        copied = Path(directory) / "copied-nvfp4-ks.gguf"
        copied_result = subprocess.run(
            [args.quantize, str(fixture), str(copied), "COPY"],
            capture_output=True, timeout=60,
        )
        copied_error = copied_result.stderr.decode(errors="replace")
        assert copied_result.returncode == 0, copied_error[-5000:]
        copied_reader = gguf.GGUFReader(copied)
        copied_names = {tensor.name for tensor in copied_reader.tensors}
        copied_scales = {name for name in copied_names if name.endswith(".input_scale")}
        assert len(copied_scales) == converted
        assert all(np.all(tensor.data == 1.0) for tensor in copied_reader.tensors
                   if tensor.name in copied_scales)
        wrong_types = [(tensor.name, tensor.tensor_type) for tensor in copied_reader.tensors
                       if not tensor.name.endswith(".input_scale")
                       and tensor.name.rsplit(".", 1)[0] + ".input_scale" in copied_scales
                       and tensor.tensor_type != gguf.GGMLQuantizationType.NVFP4_KS]
        assert not wrong_types, wrong_types
        copied_smoke = subprocess.run(
            [args.cli, "-m", str(copied), "-p", "hello", "-n", "1", "-c", "128",
             "-t", "2", "-ngl", "0", "-s", "42", "--ignore-eos", "--no-display-prompt"],
            capture_output=True, timeout=60,
        )
        assert copied_smoke.returncode == 0, copied_smoke.stderr.decode(errors="replace")[-5000:]

        # Exercise the MXFP4 -> NVFP4_KS load-time path added for Blackwell.
        # INT8 must retain the original MXFP4 tensors (and mmap eligibility),
        # while AUTO may consume the static input scales and repack them.
        mxfp4_fixture = Path(directory) / "mxfp4-with-input-scales.gguf"
        writer = gguf.GGUFWriter(mxfp4_fixture, reader.fields["general.architecture"].contents())
        for name, field in reader.fields.items():
            if name.startswith("GGUF.") or name in ("general.architecture", "general.file_type"):
                continue
            subtype = field.types[-1] if field.types[0] == gguf.GGUFValueType.ARRAY else None
            writer.add_key_value(name, field.contents(), field.types[0], subtype)
        mxfp4_converted = 0
        for tensor in reader.tensors:
            if tensor.tensor_type == gguf.GGMLQuantizationType.F32 and tensor.data.ndim == 2 and tensor.data.shape[1] % 64 == 0:
                data = np.array(tensor.data, copy=True)
                rows, width = data.shape
                packed = np.empty((rows, width // 32 * 17), dtype=np.uint8)
                size = quantize(int(gguf.GGMLQuantizationType.MXFP4), data.ctypes.data,
                                packed.ctypes.data, 0, rows, width, None, None)
                assert size == packed.nbytes
                writer.add_tensor(tensor.name, packed, raw_dtype=gguf.GGMLQuantizationType.MXFP4)
                base = tensor.name.rsplit(".", 1)[0]
                writer.add_tensor(base + ".input_scale", np.ones(1, dtype=np.float32))
                mxfp4_converted += 1
            else:
                writer.add_tensor(tensor.name, tensor.data, raw_dtype=tensor.tensor_type)
        assert mxfp4_converted > 0
        writer.write_header_to_file()
        writer.write_kv_data_to_file()
        writer.write_tensors_to_file()
        writer.close()

        base_command = [args.cli, "-m", str(mxfp4_fixture), "-p", "hello", "-n", "1", "-c", "128",
                        "-t", "2", "-ngl", "0", "-s", "42", "--ignore-eos", "--no-display-prompt"]
        auto = subprocess.run(base_command, capture_output=True, timeout=60)
        auto_error = auto.stderr.decode(errors="replace")
        assert auto.returncode == 0, auto_error[-5000:]
        auto_log = auto_error.lower()
        assert "repacking" in auto_log and "mxfp4" in auto_log and "nvfp4_ks" in auto_log and "mmap is off" in auto_log, auto_error[-5000:]

        int8 = subprocess.run(base_command + ["--nvfp4-precision", "int8"], capture_output=True, timeout=60)
        int8_error = int8.stderr.decode(errors="replace")
        assert int8.returncode == 0, int8_error[-5000:]
        assert "repacking" not in int8_error, int8_error[-5000:]
    print(f"Imported {converted} raw NVFP4 and {mxfp4_converted} MXFP4 tensors; precision-path smokes passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
