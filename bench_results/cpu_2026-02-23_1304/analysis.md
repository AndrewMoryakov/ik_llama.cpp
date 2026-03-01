> Historical run archive notice:
> This file belongs to an archived benchmark run and may contain conclusions that are outdated.
> Current source of truth:
> - `../../../project_docs/benchmarks/current/SUMMARY_CURRENT_2026-02-26.md`
> - `../../../project_docs/benchmarks/SUMMARY_ALL.md`
> - `../../../project_docs/benchmarks/INDEX.md`
# CPU Topology Benchmark Analysis (commit bd387a279)

- **Date:** 2026-02-23
- **CPU:** AMD Ryzen 9 7950X 16-Core (Zen 4, 2 CCD × 8 cores × 2 SMT = 32 logical)
- **OS:** Windows 11 Pro
- **Build:** MSVC 2022, AVX-512, Release
- **Reps:** 2
- **Total time:** 14 min
- **Tests:** 48 (all completed)

---

## Configs (best per model from baseline)

| Model | fa | muge | rtr |
|-------|----|------|-----|
| gpt-oss-20b MXFP4 | 1 | 1 | 1 |
| Qwen3-30B-A3B Q4_K_M | 1 | 0 | 1 |
| Llama-3.1-8B Q8_0 | 1 | 0 | 1 |

---

## 1. CCD Affinity (t=16, PP512 + TG128)

Affinity masks: CCD0 = 0xFFFF (logical 0-15), CCD1 = 0xFFFF0000 (logical 16-31).

### PP512

| Model | no-pin | ccd0 | Δ | ccd1 | Δ |
|-------|--------|------|---|------|---|
| gpt-oss-20b | 268.7 (σ37) | 247.3 (σ36) | **-8%** | 260.5 (σ48) | -3% |
| Qwen3-30B-A3B | 307.5 (σ0.6) | 289.3 (σ0.6) | **-6%** | 306.8 (σ0.1) | 0% |
| Llama-3.1-8B | 165.4 (σ6.4) | 156.7 (σ2.4) | **-5%** | 165.6 (σ5.4) | 0% |

### TG128

| Model | no-pin | ccd0 | Δ | ccd1 | Δ |
|-------|--------|------|---|------|---|
| gpt-oss-20b | 23.3 (σ1.4) | 20.8 (σ1.2) | **-11%** | 23.4 (σ1.2) | 0% |
| Qwen3-30B-A3B | 29.3 (σ0.0) | 28.4 (σ0.1) | **-3%** | 29.3 (σ0.0) | 0% |
| Llama-3.1-8B | 8.2 (σ0.1) | 7.7 (σ0.02) | **-6%** | 8.4 (σ0.08) | +2% |

### CCD Affinity Conclusions

1. **CCD0 pinning HURTS** — PP: -5 to -8%, TG: -3 to -11%. At t=16 with SMT, all 16 threads compete for one L3 cache (32 MB). Cross-CCD traffic is cheaper than L3 contention.
2. **CCD1 ≈ no-pin** — identical performance. Suggests Windows scheduler at t=16 already favors one CCD (likely CCD1 or distributes well enough).
3. **stddev NOT improved by pinning** — CCD0: σ36 (gpt-oss PP), no-pin: σ37. Pinning doesn't stabilize results.
4. **Recommendation: no affinity pinning at t=16.** OS scheduler handles it well. Forced pinning to one CCD is counterproductive due to L3 pressure.

### Why CCD0 is worse than CCD1

Possible explanations:
- CCD0 hosts the OS/kernel threads → more interference
- Memory controller affinity may favor CCD1 channels
- Windows scheduler already learned to prefer CCD1 for compute

---

## 2. Prompt Length Scaling (t=16, no pin)

| PP length | gpt-oss-20b | σ | Qwen3-30B-A3B | σ | Llama-3.1-8B | σ |
|-----------|-------------|---|---------------|---|--------------|---|
| 128 | 178.3 | 71.1 | 287.1 | 8.6 | 152.6 | 21.1 |
| 256 | 217.0 | 67.8 | **310.1** | 1.8 | 163.2 | 8.9 |
| 512 | 257.2 | 53.5 | 306.9 | 1.5 | **166.3** | 3.7 |
| 1024 | **268.7** | 25.3 | 284.7 | 0.1 | 163.0 | 1.3 |
| 2048 | 264.8 | 12.4 | 246.9 | 0.5 | 154.0 | 0.7 |
| 4096 | 248.4 | 5.1 | 194.6 | 0.3 | 138.9 | 0.2 |

### Scaling Factor (normalized to pp512)

