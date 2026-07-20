from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Sequence

from .layout import LayoutError, load_layout
from .io_utils import atomic_write_text, paths_alias, reject_output_alias
from .simulator import TraceError, load_trace, simulate, validate_trace_layout


def _add_inputs(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--layout", required=True, type=Path)
    parser.add_argument("--trace", required=True, type=Path)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Trace-driven MoE expert-cache locality simulator")
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate_parser = subparsers.add_parser("validate", help="validate layout and routing trace")
    _add_inputs(validate_parser)

    simulate_parser = subparsers.add_parser("simulate", help="run one cache/predictor scenario")
    _add_inputs(simulate_parser)
    budget = simulate_parser.add_mutually_exclusive_group(required=True)
    budget.add_argument("--cache-bytes", type=int)
    budget.add_argument("--cache-gib", type=float)
    simulate_parser.add_argument("--policy", choices=("lru", "lfu", "static"), default="lru")
    simulate_parser.add_argument("--predictor", choices=("none", "previous-token", "oracle"), default="none")
    simulate_parser.add_argument("--page-size", type=int, default=4096)
    simulate_parser.add_argument("--chunk-pages", type=int, default=256)
    simulate_parser.add_argument("--prefetch-limit-mib", type=float, default=None)
    simulate_parser.add_argument("--static-profile", type=Path)
    simulate_parser.add_argument(
        "--access-model", choices=("cpu-ggml-phase-v1",), default="cpu-ggml-phase-v1",
    )
    simulate_parser.add_argument(
        "--up-gate-mode", choices=("fused", "unfused"),
        help="required for separate gate/up tensors; must match runtime fused-moe setting",
    )
    simulate_parser.add_argument("--output", type=Path)

    args = parser.parse_args(argv)
    try:
        layout = load_layout(args.layout)
        trace_info, routes = load_trace(args.trace)
        validate_trace_layout(layout, trace_info, routes)
        if args.command == "validate":
            print(f"valid: {len(routes)} routes, {len(layout.layers)} MoE layers, fingerprint={layout.fingerprint}")
            return 0
        static_profile = None
        static_info = None
        if args.static_profile and args.policy != "static":
            raise ValueError("--static-profile is only valid with --policy static")
        if args.policy == "static" and not args.static_profile:
            raise ValueError("--policy static requires --static-profile")
        if args.static_profile:
            if paths_alias(args.static_profile, args.trace):
                raise ValueError("static calibration trace must differ from the evaluated trace")
            static_info, static_profile = load_trace(args.static_profile)
            if static_info["sha256"] == trace_info["sha256"]:
                raise ValueError("static calibration trace must not be a copy of the evaluated trace")
            validate_trace_layout(layout, static_info, static_profile)
        if args.cache_gib is not None and (not math.isfinite(args.cache_gib) or args.cache_gib < 0):
            raise ValueError("--cache-gib must be finite and non-negative")
        if args.prefetch_limit_mib is not None and (
                not math.isfinite(args.prefetch_limit_mib) or args.prefetch_limit_mib < 0):
            raise ValueError("--prefetch-limit-mib must be finite and non-negative")
        cache_bytes = args.cache_bytes if args.cache_bytes is not None else int(args.cache_gib * (1024 ** 3))
        prefetch_limit = None if args.prefetch_limit_mib is None else int(args.prefetch_limit_mib * (1024 ** 2))
        result = simulate(
            layout,
            routes,
            cache_bytes=cache_bytes,
            policy=args.policy,
            predictor=args.predictor,
            page_size=args.page_size,
            chunk_pages=args.chunk_pages,
            prefetch_limit_bytes=prefetch_limit,
            static_profile=static_profile,
            access_model=args.access_model,
            up_gate_mode=args.up_gate_mode,
            trace_sha256=trace_info["sha256"],
            static_profile_sha256=None if static_info is None else static_info["sha256"],
        )
        text = json.dumps(result, indent=2, sort_keys=True) + "\n"
        if args.output:
            protected = [args.layout, args.trace]
            if args.static_profile:
                protected.append(args.static_profile)
            protected.extend(Path(str(shard["path"])) for shard in layout.shards.values())
            reject_output_alias(args.output, protected, description="an input artifact")
            atomic_write_text(args.output, text)
        else:
            print(text, end="")
        return 0
    except (LayoutError, TraceError, OSError, ValueError) as exc:
        parser.error(str(exc))
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
