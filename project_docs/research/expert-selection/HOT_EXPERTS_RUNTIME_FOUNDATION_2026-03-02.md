## Hot Experts Runtime Foundation

## Purpose

This document fixes the current foundation for all expert-selection research lines.

The goal is not to restate MoE theory in general, but to pin down:

1. what `ik_llama` already does today for huge MoE
2. where the bottlenecks really are
3. what a new expert-selection idea must improve

## Current problem statement

For huge swap-bound MoE such as `MiniMax`, the main pain is usually not:

- the raw cost of router math

The main pain is:

1. reaching the chosen expert weights
2. page churn and working-set instability
3. deciding which expert subset is worth keeping hotter after prompt

That is why the current line of work is framed as:

- `expert locality`
- `hot experts`
- `prompt -> early decode prediction`

and not as a generic "make the router faster" project.

## What the current runtime already does

### 1. Swap-bound expert prefetch

Current code enables VM prefetch for swap-bound MoE:

- `src/llama.cpp:1691`
- `src/llama.cpp:1701`
- `src/llama.cpp:1712`

Meaning:

- runtime already tries to bring expert pages into RAM earlier
- this is a memory/locality optimization, not a model-quality change

### 2. Shared tensor locking

Current code explicitly keeps shared non-expert tensors hot:

- `src/llama.cpp:2703`
- `src/llama.cpp:2716`

Meaning:

- attention/router/shared path should stay resident
- expert weights are the swap-bound bulk

### 3. Hot expert tracking

Current hot-expert state and logic:

- `src/llama.cpp:2132`
- `src/llama.cpp:2141`
- `src/llama.cpp:2151`
- `src/llama.cpp:2282`
- `src/llama.cpp:4658`

Meaning:

1. prompt-side expert usage is counted
2. hottest experts are sorted
3. top experts are locked once
4. no dynamic lock/unlock storm during decode

This is intentionally conservative:
- locking during decode is blocking and harmful
- one-shot commit after prompt is safer

### 4. Tail-window path

Current tail-window hooks:

- `src/llama.cpp:217`
- `src/llama.cpp:226`
- `src/llama.cpp:2809`
- `src/llama.cpp:4248`
- `src/llama.cpp:4304`

Meaning:

- runtime can switch hot-expert accumulation to the prompt tail
- today this path is MiniMax-first / MiniMax-only in practice

### 5. Telemetry already available

Current expert hit and layer-hit APIs:

- `ggml/src/ggml.c:289`
- `ggml/src/ggml.c:296`
- `ggml/src/ggml.c:331`
- `ggml/src/ggml.c:366`
- `ggml/src/ggml.c:372`

And logging path:

- `src/llama.cpp:2168`
- `src/llama.cpp:2194`
- `src/llama.cpp:2236`
- `src/llama.cpp:2324`

Meaning:

- we already have enough instrumentation to study:
  - top experts
  - layer x expert activity
  - locked vs unlocked share
  - prompt/decode differences

## What this means for future research

Any new expert-selection line should be judged against this baseline:

1. Does it improve prompt -> decode expert prediction?
2. Does it improve useful hot-set quality?
3. Does it reduce memory pain, not just change router behavior?
4. Does it avoid introducing a worse runtime overhead than the locality gain?

## Mainline research directions from this foundation

### A. Better hot-expert selection

Examples:

- full prompt
- tail window
- weighted tail
- prompt tail + early decode feedback

This is still the cleanest mainline direction.

### B. Better expert predictor

Examples:

- heuristic predictor
- auxiliary predictor
- two-stage shortlist

This is promising, but should remain research until it shows that:

1. predictor overhead is low
2. it improves useful hot-set quality
3. it does not degrade answer quality or reproducibility

### C. Prompt shaping for locality

Examples:

- prompt-tail rewrite
- controlled tail summary

This can help, but it is not a pure runtime optimization anymore.

It belongs to a secondary research line, not to the mainline runtime path.

## Practical conclusion

The next good ideas in this area should be framed as:

- "better hot-expert prediction for early decode locality"

not as:

- "replace the router"
- "search the whole model faster"

That framing is more accurate to the real bottleneck.