| PP length | gpt-oss | Qwen3 | Llama |
|-----------|---------|-------|-------|
| 128 | 0.69x | 0.94x | 0.92x |
| 256 | 0.84x | 1.01x | 0.98x |
| 512 | 1.00x | 1.00x | 1.00x |
| 1024 | 1.04x | 0.93x | 0.98x |
| 2048 | 1.03x | 0.80x | 0.93x |
| 4096 | 0.97x | **0.63x** | **0.83x** |

### Prompt Length Conclusions

1. **Peak throughput at pp256-512** for most models. Short enough for L3, long enough for SIMD/pipeline efficiency.
2. **Long context degradation is MODEL-DEPENDENT:**
   - gpt-oss: minimal loss (-3% at pp4096). Small active params → KV-cache fits in L3.
   - Llama: moderate loss (-17% at pp4096). Dense 8B reads more data.
   - **Qwen3: severe loss (-37% at pp4096).** Q4_K_M dequant + expert routing overhead scales poorly with context.
3. **stddev DECREASES with longer prompts** — gpt-oss: σ71 at pp128 → σ5 at pp4096. Longer batches amortize startup/scheduling variance.
4. **Short prompts (pp128) have high stddev** — measurement noise dominates when test runs <1 second.
5. **Practical implication:** For long-context use (4K+ tokens), Qwen3 loses its PP advantage over gpt-oss. At pp4096: gpt-oss 248 vs Qwen3 195. Model choice depends on expected prompt lengths.

---

## 3. SMT Analysis (CCD0 pinned)

Masks: nosmt = 0x5555 (even-bit logical), smt = 0xFFFF (all CCD0).

### Raw Results

| Model | Test | nosmt (t=8) | smt (t=16) | SMT gain |
|-------|------|-------------|------------|----------|
| gpt-oss-20b | PP512 | 78.8 (σ14.6) | 260.8 (σ33.0) | **+231%** |
| gpt-oss-20b | TG128 | 7.5 (σ0.1) | 21.5 (σ0.8) | **+187%** |
| Qwen3-30B-A3B | PP512 | 106.2 (σ2.7) | 288.6 (σ9.3) | **+172%** |
| Qwen3-30B-A3B | TG128 | 20.0 (σ0.06) | 28.3 (σ0.1) | **+42%** |
| Llama-3.1-8B | PP512 | 43.4 (σ0.6) | 160.6 (σ5.7) | **+270%** |
| Llama-3.1-8B | TG128 | 6.8 (σ0.08) | 7.7 (σ0.01) | **+13%** |

### Comparison with baseline t=8 (no affinity)

| Model | Test | nosmt t=8 (0x5555) | baseline t=8 (no pin) | Ratio |
|-------|------|--------------------|-----------------------|-------|
| gpt-oss-20b | PP512 | 78.8 | 173.7 | **0.45x** |
| gpt-oss-20b | TG128 | 7.5 | 19.2 | **0.39x** |
| Qwen3-30B-A3B | PP512 | 106.2 | 181.9 | **0.58x** |
| Qwen3-30B-A3B | TG128 | 20.0 | 27.8 | **0.72x** |
| Llama-3.1-8B | PP512 | 43.4 | 99.3 | **0.44x** |
| Llama-3.1-8B | TG128 | 6.8 | 7.5 | **0.91x** |

### SMT Conclusions (UPDATED — corrected with topology discovery)

**Actual topology confirmed via GetLogicalProcessorInformation:**
```
Core N → logical [2N, 2N+1]  (SMT pair is adjacent)
CCD0: cores 0-7  → logical 0-15
CCD1: cores 8-15 → logical 16-31
NUMA: single node (mask 0xFFFFFFFF)
```

The mask 0x5555 IS correct (selects logical 0,2,4,6,8,10,12,14 = one thread per CCD0 core). The initial performance deficit vs baseline t=8 was caused by **CCD0 pinning itself** — baseline t=8 without affinity uses BOTH CCDs (confirmed by affinity quick test).

### Follow-up: Clean SMT Comparison (CCD0 pinned, reps=3)

**Three configs on CCD0 only:**

| Config | Cores | Threads/Core | Mask | Total threads |
|--------|-------|-------------|------|---------------|
| 8t-nosmt | 8 (CCD0) | 1 | 0x5555 | 8 |
| 8t-4core-smt | 4 (CCD0 half) | 2 | 0x00FF | 8 |
| 16t-smt | 8 (CCD0) | 2 | 0xFFFF | 16 |

#### PP512 Results

| Config | gpt-oss-20b | Qwen3-30B-A3B | Llama-3.1-8B |
|--------|-------------|---------------|--------------|
| 8t-nosmt | 110.9 (σ25) | 85.4 (σ8.6) | 51.6 (σ10.2) |
| 8t-4core-smt | 90.7 (σ3.5) | 96.0 (σ9.4) | 53.0 (σ1.7) |
| 16t-smt | 250.9 (σ37) | 278.7 (σ5.8) | 164.6 (σ1.3) |

