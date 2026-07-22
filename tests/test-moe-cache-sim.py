#!/usr/bin/env python3

import json
import hashlib
import math
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

import tools.moe_cache_sim.build_layout as build_layout_module  # noqa: E402
from tools.moe_cache_sim.build_layout import ShardScan, build_document  # noqa: E402
from tools.moe_cache_sim.io_utils import atomic_write_text, reject_output_alias  # noqa: E402
from tools.moe_cache_sim.layout import (  # noqa: E402
    LAYOUT_SCHEMA,
    MODEL_SIGNATURE_SCHEME,
    LayoutError,
    ModelLayout,
    layout_fingerprint,
    model_signature,
)
from tools.moe_cache_sim.simulator import (  # noqa: E402
    ChunkMapper,
    Route,
    SelectedExpert,
    TraceError,
    load_trace,
    routing_report,
    simulate,
    validate_trace_layout,
)


def make_layout(stride=16):
    n_experts = 3
    n_bytes = stride * n_experts
    document = {
        "schema": LAYOUT_SCHEMA,
        "version": 1,
        "model": {
            "architecture": "test-moe",
            "n_layers": 1,
            "n_experts": n_experts,
            "fingerprint": "pending",
            "model_signature_scheme": MODEL_SIGNATURE_SCHEME,
            "model_signature": "pending",
        },
        "shards": [{"id": 0, "path": "synthetic.gguf", "size_bytes": 4096}],
        "layers": [{
            "layer": 0,
            "representation": "separate",
            "tensors": [
                {"role": "gate", "name": "blk.0.ffn_gate_exps.weight", "shard_id": 0,
                 "type": "F32", "type_id": 0, "shape": [4, 2, 3], "file_offset": 0,
                 "n_bytes": n_bytes, "n_experts": n_experts, "expert_stride_bytes": stride},
                {"role": "up", "name": "blk.0.ffn_up_exps.weight", "shard_id": 0,
                 "type": "F32", "type_id": 0, "shape": [4, 2, 3], "file_offset": 256,
                 "n_bytes": n_bytes, "n_experts": n_experts, "expert_stride_bytes": stride},
                {"role": "down", "name": "blk.0.ffn_down_exps.weight", "shard_id": 0,
                 "type": "F32", "type_id": 0, "shape": [2, 4, 3], "file_offset": 512,
                 "n_bytes": n_bytes, "n_experts": n_experts, "expert_stride_bytes": stride},
            ],
        }],
    }
    rows = (
        f"{layer['layer']}|{tensor['role']}|{tensor['name']}|{tensor['type_id']}|"
        f"{','.join(str(value) for value in tensor['shape'])}|{tensor['n_bytes']}\n"
        for layer in document["layers"] for tensor in layer["tensors"]
    )
    document["model"]["model_signature"] = model_signature(rows)
    document["model"]["fingerprint"] = layout_fingerprint(document)
    return ModelLayout(document), document


def make_fused_layout(stride=16):
    _, document = make_layout(stride)
    n_experts = document["model"]["n_experts"]
    document["layers"][0] = {
        "layer": 0,
        "representation": "fused",
        "tensors": [
            {"role": "gate_up", "name": "blk.0.ffn_gate_up_exps.weight", "shard_id": 0,
             "type": "F32", "type_id": 0, "shape": [4, 4, n_experts], "file_offset": 0,
             "n_bytes": 2 * stride * n_experts, "n_experts": n_experts,
             "expert_stride_bytes": 2 * stride},
            {"role": "down", "name": "blk.0.ffn_down_exps.weight", "shard_id": 0,
             "type": "F32", "type_id": 0, "shape": [2, 4, n_experts], "file_offset": 512,
             "n_bytes": stride * n_experts, "n_experts": n_experts,
             "expert_stride_bytes": stride},
        ],
    }
    rows = (
        f"{layer['layer']}|{tensor['role']}|{tensor['name']}|{tensor['type_id']}|"
        f"{','.join(str(value) for value in tensor['shape'])}|{tensor['n_bytes']}\n"
        for layer in document["layers"] for tensor in layer["tensors"]
    )
    document["model"]["model_signature"] = model_signature(rows)
    document["model"]["fingerprint"] = layout_fingerprint(document)
    return ModelLayout(document), document


