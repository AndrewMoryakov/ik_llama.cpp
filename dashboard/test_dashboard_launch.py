#!/usr/bin/env python3
"""Checks that /api/launch refuses what it must, and that a valid launch
reaches the launcher without this test ever spawning a real process.

Run: python3 dashboard/test_dashboard_launch.py

The refusal cases are the ones that used to get through: os.path.join drops
its first argument when the second is absolute, so args[0] = "/usr/bin/id"
ran that binary; ".." walked out of the build directory the same way; and a
wildcard CORS header let any page in the browser POST here.

Isolation: BUILD_BIN is redirected to a temp directory and pm.launch is
stubbed. So "allowed name, no file" reliably returns 404 regardless of what
is built on the host, and the one valid-launch case cannot start a process.
"""

import http.server
import json
import os
import sys
import tempfile
import threading
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dashboard_server as ds


def start_server():
    srv = http.server.HTTPServer(("127.0.0.1", 0), ds.DashboardHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def post(port, path, body, origin=None):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=data,
                                 headers={"Content-Type": "application/json"})
    if origin:
        req.add_header("Origin", origin)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def main():
    tmp = tempfile.mkdtemp(prefix="ik_dash_test_")
    ds.BUILD_BIN = tmp  # empty: no launchable binary exists here

    # Stub the launcher so a valid request cannot spawn a real process.
    launch_calls = []
    def fake_launch(args, terminal=False, env_overrides=None, **kw):
        launch_calls.append(args)
        return True, "stubbed launch (no process spawned)"
    ds.pm.launch = fake_launch

    srv, port = start_server()
    ext = ".exe" if sys.platform == "win32" else ""

    cases = [
        ("absolute path",        {"args": ["/usr/bin/id"]},                 400, None),
        ("parent traversal",     {"args": ["../../../usr/bin/id"]},         400, None),
        ("name not allowed",     {"args": ["bash"]},                        400, None),
        ("args is a string",     {"args": "llama-cli"},                     400, None),
        ("args holds a number",  {"args": ["llama-cli", 5]},                400, None),
        ("args empty",           {"args": []},                              400, None),
        ("bad env name",         {"args": ["llama-cli"],
                                  "env": {"BAD NAME": "x"}},                400, None),
        ("foreign origin",       {"args": ["llama-cli"]},                   403, "http://evil.example"),
        ("own origin allowed",   {"args": ["llama-cli"]},                   404, f"http://127.0.0.1:{port}"),
        ("allowed name, no file",{"args": ["llama-cli"]},                   404, None),
    ]
    failures = []
    for name, body, want, origin in cases:
        got, payload = post(port, "/api/launch", body, origin)
        ok = got == want
        print(f"  {'ok  ' if ok else 'FAIL'} {name:<22} expected {want}, got {got}"
              f"   {str(payload.get('error',''))[:60]}")
        if not ok:
            failures.append(name)

    # Positive path: a real (fake) binary present -> request reaches the launcher.
    # It must hit the stub, never a real process.
    with open(os.path.join(tmp, "llama-cli" + ext), "w") as f:
        f.write("not a real binary")
    got, payload = post(port, "/api/launch", {"args": ["llama-cli", "-m", "x.gguf"]}, None)
    reached = got == 200 and len(launch_calls) == 1 and payload.get("ok") is True
    print(f"  {'ok  ' if reached else 'FAIL'} {'valid launch reaches stub':<22} "
          f"expected 200 + 1 stubbed call, got {got} + {len(launch_calls)} call(s)")
    if not reached:
        failures.append("valid launch reaches stub")

    srv.shutdown()
    try:
        os.remove(os.path.join(tmp, "llama-cli" + ext)); os.rmdir(tmp)
    except OSError:
        pass

    total = len(cases) + 1
    if failures:
        print(f"\n{len(failures)} case(s) failed: {failures}")
        return 1
    print(f"\nall {total} cases behaved as expected; no real process was spawned")
    return 0


if __name__ == "__main__":
    sys.exit(main())
