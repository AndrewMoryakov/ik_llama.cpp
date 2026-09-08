# Known Limits And Open Questions - 2026-03-06

Supersedes `KNOWN_LIMITS_AND_OPEN_QUESTIONS_2026-03-01.md`.

## Known Limits

1. No single strong architecture-specific public headline win (still true).
2. MiniMax M2.5 optimization is on hold — needs new locality hypothesis.
3. gpt-oss-20b decode-side path not yet started.
4. `-muge` flag crashes on gpt-oss-20b MXFP4 (pre-existing, cause unresolved).
5. Research-only paths remain useful internally but must not be confused with stable defaults.
6. Custom quantization work (Variants A-F) is a strategic direction, not a closed result.
7. evidence-layer.js not yet updated for gpt-oss-120b prompt-packed productization (pending).

## Open Questions

### 1. gpt-oss-20b Decode-Side Fast Path

Question:
- Can the next strong architecture-specific win come from gpt-oss-20b decode-side work?

Status: not started. Phase 4 territory.

### 2. gpt-oss-120b Final Runtime Package

Question:
- What is the final public huge-model package (rtr, startup-sensitive vs throughput-first, prompt-packed)?

Status: partially closed. prompt-packed back-half confirmed useful (medium confidence).
Needs: productization in evidence-layer.js / dashboard preset.

### 3. MiniMax Next Optimization Line

Question:
- After locality tail-window failed to become a baseline, what is the next real MiniMax win?
- Expert residency sorting? Smarter locality? Custom quantization (IQ3_M, ~81 GB)?

Status: on hold. Resume only with new hypothesis or dedicated benchmark window.

### 4. SER Practical Value For In-RAM Models

Question:
- `-ser 4,0.15` gives +48-65% TG on MiniMax swap-bound. What about gpt-oss-20b / Qwen3 in-RAM?

Status: not benchmarked. Estimated 5-15% for in-RAM. Quality trade-off unknown.

### 5. Public Release Freeze

Question:
- When should the private lab snapshot be packaged as a cleaner public fork?

Status: blocked on items 1-3 above.

### 6. muge Crash Root Cause

Question:
- Why does `-muge` crash on gpt-oss-20b MXFP4? Is it Large Pages + contiguous mmap incompatibility?

Status: diagnosed as pre-existing, not actively blocking. Low priority until needed.

## CLOSED Questions (previously open, now answered)

### MiniMax Policy (off vs auto)
CLOSED 2026-03-02:
- TG-only: rtr=off still leans better
- Mixed path: rtr=auto is now a real viable branch after the policy bug fix
- Do not reopen without a new hypothesis

### MiniMax Hot-Expert Budget Default
CLOSED 2026-03-01:
- Longer controlled run did not confirm 24/32 as a new default
- Legacy 16 remains the default; larger budgets are research-only

### Large Pages (PR14)
CLOSED 2026-03-06:
- SeLockMemoryPrivilege active, MEM_LARGE_PAGES works
- +0.8-3.5% across models — already included in current baseline

### Dashboard Modular Refactoring
CLOSED 2026-03-06:
- Phase A (115 tests) + Phase B (6 modules) complete
- dashboard.js: 4959 → 2604 lines

## Decision Rule

1. If the goal is the next practical engine win: gpt-oss-20b decode-side.
2. If the goal is documentation/productization: evidence-layer.js update for gpt-oss-120b.
3. If the goal is huge-model coverage: MiniMax needs new locality hypothesis first.
4. Keep public claims narrower than internal engineering reality.
