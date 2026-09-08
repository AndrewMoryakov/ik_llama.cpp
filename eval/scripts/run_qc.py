"""Quality Control benchmark for MiniMax M2.5 quantization.
9 tests with partial auto-scoring. Run after each new quant to detect degradation.

Usage:
    python scripts/run_qc.py
    EVAL_API_BASE=http://127.0.0.1:8080 EVAL_OUT=bench_results/qc_v4 python scripts/run_qc.py
    EVAL_USE_COMPLETION=1 python scripts/run_qc.py  # for thinking models
"""
import json, urllib.request, time, sys, os, re

API_BASE = os.environ.get("EVAL_API_BASE", "http://127.0.0.1:8080")
OUT_DIR = os.environ.get("EVAL_OUT", "bench_results/qc")
TIMEOUT = int(os.environ.get("EVAL_TIMEOUT", "900"))
MAX_TOKENS = int(os.environ.get("EVAL_MAX_TOKENS", "3000"))
USE_COMPLETION = os.environ.get("EVAL_USE_COMPLETION", "0") == "1"

os.makedirs(OUT_DIR, exist_ok=True)


def ask_chat(prompt, max_tokens):
    body = json.dumps({
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens, "temperature": 0.3,
    }).encode()
    req = urllib.request.Request(f"{API_BASE}/v1/chat/completions", body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read())
    return data["choices"][0]["message"]["content"], data.get("usage", {}).get("completion_tokens", 0)


def ask_completion(prompt, max_tokens):
    body = json.dumps({
        "prompt": f"<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n",
        "n_predict": max_tokens, "temperature": 0.3, "stop": ["<|im_end|>"],
    }).encode()
    req = urllib.request.Request(f"{API_BASE}/completion", body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read())
    raw = data.get("content", "")
    tokens = data.get("tokens_predicted", 0)
    if "</think>" in raw:
        return raw.split("</think>", 1)[1].strip(), tokens
    return raw, tokens


def ask(prompt, max_tokens=None):
    mt = max_tokens or MAX_TOKENS
    if USE_COMPLETION:
        return ask_completion(prompt, mt)
    return ask_chat(prompt, mt)


# ─── Auto-scoring helpers ───────────────────────────────────────

def score_qc1(answer):
    """Self-verification: correct answer is $63.75"""
    score = 0
    if "63.75" in answer or "63,75" in answer:
        score += 5  # correct answer
    if "600" in answer and "250" in answer and "150" in answer:
        score += 2  # correct quantities
    if "30" in answer and "18" in answer and "15" in answer:
        score += 1  # correct revenues (partial match)
    checks = answer.lower().count("✅") + answer.lower().count("correct") + answer.lower().count("verified") + answer.lower().count("✓")
    if checks >= 3:
        score += 2  # self-verification present
    return min(score, 10)


def score_qc2(answer):
    """Caesar cipher: SECRET MESSAGE and SBWKRQ"""
    score = 0
    upper = answer.upper()
    if "SECRET MESSAGE" in upper:
        score += 4
    elif "SECRET" in upper:
        score += 2
    if "SBWKRQ" in upper:
        score += 4
    elif "SBW" in upper:
        score += 2
    if "3" in answer and ("сдвиг" in answer.lower() or "shift" in answer.lower() or "caesar" in answer.lower()):
        score += 2  # identified algorithm
    return min(score, 10)


def score_qc4(answer):
    """JSON extraction: try to parse and check fields"""
    score = 0
    # Find JSON by matching first { to last }
    start = answer.find('{')
    end = answer.rfind('}')
    if start >= 0 and end > start:
        try:
            data = json.loads(answer[start:end + 1])
            score += 3  # valid JSON
            if str(data.get("company", "")) == "TechVision":
                score += 1
            if data.get("year") in (2024, "2024"):
                score += 1
            rev = data.get("revenue", {})
            if rev.get("growth_pct") in (23, 23.0, "23"):
                score += 1
            emp = data.get("employees", {})
            current = emp.get("current", 0)
            previous = emp.get("previous", 0)
            if int(current) == 1450 and int(previous) == 1200:
                score += 2
            ceo = str(data.get("ceo", ""))
            if "Petrov" in ceo or "Петров" in ceo or "Alexei" in ceo:
                score += 1
            markets = data.get("markets", [])
            if len(markets) == 3:
                score += 1
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    return min(score, 10)


