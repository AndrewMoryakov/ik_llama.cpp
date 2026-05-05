"""Analyze per-layer per-expert dispatch statistics exported by ik_llama.

Usage:
    python analyze_expert_stats.py <expert_stats.csv> [--top N] [--output report.md]

The CSV is exported by setting IK_LLAMA_EXPORT_EXPERT_STATS=path.csv
"""
import argparse
import csv
import sys
from collections import defaultdict


def load_stats(path):
    layers = defaultdict(lambda: defaultdict(int))
    global_hits = {}
    meta = {}

    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("# total_dispatches="):
                meta["total_dispatches"] = int(line.split("=")[1])
            elif line.startswith("# n_layer="):
                parts = line.replace("#", "").strip().split()
                for p in parts:
                    k, v = p.split("=")
                    meta[k] = int(v)
            elif line.startswith("# e") and not line.startswith("# expert"):
                # Global expert: # e74,3872,1.56%
                parts = line.lstrip("# ").split(",")
                try:
                    eid = int(parts[0].lstrip("e"))
                    hits = int(parts[1])
                    global_hits[eid] = hits
                except (ValueError, IndexError):
                    pass
            elif line and not line.startswith("#") and not line.startswith("layer"):
                parts = line.split(",")
                if len(parts) == 3:
                    layer, expert, hits = int(parts[0]), int(parts[1]), int(parts[2])
                    layers[layer][expert] = hits

    return layers, global_hits, meta


def analyze(layers, global_hits, meta, top_n=20):
    n_layer = meta.get("n_layer", max(layers.keys()) + 1 if layers else 0)
    n_expert = meta.get("n_expert", 256)
    total_dispatches = meta.get("total_dispatches", 0)

    report = []
    report.append(f"# Expert Dispatch Analysis")
    report.append(f"")
    report.append(f"- Layers: {n_layer}")
    report.append(f"- Experts: {n_expert}")
    report.append(f"- Total dispatches: {total_dispatches}")
    report.append(f"")

    # Global top experts
    sorted_global = sorted(global_hits.items(), key=lambda x: -x[1])
    total_hits = sum(global_hits.values())

    report.append(f"## Global Top-{top_n} Experts")
    report.append(f"")
    report.append(f"| Rank | Expert | Hits | Share | Cumulative |")
    report.append(f"|------|--------|------|-------|------------|")
    cumulative = 0.0
    for i, (eid, hits) in enumerate(sorted_global[:top_n]):
        share = 100.0 * hits / total_hits if total_hits > 0 else 0
        cumulative += share
        report.append(f"| {i+1} | e{eid} | {hits} | {share:.2f}% | {cumulative:.1f}% |")

    report.append(f"")

    # Expert usage distribution
    active_experts = len([h for h in global_hits.values() if h > 0])
    top10_share = sum(h for _, h in sorted_global[:10]) / total_hits * 100 if total_hits > 0 else 0
    top50_share = sum(h for _, h in sorted_global[:50]) / total_hits * 100 if total_hits > 0 else 0

    report.append(f"## Distribution")
    report.append(f"")
    report.append(f"- Active experts (at least 1 hit): {active_experts}/{n_expert}")
    report.append(f"- Top 10 experts: {top10_share:.1f}% of all dispatches")
    report.append(f"- Top 50 experts: {top50_share:.1f}% of all dispatches")
    report.append(f"")

    # Per-layer analysis: which layers have most concentrated expert usage
    report.append(f"## Per-Layer Expert Concentration")
    report.append(f"")
    report.append(f"| Layer | Active Experts | Top-1 Share | Top-8 Share | Top Expert |")
    report.append(f"|-------|---------------|-------------|-------------|------------|")

    for il in range(n_layer):
        if il not in layers:
            continue
        layer_data = layers[il]
        sorted_layer = sorted(layer_data.items(), key=lambda x: -x[1])
        layer_total = sum(layer_data.values())
        active = len(sorted_layer)
        top1_share = sorted_layer[0][1] / layer_total * 100 if layer_total > 0 else 0
        top8_share = sum(h for _, h in sorted_layer[:8]) / layer_total * 100 if layer_total > 0 else 0
        top_expert = f"e{sorted_layer[0][0]}" if sorted_layer else "-"
        report.append(f"| {il} | {active} | {top1_share:.1f}% | {top8_share:.1f}% | {top_expert} |")

    report.append(f"")

    # Recommendation for quantization
    report.append(f"## Quantization Recommendations")
    report.append(f"")
    report.append(f"Experts that handle >1% of dispatches should be quantized more precisely.")
    report.append(f"Experts with <0.1% can be quantized more aggressively.")
    report.append(f"")

    hot_experts = [(eid, hits) for eid, hits in sorted_global if hits / total_hits > 0.01]
    cold_experts = [(eid, hits) for eid, hits in sorted_global if hits / total_hits < 0.001]
    report.append(f"- **Hot experts** (>1% share): {len(hot_experts)}")
    report.append(f"- **Cold experts** (<0.1% share): {len(cold_experts)}")
    report.append(f"- **Medium experts**: {active_experts - len(hot_experts) - len(cold_experts)}")

    return "\n".join(report)


def main():
    parser = argparse.ArgumentParser(description="Analyze expert dispatch statistics")
    parser.add_argument("csv_file", help="Path to expert_stats.csv")
    parser.add_argument("--top", type=int, default=20, help="Show top N experts (default: 20)")
    parser.add_argument("--output", help="Output report file (default: stdout)")
    args = parser.parse_args()

    layers, global_hits, meta = load_stats(args.csv_file)
    report = analyze(layers, global_hits, meta, top_n=args.top)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"Report saved to {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
