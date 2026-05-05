# Eval V4 Deep Comparison: MiniMax v4 vs Qwen3-42B

## Results

| Test | MiniMax v4 (114 GiB) | Qwen3-42B (22 GiB) | Winner |
|------|---------------------|---------------------|--------|
| V4-1: Domain expertise | 9/10 | 2/10 | **MiniMax** |
| V4-2: Debug distributed | 0/10 (timeout) | 3/10 | Qwen3 (attempted) |
| V4-3: Reverse engineer | 0/10 (timeout) | 2/10 | Qwen3 (attempted) |
| V4-4: Logical fallacies | 9/10 | 0/10 (500 error) | **MiniMax** |
| V4-5: Contradicting sources | 9/10 | 3/10 | **MiniMax** |
| V4-6: Self-verification | 10/10 | 5/10 | **MiniMax** |
| V4-7: Technical RFC | 9/10 | 0/10 | **MiniMax** |
| **TOTAL** | **46/70** | **15/70** | **MiniMax** |
| Without failures | **46/50** (92%) | **15/60** (25%) | |

## Qwen3 Problems

Qwen3-42B showed severe degradation on V4 tests:

1. **Garbage tokens**: Output filled with `ATK`, `泷`, URL-encoded strings (%20), random markers
2. **Thinking loop**: Model spends all 5000 tokens thinking but never reaches coherent answer
3. **Language confusion**: Switches between Russian, English, Chinese mid-sentence
4. **No </think> closure**: Thinking block never closes, so no clean answer extracted
5. **Server error**: V4-4 returned HTTP 500

Only V4-6 (self-verification) produced partially useful output — correct answer $63.75 was computed within the thinking stream.

## MiniMax Strengths on V4

1. **V4-1 Domain expertise (9/10)**: Accurate medical explanation (bradykinin/ACE), correct systems comparison (Lamport/Vector/HLC with table), valid hardware analysis (Neural Engine, UMA)
2. **V4-4 Logical fallacies (9/10)**: 5/6 fallacies identified with named types and tables
3. **V4-5 Contradicting sources (9/10)**: Balanced analysis with real examples (Shopify, Netflix, Amazon, Basecamp)
4. **V4-6 Self-verification (10/10)**: Perfect answer $63.75, every step verified with checkmarks, 100% confidence
5. **V4-7 Technical RFC (9/10)**: Complete RFC with Protobuf messages, two-phase migration, failure modes — highly specific and relevant to MoE inference

## MiniMax Weaknesses on V4

1. **Timeout on V4-2 and V4-3**: Connection pool debug and reverse engineering x^y timed out at 900s. Likely the same thinking-token issue that caused empty responses in V1/V2.

## Overall Comparison Across All Suites

| Suite | MiniMax v4 | Qwen3-42B | Difference |
|-------|-----------|-----------|------------|
| V2 (5 shared) | ~32/50 | ~33/50 | ≈ tie |
| V3 discriminator | **43/50** | 28/50 | +15 MiniMax |
| V4 deep | **46/70** | 15/70 | +31 MiniMax |
| **Grand total** | **121/170** | **76/170** | **+45 MiniMax** |

## Conclusion

On complex tasks requiring domain expertise, logical analysis, instruction following, and long coherent generation, MiniMax M2.5 (228B, 4.26 bpw) significantly outperforms Qwen3-42B (42B, 4.45 bpw). The advantage grows with task complexity.

Qwen3's thinking-model architecture becomes a liability at these token budgets — most output is consumed by internal reasoning that never resolves into a clean answer.

For practical CPU-only inference on 96 GB RAM:
- **Simple tasks (chat, basic code, Q&A)**: Qwen3-42B is 5x faster and comparable quality
- **Complex tasks (analysis, research, technical writing)**: MiniMax v4 is clearly superior despite 5x slower speed
