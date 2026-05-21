#!/usr/bin/env python3
"""
ik_llama.cpp Dashboard Server
Lightweight local API server for the dashboard.
No external dependencies — stdlib only.

Endpoints:
  GET  /                  — serves dashboard.html
  GET  /dashboard.css     — stylesheet
  GET  /dashboard.js      — client-side logic
  GET  /api/system-info   — CPU cores, RAM, OS
  POST /api/file-info     — file size for a given path
  POST /api/scan-models   — find .gguf files in a directory
  POST /api/browse        — native OS file picker dialog
  POST /api/browse-dir    — native OS directory picker dialog
  POST /api/launch        — launch llama-cli or llama-server
  GET  /api/status        — running process status + recent output
  POST /api/stop          — stop the running process
  POST /api/stdin         — write text to process stdin (interactive mode)
  GET  /api/output        — full stdout/stderr buffer
  GET  /api/live-metrics  — current aggregated live observability snapshot
  GET  /api/replay-runs   — list replay-capable benchmark run directories
  GET  /api/replay-metrics — build replay frames from a stored run directory
"""

import http.server
import json
import os
import pathlib
import platform
import signal
import subprocess
import sys
import threading
import time
import ctypes
from collections import deque
from urllib.parse import urlparse, parse_qs
import urllib.request
from live_metrics import LiveMetricsAggregator, build_replay_from_run_dir, list_replay_runs


_slots_prev = {"n_decoded": 0, "time": 0.0}


def _poll_server_metrics(live_metrics, host="127.0.0.1", port=8080):
    """Poll llama-server /slots endpoint for real-time speed during generation.

    Schema notes:
    - Pre-PEG-rewrite (old): top-level slot["n_decoded"], slot["is_processing"].
    - Post-PEG-rewrite (current upstream): slot["next_token"]["n_decoded"],
      slot["next_token"]["has_next_token"], slot["state"] (1=active, 0=idle).
    Reader supports both. Counter resets between requests are detected and
    handled (prevents stuck values when one request ends and another starts).
    """
    global _slots_prev
    try:
        url = f"http://{host}:{port}/slots"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))

        def slot_decoded(slot):
            nt = slot.get("next_token") or {}
            v = nt.get("n_decoded")
            if v is not None:
                return v
            return slot.get("n_decoded", 0) or 0

        def slot_active(slot):
            nt = slot.get("next_token") or {}
            if "has_next_token" in nt:
                return bool(nt["has_next_token"])
            if "state" in slot and slot["state"] is not None:
                return slot["state"] != 0
            return bool(slot.get("is_processing", False))

        now = time.time()
        total_decoded = sum(slot_decoded(slot) for slot in data)
        any_processing = any(slot_active(slot) for slot in data)

        prev_decoded = _slots_prev["n_decoded"]
        prev_time = _slots_prev["time"]

        # Counter reset: new request started, n_decoded dropped (or wrapped to 0).
        # Re-baseline and skip this poll's tps calc.
        if total_decoded < prev_decoded:
            _slots_prev = {"n_decoded": total_decoded, "time": now}
            live_metrics.phase["current"] = "decode" if any_processing else "idle"
            return

        _slots_prev = {"n_decoded": total_decoded, "time": now}

        # Only compute fresh tps while generation is active.
        # When generation just ended, the last delta is the few-token tail (low and
        # misleading) — preserve previous tps values and only flip state to idle.
        if any_processing and prev_time > 0 and total_decoded > prev_decoded:
            dt = now - prev_time
            if dt > 0.1:
                delta = total_decoded - prev_decoded
                realtime_tps = round(delta / dt, 2)
                live_metrics.phase["current_decode_tps"] = realtime_tps
                live_metrics.phase["current"] = "decode"
                live_metrics.phase["decode_tail_steps"] = total_decoded

                if live_metrics.phase["min_decode_tps"] <= 0 or realtime_tps < live_metrics.phase["min_decode_tps"]:
                    live_metrics.phase["min_decode_tps"] = realtime_tps
                if realtime_tps > live_metrics.phase["max_decode_tps"]:
                    live_metrics.phase["max_decode_tps"] = realtime_tps
                # Rolling average: blend with previous
                prev_avg = live_metrics.phase["avg_decode_tps"]
                if prev_avg > 0:
                    live_metrics.phase["avg_decode_tps"] = round(prev_avg * 0.7 + realtime_tps * 0.3, 2)
                else:
                    live_metrics.phase["avg_decode_tps"] = realtime_tps
        elif not any_processing and prev_time > 0:
            # Not generating — keep last values but mark idle
            live_metrics.phase["current"] = "idle"

    except Exception:
        pass  # Server not running or not responding — silently skip


