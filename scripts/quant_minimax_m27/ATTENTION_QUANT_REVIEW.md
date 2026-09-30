# MiniMax M2.7: attention weight quantization review (2026-09-23)

## Measured local facts

The ten original BF16 GGUF shards contain 809 tensors. The 248 Q/K/V/output
attention matrices occupy 5,460,983,808 bytes (5.086 GiB) in BF16. All 62
expert routers (`ffn_gate_inp`) are F32 and occupy 195,035,136 bytes
(0.182 GiB). Norms and expert-probability biases are also F32. Thus the
current four M2.7 recipes **do not quantize routers**.

| Current GGUF | Attention payload | If all attention is Q8_0 | If all attention is BF16 |
|---|---:|---:|---:|
| Core IQ1_S, 48 GiB | 1.396 GiB | +1.306 GiB | +3.690 GiB |
| Other three recipes, 74/81/88 GiB | 1.885 GiB | +0.817 GiB | +3.201 GiB |

These are tensor-payload deltas computed from GGUF block sizes, not measured
finished-file sizes; metadata and alignment may add a small amount. The
current 74/81/88 GiB recipes use IQ5_K for Q, Q8_0 for K/V, and Q5_K for
attention output. The 48 GiB recipe uses Q4_K for Q/K, IQ4_K for V, and
IQ4_XS for attention output. All quantized GGUF headers were checked.

The local Wikitext-2 PPL runs do not isolate attention: the recipes also
change expert precision. They cover only 32-96 chunks at context 512. This
cannot establish long-context retrieval or instruction-following quality.
The 81 GiB model's first 32-chunk PPL run was an unexplained outlier; see the
recipe README. Do not rank attention formats from those results.

## What the literature establishes

- GPTQ (Frantar et al., 2023, https://arxiv.org/abs/2210.17323) shows that
  3-4-bit weight quantization can preserve aggregate quality on studied dense
  transformer models. It does not prove MiniMax M2.7 attention is safe at
  4 bits, and GPTQ's calibration is not identical to the GGUF imatrix recipe.
- AWQ (Lin et al., MLSys 2024, https://arxiv.org/abs/2306.00978) finds that
  a small set of activation-salient weight channels drives much of the
  quantization error. This supports calibration and selective protection, not
  a uniform rule that all attention must be BF16.
- APTQ (Guan et al., DAC 2024, https://arxiv.org/abs/2402.14866) explicitly
  includes the nonlinear attention output when assessing sensitivity. Its
  LLaMA-7B C4 ablation reports PPL 5.54 vs 5.84 at 3.5 average bits and
  6.24 vs 7.04 at 3.0 average bits for its sensitivity allocation versus a
  manual block allocation. This demonstrates that *where* bits are assigned
  matters; it does not provide a per-tensor optimum for this MoE model.
- SliM-LLM (Huang et al., 2024, https://arxiv.org/abs/2405.14917) likewise
  uses group-wise salience-based mixed precision. Its results reinforce the
  need to measure sensitivity within a model rather than assuming all layers
  of the same type need the same bit width.

Quantizing Q/K changes attention logits and softmax probabilities; quantizing
V/output changes the information propagated through every layer. Small
single-layer errors may compound, and long-context retrieval may expose
issues that short perplexity misses. These are mechanisms and test targets,
not measured quality regressions for M2.7. Weight quantization here is
separate from KV-cache quantization and runtime Flash Attention precision.

## Decision and controlled test

Keep routers and norms in F32. Do not spend the 2.384 GiB difference between
Q8_0 and BF16 attention before measuring it. For the 74 GiB expert recipe,
produce attention-only variants at current precision, all-Q8_0, and BF16;
hold source BF16 shards, imatrix, expert rules, embedding/output types,
quantizer binary, and benchmark settings fixed. Prefer generating from BF16
for each variant rather than requantizing an existing GGUF.

First run identical full-corpus perplexity and repeat a short prefix to check
stability. Then run long-context retrieval and a fixed set of generation
prompts, with identical runtime settings. If Q8_0 and BF16 are indistinguishable
on these tests, keep Q8_0 for the extra 2.384 GiB headroom. If current mixed
attention and Q8_0 are indistinguishable, keep the current recipe. Reserve
BF16 for a reproducible gain large enough to justify the RAM cost. The compact
48 GiB recipe needs its own test because its attention precision is lower.
