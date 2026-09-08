# Quick-start guide — i7-1360p / 16 GB laptop

Tested configuration: Intel Core i7-1360p (4P+8E cores, AVX-VNNI, no AVX-512),
16 GB DDR5, NVMe SSD, CPU-only (no discrete GPU).
Build branch: `feature/raptor-lake-laptop`.

---

## 1. Build

```
build_raptor_lake.bat
```

Requires Visual Studio 2022 Community at the default install path.
Build time: ~5–8 minutes (uses Ninja, `-j 8` parallelism).

Output binaries in `build\bin\`:
`llama-cli.exe`, `llama-server.exe`, `llama-bench.exe`, `llama-quantize.exe`

---

## 2. Run a model

```
build\bin\llama-cli.exe -m <model.gguf> -t 4 -fa 1 -rtr auto [your prompt flags]
```

**These three flags are settled and should always be set:**

| Flag | Value | Why |
|---|---|---|
| `-t` | `4` | P-cores only. All higher counts (8, 12, 16) are slower due to OpenMP sync overhead. |
| `-fa` | `1` | Flash attention. Always faster, no downside. |
| `-rtr` | `auto` | Let the policy decide: KEEP repack for small models (DRAM-bound, AVX-VNNI active), DISABLE for large MoE (disk-streaming). |

> **Do not use `-ctk q8_0`** — KV cache quantization is not supported in
> CPU-only builds and causes "failed to create context".

---

## 3. What fits in RAM

The `-rtr auto` policy uses **90% of total installed RAM (~14.1 GiB)** as
the threshold for MoE models. Dense models use an available-memory check.

| Model class | Typical size | `-rtr auto` decision | Notes |
|---|---|---|---|
| 7B Q4_K_M | ~4 GiB | **KEEP** (in-RAM) | Comfortable |
| 9B Q4_K_M | ~5.7 GiB | **KEEP** | GLM-Z1-9B measured |
| 14B dense Q4_K_M | ~8.4 GiB | **KEEP** | phi-4 measured |
| MoE ≤ 14 GiB | varies | **KEEP** | Borderline; check log |
| MoE > 14 GiB | 17–25 GiB | **DISABLE** (mmap) | Runs from disk |

When KEEP is active, AVX-VNNI repacking gives **+52% TG throughput** vs
a non-repacking build.

When DISABLE fires the log prints:
```
--run-time-repack auto: disabled (MoE model X GiB > 90% of RAM 15.7 GiB)
```
The model still loads and runs via mmap — just slower (disk-bound).

---

## 4. Measured performance

All numbers: `-t 4 -fa 1 -rtr 2` (or `rtr=auto` KEEP), build `bfff3fb7`.

| Model | Size | PP tok/s | TG tok/s | Notes |
|---|---|---|---|---|
| GLM-Z1-9B Q4_K_M | 5.73 GiB | 20.78 | 4.63 | In-RAM baseline |
| phi-4 Q4_K_M (14B) | 8.43 GiB | 10.36 | 1.59 | Dense 14B; thermal-limited |
| Qwen3-Coder-30B Q4_K_M | 17.35 GiB | — | ~1.7 | Disk-bound (NVMe cold) |
| Qwen3-42B MXFP4_MOE | 22.0 GiB | — | ~2.6 | Disk-bound (cache-warm) |
| ERNIE-4.5-21B Q8_K_XL | 24.8 GiB | — | ~1.2 | Disk-bound |

PP for disk-bound MoE at 512 tokens crashes (MoE virtual-memory prefetch
touches more RAM than available). Use short prompts with these models.

---

## 5. Thermal behaviour

The i7-1360p throttles sharply under sustained inference load.

- For interactive use: no issue — the chip boosts freely between turns.
- For benchmarking: use `-r 1` with a 30 s cooldown between models.
  With `-r 3`, a heavy model (14B+) averages 2–3× lower than its
  single-rep number.
- Do not run long multi-model bench suites back-to-back without cooldowns.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `failed to create context` | `-ctk q8_0` in CPU-only build | Remove `-ctk` flag |
| Very low TG (< 1 tok/s) | Thermal throttle | Wait 60 s, retry with `-r 1` |
| Model loads but TG slow | Large MoE, mmap active | Expected; check `--run-time-repack auto: disabled` in log |
| Thread count > 4 slower | OpenMP sync overhead on this chip | Keep `-t 4` |
| Access violation on PP with large MoE | MoE prefetch exceeds RAM | Use short prompts; PP512 bench not possible for >14 GiB MoE |