# ── Config ──────────────────────────────────────────────────────
HOST = "127.0.0.1"
PORT = 7860
DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(DASHBOARD_DIR)
DASHBOARD_HTML = os.path.join(DASHBOARD_DIR, "dashboard.html")
BUILD_BIN = os.path.join(REPO_ROOT, "build", "bin")
BENCH_RESULTS_DIR = os.path.join(REPO_ROOT, "bench_results")

# Static files allowed to be served (whitelist for security)
_JS = "application/javascript; charset=utf-8"
_CSS = "text/css; charset=utf-8"
STATIC_FILES = {
    "/dashboard.css":          ("dashboard.css",          _CSS),
    "/dashboard-live.css":     ("dashboard-live.css",     _CSS),
    "/dashboard.js":           ("dashboard.js",           _JS),
    "/dashboard-live.js":      ("dashboard-live.js",      _JS),
    "/evidence-layer.js":      ("evidence-layer.js",      _JS),
    "/dashboard-i18n.js":      ("dashboard-i18n.js",      _JS),
    "/dashboard-help.js":      ("dashboard-help.js",      _JS),
    "/dashboard-data.js":      ("dashboard-data.js",      _JS),
    "/dashboard-rules.js":     ("dashboard-rules.js",     _JS),
    "/dashboard-command.js":   ("dashboard-command.js",   _JS),
    "/dashboard-autoconfig.js":("dashboard-autoconfig.js",_JS),
}

# ── Find terminal emulator (Linux) ──────────────────────────────
def _find_linux_terminal():
    """Find an available terminal emulator on Linux."""
    terminals = [
        # (command, args_template) — {cmd} will be replaced with the command to run
        ("gnome-terminal", ["gnome-terminal", "--", "bash", "-c", "{cmd}; exec bash"]),
        ("konsole", ["konsole", "-e", "bash", "-c", "{cmd}; exec bash"]),
        ("xfce4-terminal", ["xfce4-terminal", "-e", "bash -c '{cmd}; exec bash'"]),
        ("mate-terminal", ["mate-terminal", "-e", "bash -c '{cmd}; exec bash'"]),
        ("xterm", ["xterm", "-e", "bash -c '{cmd}; exec bash'"]),
        ("lxterminal", ["lxterminal", "-e", "bash -c '{cmd}; exec bash'"]),
    ]
    import shutil
    for name, tmpl in terminals:
        if shutil.which(name):
            return name, tmpl
    return None, None