#### TG128 Results

| Config | gpt-oss-20b | Qwen3-30B-A3B | Llama-3.1-8B |
|--------|-------------|---------------|--------------|
| 8t-nosmt | 7.1 (σ0.3) | 22.8 (σ0.5) | 6.4 (σ0.5) |
| 8t-4core-smt | 13.5 (σ1.0) | 25.0 (σ0.8) | 7.4 (σ0.05) |
| 16t-smt | 21.0 (σ1.1) | 28.1 (σ0.1) | 7.6 (σ0.06) |

#### SMT Impact Analysis

**8t-nosmt vs 8t-4core-smt (same 8 threads, different core layout):**

| Model | PP delta | TG delta | Interpretation |
|-------|----------|----------|----------------|
| gpt-oss-20b | **-18%** | **+90%** | TG hugely benefits from SMT (latency hiding). PP prefers more cores over SMT. |
| Qwen3-30B-A3B | **+12%** | **+10%** | SMT helps both PP and TG slightly for MoE. |
| Llama-3.1-8B | +3% | **+16%** | TG benefits from SMT; PP roughly equal. |

**Key insight: SMT is critical for TG** — a second thread per core hides memory latency during sequential weight reads. For PP, having more physical cores matters more than SMT.

**8t-nosmt vs 16t-smt (double cores AND SMT):**

| Model | PP delta | TG delta |
|-------|----------|----------|
| gpt-oss-20b | +126% | +196% |
| Qwen3-30B-A3B | +226% | +23% |
| Llama-3.1-8B | +219% | +19% |

**Why baseline t=8 (no pin) is faster than 8t-nosmt (CCD0 pin):**

Baseline t=8 no-pin: gpt-oss 170.9, Qwen3 181.9, Llama 99.3
8t-nosmt CCD0 pin:   gpt-oss 110.9, Qwen3 85.4,  Llama 51.6

Without affinity, Windows distributes 8 threads across **both CCDs**, giving access to 64 MB L3 (2×32MB). With CCD0 pinning, only 32 MB L3 available. The **L3 cache capacity** is the dominant factor, not core count.

### Affinity Quick Test Summary (gpt-oss-20b PP512)

| Config | t | Mask | t/s | vs no-pin |
|--------|---|------|-----|-----------|
| no-pin | 8 | — | 170.9 | baseline |
| ccd0-nosmt | 8 | 0x5555 | 106.7 | -38% |
| 4core-smt | 8 | 0x00FF | 99.5 | -42% |
| both-ccd-nosmt | 8 | 0x55555555 | 110.6 | -35% |
| no-pin | 16 | — | 260.4 | baseline |
| ccd0-smt | 16 | 0xFFFF | 232.8 | -11% |
| both-ccd-nosmt | 16 | 0x55555555 | **54.9** | **-79%** |

**16t both-ccd-nosmt catastrophe (54.9 t/s):** 16 threads on 16 physical cores without SMT. Each core runs one thread, but cross-CCD synchronization without SMT latency hiding destroys performance. AVX-512 pipeline stalls are not hidden.

---

## Combined Recommendations

### Optimal Runtime Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Threads** | 16 | Best TG, good PP, proven in thread scaling tests |
| **Affinity** | None | OS scheduler distributes across both CCDs optimally |
| **SMT** | On (default) | Critical for TG latency hiding; removing SMT is catastrophic |
| **KV-cache** | q8_0 | No speed loss, saves memory (from adv_ tests) |
| **Prompt batching** | ≤1024 tokens | Beyond this, PP throughput drops (especially Qwen3) |

### Key Architecture Insights

1. **L3 cache is king:** Access to both L3 caches (64 MB total) matters more than core locality. Never pin to single CCD.
2. **SMT is essential for inference:** Hides memory latency during weight reads. Disabling SMT = -35 to -79% performance.
3. **OS scheduler is surprisingly good:** At t=8 and t=16, Windows distributes threads near-optimally across CCDs.
4. **Affinity pinning is always worse or equal** on this hardware/OS combination.

### For Future Optimization Work

1. **Don't pursue OS-level affinity pinning** — it's counterproductive on this hardware/OS combination.
2. **Focus on code-level optimizations** — expert prefetch (PR03), IQK kernels (PR09) will help more than scheduling tricks.
3. **Long context performance** — Qwen3 loses 37% at pp4096, investigate whether KV-cache layout or expert routing is the bottleneck.
4. **The high variance at t>16** from thread scaling tests is NOT fixable by affinity — root cause is likely in the thread synchronization code (barriers, atomics) rather than OS scheduling.
5. **NUMA pinning (PR06) should be deprioritized** — single NUMA node confirmed, CCD pinning hurts, OS scheduler is adequate.



