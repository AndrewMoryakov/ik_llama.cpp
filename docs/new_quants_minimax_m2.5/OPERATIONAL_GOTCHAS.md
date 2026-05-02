# Operational Gotchas — Lessons Learned

Practical problems encountered during MiniMax M2.5 quantization research. Save yourself hours of debugging.

---

## Model Loading & Inference

### 1. Default context kills swap-bound models
MiniMax M2.5 has `context_length=196608`. Without `-c`, KV cache = 25 GiB. On 95 GiB RAM with 90+ GiB model → OOM crash.
**Fix:** Always specify `-c 4096` or `-c 8192` for swap-bound models.

### 2. Dashboard auto-config may not set context
If user selects a preset but doesn't click auto-configure, `n_ctx` stays at 0 (default from model = 196K).
**Fix:** Added `n_ctx: 8192` to minimax presets in evidence-layer.js.

### 3. Live observability crashes swap-bound models
`pg-trace` and `hot-expert-trace` flags add memory overhead. Default `live_observability: true` in dashboard adds these to every launch.
**Fix:** Auto-disable `live_observability` for swap-bound models in dashboard-autoconfig.js.

### 4. llama-cli interactive mode crashes, server works
On this model, `-i -cnv` (interactive conversation) sometimes crashes while `llama-server` with the same parameters works fine. Cause unknown.
**Workaround:** Use llama-server mode from dashboard.

---

## Quantization

### 5. `--allow-requantize` required for Q8_0 source
When source is Q8_0 (not BF16), llama-quantize refuses by default with "requantizing from type q8_0 is disabled".
**Fix:** Always add `--allow-requantize` when source is Q8_0.

### 6. Base ftype applies to attention
When using `IQ3_KS` as base ftype with `--custom-q` for expert tensors only, attention tensors get quantized by the base ftype logic: `attn_q → iq3_ks`, `attn_output → q5_K`. This is NOT q8_0.
**Fix:** Explicitly set `--attn-q-type q8_0 --attn-k-type q8_0 --attn-v-type q8_0 --attn-output-type q8_0` (or desired type). Or accept the downgrade if budget redistribution is intended.

### 7. Imatrix format incompatibility
Unsloth's `imatrix_unsloth.gguf_file` uses non-standard format that ik_llama's `--imatrix` cannot read. ubergarm's `.dat` format works.
**Working source:** `huggingface.co/ubergarm/MiniMax-M2.5-GGUF` → `imatrix-MiniMax-M2.5-BF16.dat`

### 8. Imatrix from BF16 applied to Q8_0 may not help
Our imatrix was generated from BF16 weights, but we quantize from Q8_0. Weight distributions differ. The imatrix may assign importance incorrectly.
**Recommendation:** Generate own imatrix from the same source you quantize from, or accept potential mismatch.

---

## PPL Measurement

### 9. `llama-perplexity` with mmap segfaults on near-RAM models
Model 92 GiB on 95 GiB RAM: `llama-perplexity` with default mmap crashes during tensor loading (segfault).
**Fix:** Use `--no-mmap` for models < RAM. For models > RAM, mmap sometimes works (needs clean RAM state), sometimes doesn't.

### 10. `llama-perplexity` with `--no-mmap` fails on models > RAM
Model 114 GiB on 95 GiB RAM: `--no-mmap` tries to malloc 114 GiB → crash.
**Fix:** Use mmap (without `--no-mmap`), ensure nothing else uses RAM, try with small `--chunks` first.

### 11. PPL convergence requires 30+ chunks
8 chunks gave PPL 9.53 ± 0.66 (huge error bar). 552 chunks gave 9.70 ± 0.08. For reliable comparison, use 64+ chunks minimum.

### 12. PPL from Q8_0 source has hard ceiling ~9.4
Regardless of BPW (tested 3.46 to 4.26), PPL stays ~9.4-9.7 when source is Q8_0. Double quantization (BF16→Q8_0→IQ) compounds errors. Only BF16/FP8 source can break this ceiling.

---

## Benchmarking

### 13. Cold-start benchmarks lie for swap-bound models
`llama-bench` without warmup showed 0.02 t/s for 114 GiB model. Real interactive speed: ~4 t/s. First run loads pages from disk; subsequent runs use cached pages.
**Fix:** Always use `-w 1` (warmup) or discard first run.

### 14. Two concurrent eval scripts kill server
Running two eval scripts against one-slot server: first script gets results, second gets timeouts. All requests queue on single slot.
**Fix:** Run eval scripts strictly sequentially. Never run two against the same server.

---

## Thinking Models (Qwen3, etc.)

### 15. Empty responses from thinking models
Qwen3-type models generate `<think>...</think>` blocks. Server filters these from `content`, leaving empty string. Model generates 1000+ tokens but content = "".
**Fix:** Use `/completion` endpoint (not `/v1/chat/completions`) and extract answer after `</think>` manually. Or use `--reasoning-tokens none` and increase `max_tokens` to 4000+.

### 16. Thinking tokens consume budget
With max_tokens=1500, a thinking model may spend 1200 tokens on `<think>` and only 300 on actual answer. Complex tasks don't fit.
**Fix:** Set max_tokens=4000-5000 for thinking models.

---

## Dashboard

### 17. `--metrics` not enabled by default for server
Server's `/metrics` endpoint returns 501 unless `--metrics` flag is passed.
**Fix:** Added `--metrics` to dashboard command builder for server mode.

### 18. Pagefile is NOT the bottleneck for perplexity crashes
System had 246 GiB pagefile, but `llama-perplexity` still crashed on 114 GiB model. Issue is continuous buffer allocation, not pagefile size.

---

## Build

### 19. `build_now.bat` fails if llama-server is running
Link error `LNK1104: cannot open file llama.dll` — DLL locked by running server process.
**Fix:** Kill all llama processes before building. `wmic process where "name='llama-server.exe'" call terminate`

### 20. Building from bash doesn't work
NMake requires Visual Studio environment (vcvars64.bat). cmake from bash/PowerShell without vcvars fails.
**Fix:** Use `build_now.bat` (calls vcvars64.bat internally) or run from Developer Command Prompt.

---

## Data & Sources

### 21. Original MiniMax M2.5 is FP8, not BF16
HuggingFace `MiniMaxAI/MiniMax-M2.5` stores weights as F8_E4M3 with `weight_scale_inv`. Not pure BF16.
BF16 conversion available: `PrimeIntellect/MiniMax-M2.5-bf16` (619 GiB).

### 22. BF16 from PrimeIntellect is deq(FP8), not training weights
The chain is: training(BF16) → MiniMax(FP8) → PrimeIntellect(BF16 deq). Loss at FP8 step is not recovered. Still better than Q8_0 as source.

### 23. Q8_0 from Unsloth is already FP8→Q8_0
Our source is Unsloth Q8_0, which is FP8→Q8_0. We then do Q8_0→IQ = double quantization. This explains PPL ceiling.