# ── Process Manager ─────────────────────────────────────────────
class ProcessManager:
    def __init__(self):
        self.proc = None
        self.cmd = ""
        self.started_at = None
        self.output_buf = deque(maxlen=5000)  # last 5000 lines
        self._reader_thread = None
        self._lock = threading.Lock()
        self.terminal_mode = False  # True when running in external terminal (llama-cli)
        self.live_metrics = LiveMetricsAggregator()

    @property
    def running(self):
        return self.proc is not None and self.proc.poll() is None

    def launch(self, args, cwd=None, terminal=False, env_overrides=None):
        with self._lock:
            if self.running:
                return False, "Process already running. Stop it first."
            self.output_buf.clear()
            env_overrides = env_overrides or {}
            self.live_metrics.start_session(env_overrides)
            env_prefix = " ".join(f"{k}={v}" for k, v in env_overrides.items())
            self.cmd = (env_prefix + " " if env_prefix else "") + " ".join(args)
            self.terminal_mode = terminal
            work_dir = cwd or BUILD_BIN
            merged_env = os.environ.copy()
            merged_env.update({str(k): str(v) for k, v in env_overrides.items()})

            try:
                if terminal:
                    # Terminal mode: open a real console/terminal for interactive use.
                    # Key insight: piping ANY handle (even stderr) breaks console stdin
                    # on Windows — the process gets EOF instead of real input.
                    # Solution: redirect stderr to a temp FILE (not pipe) and tail it.
                    import tempfile
                    fd, stderr_path = tempfile.mkstemp(prefix='ik_dash_', suffix='.log')
                    os.close(fd)
                    self._stderr_path = stderr_path

                    if os.name == "nt":
                        # Windows: create a .bat wrapper that redirects stderr to file.
                        # The .bat runs in a new console with fully real stdin/stdout.
                        fd2, bat_path = tempfile.mkstemp(prefix='ik_dash_', suffix='.bat')
                        with os.fdopen(fd2, 'w') as bf:
                            cmd_line = subprocess.list2cmdline(args)
                            bf.write(f'@echo off\n')
                            bf.write(f'title llama-cli interactive\n')
                            for key, value in env_overrides.items():
                                bf.write(f'set "{key}={value}"\n')
                            bf.write(f'{cmd_line} 2>"{stderr_path}"\n')
                        self._bat_path = bat_path

                        self.proc = subprocess.Popen(
                            [bat_path],
                            cwd=work_dir,
                            env=merged_env,
                            creationflags=subprocess.CREATE_NEW_CONSOLE | subprocess.CREATE_NEW_PROCESS_GROUP,
                        )
                    else:
                        # Linux: launch inside a terminal emulator with stderr redirect.
                        term_name, term_tmpl = _find_linux_terminal()
                        if not term_name:
                            return False, "No terminal emulator found (install gnome-terminal, konsole, or xterm)"

                        inner_cmd = " ".join(
                            f'"{a}"' if " " in a else a for a in args
                        ) + f' 2>"{stderr_path}"'

                        term_args = []
                        for part in term_tmpl:
                            term_args.append(part.replace("{cmd}", inner_cmd))

                        self.proc = subprocess.Popen(
                            term_args,
                            stdin=None, stdout=None, stderr=None,
                            cwd=work_dir,
                            env=merged_env,
                        )

                    # Tail the stderr log file for browser log viewer
                    self._reader_thread = threading.Thread(
                        target=self._tail_stderr_file, args=(stderr_path,), daemon=True
                    )
                    self._reader_thread.start()
                else:
                    # Piped mode: capture all output for dashboard (llama-server)
                    # bufsize=0 + binary mode: avoids TextIOWrapper's 8 KB read-ahead
                    # which would batch output until the buffer fills on Windows pipes.
                    self.proc = subprocess.Popen(
                        args,
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        cwd=work_dir,
                        env=merged_env,
                        bufsize=0,
                        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
                    )
                    self._reader_thread = threading.Thread(
                        target=self._read_output, args=(self.proc.stdout,), daemon=True
                    )
                    self._reader_thread.start()
            except FileNotFoundError as e:
                return False, f"Executable not found: {e}"
            except Exception as e:
                return False, str(e)

            self.started_at = time.time()
            return True, f"Launched PID {self.proc.pid}"

    def stop(self):
        with self._lock:
            if not self.running:
                return False, "No process running."
            pid = self.proc.pid
            try:
                if os.name == "nt":
                    if self.terminal_mode:
                        # Terminal mode: self.proc is cmd.exe running .bat,
                        # llama-cli.exe is a child process. Must kill entire tree.
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(pid)],
                            capture_output=True, timeout=10,
                        )
                    else:
                        self.proc.send_signal(signal.CTRL_BREAK_EVENT)
                        self.proc.wait(timeout=5)
                else:
                    if self.terminal_mode:
                        # Linux: terminal emulator → bash → llama-cli. Kill group.
                        import os as _os
                        try:
                            _os.killpg(_os.getpgid(pid), signal.SIGTERM)
                        except ProcessLookupError:
                            pass
                    else:
                        self.proc.terminate()
                    self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass
            # Ensure proc is reaped
            try:
                self.proc.wait(timeout=3)
            except Exception:
                pass
            self._cleanup_temp_files()
            return True, "Process stopped."

    def _cleanup_temp_files(self):
        """Clean up temporary files created for terminal mode."""
        for attr in ('_stderr_path', '_bat_path'):
            path = getattr(self, attr, None)
            if path:
                try:
                    os.unlink(path)
                except Exception:
                    pass
                setattr(self, attr, None)

    def status(self):
        return {
            "running": self.running,
            "pid": self.proc.pid if self.proc else None,
            "cmd": self.cmd,
            "terminal_mode": self.terminal_mode,
            "uptime_s": round(time.time() - self.started_at, 1) if self.started_at and self.running else None,
            "exit_code": self.proc.returncode if self.proc and not self.running else None,
            "output_lines": len(self.output_buf),
            "last_lines": list(self.output_buf)[-30:],
        }

    def write_stdin(self, text):
        """Write text to the process stdin (for interactive mode)."""
        with self._lock:
            if not self.running or not self.proc or not self.proc.stdin:
                return False, "Process not running or stdin closed"
            try:
                self.proc.stdin.write((text + "\n").encode('utf-8'))
                self.proc.stdin.flush()
                return True, "OK"
            except Exception as e:
                return False, str(e)

    def get_output(self, offset=0):
        buf = list(self.output_buf)
        return buf[offset:]

    def _read_output(self, stream):
        pending = b''
        try:
            while True:
                chunk = stream.read(4096)
                if not chunk:
                    break
                pending += chunk
                while b'\n' in pending:
                    line, pending = pending.split(b'\n', 1)
                    clean = line.rstrip(b'\r').decode('utf-8', errors='replace')
                    self.output_buf.append(clean)
                    self.live_metrics.notify_output_line()
                    self.live_metrics.ingest_line(clean)
        except Exception:
            pass
        if pending:
            clean = pending.rstrip(b'\r').decode('utf-8', errors='replace')
            if clean:
                self.output_buf.append(clean)

    def _tail_stderr_file(self, path):
        """Tail a stderr log file (used for Linux terminal mode)."""
        try:
            # Wait for file to appear
            for _ in range(50):
                if os.path.exists(path):
                    break
                time.sleep(0.1)
            with open(path, 'r') as f:
                while self.running:
                    line = f.readline()
                    if line:
                        clean = line.rstrip("\n\r")
                        self.output_buf.append(clean)
                        self.live_metrics.ingest_line(clean)
                    else:
                        time.sleep(0.3)
                # Read remaining lines after process stops
                for line in f:
                    clean = line.rstrip("\n\r")
                    self.output_buf.append(clean)
                    self.live_metrics.ingest_line(clean)
        except Exception:
            pass


pm = ProcessManager()


# ── System Info ─────────────────────────────────────────────────
def get_system_info():
    info = {
        "os": platform.system(),
        "os_version": platform.version(),
        "arch": platform.machine(),
        "cpu_name": platform.processor() or "unknown",
        "logical_cores": os.cpu_count() or 0,
        "physical_cores": None,
        "total_ram_gb": None,
    }

    # Try to get physical cores and RAM
    if platform.system() == "Windows":
        try:
            # Physical cores via WMI
            import subprocess as sp
            out = sp.check_output(
                ["wmic", "cpu", "get", "NumberOfCores", "/value"],
                text=True, timeout=5
            )
            for line in out.strip().split("\n"):
                if "NumberOfCores=" in line:
                    info["physical_cores"] = int(line.split("=")[1].strip())
                    break
        except Exception:
            info["physical_cores"] = info["logical_cores"] // 2

        try:
            # RAM via ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            mem = MEMORYSTATUSEX()
            mem.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem))
            info["total_ram_gb"] = round(mem.ullTotalPhys / (1024**3), 1)
            info["available_ram_gb"] = round(mem.ullAvailPhys / (1024**3), 1)
        except Exception:
            pass
    else:
        # Linux/Mac
        try:
            mem_total = mem_avail = None
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        mem_total = int(line.split()[1])
                    elif line.startswith("MemAvailable:"):
                        mem_avail = int(line.split()[1])
            if mem_total:
                info["total_ram_gb"] = round(mem_total / (1024**2), 1)
            if mem_avail:
                info["available_ram_gb"] = round(mem_avail / (1024**2), 1)
        except Exception:
            pass
        try:
            info["physical_cores"] = len(set(
                line.split(":")[1].strip()
                for line in open("/proc/cpuinfo")
                if "core id" in line
            )) or info["logical_cores"] // 2
        except Exception:
            info["physical_cores"] = info["logical_cores"] // 2
        # Better CPU name on Linux
        if info["cpu_name"] in ("unknown", "", "x86_64"):
            try:
                for line in open("/proc/cpuinfo"):
                    if line.startswith("model name"):
                        info["cpu_name"] = line.split(":", 1)[1].strip()
                        break
            except Exception:
                pass

    # Check available executables
    info["executables"] = {}
    for name in ["llama-cli", "llama-server", "llama-bench"]:
        ext = ".exe" if platform.system() == "Windows" else ""
        path = os.path.join(BUILD_BIN, name + ext)
        info["executables"][name] = os.path.isfile(path)

    info["build_bin_path"] = BUILD_BIN
    return info


import re
import struct

_SPLIT_RE = re.compile(r'^(.+)-(\d{5})-of-(\d{5})(\.gguf)$', re.IGNORECASE)


# ── GGUF Metadata Parser ───────────────────────────────────────
def read_gguf_metadata(filepath, max_keys=80):
    """Read metadata KV pairs from a GGUF file header. Lightweight — no tensor data."""
    meta = {}
    try:
        with open(filepath, "rb") as f:
            magic = f.read(4)
            if magic != b"GGUF":
                return {"error": "Not a GGUF file"}
            version = struct.unpack("<I", f.read(4))[0]
            _n_tensors = struct.unpack("<Q", f.read(8))[0]
            n_kv = struct.unpack("<Q", f.read(8))[0]

            meta["_gguf_version"] = version
            meta["_n_tensors"] = _n_tensors
            meta["_n_kv"] = n_kv

            for _ in range(min(n_kv, max_keys)):
                try:
                    key = _gguf_read_string(f)
                    val = _gguf_read_value(f)
                    # Skip huge values (tokenizer arrays etc.)
                    if isinstance(val, (str, int, float, bool)):
                        meta[key] = val
                    elif isinstance(val, list) and len(val) <= 20:
                        meta[key] = val
                except Exception:
                    break  # Stop at first parse error (usually tokenizer binary data)
    except Exception as e:
        return {"error": str(e)}
    return meta


def _gguf_read_string(f):
    length = struct.unpack("<Q", f.read(8))[0]
    raw = f.read(length)
    return raw.decode("utf-8", errors="replace")


def _gguf_read_value(f, vtype=None):
    if vtype is None:
        vtype = struct.unpack("<I", f.read(4))[0]
    if vtype == 0:  return struct.unpack("<B", f.read(1))[0]
    if vtype == 1:  return struct.unpack("<b", f.read(1))[0]
    if vtype == 2:  return struct.unpack("<H", f.read(2))[0]
    if vtype == 3:  return struct.unpack("<h", f.read(2))[0]
    if vtype == 4:  return struct.unpack("<I", f.read(4))[0]
    if vtype == 5:  return struct.unpack("<i", f.read(4))[0]
    if vtype == 6:  return struct.unpack("<f", f.read(4))[0]
    if vtype == 7:  return bool(struct.unpack("<B", f.read(1))[0])
    if vtype == 8:  return _gguf_read_string(f)
    if vtype == 9:  # ARRAY
        atype = struct.unpack("<I", f.read(4))[0]
        alen = struct.unpack("<Q", f.read(8))[0]
        if alen > 100:
            # Skip large arrays (tokenizer) — seek past them
            _gguf_skip_array(f, atype, alen)
            return f"[array: {alen} items]"
        return [_gguf_read_value(f, atype) for _ in range(alen)]
    if vtype == 10: return struct.unpack("<Q", f.read(8))[0]
    if vtype == 11: return struct.unpack("<q", f.read(8))[0]
    if vtype == 12: return struct.unpack("<d", f.read(8))[0]
    raise ValueError(f"Unknown GGUF type {vtype}")


_GGUF_TYPE_SIZES = {0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8}

def _gguf_skip_array(f, atype, alen):
    if atype in _GGUF_TYPE_SIZES:
        f.seek(_GGUF_TYPE_SIZES[atype] * alen, 1)
    elif atype == 8:  # STRING array
        for _ in range(alen):
            slen = struct.unpack("<Q", f.read(8))[0]
            f.seek(slen, 1)
    elif atype == 9:  # nested ARRAY — just bail
        raise ValueError("Nested arrays not supported")
    else:
        raise ValueError(f"Cannot skip array of type {atype}")


def extract_model_info(meta):
    """Extract structured model info from raw GGUF metadata."""
    arch = meta.get("general.architecture", "unknown")
    info = {
        "architecture": arch,
        "name": meta.get("general.name", ""),
        "basename": meta.get("general.basename", ""),
        "size_label": meta.get("general.size_label", ""),
        "quantized_by": meta.get("general.quantized_by", ""),
        "block_count": meta.get(f"{arch}.block_count", 0),
        "context_length": meta.get(f"{arch}.context_length", 0),
        "embedding_length": meta.get(f"{arch}.embedding_length", 0),
        "feed_forward_length": meta.get(f"{arch}.feed_forward_length", 0),
        "head_count": meta.get(f"{arch}.attention.head_count", 0),
        "head_count_kv": meta.get(f"{arch}.attention.head_count_kv", 0),
        "expert_count": meta.get(f"{arch}.expert_count", 0),
        "expert_used_count": meta.get(f"{arch}.expert_used_count", 0),
        "is_moe": meta.get(f"{arch}.expert_count", 0) > 1,
        "key_length": meta.get(f"{arch}.attention.key_length", 0),
        "value_length": meta.get(f"{arch}.attention.value_length", 0),
        "rope_freq_base": meta.get(f"{arch}.rope.freq_base", 0),
    }
    return info


