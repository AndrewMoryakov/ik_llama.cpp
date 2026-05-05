# Eval Suite Results — Deep-Taper v4 — 2026-03-22

Model: MiniMax-M2.5-DeepTaper-v4.gguf (114 GiB, BPW 4.26)
Server: llama-server, c=4096, t=16, fa=1, rtr=off, ctk=q8_0, ctv=q8_0

## Results

| Test | Max | Score | Time | Notes |
|------|-----|-------|------|-------|
| 01. Reasoning (boxes) | 10 | 8 | 330s | Correct sequence, correct count (4), answer truncated at 1024 tokens |
| 02. Code (merge_intervals) | 10 | 9 | 410s | Correct algorithm, type hints, edge cases, truncated |
| 03. Bug finding | 10 | 7 | 351s | Found ZeroDivisionError + rank starting at 0, answer truncated |
| 04. JSON extraction | 10 | 9 | 284s | Valid JSON, all fields correct, revenue "руб" not "рублей" |
| 05. Math (trains) | 10 | 0 | 301s | **Empty response** — model generated 1024 tokens but content empty |
| 06. Summarization | 10 | 5 | 71s | 3 bullets OK, word count OK, but leaked chat template tokens |
| 07. Multilingual code | 10 | 9 | 443s | Code in English, explanations in Russian, retry+backoff correct |
| 08. Magic square | 10 | 10 | 375s | Correct solution (8,1,6/3,5,7/4,9,2), all sums verified |
| 09. SQL chain | 10 | 8 | 401s | All 6 steps, correct SQL, created 2 views instead of 1 combined |
| 10. Ambiguous query | 10 | 10 | 174s | Perfect: Python understood, concrete techniques, structured |
| 11. AIME math | 10 | 0 | 287s | **Empty response** |
| 12. CPU simulation | 10 | 7 | 434s | Correct final output (20,10,10), but SUB result wrong (10 instead of -10), JMP_GT correct |
| 13. Trick questions | 10 | 0 | 335s | **Empty response** |
| **TOTAL** | **130** | **72** | | |

## Analysis

### Empty responses (Tests 5, 11, 13)

Three tests returned empty content despite generating 1024 tokens each. The server shows `finish_reason: stop` and `completion_tokens: 1024`. Possible causes:
1. Model generates thinking/reasoning tokens that server filters
2. Encoding issue with generated content
3. Quantization artifact on reasoning-heavy prompts

These are all math/logic-heavy prompts. Simpler tasks (code, JSON, Python tips) work fine.

### Scoring notes

- **Test 01 (8/10)**: Correct logic but truncated at 1024 tokens — didn't show final answer clearly
- **Test 02 (9/10)**: Clean implementation, truncated before test output shown
- **Test 03 (7/10)**: Found 2 of 4 bugs in truncated response
- **Test 06 (5/10)**: Leaked `<|im_start|>` and `<|im_end|>` tokens — chat template contamination
- **Test 09 (8/10)**: Created two separate views instead of one combined view
- **Test 12 (7/10)**: SUB operation: model got 10 (first_popped - second_popped = 10 - 20 = -10, but model wrote 10). JMP_GT and final output correct despite this.

### Score distribution

- Perfect (10/10): Tests 8, 10
- Good (8-9/10): Tests 1, 2, 4, 7, 9
- Moderate (5-7/10): Tests 3, 6, 12
- Failed (0/10): Tests 5, 11, 13 (empty responses)

### Total: 72/130 (55%)

Interpretation: "Заметная деградация, но модель полезна" — consistent with PPL 9.42.

Without the 3 empty responses: 72/100 = 72% — "Хорошее качество, лёгкая деградация на сложных задачах".

## Comparison context

Expected for this model class:
- Top models (GPT-5, Claude Opus): 110-125 / 130
- MiniMax M2.5 BF16 (unquantized): 95-115 / 130
- Our quant (4.26 bpw from Q8_0): 72 / 130

The empty-response issue likely inflates the quality gap. If those 3 tests worked, the score would be higher.
