# Eval Tests — Complete Reference

All prompts, expected answers, scoring criteria, and baseline scores.

---

## QC — Quality Control (9 tests, 100 points)

Run after each new quantization to detect degradation.
Script: `eval/scripts/run_qc.py`

### QC-1: Self-verification (10 pts, AUTO-SCORED)

**Prompt:** Solve: 1000 units sold — 60% at $50, 25% at $75, rest at $100. Weighted average price?
Then verify your own solution step by step.

**Expected answer:** $63.75

**Auto-scoring:**
- "63.75" found → +5
- Correct quantities (600, 250, 150) → +2
- Correct revenues (30000, 18750, 15000) → +1
- Self-verification markers (✅, correct, verified) ≥3 → +2

**Baseline v4:** 10/10

---

### QC-2: Caesar cipher (10 pts, AUTO-SCORED)

**Prompt:** Given 5 encoded→decoded examples (KHOOR→HELLO, etc.), identify algorithm, decrypt "VHFUHW PHVVDJH", encrypt "PYTHON".

**Expected answers:**
- Algorithm: Caesar cipher, shift +3
- Decrypt: SECRET MESSAGE
- Encrypt: SBWKRQ

**Auto-scoring:**
- "SECRET MESSAGE" → +4
- "SBWKRQ" → +4
- Algorithm identified (shift/caesar + "3") → +2

**Baseline v4:** 10/10

---

### QC-3: Logical fallacies (10 pts, MANUAL)

**Prompt:** Find logical fallacies in 6 statements (Python vs C, GPT-4 bar exam, salary survey, quantum computer, startup growth, chocolate longevity).

**Scoring:** Named fallacy type + explanation for each. 6/6 found = 10, 5/6 = 8, 4/6 = 6.

**Baseline v4:** 9/10 (5/6 in truncated response)

---

### QC-4: JSON extraction (10 pts, AUTO-SCORED)

**Prompt:** Extract structured data from a text about TechVision (revenue, profit, employees, markets, CEO) into JSON.

**Auto-scoring:**
- Valid JSON parses → +3
- company = "TechVision" → +1
- year = 2024 → +1
- revenue growth = 23% → +1
- employees 1200→1450 → +2
- CEO contains "Petrov" or "Alexei" → +1
- 3 markets → +1

**Baseline v4:** 9/10

---

### QC-5: 10 constraints email (10 pts, MANUAL)

**Prompt:** Write email with 10 simultaneous constraints (5 paragraphs, July 15, bridge metaphor, no "but", CloudSync Pro, 20% discount, end with question, etc.). Self-check.

**Scoring:** 1 point per constraint met. Binary check for each.

**Baseline v4:** 10/10

---

### QC-6: Domain expertise (10 pts, MANUAL)

**Prompt:** Three questions — medicine (ACE inhibitors vs ARBs), distributed systems (Lamport/Vector/HLC), hardware (Apple M-series vs x86 for ML).

**Scoring:**
- Medicine: mechanism correct + cough recommendation → 3
- Systems: all 3 clocks with real-world examples → 4
- Hardware: 3 architectural reasons → 3

**Baseline v4:** 9/10

---

### QC-7: Debug distributed system — canary (10 pts, MANUAL)

**Prompt:** Microservice system with Order Service degrading every 2-3 hours. Logs show "Waiting for connection from pool". CPU low, connections growing.

**Expected root cause:** Connection pool leak — connections not returned after errors/timeouts.

**Scoring:**
- Root cause (pool leak) → 3
- Why periodic (pool exhaustion time) → 2
- Why restart helps (pool reset) → 2
- Fix (finally block, connection timeout) → 2
- Prevention (monitoring, alerting) → 1

**Baseline v4:** timeout (canary — improvement = success)

---

### QC-8: Code edge cases (10 pts, MANUAL)

**Prompt:** Write deep_equal(a, b) function + predict 5 edge cases.

**Expected results:**
1. `{"a":1,"b":2}` vs `{"b":2,"a":1}` → **True**
2. `[1,2]` vs `[2,1]` → **False**
3. `0.1+0.2` vs `0.3` → **True** (epsilon)
4. Nested dict/list → **True**
5. `True` vs `1` → **False** (type must match)

**Scoring:**
- Working function → 4
- Cases 1-4 correct → 4 (1 each)
- Case 5 correct (True≠1) → 2

**Baseline v4:** ~6-7/10 expected (edge case on True vs 1)

---

### QC-9: Team analysis (10 pts, MANUAL)

**Prompt:** Three teams with metrics (tasks, bugs, review time, turnover). Rank, identify tech debt, highest risk, recommendations.

**Key insights:**
- Bug rates: Beta 40%, Alpha 27%, **Gamma 15%** (best quality)
- Tech debt: **Beta** (78 tasks, 31 bugs, 45min review = rubber stamping)
- Highest risk: **Gamma** (lost team lead = bus factor)

**Scoring:**
- Correct ranking with justification → 3
- Beta = most tech debt → 2
- Gamma = highest risk (team lead left) → 3
- Actionable recommendations → 2

**Baseline v4:** ~7-8/10 expected

---

## V3 — Discriminator Tests (5 tests, 50 points)

Designed to find differences between large (228B) and small (42B) MoE models.
Script: `eval/scripts/run_eval_v3_discriminator.py`