def get_file_info(path):
    p = pathlib.Path(path)
    if not p.exists():
        return {"error": f"File not found: {path}"}
    if not p.is_file():
        return {"error": f"Not a file: {path}"}
    size_bytes = p.stat().st_size
    result = {
        "path": str(p.resolve()),
        "name": p.name,
        "size_bytes": size_bytes,
        "size_gb": round(size_bytes / (1024**3), 2),
        "extension": p.suffix,
    }

    # Detect split GGUF: *-00001-of-00005.gguf
    m = _SPLIT_RE.match(p.name)
    if m:
        prefix, _part_num, total_str, ext = m.groups()
        total_parts = int(total_str)
        parent = p.parent
        parts = []
        total_size = 0
        all_found = True
        for i in range(1, total_parts + 1):
            part_name = f"{prefix}-{i:05d}-of-{total_str}{ext}"
            part_path = parent / part_name
            if part_path.is_file():
                sz = part_path.stat().st_size
                parts.append({
                    "part": i,
                    "name": part_name,
                    "size_bytes": sz,
                    "size_gb": round(sz / (1024**3), 2),
                })
                total_size += sz
            else:
                all_found = False
                parts.append({
                    "part": i,
                    "name": part_name,
                    "missing": True,
                })
        result["split"] = {
            "is_split": True,
            "total_parts": total_parts,
            "found_parts": sum(1 for pp in parts if not pp.get("missing")),
            "all_found": all_found,
            "total_size_bytes": total_size,
            "total_size_gb": round(total_size / (1024**3), 2),
            "parts": parts,
        }
        # Override top-level size with total
        result["size_bytes"] = total_size
        result["size_gb"] = round(total_size / (1024**3), 2)

    return result


def scan_models(directory, max_depth=3):
    results = []
    base = pathlib.Path(directory)
    if not base.is_dir():
        return {"error": f"Not a directory: {directory}"}

    def _scan(d, depth):
        if depth > max_depth:
            return
        try:
            for entry in sorted(d.iterdir()):
                if entry.is_file() and entry.suffix.lower() == ".gguf":
                    size = entry.stat().st_size
                    results.append({
                        "path": str(entry),
                        "name": entry.name,
                        "size_gb": round(size / (1024**3), 2),
                    })
                elif entry.is_dir() and not entry.name.startswith("."):
                    _scan(entry, depth + 1)
        except PermissionError:
            pass

    _scan(base, 0)
    results.sort(key=lambda x: x["name"].lower())
    return {"directory": str(base), "models": results}


def _try_zenity_file(initial_dir="", title="Select model file"):
    """Try zenity (GTK) or kdialog (KDE) file picker on Linux."""
    for cmd in ["zenity", "kdialog"]:
        try:
            if cmd == "zenity":
                args = ["zenity", "--file-selection", "--title=" + title,
                        "--file-filter=GGUF models (*.gguf)|*.gguf",
                        "--file-filter=All files|*"]
                if initial_dir:
                    args.append("--filename=" + initial_dir + "/")
            else:
                args = ["kdialog", "--getopenfilename", initial_dir or ".",
                        "GGUF models (*.gguf);;All files (*)"]
            out = subprocess.check_output(args, text=True, timeout=120).strip()
            if out:
                return out
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            continue
    return None


def _try_zenity_dir(initial_dir="", title="Select directory"):
    """Try zenity/kdialog directory picker on Linux."""
    for cmd in ["zenity", "kdialog"]:
        try:
            if cmd == "zenity":
                args = ["zenity", "--file-selection", "--directory", "--title=" + title]
                if initial_dir:
                    args.append("--filename=" + initial_dir + "/")
            else:
                args = ["kdialog", "--getexistingdirectory", initial_dir or "."]
            out = subprocess.check_output(args, text=True, timeout=120).strip()
            if out:
                return out
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            continue
    return None


def open_file_dialog(initial_dir="", title="Select model file"):
    """Open native OS file picker. Tries tkinter, then zenity/kdialog on Linux."""
    result = {"path": None}

    def _run():
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            path = filedialog.askopenfilename(
                title=title,
                initialdir=initial_dir or None,
                filetypes=[
                    ("GGUF models", "*.gguf"),
                    ("All files", "*.*"),
                ],
            )
            root.destroy()
            if path:
                result["path"] = path
                return
        except Exception:
            pass

        # Fallback: zenity / kdialog (Linux without tkinter or without display)
        if platform.system() != "Windows":
            path = _try_zenity_file(initial_dir, title)
            if path:
                result["path"] = path
                return
            result["error"] = "No file picker available (install python3-tk or zenity)"

    t = threading.Thread(target=_run)
    t.start()
    t.join(timeout=120)
    return result