def route(event, pos, *experts, batch_index=None):
    selected = tuple(
        SelectedExpert(rank=index, expert=expert, selection_score=1.0 - index * 0.1, weight=1.0 / len(experts))
        for index, expert in enumerate(experts)
    )
    return Route(
        event=event, sequence=0, batch_index=pos if batch_index is None else batch_index,
        pos=pos, layer=0, n_expert=3, input_token_id=100 + pos, selected=selected,
    )


def write_trace(path, routes, document=None, *, complete=True):
    if document is None:
        _, document = make_layout()
    records = [{
        "type": "meta",
        "schema": "ik_llama.moe_routing_trace",
        "version": 1,
        "model": document["shards"][0]["path"],
        "model_file_size": document["shards"][0]["size_bytes"],
        "scope": "single_token_target_decode",
        "selection_score": "router_probability_with_selection_bias_if_present",
        "weight": "normalized_pre_scale_moe_contribution",
        "measurement_overhead": True,
    }, {
        "type": "model",
        "n_layer": document["model"]["n_layers"],
        "architecture": document["model"]["architecture"],
        "moe_layers": len(document["layers"]),
        "moe_layer_ids": [layer["layer"] for layer in document["layers"]],
        "model_signature_scheme": document["model"]["model_signature_scheme"],
        "model_signature": document["model"]["model_signature"],
    }]
    for item in routes:
        records.append({
            "type": "route",
            "event": item.event,
            "sequence": item.sequence,
            "batch_index": item.batch_index,
            "pos": item.pos,
            "layer": item.layer,
            "n_expert": item.n_expert,
            "input_token_id": item.input_token_id,
            "selected": [entry.__dict__ for entry in item.selected],
        })
    if complete:
        records.append({
            "type": "end", "complete": True, "routes": len(routes),
            "batches": len({(item.sequence, item.batch_index) for item in routes}),
        })
    path.write_text("".join(json.dumps(item) + "\n" for item in records), encoding="utf-8")


