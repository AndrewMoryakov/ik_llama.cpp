import copy
import os
import pathlib
import re
import time

ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


class LiveMetricsAggregator:
    PG_TRACE_RE = re.compile(
        r"pg-trace phase=(?P<phase>\S+)"
        r"(?: index=(?P<index>\d+)/(?P<window>\d+))?"
        r" tokens=(?P<tokens>\d+) ubatches=(?P<ubatches>\d+)"
        r" reuse_hits=(?P<reuse_hits>\d+) rebuilds=(?P<rebuilds>\d+)"
        r" reset_pre=(?P<reset_pre>[0-9.]+)ms"
        r" build=(?P<build>[0-9.]+)ms"
        r" alloc=(?P<alloc>[0-9.]+)ms"
        r" inputs=(?P<inputs>[0-9.]+)ms"
        r" compute=(?P<compute>[0-9.]+)ms"
        r" reset_post=(?P<reset_post>[0-9.]+)ms"
        r" total=(?P<total>[0-9.]+)ms"
        r" kv_n=(?P<kv_n>\d+) kv_head=(?P<kv_head>\d+)"
    )

    HOT_TRACE_RE = re.compile(
        r"hot experts trace \((?P<stage>[^)]+)\): "
        r"locked_rows=(?P<locked_rows>\d+) "
        r"unlocked_rows=(?P<unlocked_rows>\d+) "
        r"locked_share=(?P<locked_share>[0-9.]+)% "
        r"locked_dispatches=(?P<locked_dispatches>\d+) "
        r"unlocked_dispatches=(?P<unlocked_dispatches>\d+) "
        r"total_dispatches=(?P<total_dispatches>\d+) "
        r"budget=(?P<budget>\d+)"
    )

    HOT_SELECTED_RE = re.compile(
        r"hot experts: locked (?P<locked>\d+)/(?P<total>\d+) "
        r"\(budget (?P<budget>\d+), fails (?P<fails>\d+), dispatches (?P<dispatches>\d+)\) \| top-8:(?P<top>.*)$"
    )
    HOT_LAYER_RE = re.compile(
        r"hot experts layer \((?P<stage>[^)]+)\): layer=(?P<layer>\d+)(?P<top>.*)$"
    )

    TOP_EXPERT_RE = re.compile(r"e(?P<expert>\d+)=(?P<hits>\d+)")
    ARCH_RE = re.compile(r"general\.architecture\s+str\s+=\s+(?P<arch>[a-zA-Z0-9._-]+)")
    ARCH_META_RE = re.compile(r"llm_load_print_meta:\s+arch\s+=\s+(?P<arch>[a-zA-Z0-9._-]+)")

    # Per-response timings lines. Two formats coexist:
    # - Pre-PEG-rewrite: "llama_print_timings:        eval time = X ms / N runs   (...)"
    # - Post-PEG-rewrite: "       eval time =    X ms /    N tokens (...)" (no prefix,
    #   "tokens" instead of "runs"; preceded by "slot print_timing: id 0 | task 1 |" line).
    # Regex tolerates optional prefix and either "runs" or "tokens" unit.
    # `^` anchor prevents the eval-regex from matching "prompt eval time" lines
    # (which contain "eval time" as substring).
    TIMINGS_EVAL_RE = re.compile(
        r"^\s*(?:llama_print_timings:)?\s*eval time\s+=\s+(?P<total_ms>[0-9.]+)\s+ms\s+/\s+(?P<runs>\d+)\s+(?:runs|tokens)\s+\(\s*(?P<per_token_ms>[0-9.]+)\s+ms per token,\s+(?P<tps>[0-9.]+)\s+tokens per second\)"
    )
    TIMINGS_PROMPT_RE = re.compile(
        r"^\s*(?:llama_print_timings:)?\s*prompt eval time\s+=\s+(?P<total_ms>[0-9.]+)\s+ms\s+/\s+(?P<tokens>\d+)\s+tokens\s+\(\s*(?P<per_token_ms>[0-9.]+)\s+ms per token,\s+(?P<tps>[0-9.]+)\s+tokens per second\)"
    )

    def __init__(self):
        self.reset()

    def notify_output_line(self):
        """Called by ProcessManager on every output line to track generation rate."""
        now = time.time()
        self._output_timestamps.append(now)
        # Keep only last 30 seconds of timestamps
        cutoff = now - 30.0
        self._output_timestamps = [t for t in self._output_timestamps if t > cutoff]

    def _calc_realtime_tps(self):
        """Estimate current tok/s from recent output line rate (last 5 seconds)."""
        now = time.time()
        recent = [t for t in self._output_timestamps if t > now - 5.0]
        if len(recent) < 2:
            return 0.0
        duration = recent[-1] - recent[0]
        if duration <= 0:
            return 0.0
        return round((len(recent) - 1) / duration, 2)

    def reset(self):
        self.started_at = time.time()
        self._output_timestamps = []
        self.architecture = ""
        self.trace = {
            "pg_enabled": False,
            "pg_decode_window": 0,
            "hot_enabled": False,
        }
        self.phase = {
            "current": "idle",
            "prompt_tokens": 0,
            "prompt_ms": 0.0,
            "first_decode_ms": 0.0,
            "decode_tail_ms": 0.0,
            "decode_tail_steps": 0,
            "last_token_ms": 0.0,
            "avg_decode_tps": 0.0,
            "min_decode_tps": 0.0,
            "max_decode_tps": 0.0,
            "current_decode_tps": 0.0,
            "ttft_ms": 0.0,
            "recent": [],
            "session_history": [],
        }
        self.phase_events = []
        self.moe = {
            "latest_stage": "",
            "latest_trace": None,
            "stages": {},
            "stage_history": [],
            "hot_selection": None,
            "top_experts": [],
            "top_expert_history": [],
            "expert_totals": [],
            "expert_stage_matrix": [],
            "expert_layer_matrix": [],
            "prompt_decode_compare": {
                "prompt": [],
                "decode": [],
            },
            "stability": {
                "label": "n/a",
                "score": 0.0,
            },
        }
        self.event_stream = []

    @staticmethod
    def _stage_bucket(stage):
        value = (stage or "").strip().lower()
        if value in ("before-commit", "after-commit"):
            return "prompt"
        if value == "post-commit-decode":
            return "decode"
        return "other"

    def _rebuild_expert_views(self):
        history = self.moe["top_expert_history"]
        selection_history = [item for item in history if item.get("layer") is None]
        layer_history = [item for item in history if item.get("layer") is not None]
        totals = {}
        stage_matrix = {}
        layer_matrix = {}
        prompt_totals = {}
        decode_totals = {}

        for item in selection_history:
            stage = item.get("stage") or "selection"
            bucket = item.get("bucket") or self._stage_bucket(stage)
            row = stage_matrix.setdefault(stage, {})
            for expert_item in item.get("experts", []):
                expert = int(expert_item.get("expert", -1))
                hits = int(expert_item.get("hits", 0))
                if expert < 0 or hits <= 0:
                    continue
                totals[expert] = totals.get(expert, 0) + hits
                row[expert] = row.get(expert, 0) + hits
                if bucket == "prompt":
                    prompt_totals[expert] = prompt_totals.get(expert, 0) + hits
                elif bucket == "decode":
                    decode_totals[expert] = decode_totals.get(expert, 0) + hits

        if layer_history:
            totals = {}
            prompt_totals = {}
            decode_totals = {}

        for item in layer_history:
            layer = item.get("layer")
            if layer is None:
                continue
            bucket = item.get("bucket") or self._stage_bucket(item.get("stage") or "")
            row = layer_matrix.setdefault(int(layer), {})
            for expert_item in item.get("experts", []):
                expert = int(expert_item.get("expert", -1))
                hits = int(expert_item.get("hits", 0))
                if expert < 0 or hits <= 0:
                    continue
                row[expert] = max(row.get(expert, 0), hits)
                totals[expert] = totals.get(expert, 0) + hits
                if bucket == "prompt":
                    prompt_totals[expert] = prompt_totals.get(expert, 0) + hits
                elif bucket == "decode":
                    decode_totals[expert] = decode_totals.get(expert, 0) + hits

        self.moe["expert_totals"] = [
            {"expert": expert, "hits": hits}
            for expert, hits in sorted(totals.items(), key=lambda x: (-x[1], x[0]))
        ]
        self.moe["expert_stage_matrix"] = [
            {
                "stage": stage,
                "experts": [
                    {"expert": expert, "hits": hits}
                    for expert, hits in sorted(experts.items(), key=lambda x: (-x[1], x[0]))
                ],
            }
            for stage, experts in stage_matrix.items()
        ]
        self.moe["expert_layer_matrix"] = [
            {
                "layer": layer,
                "experts": [
                    {"expert": expert, "hits": hits}
                    for expert, hits in sorted(experts.items(), key=lambda x: (-x[1], x[0]))
                ],
            }
            for layer, experts in sorted(layer_matrix.items(), key=lambda x: x[0])
        ]
        self.moe["prompt_decode_compare"] = {
            "prompt": [
                {"expert": expert, "hits": hits}
                for expert, hits in sorted(prompt_totals.items(), key=lambda x: (-x[1], x[0]))
            ],
            "decode": [
                {"expert": expert, "hits": hits}
                for expert, hits in sorted(decode_totals.items(), key=lambda x: (-x[1], x[0]))
            ],
        }

    def _update_expert_stability(self):
        history = [item for item in self.moe["top_expert_history"] if item.get("layer") is None]
        if len(history) < 2:
            self.moe["stability"] = {
                "label": "n/a",
                "score": 0.0,
            }
            return

        current = {item["expert"] for item in history[-1].get("experts", [])}
        previous = {item["expert"] for item in history[-2].get("experts", [])}
        union = current | previous
        overlap = current & previous
        score = (len(overlap) / len(union)) if union else 0.0

        if score >= 0.67:
            label = "stable"
        elif score >= 0.34:
            label = "mixed"
        else:
            label = "volatile"

        self.moe["stability"] = {
            "label": label,
            "score": round(score * 100.0, 1),
        }

    def start_session(self, env_overrides):
        self.reset()
        env = env_overrides or {}
        self.trace["pg_enabled"] = str(env.get("IK_LLAMA_PG_TRACE", "0")) not in ("", "0", "false", "False")
        self.trace["hot_enabled"] = str(env.get("IK_LLAMA_HOT_EXPERT_TRACE", "0")) not in ("", "0", "false", "False")
        try:
            self.trace["pg_decode_window"] = int(env.get("IK_LLAMA_PG_TRACE_DECODE_WINDOW", "0") or 0)
        except ValueError:
            self.trace["pg_decode_window"] = 0

    def _append_recent_phase(self, event):
        self.phase["recent"].append(event)
        self.phase["recent"] = self.phase["recent"][-16:]
        self.phase_events.append(copy.deepcopy(event))
        self.event_stream.append({
            "kind": "phase",
            "phase": event.get("phase"),
            "tokens": event.get("tokens"),
            "index": event.get("index"),
            "total_ms": event.get("total_ms"),
        })

    def _append_stage_history(self, trace):
        self.moe["stage_history"].append(trace)
        self.moe["stage_history"] = self.moe["stage_history"][-12:]
        self.event_stream.append({
            "kind": "moe_stage",
            "stage": trace.get("stage"),
            "locked_share": trace.get("locked_share"),
            "budget": trace.get("budget"),
        })

    def ingest_line(self, line):
        if not line:
            return

        line = ANSI_ESCAPE_RE.sub("", line).strip()
        if not line:
            return

        if not self.architecture:
            m_arch = self.ARCH_RE.search(line) or self.ARCH_META_RE.search(line)
            if m_arch:
                self.architecture = m_arch.group("arch")

        m_pg = self.PG_TRACE_RE.search(line)
        if m_pg:
            phase = m_pg.group("phase")
            index = int(m_pg.group("index")) if m_pg.group("index") is not None else None
            window = int(m_pg.group("window")) if m_pg.group("window") is not None else None
            total_ms = float(m_pg.group("total"))
            tokens = int(m_pg.group("tokens"))
            event = {
                "phase": phase,
                "index": index,
                "window": window,
                "tokens": tokens,
                "total_ms": total_ms,
                "compute_ms": float(m_pg.group("compute")),
                "reuse_hits": int(m_pg.group("reuse_hits")),
                "rebuilds": int(m_pg.group("rebuilds")),
            }
            self._append_recent_phase(event)

            if phase == "prompt":
                self.phase["current"] = "prompt"
                self.phase["prompt_tokens"] = tokens
                self.phase["prompt_ms"] = total_ms
            elif phase == "first_decode_after_prompt" or (phase == "decode_after_prompt" and index == 0):
                self.phase["current"] = "first_decode"
                self.phase["first_decode_ms"] = total_ms
                self.phase["ttft_ms"] = total_ms
                self.phase["last_token_ms"] = total_ms
                current_tps = round(1000.0 / total_ms, 2) if total_ms > 0 else 0.0
                self.phase["avg_decode_tps"] = current_tps
                self.phase["current_decode_tps"] = current_tps
                self.phase["min_decode_tps"] = current_tps
                self.phase["max_decode_tps"] = current_tps
            elif phase == "decode_after_prompt":
                self.phase["current"] = "decode"
                self.phase["decode_tail_ms"] += total_ms
                self.phase["decode_tail_steps"] += 1
                self.phase["last_token_ms"] = total_ms
                current_tps = round(1000.0 / total_ms, 2) if total_ms > 0 else 0.0
                self.phase["current_decode_tps"] = current_tps
                avg_ms = self.phase["decode_tail_ms"] / max(self.phase["decode_tail_steps"], 1)
                self.phase["avg_decode_tps"] = round(1000.0 / avg_ms, 2) if avg_ms > 0 else 0.0
                if current_tps > 0:
                    if self.phase["min_decode_tps"] <= 0 or current_tps < self.phase["min_decode_tps"]:
                        self.phase["min_decode_tps"] = current_tps
                    if current_tps > self.phase["max_decode_tps"]:
                        self.phase["max_decode_tps"] = current_tps
            return

        # Parse llama_print_timings (works without pg-trace, emitted after every response)
        m_eval = self.TIMINGS_EVAL_RE.search(line)
        if m_eval:
            tps = float(m_eval.group("tps"))
            runs = int(m_eval.group("runs"))
            per_token = float(m_eval.group("per_token_ms"))
            if tps > 0 and runs > 0:
                self.phase["current_decode_tps"] = round(tps, 2)
                self.phase["avg_decode_tps"] = round(tps, 2)
                self.phase["decode_tail_steps"] = runs
                self.phase["last_token_ms"] = per_token
                if self.phase["min_decode_tps"] <= 0 or tps < self.phase["min_decode_tps"]:
                    self.phase["min_decode_tps"] = round(tps, 2)
                if tps > self.phase["max_decode_tps"]:
                    self.phase["max_decode_tps"] = round(tps, 2)
                self.phase["session_history"].append({
                    "type": "eval",
                    "tps": round(tps, 2),
                    "tokens": runs,
                    "per_token_ms": per_token,
                })
                self.phase["session_history"] = self.phase["session_history"][-32:]
            return

        m_prompt = self.TIMINGS_PROMPT_RE.search(line)
        if m_prompt:
            tps = float(m_prompt.group("tps"))
            tokens = int(m_prompt.group("tokens"))
            self.phase["prompt_tokens"] = tokens
            self.phase["prompt_ms"] = float(m_prompt.group("total_ms"))
            self.phase["session_history"].append({
                "type": "prompt",
                "tps": round(tps, 2),
                "tokens": tokens,
            })
            self.phase["session_history"] = self.phase["session_history"][-32:]
            return

        m_hot = self.HOT_TRACE_RE.search(line)
        if m_hot:
            stage = m_hot.group("stage")
            trace = {
                "stage": stage,
                "locked_rows": int(m_hot.group("locked_rows")),
                "unlocked_rows": int(m_hot.group("unlocked_rows")),
                "locked_share": float(m_hot.group("locked_share")),
                "locked_dispatches": int(m_hot.group("locked_dispatches")),
                "unlocked_dispatches": int(m_hot.group("unlocked_dispatches")),
                "total_dispatches": int(m_hot.group("total_dispatches")),
                "budget": int(m_hot.group("budget")),
            }
            self.moe["latest_stage"] = stage
            self.moe["latest_trace"] = trace
            self.moe["stages"][stage] = trace
            self._append_stage_history(trace)
            return

        m_selected = self.HOT_SELECTED_RE.search(line)
        if m_selected:
            top = []
            for match in self.TOP_EXPERT_RE.finditer(m_selected.group("top")):
                top.append({
                    "expert": int(match.group("expert")),
                    "hits": int(match.group("hits")),
                })
            self.moe["top_experts"] = top
            self.moe["hot_selection"] = {
                "locked": int(m_selected.group("locked")),
                "total": int(m_selected.group("total")),
                "budget": int(m_selected.group("budget")),
                "fails": int(m_selected.group("fails")),
                "dispatches": int(m_selected.group("dispatches")),
            }
            stage = self.moe["latest_stage"] or "selection"
            self.moe["top_expert_history"].append({
                "stage": stage,
                "bucket": self._stage_bucket(stage),
                "experts": copy.deepcopy(top[:8]),
            })
            self.moe["top_expert_history"] = self.moe["top_expert_history"][-16:]
            self._rebuild_expert_views()
            self._update_expert_stability()
            self.event_stream.append({
                "kind": "hot_selection",
                "locked": self.moe["hot_selection"]["locked"],
                "total": self.moe["hot_selection"]["total"],
                "budget": self.moe["hot_selection"]["budget"],
                "top_experts": copy.deepcopy(top[:8]),
            })
            return

        m_layer = self.HOT_LAYER_RE.search(line)
        if m_layer:
            top = []
            for match in self.TOP_EXPERT_RE.finditer(m_layer.group("top")):
                top.append({
                    "expert": int(match.group("expert")),
                    "hits": int(match.group("hits")),
                })
            self.moe["top_expert_history"].append({
                "stage": m_layer.group("stage"),
                "bucket": self._stage_bucket(m_layer.group("stage")),
                "layer": int(m_layer.group("layer")),
                "experts": copy.deepcopy(top[:8]),
            })
            self.moe["top_expert_history"] = self.moe["top_expert_history"][-96:]
            self._rebuild_expert_views()
            self._update_expert_stability()
            self.event_stream.append({
                "kind": "hot_layer",
                "stage": m_layer.group("stage"),
                "layer": int(m_layer.group("layer")),
                "top_experts": copy.deepcopy(top[:8]),
            })

    def snapshot(self, running=False):
        timeline = [
            {"key": "prompt", "label": "Prompt", "ms": self.phase["prompt_ms"]},
            {"key": "first_decode", "label": "First Decode", "ms": self.phase["first_decode_ms"]},
            {"key": "decode_tail", "label": "Decode Tail", "ms": self.phase["decode_tail_ms"]},
        ]
        total_ms = sum(item["ms"] for item in timeline)
        for item in timeline:
            item["share"] = round((item["ms"] / total_ms) * 100.0, 1) if total_ms > 0 else 0.0

        return {
            "running": running,
            "architecture": self.architecture,
            "trace": self.trace,
            "phase": {
                **self.phase,
                "recent_compact": [
                    {
                        "phase": item["phase"],
                        "token_index": item["index"],
                        "window": item["window"],
                        "tokens": item["tokens"],
                        "total_ms": item["total_ms"],
                    }
                    for item in self.phase["recent"][-8:]
                ],
                "timeline": timeline,
                "uptime_s": round(time.time() - self.started_at, 1),
            },
            "moe": self.moe,
        }


