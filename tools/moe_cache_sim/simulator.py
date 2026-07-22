from __future__ import annotations

import heapq
import hashlib
import json
import math
from collections import Counter, defaultdict, OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

from .layout import ByteRange, LayoutError, ModelLayout


TRACE_SCHEMA = "ik_llama.moe_routing_trace"
TRACE_VERSION = 1


class TraceError(ValueError):
    pass


@dataclass(frozen=True)
class SelectedExpert:
    rank: int
    expert: int
    selection_score: float
    weight: float


@dataclass(frozen=True)
class Route:
    event: int
    sequence: int
    batch_index: int
    pos: int
    layer: int
    n_expert: int
    input_token_id: int
    selected: tuple[SelectedExpert, ...]


def _int(value: Any, name: str, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise TraceError(f"{name} must be an integer >= {minimum}")
    return value


def _finite(value: Any, name: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise TraceError(f"{name} must be finite")
    try:
        result = float(value)
    except (OverflowError, TypeError, ValueError) as exc:
        raise TraceError(f"{name} must be finite") from exc
    if not math.isfinite(result):
        raise TraceError(f"{name} must be finite")
    return result


def load_trace(path: str | Path) -> tuple[dict[str, Any], list[Route]]:
    source = Path(path)
    routes: list[Route] = []
    header: dict[str, Any] | None = None
    model_record: dict[str, Any] | None = None
    end_record: dict[str, Any] | None = None
    seen_keys: set[tuple[int, int, int]] = set()
    digest = hashlib.sha256()
    try:
        stream = source.open("rb")
    except OSError as exc:
        raise TraceError(f"cannot read trace {source}: {exc}") from exc
    with stream:
        for line_no, raw_line in enumerate(stream, 1):
            digest.update(raw_line)
            try:
                line = raw_line.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise TraceError(f"trace is not UTF-8 at line {line_no}: {exc}") from exc
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                raise TraceError(f"invalid JSON at line {line_no}: {exc}") from exc
            if not isinstance(item, dict):
                raise TraceError(f"line {line_no} must be a JSON object")
            kind = item.get("type")
            if header is None:
                if kind != "meta" or item.get("schema") != TRACE_SCHEMA or item.get("version") != TRACE_VERSION:
                    raise TraceError("first trace record must be the supported meta header")
                if item.get("scope") != "single_token_target_decode" or item.get("measurement_overhead") is not True:
                    raise TraceError("unsupported trace scope/measurement semantics")
                if item.get("selection_score") != "router_probability_with_selection_bias_if_present" or \
                        item.get("weight") != "normalized_pre_scale_moe_contribution":
                    raise TraceError("unsupported trace score/weight semantics")
                if not isinstance(item.get("model"), str) or not item["model"]:
                    raise TraceError("trace meta.model must be non-empty")
                _int(item.get("model_file_size"), "meta.model_file_size", minimum=1)
                header = item
                continue
            if end_record is not None:
                raise TraceError("trace contains records after the end footer")
            if kind == "model":
                if model_record is not None or routes:
                    raise TraceError("trace must contain exactly one model record before routes")
                model_record = item
                continue
            if kind == "end":
                end_record = item
                continue
            if kind != "route":
                raise TraceError(f"unknown trace record type at line {line_no}: {kind!r}")
            if model_record is None:
                raise TraceError("route appears before the model record")
            event = _int(item.get("event"), "route.event")
            if event != len(routes):
                raise TraceError("route.event must be contiguous starting at zero")
            sequence = _int(item.get("sequence"), "route.sequence")
            batch_index = _int(item.get("batch_index"), "route.batch_index")
            pos = _int(item.get("pos"), "route.pos")
            layer = _int(item.get("layer"), "route.layer")
            n_expert = _int(item.get("n_expert"), "route.n_expert", minimum=1)
            token = item.get("input_token_id")
            if isinstance(token, bool) or not isinstance(token, int):
                raise TraceError("route.input_token_id must be an integer")
            key = (sequence, batch_index, layer)
            if key in seen_keys:
                raise TraceError(f"duplicate route for sequence/batch/layer {key}")
            seen_keys.add(key)
            selected_doc = item.get("selected")
            if not isinstance(selected_doc, list) or not selected_doc:
                raise TraceError("route.selected must be a non-empty array")
            selected: list[SelectedExpert] = []
            seen_experts: set[int] = set()
            for expected_rank, entry in enumerate(selected_doc):
                if not isinstance(entry, dict):
                    raise TraceError("selected entry must be an object")
                rank = _int(entry.get("rank"), "selected.rank")
                expert = _int(entry.get("expert"), "selected.expert")
                if rank != expected_rank or expert in seen_experts or expert >= n_expert:
                    raise TraceError("selected ranks/experts are invalid")
                seen_experts.add(expert)
                weight = _finite(entry.get("weight"), "selected.weight")
                if weight < 0:
                    raise TraceError("selected.weight must be non-negative")
                selection_score = _finite(entry.get("selection_score"), "selected.selection_score")
                selected.append(SelectedExpert(
                    rank=rank,
                    expert=expert,
                    selection_score=selection_score,
                    weight=weight,
                ))
            if not math.isclose(sum(entry.weight for entry in selected), 1.0, rel_tol=1e-3, abs_tol=1e-3):
                raise TraceError("normalized selected weights must sum to one")
            routes.append(Route(event, sequence, batch_index, pos, layer, n_expert, token, tuple(selected)))
    if header is None:
        raise TraceError("empty trace")
    if model_record is None:
        raise TraceError("trace has no model record")
    if end_record is None or end_record.get("complete") is not True:
        raise TraceError("trace is incomplete (missing complete end footer)")
    expected_routes = _int(end_record.get("routes"), "end.routes")
    expected_batches = _int(end_record.get("batches"), "end.batches")
    batches = {(route.sequence, route.batch_index) for route in routes}
    if expected_routes != len(routes) or expected_batches != len(batches):
        raise TraceError("trace footer counts do not match its records")
    return {
        "meta": header,
        "model": model_record,
        "end": end_record,
        "sha256": digest.hexdigest(),
    }, routes


def validate_trace_layout(
    layout: ModelLayout, trace_info: dict[str, Any], routes: Sequence[Route]
) -> None:
    model = trace_info["model"]
    meta = trace_info["meta"]
    if _int(model.get("n_layer"), "model.n_layer", minimum=1) != layout.n_layers:
        raise TraceError("trace and layout layer counts differ")
    if model.get("architecture") != layout.architecture:
        raise TraceError("trace and layout architectures differ")
    if _int(model.get("moe_layers"), "model.moe_layers", minimum=1) != len(layout.layers):
        raise TraceError("trace and layout MoE layer counts differ")
    layer_ids = model.get("moe_layer_ids")
    if not isinstance(layer_ids, list) or any(
            isinstance(value, bool) or not isinstance(value, int) for value in layer_ids):
        raise TraceError("model.moe_layer_ids must be an integer array")
    if layer_ids != sorted(layout.layers):
        raise TraceError("trace and layout MoE layer IDs differ")
    if model.get("model_signature_scheme") != layout.model_signature_scheme or \
            model.get("model_signature") != layout.model_signature:
        raise TraceError("trace and layout model signatures differ")

    trace_model = Path(meta["model"])
    trace_size = _int(meta.get("model_file_size"), "meta.model_file_size", minimum=1)
    candidates = [
        shard for shard in layout.shards.values()
        if Path(str(shard.get("path", ""))).name.lower() == trace_model.name.lower()
        and shard["size_bytes"] == trace_size
    ]
    if not candidates:
        raise TraceError("trace model filename/size does not match any layout shard")
    if trace_model.is_absolute():
        try:
            trace_resolved = trace_model.resolve()
            if not any(Path(str(shard.get("path", ""))).resolve() == trace_resolved for shard in candidates):
                raise TraceError("trace model path does not match the layout artifact")
        except OSError as exc:
            raise TraceError(f"cannot resolve trace model path: {exc}") from exc
    if not routes:
        raise TraceError("trace contains no target-decode MoE routes")

    expected_layers = set(layout.layers)
    batches: dict[tuple[int, int], list[Route]] = {}
    for route in routes:
        if route.sequence != 0:
            raise TraceError("v1 trace supports only sequence 0")
        if route.n_expert != layout.n_experts:
            raise TraceError("trace and layout expert counts differ")
        batches.setdefault((route.sequence, route.batch_index), []).append(route)
    indices = sorted(batch_index for sequence, batch_index in batches if sequence == 0)
    if indices != list(range(len(indices))):
        raise TraceError("trace batch indices must be contiguous starting at zero")
    for key, batch_routes in batches.items():
        if {route.layer for route in batch_routes} != expected_layers:
            raise TraceError(f"incomplete MoE layer set for batch {key[1]}")
        if len({(route.pos, route.input_token_id) for route in batch_routes}) != 1:
            raise TraceError(f"inconsistent position/token inside batch {key[1]}")

    expected_order = sorted(expected_layers)
    current_batch = -1
    layer_offset = 0
    for route in routes:
        if route.batch_index != current_batch:
            if route.batch_index != current_batch + 1:
                raise TraceError("trace batches are not in chronological contiguous order")
            current_batch = route.batch_index
            layer_offset = 0
        if layer_offset >= len(expected_order) or route.layer != expected_order[layer_offset]:
            raise TraceError(f"noncanonical/interleaved layer order in batch {current_batch}")
        layer_offset += 1


ChunkKey = tuple[int, int]


class ChunkMapper:
    def __init__(self, layout: ModelLayout, page_size: int, chunk_pages: int):
        if page_size <= 0 or page_size & (page_size - 1):
            raise ValueError("page_size must be a power of two")
        if chunk_pages <= 0:
            raise ValueError("chunk_pages must be positive")
        self.layout = layout
        self.page_size = page_size
        self.chunk_pages = chunk_pages
        self.chunk_bytes = page_size * chunk_pages

    def range_chunks(self, byte_range: ByteRange) -> list[ChunkKey]:
        first_page = byte_range.offset // self.page_size
        end_page = (byte_range.end + self.page_size - 1) // self.page_size
        first_chunk = first_page // self.chunk_pages
        end_chunk = (end_page + self.chunk_pages - 1) // self.chunk_pages
        return [(byte_range.shard_id, index) for index in range(first_chunk, end_chunk)]

    def expert_chunks(self, layer: int, experts: Sequence[int]) -> list[ChunkKey]:
        """Prediction order: top-k rank first, then manifest tensor order."""
        result: list[ChunkKey] = []
        seen: set[ChunkKey] = set()
        for expert in experts:
            for byte_range in self.layout.ranges_for(layer, expert):
                for key in self.range_chunks(byte_range):
                    if key not in seen:
                        seen.add(key)
                        result.append(key)
        return result

    @staticmethod
    def _deduplicate(keys: Iterable[ChunkKey]) -> list[ChunkKey]:
        result: list[ChunkKey] = []
        seen: set[ChunkKey] = set()
        for key in keys:
            if key not in seen:
                seen.add(key)
                result.append(key)
        return result

    @staticmethod
    def _interleave(left: Sequence[ChunkKey], right: Sequence[ChunkKey]) -> list[ChunkKey]:
        result: list[ChunkKey] = []
        for index in range(max(len(left), len(right))):
            if index < len(left):
                result.append(left[index])
            if index < len(right):
                result.append(right[index])
        return result

    def demand_phases(
        self, layer: int, experts: Sequence[int], *, up_gate_mode: str | None,
    ) -> list[list[ChunkKey]]:
        """Approximate the CPU ggml graph phases, preserving cross-phase touches."""
        try:
            tensors = self.layout.layers[layer]
        except KeyError as exc:
            raise LayoutError(f"trace references unknown/non-MoE layer {layer}") from exc
        by_role = {tensor.role: tensor for tensor in tensors}
        expert_ids = sorted(set(experts))

        def role_chunks(role: str) -> list[ChunkKey]:
            tensor = by_role[role]
            return self._deduplicate(
                key
                for expert in expert_ids
                for key in self.range_chunks(tensor.range_for(expert))
            )

        if "gate_up" in by_role:
            gate_up = by_role["gate_up"]
            fused_keys: list[ChunkKey] = []
            for expert in expert_ids:
                combined = gate_up.range_for(expert)
                if combined.length % 2:
                    raise LayoutError(f"fused gate_up expert stride is not even: {gate_up.name}")
                half = combined.length // 2
                gate = ByteRange(combined.shard_id, combined.offset, half, "gate", combined.tensor)
                up = ByteRange(combined.shard_id, combined.offset + half, half, "up", combined.tensor)
                fused_keys.extend(self._interleave(
                    self.range_chunks(up), self.range_chunks(gate),
                ))
            return [self._deduplicate(fused_keys), role_chunks("down")]
        if up_gate_mode not in ("fused", "unfused"):
            raise ValueError("separate expert layout requires up_gate_mode=fused or unfused")
        # The runtime fused op is eligible only when the two source tensor
        # types match; otherwise GGML builds separate up and gate nodes for
        # this layer even when fused mode is globally enabled.
        gate_up_eligible = (
            by_role["up"].type_id == by_role["gate"].type_id
            and by_role["up"].ggml_type == by_role["gate"].ggml_type
        )
        if up_gate_mode == "unfused" or not gate_up_eligible:
            return [role_chunks("up"), role_chunks("gate"), role_chunks("down")]

        # The CPU fused kernel reads up/gate row blocks together. Chunk-level
        # alternation is deterministic, but remains an approximation because
        # worker threads access disjoint row ranges concurrently.
        up = by_role["up"]
        gate = by_role["gate"]
        fused_keys: list[ChunkKey] = []
        for expert in expert_ids:
            fused_keys.extend(self._interleave(
                self.range_chunks(up.range_for(expert)),
                self.range_chunks(gate.range_for(expert)),
            ))
        return [self._deduplicate(fused_keys), role_chunks("down")]

    def logical_bytes(self, route: Route) -> int:
        return sum(
            byte_range.length
            for selected in route.selected
            for byte_range in self.layout.ranges_for(route.layer, selected.expert)
        )

    def page_aligned_bytes(self, route: Route) -> int:
        intervals: dict[int, list[tuple[int, int]]] = {}
        for selected in route.selected:
            for byte_range in self.layout.ranges_for(route.layer, selected.expert):
                start = byte_range.offset // self.page_size
                end = (byte_range.end + self.page_size - 1) // self.page_size
                intervals.setdefault(byte_range.shard_id, []).append((start, end))
        pages = 0
        for values in intervals.values():
            values.sort()
            current_start = current_end = -1
            for start, end in values:
                if current_start < 0:
                    current_start, current_end = start, end
                elif start <= current_end:
                    current_end = max(current_end, end)
                else:
                    pages += current_end - current_start
                    current_start, current_end = start, end
            if current_start >= 0:
                pages += current_end - current_start
        return pages * self.page_size


class CacheBase:
    def __init__(self, capacity_chunks: int):
        self.capacity = max(0, capacity_chunks)

    def access(self, key: ChunkKey, *, prefetch: bool) -> tuple[bool, list[ChunkKey]]:
        raise NotImplementedError

    def __contains__(self, key: ChunkKey) -> bool:
        raise NotImplementedError

    def size(self) -> int:
        raise NotImplementedError


class LRUCache(CacheBase):
    def __init__(self, capacity_chunks: int):
        super().__init__(capacity_chunks)
        self.items: OrderedDict[ChunkKey, None] = OrderedDict()

    def access(self, key: ChunkKey, *, prefetch: bool) -> tuple[bool, list[ChunkKey]]:
        if key in self.items:
            self.items.move_to_end(key)
            return True, []
        if self.capacity == 0:
            return False, []
        evicted: list[ChunkKey] = []
        if len(self.items) >= self.capacity:
            evicted.append(self.items.popitem(last=False)[0])
        self.items[key] = None
        return False, evicted

    def __contains__(self, key: ChunkKey) -> bool:
        return key in self.items

    def size(self) -> int:
        return len(self.items)


class LFUCache(CacheBase):
    def __init__(self, capacity_chunks: int):
        super().__init__(capacity_chunks)
        self.clock = 0
        self.items: dict[ChunkKey, tuple[int, int]] = {}
        self.heap: list[tuple[int, int, ChunkKey]] = []

    def _compact(self) -> None:
        if len(self.heap) > 4 * len(self.items) + 1024:
            self.heap = [(frequency, last, key) for key, (frequency, last) in self.items.items()]
            heapq.heapify(self.heap)

    def access(self, key: ChunkKey, *, prefetch: bool) -> tuple[bool, list[ChunkKey]]:
        self.clock += 1
        current = self.items.get(key)
        if current is not None:
            frequency = current[0] + (0 if prefetch else 1)
            state = (frequency, self.clock)
            self.items[key] = state
            heapq.heappush(self.heap, (state[0], state[1], key))
            self._compact()
            return True, []
        if self.capacity == 0:
            return False, []
        evicted: list[ChunkKey] = []
        if len(self.items) >= self.capacity:
            while self.heap:
                frequency, last, candidate = heapq.heappop(self.heap)
                if self.items.get(candidate) == (frequency, last):
                    del self.items[candidate]
                    evicted.append(candidate)
                    break
        state = (0 if prefetch else 1, self.clock)
        self.items[key] = state
        heapq.heappush(self.heap, (state[0], state[1], key))
        self._compact()
        return False, evicted

    def __contains__(self, key: ChunkKey) -> bool:
        return key in self.items

    def size(self) -> int:
        return len(self.items)


class StaticCache(CacheBase):
    def __init__(self, capacity_chunks: int, pinned: Iterable[ChunkKey]):
        super().__init__(capacity_chunks)
        self.items = frozenset(list(pinned)[: self.capacity])

    def access(self, key: ChunkKey, *, prefetch: bool) -> tuple[bool, list[ChunkKey]]:
        return key in self.items, []

    def __contains__(self, key: ChunkKey) -> bool:
        return key in self.items

    def size(self) -> int:
        return len(self.items)


def _static_chunks(
    mapper: ChunkMapper,
    routes: Sequence[Route],
    capacity: int,
    *,
    up_gate_mode: str | None,
) -> list[ChunkKey]:
    counts: Counter[ChunkKey] = Counter()
    for route in routes:
        for phase in mapper.demand_phases(
            route.layer,
            [entry.expert for entry in route.selected],
            up_gate_mode=up_gate_mode,
        ):
            counts.update(phase)
    return [key for key, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:capacity]]


def _percentile(values: Sequence[int | float], percentile: float) -> int | float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(percentile * len(ordered)) - 1))
    return ordered[index]


