# ik_llama.cpp - Local Run Guide (Zen4)

Host target: Ryzen 9 7950X (16C/32T), 96 GB RAM
Updated: 2026-02-27

---

## 1. Core binaries

- `llama-cli.exe` - interactive generation
- `llama-server.exe` - HTTP/OpenAI-compatible API
- `llama-bench.exe` - performance benchmarks
- `llama-quantize.exe` - quantization / repack

---

## 2. Default runtime profile for this machine

Use this unless a test explicitly says otherwise:

- `-t 16`
- `-fa 1`
- `--run-time-repack auto`
- no CCD affinity pinning
- SMT enabled in BIOS/OS

Reason: current benchmark sets on this host show that:
- `t=16` is a safe general starting point
- `auto` is the best general `rtr` starting policy
- mixed path must be treated separately from TG-only

Important project scope note:

- this fork is optimized not only for models that fit in RAM
- one of the main goals is practical inference for huge MoE models that are larger than available RAM
- this is why swap-bound cases such as `MiniMax M2.5` matter so much in project decisions

---

## 3. Quick launch examples

If you want to use the local dashboard instead of building commands by hand, start here:

- `../tutorial/README.md`
- `../tutorial/START_HERE.md`
- `../tutorial/MINI_TUTORIAL.md`

### CLI

```bash
llama-cli.exe -m model.gguf -t 16 -c 8192 -fa 1 --run-time-repack auto --conversation
```

### Server

```bash
llama-server.exe -m model.gguf -t 16 -c 8192 -fa 1 --run-time-repack auto --port 8080
```

### Benchmark (PP and TG)

```bash
llama-bench.exe -m model.gguf -t 16 -fa 1 -rtr auto -p 512 -n 0 -r 3
llama-bench.exe -m model.gguf -t 16 -fa 1 -rtr auto -p 0 -n 128 -r 3
```

### Mixed prompt+generation path

```bash
llama-bench.exe -m model.gguf -t 16 -fa 1 -rtr auto -pg 512,128 -r 3
```

---

## 4. Model-specific runtime notes

### Qwen3-30B-A3B (Q4_K_M)

Recommended baseline:

```bash
llama-bench.exe -m <qwen.gguf> -t 16 -fa 1 -rtr auto -muge 0 -p 512 -n 0 -r 3
llama-bench.exe -m <qwen.gguf> -t 16 -fa 1 -rtr auto -muge 0 -p 0 -n 128 -r 3
llama-bench.exe -m <qwen.gguf> -t 16 -fa 1 -rtr auto -muge 0 -pg 512,128 -r 3
```

### gpt-oss-20b (MXFP4)

Recommended baseline:

```bash
llama-bench.exe -m <gptoss.gguf> -t 16 -fa 1 -rtr auto -p 512 -n 0 -r 3
llama-bench.exe -m <gptoss.gguf> -t 16 -fa 1 -rtr auto -p 0 -n 128 -r 3
llama-bench.exe -m <gptoss.gguf> -t 16 -fa 1 -rtr auto -pg 512,128 -r 3
```

### Very large swap-bound MoE

Always validate `off`, `on`, and `auto`:

```bash
llama-bench.exe -m <large.gguf> -t 16 -fa 1 -rtr off -p 0 -n 128 -r 1
llama-bench.exe -m <large.gguf> -t 16 -fa 1 -rtr on  -p 0 -n 128 -r 1
llama-bench.exe -m <large.gguf> -t 16 -fa 1 -rtr auto -p 0 -n 128 -r 1

llama-bench.exe -m <large.gguf> -t 16 -fa 1 -rtr off -pg 512,128 -r 1
llama-bench.exe -m <large.gguf> -t 16 -fa 1 -rtr on  -pg 512,128 -r 1
llama-bench.exe -m <large.gguf> -t 16 -fa 1 -rtr auto -pg 512,128 -r 1
```

Why:
- current data shows throughput often favors `auto/on`
- startup time can favor `off`

### MiniMax-M2.5 (historical local swap-bound case)

Use this as a cautious baseline until a fresh full rerun is completed:

```bash
llama-bench.exe -m <minimax.gguf> -t 16 -fa 1 -rtr off -p 0 -n 128 -r 1
llama-bench.exe -m <minimax.gguf> -t 16 -fa 1 -rtr on  -p 0 -n 128 -r 1
llama-bench.exe -m <minimax.gguf> -t 16 -fa 1 -rtr off -pg 512,128 -r 1
llama-bench.exe -m <minimax.gguf> -t 16 -fa 1 -rtr on  -pg 512,128 -r 1
```

Current practical interpretation:

- old blanket statement "`rtr` catastrophically hurts MiniMax" is outdated for TG-only on stored local results
- for mixed `pg512,128`, historical local results still favored `rtr off`
- do not copy `gpt-oss-120b` policy onto MiniMax without measuring
- MiniMax is one of the main huge-model targets of the fork, not a side case

Read this before making MiniMax claims:

- `../models/MINIMAX_M2_5_RUNTIME.md`

---

## 5. Quantization direction

- Support stays for UD-Q / IQ / Q.
- Active optimization focus is moving to custom quantization variants described in `../strategy/TASK.md`.
- For each new variant, benchmark: `tg32`, `tg128`, `pp512`, `pg512,128` under fixed profile `t16 fa1 ctk=q8_0`.

---

## 6. Read These Next

- `../tutorial/README.md`
- `../tutorial/START_HERE.md`
- `../tutorial/MINI_TUTORIAL.md`
- `../tutorial/PARAMETER_REFERENCE.md`
- `../tutorial/RECIPES_AND_ANTI_PATTERNS.md`
- `../release/README.md`
- `../release/CURRENT_STATUS_2026-02-28.md`
- `../release/VALIDATED_SCOPE_2026-02-28.md`
- `../release/STABLE_VS_EXPERIMENTAL_2026-02-28.md`
- `MOE_RUNTIME_PROFILES.md`
- `../benchmarks/RTR_POLICY.md`
- `../benchmarks/current/SUMMARY_CURRENT_2026-02-27.md`
- `../benchmarks/SUMMARY_ALL.md`
- `../benchmarks/INDEX.md`
- `../development/ARCHITECTURE_EXECUTION_MAPS_2026-02-28.md`
- `../development/MIXED_PATH_OPT_PLAN.md`
- `SPEED_OPTIMIZATION.md`
