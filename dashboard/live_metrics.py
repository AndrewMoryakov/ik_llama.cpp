import re
import time


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

    TOP_EXPERT_RE = re.compile(r"e(?P<expert>\d+)=(?P<hits>\d+)")
    ARCH_RE = re.compile(r"general\.architecture\s+str\s+=\s+(?P<arch>[a-zA-Z0-9._-]+)")
    ARCH_META_RE = re.compile(r"llm_load_print_meta:\s+arch\s+=\s+(?P<arch>[a-zA-Z0-9._-]+)")

    def __init__(self):
        self.reset()

    def reset(self):
        self.started_at = time.time()
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
            "ttft_ms": 0.0,
            "recent": [],
        }
        self.moe = {
            "latest_stage": "",
            "latest_trace": None,
            "stages": {},
            "stage_history": [],
            "hot_selection": None,
            "top_experts": [],
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

    def _append_stage_history(self, trace):
        self.moe["stage_history"].append(trace)
        self.moe["stage_history"] = self.moe["stage_history"][-12:]

    def ingest_line(self, line):
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
                self.phase["avg_decode_tps"] = round(1000.0 / total_ms, 2) if total_ms > 0 else 0.0
            elif phase == "decode_after_prompt":
                self.phase["current"] = "decode"
                self.phase["decode_tail_ms"] += total_ms
                self.phase["decode_tail_steps"] += 1
                self.phase["last_token_ms"] = total_ms
                avg_ms = self.phase["decode_tail_ms"] / max(self.phase["decode_tail_steps"], 1)
                self.phase["avg_decode_tps"] = round(1000.0 / avg_ms, 2) if avg_ms > 0 else 0.0
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