def _mean(values: Sequence[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _hotset_sizes(counts: Counter[Any], shares: Sequence[float]) -> dict[str, int | None]:
    ordered = sorted(counts.values(), reverse=True)
    total = sum(ordered)
    result: dict[str, int | None] = {}
    for share in shares:
        key = f"{share:.2f}"
        if total == 0:
            result[key] = None
            continue
        threshold = share * total
        cumulative = 0
        size = 0
        for value in ordered:
            cumulative += value
            size += 1
            if cumulative >= threshold:
                break
        result[key] = size
    return result


def _normalized_entropy(counts: Counter[Any], universe: int) -> float | None:
    total = sum(counts.values())
    if total <= 0 or universe <= 0:
        return None
    if universe == 1:
        return 0.0
    entropy = -sum((value / total) * math.log(value / total) for value in counts.values() if value)
    return entropy / math.log(universe)


def _sliding_working_sets(
    token_experts: dict[tuple[int, int], set[Any]], windows: Sequence[int],
) -> dict[str, dict[str, float | int | None]]:
    by_sequence: dict[int, list[tuple[int, set[Any]]]] = defaultdict(list)
    for (sequence, batch_index), experts in token_experts.items():
        by_sequence[sequence].append((batch_index, experts))
    result: dict[str, dict[str, float | int | None]] = {}
    for window in windows:
        sizes: list[int] = []
        for items in by_sequence.values():
            ordered = sorted(items)
            for start in range(0, len(ordered) - window + 1):
                segment = ordered[start:start + window]
                if segment[-1][0] - segment[0][0] != window - 1:
                    continue
                union: set[Any] = set()
                for _, experts in segment:
                    union.update(experts)
                sizes.append(len(union))
        result[str(window)] = {
            "full_contiguous_windows": len(sizes),
            "mean_unique_experts": _mean(sizes),
            "p95_unique_experts": _percentile(sizes, 0.95),
            "max_unique_experts": max(sizes) if sizes else None,
        }
    return result


def _routing_scope_report(
    routes: Sequence[Route], *, global_scope: bool, expert_universe: int,
) -> dict[str, Any]:
    popularity: Counter[Any] = Counter()
    last_seen: dict[tuple[int, Any], int] = {}
    reuse_distances: list[int] = []
    cold_selections = 0
    previous: dict[tuple[int, int], Route] = {}
    jaccards: list[float] = []
    recalls: list[float] = []
    precisions: list[float] = []
    exact_matches = 0
    top_rank_weights: list[float] = []
    max_weights: list[float] = []
    tail_rank_weights: list[float] = []
    effective_experts: list[float] = []
    token_experts: dict[tuple[int, int], set[Any]] = defaultdict(set)

    for route in routes:
        keys = [
            (route.layer, entry.expert) if global_scope else entry.expert
            for entry in route.selected
        ]
        current = set(keys)
        popularity.update(keys)
        token_experts[(route.sequence, route.batch_index)].update(current)
        for key in current:
            seen_key = (route.sequence, key)
            if seen_key in last_seen:
                reuse_distances.append(route.batch_index - last_seen[seen_key])
            else:
                cold_selections += 1
            last_seen[seen_key] = route.batch_index

        previous_route = previous.get((route.sequence, route.layer))
        if previous_route is not None and previous_route.batch_index + 1 == route.batch_index:
            predicted = {
                (route.layer, entry.expert) if global_scope else entry.expert
                for entry in previous_route.selected
            }
            intersection = len(current & predicted)
            union = len(current | predicted)
            jaccards.append(intersection / union if union else 1.0)
            recalls.append(intersection / len(current) if current else 1.0)
            precisions.append(intersection / len(predicted) if predicted else 1.0)
            exact_matches += int(current == predicted)
        previous[(route.sequence, route.layer)] = route

        weights = [entry.weight for entry in route.selected]
        if weights:
            top_rank_weights.append(weights[0])
            max_weights.append(max(weights))
            tail_rank_weights.append(weights[-1])
            squared = sum(weight * weight for weight in weights)
            effective_experts.append(1.0 / squared if squared else 0.0)

    repeated = len(reuse_distances)
    selections = sum(popularity.values())
    eligible = len(jaccards)
    popularity_rows: list[dict[str, int | float]] = []
    for key, count in sorted(popularity.items(), key=lambda item: (-item[1], item[0])):
        row: dict[str, int | float]
        if global_scope:
            row = {"layer": key[0], "expert": key[1], "count": count}
        else:
            row = {"expert": key, "count": count}
        row["selection_share"] = count / selections if selections else 0.0
        popularity_rows.append(row)
    return {
        "routes": len(routes),
        "tokens": len(token_experts),
        "expert_universe": expert_universe,
        "selected_occurrences": selections,
        "unique_selected_experts": len(popularity),
        "expert_popularity": popularity_rows,
        "selection_frequency_normalized_entropy": _normalized_entropy(popularity, expert_universe),
        "hotset_experts_for_selection_share": _hotset_sizes(popularity, (0.50, 0.80, 0.90, 0.95)),
        "previous_token": {
            "eligible_routes": eligible,
            "route_coverage": eligible / len(routes) if routes else None,
            "mean_jaccard": _mean(jaccards),
            "p50_jaccard": _percentile(jaccards, 0.50),
            "p95_jaccard": _percentile(jaccards, 0.95),
            "exact_match_rate": exact_matches / eligible if eligible else None,
            "mean_actual_recall": _mean(recalls),
            "mean_prediction_precision": _mean(precisions),
        },
        "reuse_distance_tokens": {
            "cold_selections": cold_selections,
            "repeated_selections": repeated,
            "cold_fraction": cold_selections / (cold_selections + repeated) if selections else None,
            "p50": _percentile(reuse_distances, 0.50),
            "p95": _percentile(reuse_distances, 0.95),
            "max": max(reuse_distances) if reuse_distances else None,
        },
        "selected_weight_concentration": {
            "mean_top_rank_weight": _mean(top_rank_weights),
            "mean_max_weight": _mean(max_weights),
            "mean_tail_rank_weight": _mean(tail_rank_weights),
            "mean_effective_selected_experts": _mean(effective_experts),
        },
        "sliding_token_working_set": _sliding_working_sets(token_experts, (8, 32, 128)),
    }


def routing_report(
    routes: Sequence[Route], *, trace_sha256: str | None = None,
    layout_fingerprint: str | None = None,
) -> dict[str, Any]:
    """Describe baseline routing locality without simulating an intervention."""
    layers: dict[str, Any] = {}
    for layer in sorted({route.layer for route in routes}):
        layer_routes = [route for route in routes if route.layer == layer]
        n_expert = layer_routes[0].n_expert
        layers[str(layer)] = _routing_scope_report(
            layer_routes, global_scope=False, expert_universe=n_expert,
        )
    global_universe = sum(
        next(route.n_expert for route in routes if route.layer == layer)
        for layer in sorted({route.layer for route in routes})
    )
    return {
        "schema": "ik_llama.moe_routing_locality_report",
        "version": 1,
        "warning": "baseline-route locality only; does not predict physical I/O, post-intervention routing, latency, or tokens/s",
        "semantics": {
            "global_expert_identity": "(layer, expert)",
            "previous_token_aggregation": "macro over layer-route observations",
            "percentile_method": "nearest_rank",
            "reuse_distance": "generated-token batch_index gap, not cache stack distance",
            "global_working_set_unit": "layer-qualified expert",
            "weight": "normalized contribution among selected experts; trace v1 has no unselected probabilities, total captured gate mass, or k/k+1 candidate gap",
        },
        "provenance": {
            "trace_sha256": trace_sha256,
            "layout_fingerprint": layout_fingerprint,
        },
        "global": _routing_scope_report(
            routes, global_scope=True, expert_universe=global_universe,
        ),
        "layers": layers,
    }


def simulate(
    layout: ModelLayout,
    routes: Sequence[Route],
    *,
    cache_bytes: int,
    policy: str = "lru",
    predictor: str = "none",
    page_size: int = 4096,
    chunk_pages: int = 256,
    prefetch_limit_bytes: int | None = None,
    static_profile: Sequence[Route] | None = None,
    access_model: str = "cpu-ggml-phase-v1",
    up_gate_mode: str | None = None,
    trace_sha256: str | None = None,
    static_profile_sha256: str | None = None,
) -> dict[str, Any]:
    if cache_bytes < 0:
        raise ValueError("cache_bytes must be non-negative")
    mapper = ChunkMapper(layout, page_size, chunk_pages)
    if access_model != "cpu-ggml-phase-v1":
        raise ValueError(f"unknown access model: {access_model}")
    separate_layers = [
        tensors for tensors in layout.layers.values()
        if "gate_up" not in {tensor.role for tensor in tensors}
    ]
    has_separate = bool(separate_layers)
    if has_separate and up_gate_mode not in ("fused", "unfused"):
        raise ValueError("separate expert layout requires explicit up_gate_mode=fused or unfused")
    if up_gate_mode is not None and up_gate_mode not in ("fused", "unfused"):
        raise ValueError("up_gate_mode must be fused, unfused, or None")
    for value, name in (
        (trace_sha256, "trace_sha256"),
        (static_profile_sha256, "static_profile_sha256"),
    ):
        if value is not None and (
            not isinstance(value, str) or len(value) != 64
            or any(ch not in "0123456789abcdef" for ch in value)
        ):
            raise ValueError(f"{name} must be a lowercase SHA-256 hex digest")
    if policy == "static" and trace_sha256 is not None and trace_sha256 == static_profile_sha256:
        raise ValueError("static calibration trace provenance must differ from evaluated trace")
    if policy == "static" and static_profile is not None:
        def routing_identity(items: Sequence[Route]) -> tuple[Any, ...]:
            return tuple(
                (route.sequence, route.batch_index, route.layer,
                 tuple(entry.expert for entry in route.selected))
                for route in items
            )
        if routing_identity(routes) == routing_identity(static_profile):
            raise ValueError("static calibration routing must differ from evaluated routing")
    capacity = cache_bytes // mapper.chunk_bytes
    if policy == "lru":
        cache: CacheBase = LRUCache(capacity)
    elif policy == "lfu":
        cache = LFUCache(capacity)
    elif policy == "static":
        if predictor != "none":
            raise ValueError("static policy v1 only supports predictor=none")
        if static_profile is None:
            raise ValueError("static policy requires a separate calibration trace")
        cache = StaticCache(capacity, _static_chunks(
            mapper, static_profile, capacity, up_gate_mode=up_gate_mode,
        ))
    else:
        raise ValueError(f"unknown cache policy: {policy}")
    if predictor not in ("none", "previous-token", "oracle"):
        raise ValueError(f"unknown predictor: {predictor}")

    initial_resident_bytes = cache.size() * mapper.chunk_bytes
    metrics: Counter[str] = Counter()
    pending_prefetch: set[ChunkKey] = set()
    last_routes: dict[tuple[int, int], Route] = {}
    miss_per_route: list[int] = []
    peak_cache = cache.size()
    expert_intersection = predicted_experts = actual_experts = eligible_actual_experts = 0
    chunk_intersection = predicted_chunk_count = actual_chunk_count = eligible_actual_chunks = 0
    issued_chunk_intersection = eligible_routes = 0

    max_prefetch_chunks = None
    if prefetch_limit_bytes is not None:
        if prefetch_limit_bytes < 0:
            raise ValueError("prefetch_limit_bytes must be non-negative or None")
        max_prefetch_chunks = prefetch_limit_bytes // mapper.chunk_bytes

    for route in routes:
        actual_ids = [entry.expert for entry in route.selected]
        actual_set = set(actual_ids)
        predicted_ids: list[int] = []
        if predictor == "oracle":
            predicted_ids = actual_ids
        elif predictor == "previous-token":
            previous = last_routes.get((route.sequence, route.layer))
            if previous is not None and previous.batch_index + 1 == route.batch_index:
                predicted_ids = [entry.expert for entry in previous.selected]
        predicted_set = set(predicted_ids)
        if predicted_ids:
            eligible_routes += 1
            eligible_actual_experts += len(actual_set)
        expert_intersection += len(actual_set & predicted_set)
        predicted_experts += len(predicted_set)
        actual_experts += len(actual_set)

        actual_phases = mapper.demand_phases(
            route.layer, actual_ids, up_gate_mode=up_gate_mode,
        )
        actual_chunks = [key for phase in actual_phases for key in phase]
        actual_chunk_set = set(actual_chunks)
        predicted_chunks = mapper.expert_chunks(route.layer, predicted_ids)
        predicted_chunk_set = set(predicted_chunks)
        chunk_intersection += len(actual_chunk_set & predicted_chunk_set)
        predicted_chunk_count += len(predicted_chunk_set)
        actual_chunk_count += len(actual_chunk_set)
        if predicted_ids:
            eligible_actual_chunks += len(actual_chunk_set)
        metrics["max_predicted_batch_bytes_before_cap"] = max(
            metrics["max_predicted_batch_bytes_before_cap"], len(predicted_chunks) * mapper.chunk_bytes
        )
        if max_prefetch_chunks is not None and len(predicted_chunks) > max_prefetch_chunks:
            metrics["prefetch_truncated_bytes"] += (len(predicted_chunks) - max_prefetch_chunks) * mapper.chunk_bytes
            predicted_chunks = predicted_chunks[:max_prefetch_chunks]
        if cache.capacity == 0 and predicted_chunks:
            metrics["prefetch_unadmitted_bytes"] += len(predicted_chunks) * mapper.chunk_bytes
            predicted_chunks = []
        issued_chunk_set = set(predicted_chunks)
        issued_chunk_intersection += len(actual_chunk_set & issued_chunk_set)

        def issue_prefetch(key: ChunkKey) -> None:
            metrics["prefetch_requested_bytes"] += mapper.chunk_bytes
            hit, evicted = cache.access(key, prefetch=True)
            for old in evicted:
                metrics["evictions"] += 1
                metrics["evicted_bytes"] += mapper.chunk_bytes
                if old in pending_prefetch:
                    pending_prefetch.remove(old)
                    metrics["wasted_prefetch_bytes"] += mapper.chunk_bytes
            if hit:
                metrics["redundant_prefetch_bytes"] += mapper.chunk_bytes
            else:
                metrics["prefetch_read_bytes"] += mapper.chunk_bytes
                if key in cache:
                    pending_prefetch.add(key)

        # previous-token is intentionally a route-JIT locality scenario. The
        # oracle is even stronger: it issues each missing chunk immediately
        # before demand, avoiding self-eviction inside a route.
        if predictor == "previous-token":
            for key in predicted_chunks:
                issue_prefetch(key)

        metrics["logical_range_bytes"] += mapper.logical_bytes(route)
        metrics["page_aligned_demand_bytes"] += mapper.page_aligned_bytes(route)
        route_misses = 0
        for key in actual_chunks:
            if predictor == "oracle" and key in issued_chunk_set and key not in cache:
                issue_prefetch(key)
            metrics["demand_chunk_bytes"] += mapper.chunk_bytes
            hit, evicted = cache.access(key, prefetch=False)
            for old in evicted:
                metrics["evictions"] += 1
                metrics["evicted_bytes"] += mapper.chunk_bytes
                if old in pending_prefetch:
                    pending_prefetch.remove(old)
                    metrics["wasted_prefetch_bytes"] += mapper.chunk_bytes
            if hit:
                metrics["demand_hit_bytes"] += mapper.chunk_bytes
                if key in pending_prefetch:
                    pending_prefetch.remove(key)
                    metrics["useful_prefetch_bytes"] += mapper.chunk_bytes
            else:
                metrics["demand_miss_bytes"] += mapper.chunk_bytes
                route_misses += mapper.chunk_bytes
        miss_per_route.append(route_misses)
        last_routes[(route.sequence, route.layer)] = route
        peak_cache = max(peak_cache, cache.size())

    metrics["wasted_prefetch_bytes"] += len(pending_prefetch) * mapper.chunk_bytes
    for name in (
        "logical_range_bytes", "page_aligned_demand_bytes", "demand_chunk_bytes",
        "demand_hit_bytes", "demand_miss_bytes", "prefetch_requested_bytes",
        "prefetch_read_bytes", "redundant_prefetch_bytes", "useful_prefetch_bytes",
        "wasted_prefetch_bytes", "prefetch_truncated_bytes", "evictions",
        "prefetch_unadmitted_bytes", "evicted_bytes", "max_predicted_batch_bytes_before_cap",
    ):
        metrics.setdefault(name, 0)
    cache_fill_bytes = metrics["prefetch_read_bytes"] + metrics["demand_miss_bytes"]
    fused_eligible_layers = sum(
        1 for tensors in separate_layers
        if ({tensor.role: tensor for tensor in tensors}["up"].type_id ==
            {tensor.role: tensor for tensor in tensors}["gate"].type_id)
        and ({tensor.role: tensor for tensor in tensors}["up"].ggml_type ==
             {tensor.role: tensor for tensor in tensors}["gate"].ggml_type)
    )
    if not has_separate:
        effective_up_gate = "not_applicable"
    elif up_gate_mode == "unfused" or fused_eligible_layers == 0:
        effective_up_gate = "unfused"
    elif fused_eligible_layers == len(separate_layers):
        effective_up_gate = "fused"
    else:
        effective_up_gate = "mixed_by_layer"

    result: dict[str, Any] = {
        "schema": "ik_llama.moe_cache_sim_result",
        "version": 1,
        "idealized_upper_bound": predictor == "oracle",
        "idealized_prefetch_timing": predictor in ("previous-token", "oracle"),
        "production_prefetch_timing_modeled": False,
        "warning": "cache-fill locality model only; does not predict physical SSD bytes, t/s, timing, or OS eviction",
        "provenance": {
            "layout_fingerprint": layout.fingerprint,
            "model_signature_scheme": layout.model_signature_scheme,
            "model_signature": layout.model_signature,
            "trace_sha256": trace_sha256,
            "static_profile_sha256": static_profile_sha256,
        },
        "configuration": {
            "policy": policy,
            "predictor": predictor,
            "prefetch_schedule": "route_jit" if predictor == "previous-token" else ("perfect_chunk_jit" if predictor == "oracle" else "none"),
            "cache_bytes": cache_bytes,
            "effective_cache_bytes": capacity * mapper.chunk_bytes,
            "capacity_chunks": capacity,
            "unused_cache_budget_bytes": cache_bytes - capacity * mapper.chunk_bytes,
            "page_size": page_size,
            "chunk_pages": chunk_pages,
            "chunk_bytes": mapper.chunk_bytes,
            "replacement_granularity_approximation": chunk_pages != 1,
            "prefetch_limit_bytes": prefetch_limit_bytes,
            "layout_fingerprint": layout.fingerprint,
            "cold_start_empty_dynamic_cache": policy in ("lru", "lfu"),
            "access_model": access_model,
            "backend": "cpu",
            "up_gate_requested": up_gate_mode if has_separate else "not_applicable",
            "up_gate_execution": effective_up_gate,
            "fused_up_gate_eligible_layers": fused_eligible_layers,
            "selected_expert_demand_order": "ascending_expert_id",
            "demand_deduplication_scope": "phase",
            "intra_kernel_order_exact": False,
        },
        "metrics": dict(metrics),
    }
    result["metrics"].update({
        "routes": len(routes),
        "tokens": len({(route.sequence, route.batch_index) for route in routes}),
        "modeled_cache_fill_bytes": cache_fill_bytes,
        "initial_resident_bytes": initial_resident_bytes,
        "modeled_total_fill_including_initial_bytes": cache_fill_bytes + initial_resident_bytes,
        "peak_resident_bytes": peak_cache * mapper.chunk_bytes,
        "demand_hit_ratio": (
            metrics["demand_hit_bytes"] / metrics["demand_chunk_bytes"]
            if metrics["demand_chunk_bytes"] else None
        ),
        "predictor_expert_precision": expert_intersection / predicted_experts if predicted_experts else None,
        "predictor_expert_recall": expert_intersection / eligible_actual_experts if eligible_actual_experts else None,
        "predictor_expert_overall_recall": expert_intersection / actual_experts if actual_experts else None,
        "predictor_route_coverage": eligible_routes / len(routes) if routes else None,
        "predictor_chunk_precision": chunk_intersection / predicted_chunk_count if predicted_chunk_count else None,
        "predictor_chunk_recall": chunk_intersection / eligible_actual_chunks if eligible_actual_chunks else None,
        "predictor_chunk_overall_recall": chunk_intersection / actual_chunk_count if actual_chunk_count else None,
        "issued_prefetch_chunk_recall": issued_chunk_intersection / eligible_actual_chunks if eligible_actual_chunks else None,
        "issued_prefetch_chunk_overall_recall": issued_chunk_intersection / actual_chunk_count if actual_chunk_count else None,
        "logical_range_bytes_per_token": (
            metrics["logical_range_bytes"] / len({(route.sequence, route.batch_index) for route in routes})
            if routes else None
        ),
        "demand_miss_bytes_p50_per_route": _percentile(miss_per_route, 0.50),
        "demand_miss_bytes_p95_per_route": _percentile(miss_per_route, 0.95),
    })
    return result