### V3-1: Deep knowledge (10 pts)
5 consensus algorithms besides Paxos/Raft with year, author, difference from Raft, real project.
**Baseline:** MiniMax 8/10, Qwen3 7/10

### V3-2: Chained code (10 pts)
flatten() + unflatten() + test_roundtrip() — three linked functions.
**Baseline:** MiniMax 7/10, Qwen3 6/10

### V3-3: Multilingual math (10 pts)
Solve shelf problem in 4 languages (Russian, English, Chinese, Arabic). Answer: 24, 12, 19.
**Baseline:** MiniMax 9/10, Qwen3 2/10

### V3-4: Stylistic analysis (10 pts)
Same author or different for formal vs colloquial texts on distributed systems. **Answer: different authors.**
**Baseline:** MiniMax 9/10, Qwen3 7/10

### V3-5: 10 constraints (10 pts)
Same as QC-5.
**Baseline:** MiniMax 10/10, Qwen3 6/10

---

## V4 — Deep Tests (7 tests, 70 points)

Focus: code, real problems, research, logic, rare knowledge.
Script: `eval/scripts/run_eval_v4_deep.py`

### V4-1: Domain expertise (10 pts)
Medicine + distributed systems + hardware. Same as QC-6.
**Baseline:** MiniMax 9/10, Qwen3 2/10

### V4-2: Debug distributed system (10 pts)
Same as QC-7. Connection pool leak diagnosis.
**Baseline:** MiniMax timeout, Qwen3 3/10

### V4-3: Reverse engineer x^y (10 pts)
Black box function, determine f(x,y) = x^y, compute f(7,3)=343, f(3,7)=2187, find pairs where f(x,y)=f(y,x): only (2,4)/(4,2).
**Baseline:** MiniMax timeout, Qwen3 2/10

### V4-4: Logical fallacies (10 pts)
Same as QC-3 (6 fallacies).
**Baseline:** MiniMax 9/10, Qwen3 0/10 (server error)

### V4-5: Contradicting sources (10 pts)
Microservices vs monolith analysis. Real examples: Netflix/Amazon vs Shopify/Basecamp.
**Baseline:** MiniMax 9/10, Qwen3 3/10

### V4-6: Self-verification (10 pts)
Same as QC-1 ($63.75).
**Baseline:** MiniMax 10/10, Qwen3 5/10

### V4-7: Technical RFC (10 pts)
RFC for hot expert migration in distributed MoE cluster. 500-700 words with Protobuf, algorithm, failure modes.
**Baseline:** MiniMax 9/10, Qwen3 0/10

---

## V2 — Advanced Tests (10 tests, 100 points)

Script: `eval/scripts/run_eval_suite_v2.py`

| # | Test | Points | Baseline v4 |
|---|------|--------|-------------|
| V2-1 | Business calc (compound growth ROI) | 10 | 7 |
| V2-2 | Cascade debug (5 bugs in CSV parser) | 10 | 6 |
| V2-3 | Recursive descent parser + trace | 10 | 0 (empty) |
| V2-4 | Counterfactual history (Rome) | 10 | 9 |
| V2-5 | LRU Cache + 5 unit tests | 10 | 7 |
| V2-6 | System analysis (Redis/Go/replicas) | 10 | 8 |
| V2-7 | Caesar cipher | 10 | 10 |
| V2-8 | Ethics memo (AI resume bias) | 10 | 9 |
| V2-9 | Multilingual generation (3 languages) | 10 | 6 |
| V2-10 | System design (10M DAU caching) | 10 | 8 |

---

## V1 — Basic Tests (13 tests, 130 points)

Script: `eval/scripts/run_eval_suite.py`

| # | Test | Points | Baseline v4 |
|---|------|--------|-------------|
| 01 | Reasoning (boxes with keys) | 10 | 8 |
| 02 | Code (merge_intervals) | 10 | 9 |
| 03 | Bug finding (process_data) | 10 | 7 |
| 04 | JSON extraction (TechVision) | 10 | 9 |
| 05 | Math (trains meeting) | 10 | 0 (empty) |
| 06 | Summarization (3 bullets ≤20 words) | 10 | 5 |
| 07 | Multilingual code (retry+backoff) | 10 | 9 |
| 08 | Magic square 3×3 | 10 | 10 |
| 09 | SQL chain (6 steps) | 10 | 8 |
| 10 | Ambiguous query ("python faster") | 10 | 10 |
| 11 | AIME math (a²+b²=a³) | 10 | 0 (empty) |
| 12 | CPU simulation (16 instructions) | 10 | 7 |
| 13 | Trick questions (7 riddles) | 10 | 0 (empty) |

---

## Cross-Model Comparison

### MiniMax M2.5 v4 (228B, 114 GiB) vs Qwen3-42B (42B, 22 GiB)

| Suite | MiniMax | Qwen3 | Winner |
|-------|---------|-------|--------|
| V2 (5 shared) | ~32/50 | ~33/50 | Tie |
| V3 (5 discriminator) | **43/50** | 28/50 | MiniMax +30% |
| V4 (7 deep) | **46/70** | 15/70 | MiniMax +207% |
| **Combined** | **121/170** | **76/170** | **MiniMax +59%** |

MiniMax advantages grow with task complexity. Superior on: multilingual, factual accuracy, instruction following, long coherent generation, domain expertise.

Qwen3 advantages: 5x faster, 5x smaller, comparable on simple tasks.
