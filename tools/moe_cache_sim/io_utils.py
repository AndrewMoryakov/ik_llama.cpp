from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Iterable


def _normalized_path(path: Path) -> str:
    """Return an absolute, symlink-resolved and platform-case-normalized path."""
    return os.path.normcase(os.path.normpath(str(path.resolve(strict=False))))


def paths_alias(left: Path, right: Path) -> bool:
    """Detect lexical aliases, symlinks and (when both exist) hard links."""
    left = Path(left)
    right = Path(right)
    try:
        if left.exists() and right.exists() and left.samefile(right):
            return True
    except OSError:
        # Fall through to the conservative normalized-path comparison. The
        # caller will still surface later filesystem failures without writing.
        pass
    return _normalized_path(left) == _normalized_path(right)


def reject_output_alias(output: Path, inputs: Iterable[Path], *, description: str = "input") -> None:
    output = Path(output)
    for source in inputs:
        source = Path(source)
        if paths_alias(output, source):
            raise ValueError(f"output {output} must not overwrite {description}: {source}")


def atomic_write_text(path: Path, text: str) -> None:
    """Write a complete UTF-8 artifact and atomically replace its destination."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            prefix=f".{path.name}.",
            suffix=".tmp",
            dir=path.parent,
            delete=False,
        ) as stream:
            temporary = Path(stream.name)
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        temporary = None
    finally:
        if temporary is not None:
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass
