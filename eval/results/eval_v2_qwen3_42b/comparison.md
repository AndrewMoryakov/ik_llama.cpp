# Eval V2 Comparison: MiniMax v4 vs Qwen3-42B

## Models

| | MiniMax M2.5 Deep-Taper v4 | Qwen3-42B-A3B MXFP4 |
|---|---------------------------|---------------------|
| Size | 114 GiB | 22 GiB |
| BPW | 4.26 | 4.45 |
| Params | 228B (8 active) | 42B (3B active) |
| Speed | ~4 t/s (swap-bound) | ~20 t/s (in-RAM) |
| RAM usage | ~114 GiB (swap ~19 GiB) | ~22 GiB |
| Type | Standard | Thinking (reasoning) |

## Results (5 shared tests)

| Test | MiniMax v4 | Qwen3-42B | Notes |
|------|-----------|-----------|-------|
| V2-1 Business calc | 7/10 | ~8/10 | Qwen3: correct 1.1^6 step-by-step, proper ROI |
| V2-2 Cascade debug | 6/10 | ~7/10 | Both missed str==int as root cause, Qwen3 more thorough |
| V2-7 Caesar cipher | 10/10 | ~10/10 | Both perfect |
| V2-8 Ethics memo | 9/10 | ~8/10 | MiniMax: better memo format; Qwen3: more business-oriented |
| V2-11 Reverse engineer | 0/15 (empty) | ~10/15 | MiniMax: empty response; Qwen3: identified x^y correctly |
| **Time per test** | **~500s** | **~150s** | **3x faster** |

## Key Findings

### 1. Smaller model ≈ larger model on practical tasks
Qwen3-42B (22 GiB, 42B params) performs comparably to MiniMax v4 (114 GiB, 228B params) on code, analysis, and reasoning tasks.

### 2. Thinking model advantage on math/pattern tasks
Qwen3 (thinking model) successfully solved V2-11 (reverse engineering x^y) while MiniMax consistently fails on math-heavy tasks with empty responses.

### 3. Speed advantage is massive
Qwen3: ~20 t/s, MiniMax: ~4 t/s. Factor 5x. Combined with 3x faster test completion (due to in-RAM), practical throughput is ~5x higher.

### 4. Thinking tokens are expensive
Qwen3 generates 2000-4000 tokens per test, but ~60-80% are thinking tokens. Actual answer is only 20-40% of generated tokens. This is a hidden cost.

### 5. MiniMax empty response pattern
MiniMax M2.5 consistently returns empty content on:
- Pure math (V1 tests 5, 11, 13)
- Code-heavy recursive tasks (V1 test 3, V2 test 3)

This appears to be a model-level issue (thinking tokens filtered by server), not a quantization issue.

## Implications for quantization research

The comparison suggests that for practical use on 96 GB RAM:
- **Qwen3-42B** (22 GiB) is a better daily-driver: faster, comparable quality, no empty responses
- **MiniMax M2.5** (114-151 GiB) is for specialized use cases where 228B parameter knowledge is needed
- Our quantization research methodology (zone taper, budget redistribution) applies to any MoE model