def score_generic(answer, max_score=10):
    """Generic scoring: penalize empty, very short, or garbage answers"""
    if len(answer) < 10:
        return 0
    if len(answer) < 100:
        return 2
    # Check for garbage (repeated characters, URL encoding, etc.)
    garbage_indicators = ["ATK", "%20", "泷", "uxe marker"]
    garbage_count = sum(1 for g in garbage_indicators if g in answer)
    if garbage_count >= 2:
        return 1
    return -1  # needs manual scoring


# ─── Tests ──────────────────────────────────────────────────────

TESTS = [
    ("QC-1: Self-verification", "auto", """Solve this problem, then verify your own solution for errors.

Problem: A company sold 1000 units of product.
60% at $50 each, 25% at $75 each, the rest at $100 each.
What is the weighted average selling price?

Steps:
1. Solve the problem
2. List possible errors you might have made
3. Verify each computation step independently
4. Give your final answer with confidence level (%)"""),

    ("QC-2: Caesar cipher", "auto", """Here are 5 encoded messages and their decoded versions:

"KHOOR" → "HELLO"
"ZRUOG" → "WORLD"
"FDHVDU" → "CAESAR"
"FLSKHU" → "CIPHER"
"DWWDFN" → "ATTACK"

1. Identify the encryption algorithm
2. Decrypt: "VHFUHW PHVVDJH"
3. Encrypt: "PYTHON" """),

    ("QC-3: Logical fallacies", "manual", """Find the logical fallacy in EACH statement. Name the fallacy type and explain why the reasoning is flawed.

1. "Python is 100x slower than C, therefore you cannot build high-load systems in Python"
2. "GPT-4 passed the bar exam, therefore AI can replace lawyers"
3. "90% of employees are satisfied with their salary (internal anonymous survey), therefore salaries are fair"
4. "Google's quantum computer solved a problem in 200 seconds that would take a supercomputer 10,000 years — therefore quantum computers are 1.5 billion times faster"
5. "A startup grew 300% in one year. If you invest now, it will grow 2700% in 3 years"
6. "Studies show people who eat chocolate live longer. Therefore chocolate extends life" """),

    ("QC-4: JSON extraction", "auto", """Analyze this text and return the result strictly in JSON format:

"TechVision increased its revenue by 23% to 4.2 billion rubles in 2024.
Net profit was 890 million rubles, 15% more than the previous year.
The company grew from 1200 to 1450 employees. Key markets: Russia (65%),
Kazakhstan (20%), Uzbekistan (15%). CEO Alexei Petrov announced plans
to enter the Turkish market in 2025."

JSON format:
{"company":"","year":0,"revenue":{"value":0,"currency":"","growth_pct":0},"profit":{"value":0,"currency":"","growth_pct":0},"employees":{"current":0,"previous":0},"markets":[{"country":"","share_pct":0}],"ceo":"","plans":[""]}"""),

    ("QC-5: 10 constraints", "manual", """Write an email to a client. You MUST satisfy ALL 10 constraints simultaneously:

1. Exactly 5 paragraphs
2. First paragraph is a greeting, last is a call-to-action
3. Tone is professional but warm (not cold)
4. Mention a specific date: July 15
5. Include a metaphor about a bridge or journey
6. Do NOT use the word "but" anywhere
7. Each paragraph is exactly 2-3 sentences
8. Mention the product "CloudSync Pro"
9. Offer a 20% discount
10. End with a question

After the email, self-check all 10 constraints with checkmarks."""),

    ("QC-6: Domain expertise", "manual", """Answer three questions from different domains. Factual accuracy is critical — do not fabricate.

1. MEDICINE: How does the mechanism of action of ACE inhibitors (captopril) differ from angiotensin II receptor blockers (losartan)? Which is preferred when a patient develops dry cough?

2. DISTRIBUTED SYSTEMS: Explain the difference between Lamport timestamps, Vector clocks, and Hybrid Logical Clocks. Where is each used in real-world systems?

3. HARDWARE: Why are Apple M-series chips faster than x86 for ML inference at lower TDP? Give 3 specific architectural reasons."""),

    ("QC-7: Debug distributed (canary)", "manual", """Microservice system: API Gateway → Auth Service → User Service → PostgreSQL, API Gateway → Order Service → PostgreSQL (separate DB).

Production symptoms:
1. Every 2-3 hours, Order Service response time spikes to 5+ seconds (normally 200ms)
2. During spikes: Order Service CPU = 5%, Memory = 40% (stable)
3. PostgreSQL active connections grow from 20 to 100
4. Auth Service and User Service work normally
5. Restarting Order Service fixes the issue for 2-3 hours
6. Order Service logs: "Waiting for connection from pool" repeated hundreds of times

Determine:
1. Root cause
2. Why is it periodic (every 2-3 hours)?
3. Why does restart help?
4. How to fix without restarts?
5. How to prevent in the future?"""),

    ("QC-8: Code edge cases", "manual", """Write a Python function deep_equal(a, b) that compares two objects:
- dict: key order does not matter
- list: element order MATTERS
- float: compare with epsilon=1e-9
- None, bool, int, str: exact match (type must match too)
- Arbitrary nesting depth

Then predict the result for each case:
1. deep_equal({"a": 1, "b": 2}, {"b": 2, "a": 1})
2. deep_equal([1, 2], [2, 1])
3. deep_equal(0.1 + 0.2, 0.3)
4. deep_equal({"a": [1, {"b": None}]}, {"a": [1, {"b": None}]})
5. deep_equal(True, 1)"""),

    ("QC-9: Team analysis", "manual", """Three teams work on the same product. Quarterly metrics:

Alpha: 45 tasks completed, 12 production bugs, avg code review time 4h, turnover: 0
Beta: 78 tasks completed, 31 production bugs, avg code review time 45min, turnover: 2 out of 6 left
Gamma: 52 tasks completed, 8 production bugs, avg code review time 2.5h, turnover: 1 out of 5 left (the team lead)

1. Rank teams by effectiveness. Justify your ranking.
2. Which team creates the most technical debt? Why?
3. Which team has the highest risk for next quarter?
4. What would you recommend to each team?"""),
]


