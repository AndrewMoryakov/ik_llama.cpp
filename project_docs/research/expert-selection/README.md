## Expert Selection Research

This directory is the canonical place for research lines around expert choice, hot-expert locality, and prompt-to-expert prediction.

Use these documents in this order:

1. `HOT_EXPERTS_RUNTIME_FOUNDATION_2026-03-02.md`
- what the current runtime already does
- where the real bottlenecks are
- which code paths matter

2. `PROMPT_TAIL_REWRITE_2026-03-02.md`
- secondary research line
- use a small auxiliary model to rewrite or append a controlled prompt tail

3. `AUX_EXPERT_PREDICTOR_2026-03-02.md`
- secondary research line
- use a lightweight predictor for expert shortlist / prefetch / hot-set guidance

4. `NEXT_IDEAS_2026-03-02.md`
- prioritized list of the next plausible expert-selection ideas
- split into:
  - cheap
  - medium
  - ambitious
- includes a recommended next order

5. `../weighted-hot-experts/` (sibling directory)
- **first concrete implementation target** from NEXT_IDEAS Tier 1
- Soft Tail-Window Blend: scale early hits instead of zeroing
- detailed runtime analysis, implementation plan, benchmark plan
- status: plan ready, implementation not started (2026-03-06)

This directory is intentionally research-oriented:
- preserve failed ideas
- preserve speculative ideas
- preserve reasoning and search path

It is meant to survive into future writeups or public engineering notes.
