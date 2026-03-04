# Next Benchmark Queue - 2026-03-01

Operational note: which benchmark questions are already closed, which fresh runs now exist, and what still makes sense next.

## 1. Recently completed

### MiniMax policy closeout

Status: `completed`

Meaning:

- `TG-only`: `off > auto`
- mixed `pg32,4`: `auto > off`
- this policy question should now be treated as closed on the fixed tree

Canonical raw artifacts:

- `ik_llama.cpp/bench_results/2026-03-01_223439_minimax_hot_budget_long`
- `ik_llama.cpp/bench_results/2026-03-01_224347_minimax_policy_closeout`

### MiniMax locality confirm

Status: `completed`

Run:

- `ik_llama.cpp/bench_results/2026-03-03_001015_minimax_locality_confirm`

Matrix:

- baseline default hot-expert selection
- `tail-window=16`
- `rtr=auto`
- scenarios:
  - `tg128`
  - `pg512,128`
- `r=3`, `w=1`, `t=16`, `fa=1`, `muge=0`

Result:

- `TG128`: `1.332637 -> 1.282882`
- `PG512,128 mixed`: `3.991484 -> 4.030163`

Meaning:

1. `tail-window=16` did not become a practical new baseline
2. mixed signal stayed positive but weak
3. next MiniMax line should move toward smarter locality ideas, not repeat this exact confirm pass

### GPT-OSS runtime refresh

Status: `completed`

Queue launcher:

- `ik_llama.cpp/bench_results/2026-03-03_060927_gptoss_queue_launcher`

#### gpt-oss-20b baseline

Run:

- `ik_llama.cpp/bench_results/2026-03-03_060928_gptoss20b_runtime_baseline`

Result:

- `TG128`: `23.707807`
- `PG512,128`
  - `pp512`: `272.749618`
  - `tg128`: `24.075077`
  - `pp512+tg128`: `90.283185`

Meaning:

- fresh current-tree baseline now exists for the next decode-side `gpt-oss-20b` line

#### gpt-oss-120b packaging refresh

Run:

- `ik_llama.cpp/bench_results/2026-03-03_061156_gptoss120b_runtime_packaging`

Result:

- `TG128`
  - `off`: `14.134468`
  - `auto`: `16.657064`
- `PG512,128`
  - `off`: `59.089030`
  - `auto`: `60.177522`

Meaning:

1. `rtr=auto` is the current throughput-first mode on this tree
2. `off` still matters only for more conservative startup-sensitive packaging

## 2. Latest completed generalized-validation run

### Phase 3 validation without MiniMax

Status: `completed`

Launcher:

- `ik_llama.cpp/bench_results/2026-03-03_162811_phase3_validation_launcher`

Run:

- `ik_llama.cpp/bench_results/2026-03-03_162813_phase3_validation`

Scope:

1. `gpt-oss-20b`
   - hot-expert sanity
   - prompt-packed validation
2. `gpt-oss-120b`
   - prompt-packed heavy sanity
3. `Qwen3-30B-A3B`
   - prompt-packed validation

Note:

- `MiniMax` is intentionally deferred from this pass to keep the queue within a practical time window.

Key outcome:

1. `gpt-oss-120b prompt-packed back-half` survived a dedicated confirm run and now stands as a medium-confidence huge-model branch
2. `gpt-oss-20b tail-window=16` is promising but weak
3. `gpt-oss-20b` and `Qwen3-30B-A3B` prompt-packed remain mostly prompt-side wins, not clear mixed-path wins

## 3. What is worth running next

### Highest-ROI next benchmark question

None of the previously open heavy questions remain urgent.

The next useful runs should be tied to one of two follow-ups:

1. `gpt-oss-120b` productization pass for `Prompt Packed QKV back-half`
2. next `gpt-oss-20b` decode-side line

### Good next candidates, if code changes land

1. `gpt-oss-20b` decode-side A/B
- compare a concrete decode-path patch against the fresh March 3 baseline

2. next `MiniMax locality` A/B
- only after a smarter locality idea lands
- for example weighted hot experts or prompt+early-decode feedback

3. `Qwen3-30B-A3B` runtime refresh
- useful as a clean comparison point if a new runtime or dashboard-facing claim needs it

## 4. What is not worth rerunning right now

Do not spend time yet on:

1. another wide `MiniMax hot-budget` matrix
2. another `MiniMax off vs auto` pass
3. another `tail-window=16` confirm run without a new locality hypothesis
4. a `SER` matrix without a new supporting idea
5. wider prompt-packed QKV reruns without a new runtime/generalization hypothesis