class LayoutTests(unittest.TestCase):
    def test_exact_expert_ranges_and_shared_pages(self):
        layout, _ = make_layout(stride=20)
        ranges = layout.ranges_for(0, 1)
        self.assertEqual([item.offset for item in ranges], [20, 276, 532])
        mapper = ChunkMapper(layout, page_size=16, chunk_pages=1)
        # Adjacent 20-byte slabs share boundary pages; per-event chunks are deduplicated.
        chunks = mapper.expert_chunks(0, [0, 1])
        self.assertEqual(len(chunks), len(set(chunks)))
        self.assertLess(len(chunks), 12)

    def test_build_document_from_tensor_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            shard_path = Path(tmp) / "model.gguf"
            shard_path.write_bytes(b"\0" * 512)
            scan = ShardScan(
                path=shard_path,
                split_no=None,
                split_count=1,
                total_tensor_count=None,
                data_offset=0,
                alignment=32,
                fields={
                    "general.architecture": "test",
                    "test.expert_count": 3,
                    "test.block_count": 1,
                },
                tensors=(
                    {"name": "blk.0.ffn_gate_exps.weight", "type": "F32", "type_id": 0, "shape": (4, 2, 3), "file_offset": 0, "n_bytes": 48},
                    {"name": "blk.0.ffn_up_exps.weight", "type": "F32", "type_id": 0, "shape": (4, 2, 3), "file_offset": 64, "n_bytes": 48},
                    {"name": "blk.0.ffn_down_exps.weight", "type": "F32", "type_id": 0, "shape": (2, 4, 3), "file_offset": 128, "n_bytes": 48},
                ),
            )
            document = build_document([scan])
            self.assertEqual(document["layers"][0]["representation"], "separate")
            self.assertEqual(document["layers"][0]["tensors"][0]["expert_stride_bytes"], 16)
            self.assertTrue(document["model"]["fingerprint"])
            self.assertTrue(document["model"]["model_signature"])

    def test_fused_gate_up_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            shard_path = Path(tmp) / "fused.gguf"
            shard_path.write_bytes(b"\0" * 512)
            scan = ShardScan(
                path=shard_path, split_no=None, split_count=1, total_tensor_count=None,
                data_offset=0, alignment=32,
                fields={"general.architecture": "test", "test.expert_count": 3, "test.block_count": 1},
                tensors=(
                    {"name": "blk.0.ffn_gate_up_exps.weight", "type": "F32", "type_id": 0,
                     "shape": (4, 4, 3), "file_offset": 0, "n_bytes": 96},
                    {"name": "blk.0.ffn_down_exps.weight", "type": "F32", "type_id": 0,
                     "shape": (2, 4, 3), "file_offset": 128, "n_bytes": 48},
                ),
            )
            document = build_document([scan])
            layout = ModelLayout(document)
            self.assertEqual(document["layers"][0]["representation"], "fused")
            self.assertEqual([item.role for item in layout.layers[0]], ["gate_up", "down"])

    def test_split_shards_and_metadata_consistency(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            paths = [root / "m-00001-of-00002.gguf", root / "m-00002-of-00002.gguf"]
            for path in paths:
                path.write_bytes(b"\0" * 512)
            fields = {
                "general.architecture": "test", "test.expert_count": 3,
                "test.block_count": 1, "split.count": 2, "split.tensors.count": 3,
            }
            scans = [
                ShardScan(paths[1], 1, 2, 3, 0, 32, {**fields, "split.no": 1}, (
                    {"name": "blk.0.ffn_down_exps.weight", "type": "F32", "type_id": 0,
                     "shape": (2, 4, 3), "file_offset": 64, "n_bytes": 48},
                )),
                ShardScan(paths[0], 0, 2, 3, 0, 32, {**fields, "split.no": 0}, (
                    {"name": "blk.0.ffn_gate_exps.weight", "type": "F32", "type_id": 0,
                     "shape": (4, 2, 3), "file_offset": 32, "n_bytes": 48},
                    {"name": "blk.0.ffn_up_exps.weight", "type": "F32", "type_id": 0,
                     "shape": (4, 2, 3), "file_offset": 128, "n_bytes": 48},
                )),
            ]
            layout = ModelLayout(build_document(scans))
            self.assertEqual([item.shard_id for item in layout.layers[0]], [0, 0, 1])

            bad = list(scans)
            bad[0] = ShardScan(
                bad[0].path, bad[0].split_no, bad[0].split_count, 4,
                bad[0].data_offset, bad[0].alignment, bad[0].fields, bad[0].tensors,
            )
            with self.assertRaises(LayoutError):
                build_document(bad)

    def test_incomplete_and_overlapping_layouts_are_rejected(self):
        _, document = make_layout()
        incomplete = json.loads(json.dumps(document))
        incomplete["layers"][0]["tensors"].pop()
        with self.assertRaises(LayoutError):
            ModelLayout(incomplete)

        overlapping = json.loads(json.dumps(document))
        overlapping["layers"][0]["tensors"][1]["file_offset"] = 0
        with self.assertRaises(LayoutError):
            ModelLayout(overlapping)

        tampered = json.loads(json.dumps(document))
        tampered["layers"][0]["tensors"][1]["file_offset"] = 320
        with self.assertRaisesRegex(LayoutError, "fingerprint"):
            ModelLayout(tampered)


class SimulatorTests(unittest.TestCase):
    def test_routing_locality_report_known_sequence(self):
        routes = [
            route(0, 0, 0, 1),
            route(1, 1, 1, 2),
            route(2, 2, 1, 2),
        ]
        result = routing_report(routes, trace_sha256="a" * 64, layout_fingerprint="layout")
        report = result["global"]
        self.assertEqual(result["schema"], "ik_llama.moe_routing_locality_report")
        self.assertEqual(result["provenance"]["trace_sha256"], "a" * 64)
        self.assertEqual(report["hotset_experts_for_selection_share"], {
            "0.50": 1, "0.80": 2, "0.90": 3, "0.95": 3,
        })
        self.assertEqual(report["expert_popularity"], [
            {"layer": 0, "expert": 1, "count": 3, "selection_share": 0.5},
            {"layer": 0, "expert": 2, "count": 2, "selection_share": 1 / 3},
            {"layer": 0, "expert": 0, "count": 1, "selection_share": 1 / 6},
        ])
        self.assertEqual(result["layers"]["0"]["expert_popularity"][0],
                         {"expert": 1, "count": 3, "selection_share": 0.5})
        expected_entropy = -(0.5 * math.log(0.5) + (1 / 3) * math.log(1 / 3) +
                             (1 / 6) * math.log(1 / 6)) / math.log(3)
        self.assertAlmostEqual(report["selection_frequency_normalized_entropy"], expected_entropy)
        self.assertAlmostEqual(report["previous_token"]["mean_jaccard"], 2 / 3)
        self.assertEqual(report["previous_token"]["p50_jaccard"], 1 / 3)
        self.assertEqual(report["previous_token"]["p95_jaccard"], 1.0)
        self.assertEqual(report["previous_token"]["exact_match_rate"], 0.5)
        self.assertEqual(report["reuse_distance_tokens"]["cold_selections"], 3)
        self.assertEqual(report["reuse_distance_tokens"]["repeated_selections"], 3)
        self.assertEqual(report["reuse_distance_tokens"]["p95"], 1)
        self.assertEqual(report["selected_weight_concentration"], {
            "mean_top_rank_weight": 0.5,
            "mean_max_weight": 0.5,
            "mean_tail_rank_weight": 0.5,
            "mean_effective_selected_experts": 2.0,
        })

    def test_routing_locality_global_identity_is_layer_qualified(self):
        layer0 = route(0, 0, 0)
        layer1 = Route(
            event=1, sequence=0, batch_index=0, pos=0, layer=1, n_expert=3,
            input_token_id=100, selected=layer0.selected,
        )
        report = routing_report([layer0, layer1])["global"]
        self.assertEqual(report["unique_selected_experts"], 2)
        self.assertEqual(report["expert_popularity"], [
            {"layer": 0, "expert": 0, "count": 1, "selection_share": 0.5},
            {"layer": 1, "expert": 0, "count": 1, "selection_share": 0.5},
        ])

    def test_routing_locality_sliding_window(self):
        routes = [route(index, index, 0 if index < 4 else 1) for index in range(8)]
        report = routing_report(routes)["layers"]["0"]
        window = report["sliding_token_working_set"]["8"]
        self.assertEqual(window["full_contiguous_windows"], 1)
        self.assertEqual(window["mean_unique_experts"], 2)
        self.assertEqual(window["p95_unique_experts"], 2)
        self.assertIsNone(report["sliding_token_working_set"]["32"]["mean_unique_experts"])

    def test_cpu_phase_order_uses_expert_id_not_router_rank(self):
        layout, _ = make_layout()
        mapper = ChunkMapper(layout, page_size=16, chunk_pages=1)
        self.assertEqual(
            mapper.demand_phases(0, [2, 0], up_gate_mode="unfused"),
            [[(0, 16), (0, 18)], [(0, 0), (0, 2)], [(0, 32), (0, 34)]],
        )
        self.assertEqual(
            mapper.demand_phases(0, [2, 0], up_gate_mode="fused"),
            [[(0, 16), (0, 0), (0, 18), (0, 2)], [(0, 32), (0, 34)]],
        )

    def test_fused_layout_has_gate_up_then_down_phases_without_mode(self):
        layout, _ = make_fused_layout()
        mapper = ChunkMapper(layout, page_size=16, chunk_pages=1)
        phases = mapper.demand_phases(0, [2, 0], up_gate_mode=None)
        self.assertEqual(phases[0], [(0, 1), (0, 0), (0, 5), (0, 4)])
        self.assertEqual(phases[1], [(0, 32), (0, 34)])
        result = simulate(layout, [route(0, 0, 2, 0)], cache_bytes=8 * 16,
                          page_size=16, chunk_pages=1)
        self.assertEqual(result["configuration"]["up_gate_execution"], "not_applicable")

    def test_phase_boundary_retouches_shared_chunk(self):
        layout, _ = make_layout()
        mapper = ChunkMapper(layout, page_size=512, chunk_pages=1)
        self.assertEqual(
            mapper.demand_phases(0, [0], up_gate_mode="unfused"),
            [[(0, 0)], [(0, 0)], [(0, 1)]],
        )
        result = simulate(layout, [route(0, 0, 0)], cache_bytes=2 * 512,
                          page_size=512, chunk_pages=1, up_gate_mode="unfused")
        self.assertEqual(result["metrics"]["demand_chunk_bytes"], 3 * 512)
        self.assertEqual(result["metrics"]["demand_hit_bytes"], 512)

    def test_runtime_fused_mode_falls_back_for_mismatched_tensor_types(self):
        _, document = make_layout()
        gate = document["layers"][0]["tensors"][0]
        gate["type"] = "F16"
        gate["type_id"] = 1
        rows = (
            f"{layer['layer']}|{tensor['role']}|{tensor['name']}|{tensor['type_id']}|"
            f"{','.join(str(value) for value in tensor['shape'])}|{tensor['n_bytes']}\n"
            for layer in document["layers"] for tensor in layer["tensors"]
        )
        document["model"]["model_signature"] = model_signature(rows)
        document["model"]["fingerprint"] = layout_fingerprint(document)
        layout = ModelLayout(document)
        mapper = ChunkMapper(layout, page_size=16, chunk_pages=1)
        self.assertEqual(
            mapper.demand_phases(0, [0], up_gate_mode="fused"),
            mapper.demand_phases(0, [0], up_gate_mode="unfused"),
        )
        result = simulate(
            layout, [route(0, 0, 0)], cache_bytes=48,
            page_size=16, chunk_pages=1, up_gate_mode="fused",
        )
        self.assertEqual(result["configuration"]["up_gate_requested"], "fused")
        self.assertEqual(result["configuration"]["up_gate_execution"], "unfused")
        self.assertEqual(result["configuration"]["fused_up_gate_eligible_layers"], 0)

    def test_phase_order_changes_lru_regression(self):
        layout, _ = make_layout()
        result = simulate(
            layout,
            [route(0, 0, 0, 1), route(1, 1, 1)],
            cache_bytes=3 * 16,
            page_size=16,
            chunk_pages=1,
            up_gate_mode="unfused",
        )
        self.assertEqual(result["metrics"]["demand_hit_bytes"], 16)

    def test_separate_layout_requires_mode_and_reports_capacity_and_timing(self):
        layout, _ = make_layout()
        with self.assertRaisesRegex(ValueError, "explicit up_gate_mode"):
            simulate(layout, [route(0, 0, 0)], cache_bytes=48, page_size=16, chunk_pages=1)
        result = simulate(
            layout,
            [route(0, 0, 0), route(1, 1, 0)],
            cache_bytes=50,
            predictor="previous-token",
            page_size=16,
            chunk_pages=1,
            up_gate_mode="fused",
            trace_sha256="a" * 64,
        )
        self.assertEqual(result["configuration"]["effective_cache_bytes"], 48)
        self.assertEqual(result["configuration"]["unused_cache_budget_bytes"], 2)
        self.assertEqual(result["configuration"]["selected_expert_demand_order"], "ascending_expert_id")
        self.assertFalse(result["configuration"]["intra_kernel_order_exact"])
        self.assertTrue(result["idealized_prefetch_timing"])
        self.assertFalse(result["production_prefetch_timing_modeled"])
        self.assertEqual(result["provenance"]["trace_sha256"], "a" * 64)

    def test_lru_known_sequence(self):
        layout, _ = make_layout()
        routes = [route(0, 0, 0), route(1, 1, 1), route(2, 2, 0)]
        result = simulate(layout, routes, cache_bytes=6 * 16, page_size=16, chunk_pages=1,
                          up_gate_mode="unfused")
        self.assertEqual(result["metrics"]["demand_miss_bytes"], 6 * 16)
        self.assertEqual(result["metrics"]["demand_hit_bytes"], 3 * 16)

        small = simulate(layout, routes, cache_bytes=3 * 16, page_size=16, chunk_pages=1,
                         up_gate_mode="unfused")
        self.assertEqual(small["metrics"]["demand_miss_bytes"], 9 * 16)

    def test_oracle_moves_io_to_prefetch_not_away(self):
        layout, _ = make_layout()
        result = simulate(
            layout, [route(0, 0, 0)], cache_bytes=3 * 16,
            predictor="oracle", page_size=16, chunk_pages=1, up_gate_mode="unfused",
        )
        self.assertEqual(result["metrics"]["demand_miss_bytes"], 0)
        self.assertEqual(result["metrics"]["prefetch_read_bytes"], 3 * 16)
        self.assertEqual(result["metrics"]["modeled_cache_fill_bytes"], 3 * 16)
        self.assertTrue(result["idealized_upper_bound"])

        tiny = simulate(
            layout, [route(0, 0, 0)], cache_bytes=16,
            predictor="oracle", page_size=16, chunk_pages=1, up_gate_mode="unfused",
        )
        self.assertEqual(tiny["metrics"]["demand_miss_bytes"], 0)
        self.assertEqual(tiny["metrics"]["modeled_cache_fill_bytes"], 3 * 16)

    def test_previous_token_does_not_cross_position_gap(self):
        layout, _ = make_layout()
        result = simulate(
            layout, [route(0, 0, 0), route(1, 2, 0)], cache_bytes=3 * 16,
            predictor="previous-token", page_size=16, chunk_pages=1, up_gate_mode="unfused",
        )
        self.assertEqual(result["metrics"].get("prefetch_requested_bytes", 0), 0)
        self.assertIsNone(result["metrics"]["predictor_expert_precision"])

    def test_static_requires_separate_calibration(self):
        layout, _ = make_layout()
        with self.assertRaises(ValueError):
            simulate(layout, [route(0, 0, 0)], cache_bytes=3 * 16,
                     policy="static", page_size=16, chunk_pages=1, up_gate_mode="unfused")
        with self.assertRaisesRegex(ValueError, "routing must differ"):
            simulate(
                layout, [route(0, 0, 0)], cache_bytes=3 * 16, policy="static",
                static_profile=[route(0, 0, 0)], page_size=16, chunk_pages=1,
                up_gate_mode="unfused",
            )
        result = simulate(
            layout, [route(0, 0, 0)], cache_bytes=3 * 16, policy="static",
            static_profile=[route(0, 0, 0), route(1, 1, 0)], page_size=16, chunk_pages=1,
            up_gate_mode="unfused",
        )
        self.assertEqual(result["metrics"]["demand_hit_bytes"], 3 * 16)
        self.assertEqual(result["metrics"]["initial_resident_bytes"], 3 * 16)
        self.assertEqual(
            result["metrics"]["modeled_total_fill_including_initial_bytes"],
            result["metrics"]["modeled_cache_fill_bytes"] + 3 * 16,
        )
        with self.assertRaisesRegex(ValueError, "provenance must differ"):
            simulate(
                layout, [route(0, 0, 0)], cache_bytes=3 * 16, policy="static",
                static_profile=[route(0, 0, 1)], page_size=16, chunk_pages=1,
                up_gate_mode="unfused", trace_sha256="b" * 64,
                static_profile_sha256="b" * 64,
            )

    def test_lfu_retains_hot_chunk(self):
        layout, _ = make_layout()
        routes = [route(i, i, expert) for i, expert in enumerate([0, 0, 0, 1, 2, 0])]
        result = simulate(layout, routes, cache_bytes=6 * 16, policy="lfu", page_size=16,
                          chunk_pages=1, up_gate_mode="unfused")
        self.assertGreater(result["metrics"]["demand_hit_bytes"], 0)

    def test_prefetch_cap_and_zero_capacity(self):
        layout, _ = make_layout()
        routes = [route(0, 0, 0), route(1, 1, 0)]
        capped = simulate(
            layout, routes, cache_bytes=6 * 16, predictor="previous-token",
            page_size=16, chunk_pages=1, prefetch_limit_bytes=16, up_gate_mode="unfused",
        )
        self.assertEqual(capped["metrics"]["prefetch_truncated_bytes"], 2 * 16)
        self.assertAlmostEqual(capped["metrics"]["issued_prefetch_chunk_recall"], 1 / 3)
        self.assertAlmostEqual(capped["metrics"]["issued_prefetch_chunk_overall_recall"], 1 / 6)

        zero = simulate(
            layout, routes, cache_bytes=8, predictor="previous-token",
            page_size=16, chunk_pages=1, up_gate_mode="unfused",
        )
        self.assertEqual(zero["metrics"]["prefetch_read_bytes"], 0)
        self.assertEqual(zero["metrics"]["prefetch_unadmitted_bytes"], 3 * 16)


class TraceAndCliTests(unittest.TestCase):
    def test_trace_sha256_is_raw_file_digest_and_huge_numbers_are_rejected(self):
        _, document = make_layout()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "trace.jsonl"
            write_trace(path, [route(0, 0, 0)], document)
            info, _ = load_trace(path)
            self.assertEqual(info["sha256"], hashlib.sha256(path.read_bytes()).hexdigest())

            records = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
            records[2]["selected"][0]["selection_score"] = 10 ** 400
            path.write_text("".join(json.dumps(item) + "\n" for item in records), encoding="utf-8")
            with self.assertRaisesRegex(TraceError, "must be finite"):
                load_trace(path)

            # MiniMax selection bias is added before top-k and can make a
            # finite selected score negative; contribution weights stay >= 0.
            records[2]["selected"][0]["selection_score"] = -0.25
            path.write_text("".join(json.dumps(item) + "\n" for item in records), encoding="utf-8")
            _, negative_routes = load_trace(path)
            self.assertEqual(negative_routes[0].selected[0].selection_score, -0.25)

    def test_trace_validation_rejects_duplicate_route(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "trace.jsonl"
            duplicated = [route(0, 0, 0), route(1, 0, 0)]
            write_trace(path, duplicated)
            with self.assertRaises(TraceError):
                load_trace(path)

    def test_trace_requires_footer_and_allows_repeated_kv_position(self):
        layout, document = make_layout()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "trace.jsonl"
            write_trace(path, [route(0, 7, 0, batch_index=0)], document, complete=False)
            with self.assertRaises(TraceError):
                load_trace(path)

            write_trace(path, [
                route(0, 7, 0, batch_index=0),
                route(1, 7, 1, batch_index=1),
            ], document)
            info, routes = load_trace(path)
            validate_trace_layout(layout, info, routes)

    def test_validation_rejects_reversed_timeline(self):
        layout, document = make_layout()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "trace.jsonl"
            write_trace(path, [
                route(0, 8, 0, batch_index=1),
                route(1, 7, 1, batch_index=0),
            ], document)
            info, routes = load_trace(path)
            with self.assertRaisesRegex(TraceError, "chronological"):
                validate_trace_layout(layout, info, routes)

    def test_validate_cli(self):
        layout, document = make_layout()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            layout_path = root / "layout.json"
            trace_path = root / "trace.jsonl"
            layout_path.write_text(json.dumps(document), encoding="utf-8")
            write_trace(trace_path, [route(0, 0, 0)])
            proc = subprocess.run(
                [sys.executable, "-m", "tools.moe_cache_sim.simulate", "validate",
                 "--layout", str(layout_path), "--trace", str(trace_path)],
                cwd=REPO_ROOT, capture_output=True, text=True,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("valid: 1 routes", proc.stdout)

    def test_simulate_cli(self):
        _, document = make_layout()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            layout_path = root / "layout.json"
            trace_path = root / "trace.jsonl"
            output_path = root / "result.json"
            layout_path.write_text(json.dumps(document), encoding="utf-8")
            write_trace(trace_path, [route(0, 0, 0)], document)
            proc = subprocess.run(
                [sys.executable, "-m", "tools.moe_cache_sim.simulate", "simulate",
                 "--layout", str(layout_path), "--trace", str(trace_path),
                 "--cache-bytes", "48", "--page-size", "16", "--chunk-pages", "1",
                 "--up-gate-mode", "unfused",
                 "--output", str(output_path)],
                cwd=REPO_ROOT, capture_output=True, text=True,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            result = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(result["metrics"]["routes"], 1)
            self.assertEqual(
                result["provenance"]["trace_sha256"],
                hashlib.sha256(trace_path.read_bytes()).hexdigest(),
            )
            self.assertIsNone(result["provenance"]["static_profile_sha256"])

    def test_report_cli(self):
        _, document = make_layout()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            layout_path = root / "layout.json"
            trace_path = root / "trace.jsonl"
            output_path = root / "locality.json"
            layout_path.write_text(json.dumps(document), encoding="utf-8")
            write_trace(trace_path, [route(0, 0, 0), route(1, 1, 0)], document)
            proc = subprocess.run(
                [sys.executable, "-m", "tools.moe_cache_sim.simulate", "report",
                 "--layout", str(layout_path), "--trace", str(trace_path),
                 "--output", str(output_path)],
                cwd=REPO_ROOT, capture_output=True, text=True,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            result = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(result["global"]["previous_token"]["exact_match_rate"], 1.0)
            self.assertEqual(
                result["provenance"]["trace_sha256"],
                hashlib.sha256(trace_path.read_bytes()).hexdigest(),
            )

    def test_simulate_cli_refuses_to_overwrite_inputs(self):
        _, document = make_layout()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            layout_path = root / "layout.json"
            trace_path = root / "trace.jsonl"
            layout_path.write_text(json.dumps(document), encoding="utf-8")
            write_trace(trace_path, [route(0, 0, 0)], document)
            original_trace = trace_path.read_bytes()
            proc = subprocess.run(
                [sys.executable, "-m", "tools.moe_cache_sim.simulate", "simulate",
                 "--layout", str(layout_path), "--trace", str(trace_path),
                 "--cache-bytes", "48", "--page-size", "16", "--chunk-pages", "1",
                 "--up-gate-mode", "unfused",
                 "--output", str(trace_path)],
                cwd=REPO_ROOT, capture_output=True, text=True,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("must not overwrite", proc.stderr)
            self.assertEqual(trace_path.read_bytes(), original_trace)

    def test_static_cli_rejects_hardlink_and_byte_identical_copy(self):
        _, document = make_layout()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            layout_path = root / "layout.json"
            trace_path = root / "trace.jsonl"
            hardlink_path = root / "hardlink.jsonl"
            copy_path = root / "copy.jsonl"
            layout_path.write_text(json.dumps(document), encoding="utf-8")
            write_trace(trace_path, [route(0, 0, 0)], document)
            os.link(trace_path, hardlink_path)
            copy_path.write_bytes(trace_path.read_bytes())

            base = [
                sys.executable, "-m", "tools.moe_cache_sim.simulate", "simulate",
                "--layout", str(layout_path), "--trace", str(trace_path),
                "--cache-bytes", "48", "--page-size", "16", "--chunk-pages", "1",
                "--up-gate-mode", "unfused", "--policy", "static", "--static-profile",
            ]
            hardlink_proc = subprocess.run(
                [*base, str(hardlink_path)], cwd=REPO_ROOT, capture_output=True, text=True,
            )
            self.assertNotEqual(hardlink_proc.returncode, 0)
            self.assertIn("must differ", hardlink_proc.stderr)

            copy_proc = subprocess.run(
                [*base, str(copy_path)], cwd=REPO_ROOT, capture_output=True, text=True,
            )
            self.assertNotEqual(copy_proc.returncode, 0)
            self.assertIn("must not be a copy", copy_proc.stderr)

            calibration_path = root / "calibration.jsonl"
            output_path = root / "static-result.json"
            write_trace(calibration_path, [route(0, 0, 1)], document)
            success = subprocess.run(
                [*base, str(calibration_path), "--output", str(output_path)],
                cwd=REPO_ROOT, capture_output=True, text=True,
            )
            self.assertEqual(success.returncode, 0, success.stderr)
            result = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(
                result["provenance"]["static_profile_sha256"],
                hashlib.sha256(calibration_path.read_bytes()).hexdigest(),
            )


class OutputSafetyTests(unittest.TestCase):
    def test_alias_detection_covers_normalized_paths_hardlinks_and_split_shards(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shards = [root / "m-00001-of-00002.gguf", root / "m-00002-of-00002.gguf"]
            for index, shard in enumerate(shards):
                shard.write_bytes(bytes([index + 1]) * 32)

            with self.assertRaisesRegex(ValueError, "GGUF shard"):
                reject_output_alias(root / "." / shards[0].name, shards, description="a GGUF shard")
            with self.assertRaisesRegex(ValueError, "GGUF shard"):
                reject_output_alias(shards[1], shards, description="a GGUF shard")

            hardlink = root / "trace.ndjson"
            os.link(shards[1], hardlink)
            with self.assertRaisesRegex(ValueError, "GGUF shard"):
                reject_output_alias(hardlink, shards, description="a GGUF shard")

    def test_build_layout_cli_refuses_every_input_shard_alias(self):
        _, document = make_layout()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shards = [root / "m-00001-of-00002.gguf", root / "m-00002-of-00002.gguf"]
            for shard in shards:
                shard.write_bytes(b"GGUF-sentinel")
            document["shards"] = [
                {"id": index, "path": str(shard.resolve()), "size_bytes": shard.stat().st_size}
                for index, shard in enumerate(shards)
            ]
            hardlink = root / "layout.json"
            os.link(shards[1], hardlink)

            for output in (shards[0], root / "." / shards[0].name, shards[1], hardlink):
                before = [shard.read_bytes() for shard in shards]
                with patch.object(build_layout_module, "build_layout", return_value=document):
                    with redirect_stderr(StringIO()), self.assertRaises(SystemExit):
                        build_layout_module.main([
                            "--model", str(shards[0]), "--output", str(output),
                        ])
                self.assertEqual([shard.read_bytes() for shard in shards], before)

    def test_atomic_write_replaces_complete_artifact_without_temp_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "result.json"
            path.write_text("old", encoding="utf-8")
            atomic_write_text(path, "new\n")
            self.assertEqual(path.read_text(encoding="utf-8"), "new\n")
            self.assertEqual(list(path.parent.glob(f".{path.name}.*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