def _iter_log_files(run_dir):
    path = pathlib.Path(run_dir)
    if not path.exists() or not path.is_dir():
        return []
    return sorted(
        [p for p in path.iterdir() if p.is_file() and p.suffix.lower() == ".log"],
        key=lambda p: (p.stat().st_mtime, p.name),
    )


def _file_has_trace_markers(path):
    lower_name = path.name.lower()
    if "trace" in lower_name:
        return True
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for i, line in enumerate(f):
                if "pg-trace" in line or "hot experts trace" in line or "hot experts: locked" in line:
                    return True
                if i >= 2000:
                    break
    except Exception:
        return False
    return False


def list_replay_runs(bench_root, limit=80):
    root = pathlib.Path(bench_root)
    if not root.exists() or not root.is_dir():
        return []

    runs = []
    for child in root.iterdir():
        if not child.is_dir():
            continue
        logs = _iter_log_files(child)
        if not logs:
            continue
        trace_like = any(_file_has_trace_markers(p) for p in logs[:4])
        latest_mtime = max((p.stat().st_mtime for p in logs), default=child.stat().st_mtime)
        runs.append({
            "id": child.name,
            "name": child.name,
            "path": str(child),
            "log_count": len(logs),
            "trace_like": trace_like,
            "last_modified_ts": latest_mtime,
            "last_modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(latest_mtime)),
        })

    runs.sort(key=lambda item: item["last_modified_ts"], reverse=True)
    return runs[:limit]


def build_replay_from_run_dir(run_dir):
    logs = _iter_log_files(run_dir)
    if not logs:
        return {
            "ok": False,
            "error": f"No .log files found in {run_dir}",
        }

    agg = LiveMetricsAggregator()
    agg.start_session({})
    frames = []
    frame_id = 0

    for log_path in logs:
        try:
            with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    before = len(agg.event_stream)
                    agg.ingest_line(line.rstrip("\n\r"))
                    if len(agg.event_stream) > before:
                        frame_id += 1
                        frames.append({
                            "id": frame_id,
                            "event": copy.deepcopy(agg.event_stream[-1]),
                            "snapshot": agg.snapshot(False),
                        })
        except Exception:
            continue

    final_snapshot = agg.snapshot(False)
    return {
        "ok": True,
        "run_dir": str(run_dir),
        "run_name": pathlib.Path(run_dir).name,
        "log_count": len(logs),
        "frame_count": len(frames),
        "has_trace_data": bool(frames),
        "frames": frames,
        "final_snapshot": final_snapshot,
    }
