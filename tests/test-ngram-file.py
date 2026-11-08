"""Exercise the separate-GGUF loader using a small, supplied F32 model."""

import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "gguf-py"))
import gguf


def write_model(path, reader, tensors, split_no=None):
    writer = gguf.GGUFWriter(path, reader.fields["general.architecture"].contents())
    for name, field in reader.fields.items():
        if name.startswith("GGUF.") or name == "general.architecture" or name.startswith("split."):
            continue
        subtype = field.types[-1] if field.types[0] == gguf.GGUFValueType.ARRAY else None
        writer.add_key_value(name, field.contents(), field.types[0], subtype)
    if split_no is not None:
        writer.add_uint16("split.no", split_no)
        writer.add_uint16("split.count", 2)
        writer.add_int32("split.tensors.count", len(reader.tensors))
    for tensor in tensors:
        writer.add_tensor(tensor.name, tensor.data, raw_dtype=tensor.tensor_type)
    writer.write_header_to_file()
    writer.write_kv_data_to_file()
    writer.write_tensors_to_file()
    writer.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cli", required=True)
    parser.add_argument("--model", default=os.getenv("LLAMACPP_TEST_MODELFILE"))
    args = parser.parse_args()
    if not args.model:
        print("Set LLAMACPP_TEST_MODELFILE to a small F32 model for loader integration tests")
        return 77
    model = Path(args.model).resolve()
    reader = gguf.GGUFReader(model)
    tables = [t for t in reader.tensors if t.name == "token_embd.weight"]
    if len(tables) != 1 or tables[0].tensor_type != gguf.GGMLQuantizationType.F32:
        print("The integration fixture needs an F32 token_embd.weight tensor")
        return 77
    dense = [t for t in reader.tensors if t.name != "token_embd.weight"]
    with tempfile.TemporaryDirectory(prefix="ik-ngram-test-") as directory:
        root = Path(directory)
        detached = root / "dense.gguf"
        sidecar = root / "tables.gguf"
        first = root / "split-00001-of-00002.gguf"
        replacement = root / "elsewhere" / "replacement.gguf"
        replacement.parent.mkdir()
        write_model(detached, reader, dense)
        write_model(sidecar, reader, tables)
        write_model(first, reader, dense, 0)
        write_model(replacement, reader, tables, 1)

        def run(path, *extra, success=True):
            result = subprocess.run(
                [args.cli, "-m", str(path), "-p", "Once upon a time", "-n", "8",
                 "-c", "128", "-s", "42", "-t", "2", "-ngl", "0",
                 "--ignore-eos", "--no-display-prompt", *map(str, extra)],
                capture_output=True, timeout=60,
            )
            if (result.returncode == 0) != success:
                raise AssertionError(result.stderr.decode(errors="replace")[-5000:])
            return result.stdout

        baseline = run(model)
        assert run(detached, "--ngram-file", sidecar) == baseline
        assert run(detached, "--ple-file", sidecar, "-rtra") == baseline
        run(first, success=False)  # The conventionally named second shard is absent.
        assert run(first, "--ngram-file", replacement) == baseline
        run(model, "--ngram-file", sidecar, success=False)  # Duplicate tensor.
        run(detached, "--ngram-file", root / "missing.gguf", success=False)
        digest = hashlib.sha256(sidecar.read_bytes()).digest()
        for output in ("--token-timing", "--moe-trace"):
            run(detached, "--ngram-file", sidecar, output, sidecar, success=False)
            assert hashlib.sha256(sidecar.read_bytes()).digest() == digest
    print("Separate GGUF append, split replacement, alias, RTR and rejection tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
