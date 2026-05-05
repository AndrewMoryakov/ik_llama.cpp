#!/usr/bin/env python3
"""Compare two eval runs (summary.json or run directories) and write Markdown/JSON reports.

Examples:
  python compare_runs.py --baseline /path/to/baseline_run --current /path/to/current_run
  python compare_runs.py --baseline bench_results/fast_qc_v2/20260324_101010 --current bench_results/fast_qc_v2/20260324_111111 --out compare_out
"""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, Dict, List

from eval_common import compare_summary_to_baseline, load_summary, md_escape, write_json, write_text


def build_markdown(current: Dict[str, Any], comparison: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append(f"# Run comparison: {current.get('suite', 'unknown_suite')}")
    lines.append("")
    lines.append(f"- current quant: `{current.get('quant_name')}`")
    lines.append(f"- current run_id: `{current.get('run_id')}`")
    lines.append(f"- baseline quant: `{comparison.get('baseline_quant_name')}`")
    lines.append(f"- baseline run_id: `{comparison.get('baseline_run_id')}`")
    lines.append(f"- total delta: `{comparison.get('total_score_delta'):+.2f}`")
    lines.append(f"- pct delta: `{comparison.get('pct_delta'):+.2f}`")
    lines.append("")

    if comparison.get("section_deltas"):
        lines.append("## Section deltas")
        lines.append("")
        lines.append("| Section | Delta |")
        lines.append("|---|---:|")
        for key, value in sorted(comparison["section_deltas"].items()):
            lines.append(f"| {md_escape(key)} | {value:+.2f} |")
        lines.append("")

    if comparison.get("dimension_deltas"):
        lines.append("## Dimension deltas")
        lines.append("")
        lines.append("| Dimension | Delta |")
        lines.append("|---|---:|")
        for key, value in sorted(comparison["dimension_deltas"].items()):
            lines.append(f"| {md_escape(key)} | {value:+.2f} |")
        lines.append("")

    lines.append("## Per-test deltas")
    lines.append("")
    lines.append("| Test | Weight | Baseline | Current | Delta |")
    lines.append("|---|---:|---:|---:|---:|")
    for item in comparison.get("per_test", []):
        lines.append(
            f"| {md_escape(item['test_id'])} {md_escape(item.get('test_name',''))} | {item.get('weight', 0)} | {item.get('baseline_score', 0)} | {item.get('current_score', 0)} | {item.get('delta', 0):+.2f} |"
        )
    lines.append("")

    lines.append("## Largest regressions")
    lines.append("")
    for item in comparison.get("top_regressions", []):
        lines.append(f"- {item['test_id']}: {item['delta']:+.2f}")
    lines.append("")

    lines.append("## Largest improvements")
    lines.append("")
    for item in comparison.get("top_improvements", []):
        lines.append(f"- {item['test_id']}: {item['delta']:+.2f}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", required=True, help="Path to baseline summary.json or run directory")
    parser.add_argument("--current", required=True, help="Path to current summary.json or run directory")
    parser.add_argument("--out", default=None, help="Output directory for comparison artifacts")
    args = parser.parse_args()

    baseline = load_summary(args.baseline)
    current = load_summary(args.current)
    if not baseline:
        raise SystemExit(f"Could not load baseline summary from: {args.baseline}")
    if not current:
        raise SystemExit(f"Could not load current summary from: {args.current}")

    comparison = compare_summary_to_baseline(current, baseline)
    if not comparison:
        raise SystemExit("Comparison could not be computed")

    out_dir = args.out or os.path.join(current.get("run_dir", os.getcwd()), "comparison_vs_baseline")
    os.makedirs(out_dir, exist_ok=True)

    write_json(os.path.join(out_dir, "comparison.json"), comparison)
    md = build_markdown(current, comparison)
    write_text(os.path.join(out_dir, "comparison.md"), md)

    print(md)
    print(f"\nArtifacts written to: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
