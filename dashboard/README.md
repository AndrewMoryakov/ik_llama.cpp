# Dashboard

This directory contains the dashboard as a self-contained product layer.

## Quick Start

From the repo root:

```powershell
.\dashboard.bat
```

Default URL:

```text
http://127.0.0.1:7860/
```

Custom port:

```powershell
.\dashboard.bat 7861
```

## What Is Here

1. `dashboard.html`
- UI structure

2. `dashboard.css`
- styles, badges, warnings, layout

3. `dashboard.js`
- main knowledge layer
- auto-configure
- family detection
- warnings/badges
- command/env builders

4. `dashboard-live.js`
- live inference UI
- phase timeline
- MoE expert activity panels
- replay mode for stored benchmark/log runs
- `Learn / Inspect` presentation split

5. `dashboard-live.css`
- styles for the live observability layer

6. `live_metrics.py`
- server-side parser/aggregator for runtime trace lines
- converts `pg-trace` and `hot experts` logs into JSON snapshots
- builds replay frames from stored run directories in `bench_results/`

7. `dashboard_server.py`
- local stdlib-only server
- launch/status/output API
- `/api/live-metrics`
- `/api/replay-runs`
- `/api/replay-metrics`

8. `dashboard_server.sh`
- Linux launcher

## What To Change Where

### UI layout / new controls

- `dashboard.html`

### Visual state / warnings / badges styling

- `dashboard.css`

### Recommendations / logic / family behavior

- `dashboard.js`

### Live inference visualization

- `dashboard-live.js`
- `dashboard-live.css`
- `live_metrics.py`

### Launch behavior / env plumbing / server API

- `dashboard_server.py`

## Important Runtime Note

The dashboard server is stored in `dashboard/`, but it resolves `build/bin` from the repo root.

That is intentional.

## Detailed Docs

For the full product guide:

- `../project_docs/dashboard/PRODUCT_GUIDE.md`

For roadmap:

- `../project_docs/dashboard/ROADMAP_2026-02-28.md`

For tutorial / beginner docs:

- `../project_docs/tutorial/README.md`