def main():
    results_file = os.path.join(OUT_DIR, "results.jsonl")
    scores = {}

    for name, score_mode, prompt in TESTS:
        print(f"\n{'='*60}", flush=True)
        print(f"{name}", flush=True)
        print(f"{'='*60}", flush=True)
        t0 = time.time()
        try:
            answer, tokens = ask(prompt)
            elapsed = time.time() - t0

            # Auto-score where possible
            auto_score = -1
            if score_mode == "auto":
                if "QC-1" in name:
                    auto_score = score_qc1(answer)
                elif "QC-2" in name:
                    auto_score = score_qc2(answer)
                elif "QC-4" in name:
                    auto_score = score_qc4(answer)

            score_str = f"AUTO: {auto_score}/10" if auto_score >= 0 else "MANUAL"
            print(f"Time: {elapsed:.1f}s | Tokens: {tokens} | {score_str}", flush=True)
            print(f"\n{answer[:1500]}", flush=True)

            scores[name] = auto_score
            with open(results_file, "a", encoding="utf-8") as f:
                f.write(json.dumps({
                    "test": name, "answer": answer, "tokens": tokens,
                    "elapsed": elapsed, "auto_score": auto_score,
                }, ensure_ascii=False) + "\n")

        except Exception as e:
            print(f"ERROR: {e}", flush=True)
            scores[name] = 0
            with open(results_file, "a", encoding="utf-8") as f:
                f.write(json.dumps({
                    "test": name, "answer": f"ERROR: {e}", "tokens": 0,
                    "elapsed": time.time() - t0, "auto_score": 0,
                }, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    # Summary
    print(f"\n{'='*60}")
    print("QC SUMMARY")
    print(f"{'='*60}")
    auto_total = 0
    auto_max = 0
    for name, score in scores.items():
        if score >= 0:
            print(f"  {name}: {score}/10 (auto)")
            auto_total += score
            auto_max += 10
        else:
            print(f"  {name}: MANUAL REVIEW NEEDED")
    if auto_max > 0:
        print(f"\n  Auto-scored: {auto_total}/{auto_max} ({100*auto_total/auto_max:.0f}%)")
    print(f"  Results: {results_file}")
    print(f"{'='*60}")

    # Write summary
    with open(os.path.join(OUT_DIR, "summary.txt"), "w") as f:
        f.write(f"QC Summary\n{'='*40}\n")
        for name, score in scores.items():
            f.write(f"{name}: {'MANUAL' if score < 0 else f'{score}/10'}\n")
        if auto_max > 0:
            f.write(f"\nAuto-scored: {auto_total}/{auto_max} ({100*auto_total/auto_max:.0f}%)\n")


if __name__ == "__main__":
    main()