def open_dir_dialog(initial_dir="", title="Select directory"):
    """Open native OS directory picker."""
    result = {"path": None}

    def _run():
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            path = filedialog.askdirectory(
                title=title,
                initialdir=initial_dir or None,
            )
            root.destroy()
            if path:
                result["path"] = path
                return
        except Exception:
            pass

        # Fallback: zenity / kdialog
        if platform.system() != "Windows":
            path = _try_zenity_dir(initial_dir, title)
            if path:
                result["path"] = path
                return
            result["error"] = "No directory picker available (install python3-tk or zenity)"

    t = threading.Thread(target=_run)
    t.start()
    t.join(timeout=120)
    return result


# Map --experimental keys to env vars for live_metrics session detection.
_EXPERIMENTAL_ENV_MAP = {
    'pg-trace':               'IK_LLAMA_PG_TRACE',
    'pg-trace-decode-window': 'IK_LLAMA_PG_TRACE_DECODE_WINDOW',
    'hot-expert-trace':       'IK_LLAMA_HOT_EXPERT_TRACE',
    'locality-trace':         'IK_LLAMA_LOCALITY_TRACE',
    'layer-score-trace':      'IK_LLAMA_LAYER_SCORE_TRACE',
}

def _extract_experimental_env(args):
    """Extract env var equivalents from --experimental key=value args."""
    env = {}
    i = 0
    while i < len(args):
        if args[i] == '--experimental' and i + 1 < len(args):
            kv = args[i + 1]
            eq = kv.find('=')
            if eq > 0:
                key = kv[:eq]
                value = kv[eq + 1:]
                if key in _EXPERIMENTAL_ENV_MAP:
                    env[_EXPERIMENTAL_ENV_MAP[key]] = value
        i += 1
    return env


