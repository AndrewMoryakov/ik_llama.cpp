# MiniMax M2.7 BF16 quantization on the 7950X

## Unsloth-compatible r2 (2026-09-23)

The r1 GGUF files below contain fork-local GGML types such as 139 and 156.
The installed Unsloth Studio server is byte-identical to
`D:\ik_llama-unsloth\build\bin\Release\llama-server.exe`, whose GGML type
range ends at 66. It rejects r1 during GGUF header parsing, before loading
weights. More RAM or changing only attention does not solve that error.

`prepare_unsloth_compatible.py` converts the r1 expert zone maps to types
accepted by that server: IQ3_KS -> IQ3_S, IQ5_K -> Q5_K; other expert types
are already supported. It creates exact per-tensor plans for the Unsloth
quantizer. All non-expert tensors retain their source precision: attention,
embedding and output are BF16; routers, norms and expert-probability biases
are F32. The `ram88` research profile keeps attention at Q8_0. Each r2 model
is quantized directly from the original ten-part BF16 GGUF and matching M2.7
imatrix with the **same binary family as the Unsloth server**. The installed
quantizer accepts `--tensor-type-file` (the primary fork's `--custom-q` syntax
is not portable to it).
The quantizer may print `invalid magic characters: '????'` while probing the
legacy imatrix file as GGUF; the following `loaded 496 importance matrix
entries` line confirms that it fell back to the correct imatrix format.

| r2 profile | Quantizer dry-run payload | GiB | Plan |
|---|---:|---:|---|
| `compact` | 54,703.72 MiB | 53.42 | compact expert map, BF16 service tensors |
| `balanced` | 81,505.72 MiB | 79.60 | balanced expert map, BF16 service tensors |
| `ram_safe` | 83,665.72 MiB | 81.70 | balanced map plus IQ3_XXS gate/up in layers 5–9, 52–56 |
| `ram81` | 90,919.72 MiB | 88.79 | research; inadequate no-mmap RAM headroom |
| `ram88` | 95,822.47 MiB | 93.58 | research; exceeds practical RAM target even with Q8_0 attention |

