# Next Benchmark Queue - 2026-03-01

Короткий operational note: какие прогоны реально имеют смысл следующими.

## 1. Active now

### MiniMax M2.5 closeout

Status: `completed`.

Result:

- `TG-only`: `off > auto`
- mixed `pp32+tg4`: `auto > off`

Meaning:

- MiniMax `off vs auto` should no longer be treated as an open policy question
- the next MiniMax step should move into `expert locality / paging`

Run in progress:

- `rtr=off` vs `rtr=auto`
- `Hot Expert Budget` unset / runtime default
- scenarios:
  - `tg32`
  - `pg32,4`
- `t16`, `fa1`, `muge0`, `ngl0`, `r=1`, `w=1`

Current run dir:

- `ik_llama.cpp/bench_results/2026-03-01_221624_minimax_hot_budget_long`

Launcher dir:

- `ik_llama.cpp/bench_results/2026-03-01_221623_minimax_off_vs_auto_launcher_fixed2`

Current status:

- `tg32 off` complete: `0.618850 tok/s`
- `tg32 auto` complete: `0.553629 tok/s`
- `pg32,4 off` is/was re-run separately via:
  - `ik_llama.cpp/bench_results/2026-03-01_223439_minimax_hot_budget_long`
- continuation for `pg32,4 auto` has been scheduled via:
  - `ik_llama.cpp/bench_results/2026-03-01_223808_minimax_pg_auto_continuation`

Why this split exists:

- the older overloaded hot-budget runner was failing around the `pg` transition
- a cleaner dedicated policy runner was added:
  - `ik_llama.cpp/scripts/bench-minimax-policy-closeout.ps1`

Why this run matters:

- it closes the main remaining practical policy question for huge `MiniMax`
- it has better ROI than any wider matrix right now

## 2. Next if MiniMax finishes cleanly

### gpt-oss-20b decode-side follow-up

Not started in this pass because no local model path is currently available from the active host context.

Minimal useful pass:

1. `tg128`
2. `pg512,128`
3. baseline profile:
   - `t16`
   - `fa1`
   - `rtr=auto`
   - `muge0`
4. same-build A/B around the next decode-side target

Why:

- `gpt-oss-20b` remains the best next candidate for a clean engine win
- prompt-only work already looks mostly exhausted

## 3. Next huge-model packaging pass

### gpt-oss-120b runtime-policy packaging

Useful when the model path is available:

1. `tg128`
2. `pg512,128`
3. compare:
   - `rtr=off`
   - `rtr=auto`

Interpretation goal:

- separate throughput-first profile from startup-safe profile

## 4. Not worth running right now

Do not spend time yet on:

1. wide `MiniMax` hot-budget matrix
2. `MiniMax rtr=on`
3. `SER` matrix
4. wider `Qwen3MoE` prompt-side packed-QKV passes

Reason:

- lower ROI than the active `MiniMax off vs auto` closeout
- or blocked by missing local model path on the current host