# ── HTTP Handler ────────────────────────────────────────────────
class DashboardHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Cleaner logging
        sys.stderr.write(f"[dashboard] {args[0]} {args[1]}\n")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json_response(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/" or path == "/dashboard.html":
            self._serve_file(DASHBOARD_HTML, "text/html; charset=utf-8")
            return

        if path in STATIC_FILES:
            filename, ctype = STATIC_FILES[path]
            self._serve_file(os.path.join(DASHBOARD_DIR, filename), ctype)
            return

        if path == "/api/system-info":
            self._json_response(get_system_info())
            return

        if path == "/api/status":
            self._json_response(pm.status())
            return

        if path == "/api/output":
            qs = parse_qs(urlparse(self.path).query)
            offset = int(qs.get("offset", [0])[0])
            lines = pm.get_output(offset)
            self._json_response({"offset": offset, "lines": lines, "total": len(pm.output_buf)})
            return

        if path == "/api/live-metrics":
            # Try to poll llama-server /metrics for real-time speed data
            qs = parse_qs(urlparse(self.path).query)
            server_port = int(qs.get("server_port", [8080])[0])
            server_host = qs.get("server_host", ["127.0.0.1"])[0]
            _poll_server_metrics(pm.live_metrics, server_host, server_port)
            self._json_response(pm.live_metrics.snapshot(pm.running))
            return

        if path == "/api/export-expert-stats":
            qs = parse_qs(urlparse(self.path).query)
            server_port = int(qs.get("server_port", [8080])[0])
            server_host = qs.get("server_host", ["127.0.0.1"])[0]
            # Only pass a safe filename, no arbitrary paths
            filename = "expert_stats_session.csv"
            try:
                url = f"http://{server_host}:{server_port}/export-expert-stats?filename={filename}"
                req = urllib.request.Request(url, method="GET")
                with urllib.request.urlopen(req, timeout=5.0) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                self._json_response(data)
            except Exception as e:
                self._json_response({"status": "error", "message": str(e)}, 500)
            return

        if path == "/api/replay-runs":
            self._json_response({"runs": list_replay_runs(BENCH_RESULTS_DIR)})
            return

        if path == "/api/replay-metrics":
            qs = parse_qs(urlparse(self.path).query)
            run_id = qs.get("run", [""])[0].strip()
            if not run_id:
                self._json_response({"error": "No run specified"}, 400)
                return
            run_dir = os.path.join(BENCH_RESULTS_DIR, run_id)
            data = build_replay_from_run_dir(run_dir)
            status = 200 if data.get("ok") else 404
            self._json_response(data, status)
            return

        self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/file-info":
            body = self._read_body()
            fpath = body.get("path", "")
            if not fpath:
                self._json_response({"error": "No path provided"}, 400)
                return
            self._json_response(get_file_info(fpath))
            return

        if path == "/api/scan-models":
            body = self._read_body()
            directory = body.get("directory", "")
            max_depth = body.get("max_depth", 3)
            if not directory:
                self._json_response({"error": "No directory provided"}, 400)
                return
            self._json_response(scan_models(directory, max_depth))
            return

        if path == "/api/model-meta":
            body = self._read_body()
            fpath = body.get("path", "")
            if not fpath:
                self._json_response({"error": "No path provided"}, 400)
                return
            p = pathlib.Path(fpath)
            if not p.exists() or not p.is_file():
                self._json_response({"error": f"File not found: {fpath}"}, 404)
                return
            raw_meta = read_gguf_metadata(str(p))
            if "error" in raw_meta:
                self._json_response(raw_meta, 500)
                return
            model_info = extract_model_info(raw_meta)
            self._json_response({"raw": raw_meta, "info": model_info})
            return

        if path == "/api/browse":
            body = self._read_body()
            initial_dir = body.get("initial_dir", "")
            result = open_file_dialog(initial_dir=initial_dir)
            if result.get("path"):
                info = get_file_info(result["path"])
                self._json_response(info)
            elif result.get("error"):
                self._json_response({"error": result["error"]}, 500)
            else:
                self._json_response({"cancelled": True})
            return

        if path == "/api/browse-dir":
            body = self._read_body()
            initial_dir = body.get("initial_dir", "")
            result = open_dir_dialog(initial_dir=initial_dir)
            if result.get("path"):
                self._json_response({"path": result["path"]})
            elif result.get("error"):
                self._json_response({"error": result["error"]}, 500)
            else:
                self._json_response({"cancelled": True})
            return

        if path == "/api/launch":
            body = self._read_body()
            args = body.get("args", [])
            env = body.get("env", {})
            terminal = body.get("terminal", False)
            if not args:
                self._json_response({"error": "No args provided"}, 400)
                return
            if not isinstance(env, dict):
                self._json_response({"error": "env must be an object"}, 400)
                return
            env = {str(k): str(v) for k, v in env.items() if str(k)}
            # Resolve executable path
            exe_name = args[0]
            ext = ".exe" if platform.system() == "Windows" else ""
            exe_path = os.path.join(BUILD_BIN, exe_name + ext)
            if not os.path.isfile(exe_path):
                self._json_response({"error": f"Executable not found: {exe_path}"}, 404)
                return
            full_args = [exe_path] + args[1:]
            # Merge trace env vars extracted from --experimental args so
            # live_metrics can detect pg_trace / hot_expert_trace even when
            # the client no longer sends them as a separate env dict.
            env.update(_extract_experimental_env(full_args))
            ok, msg = pm.launch(full_args, terminal=terminal, env_overrides=env)
            self._json_response({"ok": ok, "message": msg}, 200 if ok else 409)
            return

        if path == "/api/stop":
            ok, msg = pm.stop()
            self._json_response({"ok": ok, "message": msg})
            return

        if path == "/api/stdin":
            body = self._read_body()
            ok, msg = pm.write_stdin(body.get("text", ""))
            self._json_response({"ok": ok, "message": msg})
            return

        self.send_error(404)

    def _serve_file(self, filepath, content_type):
        try:
            with open(filepath, "rb") as f:
                data = f.read()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self.send_error(404, f"File not found: {filepath}")


# ── Main ────────────────────────────────────────────────────────
def main():
    port = PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Usage: {sys.argv[0]} [port]")
            sys.exit(1)

    server = http.server.HTTPServer((HOST, port), DashboardHandler)
    print(f"")
    print(f"  ik_llama.cpp Dashboard Server")
    print(f"  http://{HOST}:{port}/")
    print(f"")
    print(f"  Build dir:  {BUILD_BIN}")
    print(f"  Dashboard:  {DASHBOARD_HTML}")
    print(f"  Press Ctrl+C to stop")
    print(f"")

    try:
        import webbrowser
        webbrowser.open(f"http://{HOST}:{port}/")
    except Exception:
        pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        if pm.running:
            pm.stop()
        server.server_close()


if __name__ == "__main__":
    main()