The table reports dry-run estimates. The three selected r2 outputs were
subsequently verified as follows (one GGUF per folder under
`E:\Lm Models\AndrewM\`):

| Profile | Actual GGUF | Unsloth server smoke test | Free physical RAM after load |
|---|---:|---|---:|
| `compact` | 53.43 GiB | `/health` OK, one token generated | ~30.8 GiB |
| `balanced` | 79.60 GiB | `/health` OK, one token generated | ~4.9 GiB |
| `ram_safe` | 81.72 GiB (87,738,154,912 bytes) | `/health` OK, one token generated | ~2.5 GiB |

The `ram_safe` test used the installed Unsloth Release `llama-server.exe` with
`-c 512 -ngl 0 -lm none --no-warmup --fit off`. Its 809 tensor headers and
payload length matched the exact plan; no tensor type exceeded the installed
server's supported range. The 2.5 GiB RAM margin is narrow and may change
with other applications or a larger context. The test server was stopped.

The existing 88.09 GiB r1
GGUF left only about 0.4 GiB free on a no-mmap load, so `ram81` and `ram88`
should not be treated as RAM-safe. Generate plans with
`python prepare_unsloth_compatible.py`; invoke `run_unsloth_compatible.ps1`
with `-Profile <name>` and optionally `-Estimate`. Verify completed GGUF
headers with `python verify_unsloth_compatible.py <profile> <gguf>` and test
loading with the Unsloth server before considering a profile complete.
The compact r2 no-mmap load used about 53.6 GiB of server working set; that
observation motivated reducing `ram_safe` from an initial 83.39 GiB estimate
to 81.70 GiB. These smoke tests establish format and runtime compatibility,
not relative model quality; r2 perplexity has not been measured.

The active fork is this repository (origin is AndrewMoryakov/ik_llama.cpp).
The parent project directory is a wrapper. The source is the ten-part BF16
GGUF under E:\Lm Models\unsloth\MiniMax-M2,7-BF16\. Pass its first shard as
Source. The matching imatrix is imatrix_minimax_m27_unsloth.dat in that folder
(496 entries, 81 calibration chunks).
Other M2.7 GGUF files in E:\Lm Models include an abliterated Q8_0 set; the
selected outputs use the original BF16 source to avoid changing the model and
introducing a second quantization step.

The three selected manifests use the M2.7 62-layer, 256-expert layout and
quantize directly from BF16. The M2.5 experiments showed that expert precision
dominates quantization loss; attention uses only a small fraction of the bytes.
The earlier M2.7 v4 quant in E:\Lm Models is 92.88 GiB, above the RAM target.

| Manifest | Intent | Expert layout |
|---|---|---|
| ram_81_bf16.json | 85–90 GB decimal RAM version | IQ5/IQ4 edges, IQ3_KS bridge/down, IQ2_XS core gate/up |
| balanced_74_bf16.json | Medium size | IQ5/IQ4 edges, IQ3 bridge/sensitive down, IQ2 core |
| compact_50_bf16.json | About 50 GB decimal | IQ3/IQ2 edges and bridge, IQ1_S core |

The compact recipe follows
the M2.5 Taper28 geometry. Its 1-bit core has a known quality cost on M2.5:
48.07 GiB and wikitext-2 PPL 13.98 from an already quantized source, versus
91 GiB and PPL 9.95 for TaperedRAM. M2.7 quality must be measured separately;
M2.5 PPL numbers are not comparable across model versions.
The relevant M2.5 evidence is
`docs/sessions/2026-09-08-upstream-merge/evidence-17-taperedram-requant-2026-09-11.md`
and `evidence-19-sub28-quant-experiment-2026-09-12.md` beside it. The
core `IQ1_S` choice in the compact profile is a size choice with a measured
M2.5 quality penalty, not an assumed M2.7 optimum.

The first high-quality M2.7 attempt, `ram_88_bf16.json`, produced a 94.58 GB
(88.09 GiB) GGUF. A `--no-mmap` load on this 95.09 GiB RAM machine reduced
available memory to about 0.4 GiB and the process working set was trimmed.
That file is retained as a research variant, not the recommended RAM profile.
It is in `E:\Lm Models\AndrewM\MiniMax-M2.7-CoreDown-IQ3_KS-GateUp-IQ3_XXS-88GiB-r1\`.
The interrupted Balanced 74 `.partial` file remains in `E:\Lm Models\` and
must not be loaded as a completed model.
The revised `ram_81_bf16.json` lowers only central expert gate/up tensors,
while preserving the higher precision of the expert down tensors.

Selected outputs are under `E:\Lm Models\AndrewM\`, one model per folder.

### Model names

Use `MiniMax-M2.7-<core-expert-quantization>-<rounded-size-GiB>-r<recipe-revision>`
for both folder and GGUF basename. Most expert layers are in the core, so its
quantization distinguishes the recipes in the filename. `Core-IQ1_S` means
all three expert tensors (down, gate, up) are IQ1_S. `CoreDown-IQ2_S-GateUp-IQ2_XS`
means the core expert down tensors are IQ2_S and gate/up are IQ2_XS. The same
rule applies to the two IQ3_KS core variants. The size is the completed GGUF
rounded to whole GiB, not a RAM requirement. `r1` identifies this first set
of local recipe revisions. Names do not imply a measured response-quality rank.

The full layer map is below. Each pair is **expert down / expert gate and up**;
attention and non-expert tensor types are in the recipe JSON.

| Internal recipe | Edge (0–1, 60–61) | Bridge | Sensitive | Core |
|---|---|---|---|---|
| `compact_50_bf16.json` | IQ3_KS / IQ2_S | IQ2_S / IQ2_XS (2–5, 56–59) | — | IQ1_S / IQ1_S (6–55) |
| `balanced_74_bf16.json` | IQ5_K / IQ4_XS | IQ4_XS / IQ3_KS (2–4, 57–59) | IQ3_KS / IQ2_XS (5–13, 48–56) | IQ2_S / IQ2_XS (14–47) |
| `ram_81_bf16.json` | IQ5_K / IQ4_XS | IQ3_KS / IQ3_KS (2–4, 57–59) | IQ3_KS / IQ3_KS (5–13, 48–56) | IQ3_KS / IQ2_XS (14–47) |
| `ram_88_bf16.json` | IQ5_K / IQ4_XS | IQ3_KS / IQ3_KS (2–4, 57–59) | IQ3_KS / IQ3_KS (5–13, 48–56) | IQ3_KS / IQ3_XXS (14–47) |

All four were quantized from the original BF16 GGUF with its matching M2.7
imatrix. This provenance lives in the recipe and here, rather than in the
filename: Unsloth Studio treats a GGUF basename ending in `-imatrix` as a
calibration matrix and hides the model. The original recipe filenames and IDs
remain stable for historical run records.

| Folder / GGUF | Bytes | GB decimal | GiB | Expert tensor check |
|---|---:|---:|---:|---|
| `MiniMax-M2.7-Core-IQ1_S-48GiB-r1/MiniMax-M2.7-Core-IQ1_S-48GiB-r1.gguf` | 51,457,564,576 | 51.46 | 47.92 | 186/186 match |
| `MiniMax-M2.7-CoreDown-IQ2_S-GateUp-IQ2_XS-74GiB-r1/MiniMax-M2.7-CoreDown-IQ2_S-GateUp-IQ2_XS-74GiB-r1.gguf` | 79,788,654,496 | 79.79 | 74.31 | 186/186 match |
| `MiniMax-M2.7-CoreDown-IQ3_KS-GateUp-IQ2_XS-81GiB-r1/MiniMax-M2.7-CoreDown-IQ3_KS-GateUp-IQ2_XS-81GiB-r1.gguf` | 86,882,271,136 | 86.88 | 80.92 | 186/186 match |
| `MiniMax-M2.7-CoreDown-IQ3_KS-GateUp-IQ3_XXS-88GiB-r1/MiniMax-M2.7-CoreDown-IQ3_KS-GateUp-IQ3_XXS-88GiB-r1.gguf` | 94,583,013,280 | 94.58 | 88.09 | 186/186 match |

Run run_recipe.ps1 with Source, Output, Imatrix and Recipe parameters. For
example, set Recipe to recipes\ram_81_bf16.json and Output to
E:\Lm Models\AndrewM\MiniMax-M2.7-CoreDown-IQ3_KS-GateUp-IQ2_XS-81GiB-r1\MiniMax-M2.7-CoreDown-IQ3_KS-GateUp-IQ2_XS-81GiB-r1.gguf. The default quantizer is
D:\build-zen4\bin\llama-quantize.exe. DryRun prints the command without
loading the model. Estimate invokes the quantizer's dry-run mode and scans
the whole source without writing GGUF output.

After completion, run verify_quant_recipe.ps1 with Model and the same Recipe.
The verifier checks tensor types, not semantic quality. Test loading and
generation before relying on a quant.

## Validation on this machine (2026-09-23)

The clean CPU Release build in `E:\ik-llama-m27-gate-build` completed all
304 Ninja steps with AVX-512, VBMI, VNNI and BF16 enabled. `llama-cli --help`
listed `-rtr`, `-rtra`, `--defer-experts`, `--moe-trace` and `--token-timing`.
A small-model generation smoke test exited successfully and printed
`HAVE_FANCY_SIMD is defined`. `ctest` passed 28/31 tests after clearing the
machine-wide `IK_LLAMA_IGNORE_UNKNOWN_ARGS=1`; the remaining BGE tokenizer,
chat-template and eval-callback failures match the committed upstream reference
logs in `docs/rtr-handoff/`. With that environment variable set, one extra
CLI-parser test fails because unknown flags are intentionally tolerated.

For quality, `run_ppl_all.ps1` uses the same wikitext-2 raw test corpus,
context 512 and first 32 chunks for all three selected files. This is a
relative comparison, not a full-corpus quality claim. It uses `--no-mmap`:
an older MiniMax M2.5 perplexity run crashed with mmap on this machine.

| Profile | First 32 chunks PPL | First 64 chunks PPL | First 96 chunks PPL (lower is better) |
|---|---:|---:|---:|
| Compact 50 | 10.4715 ± 0.3348 | not run | not run |
| Balanced 74 | 7.8732 ± 0.2466 | 9.0137 ± 0.2017 | 9.1210 ± 0.1663 |
| RAM 81 | 8.6498 ± 0.3004 | 8.5957 ± 0.1937 | 8.7296 ± 0.1606 |

The RAM 81 model's first 32 chunks did **not** reproduce: its cumulative PPL
at chunk 32 was 8.6498 in the 32-chunk run, then 7.3798 and 7.3744 within
the 64- and 96-chunk runs. At chunk 64, the latter two runs gave 8.5957 and
8.5905. Balanced 74 varied only by about 0.02 on the same prefixes. All runs
used the same source, imatrix, binary and PPL settings. The first RAM 81 run
was an outlier whose cause is not established. On the longer runs RAM 81 has
lower PPL than Balanced 74, but 96 chunks are still only a subset of the test
corpus, and the recipe changes several zones together. These comparisons do
not isolate which tensor group caused the difference.

**Recommendation:** Balanced 74 is the default tradeoff: 7.09 GB smaller than
RAM 81, about 12 GiB free after loading, and stable repeated PPL prefixes.
RAM 81 is the higher-precision option at the requested 85–90 GB size; it fits
without mmap (about 5.5 GiB free at full load), but its initial PPL outlier
means the measured quality edge should be treated cautiously. Compact 50 is
for maximum space savings with a substantial quality cost on the matched
32-chunk test.

Windows System logged an unexpected shutdown at 00:57 and a boot at 01:08
on 2026-09-23, before the completed Balanced and RAM 81 outputs. Kernel-Power
41 has BugcheckCode 0; no WHEA event or minidump was found. The cause cannot
be determined from these logs. The three selected GGUF files and all reported
PPL results were completed after the boot. No further heavy load test was run
after the user reported the reboot.
