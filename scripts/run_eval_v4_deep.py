"""Eval V4: Deep discriminator tests focused on code, real problems, research, logic, rare knowledge.
Supports both standard and thinking models."""
import json, urllib.request, time, sys, os

API_BASE = os.environ.get("EVAL_API_BASE", "http://127.0.0.1:8080")
OUT_DIR = os.environ.get("EVAL_OUT", "bench_results/eval_v4")
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
    return data["choices"][0]["message"]["content"], "", data.get("usage", {}).get("completion_tokens", 0)

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
        return raw.split("</think>", 1)[1].strip(), raw.split("</think>", 1)[0], tokens
    return raw, "", tokens

def ask(prompt, max_tokens=None):
    mt = max_tokens or MAX_TOKENS
    return ask_completion(prompt, mt) if USE_COMPLETION else ask_chat(prompt, mt)

TESTS = [
    ("V4-1: Domain expertise", """Answer three questions from different domains. Factual accuracy matters — do not make things up.

1. MEDICINE: What is the difference between the mechanism of action of ACE inhibitors (captopril) and angiotensin II receptor blockers (losartan)? Which one is preferable when a patient has a dry cough?

2. SYSTEMS: Explain the difference between Lamport timestamps, Vector clocks, and Hybrid Logical Clocks. Where is each used in real systems?

3. HARDWARE: Why are Apple M-series chips faster than x86 on ML inference tasks at lower TDP? Name 3 specific architectural reasons."""),

    ("V4-2: Debug distributed system", """A microservice system consists of 4 services:
- API Gateway → Auth Service → User Service → PostgreSQL
- API Gateway → Order Service → PostgreSQL (separate DB)

Production symptoms:
1. Every 2-3 hours, Order Service starts responding in 5+ seconds (normally 200ms)
2. During this time, Order Service CPU = 5%, Memory = 40% (stable)
3. PostgreSQL shows active connections growing from 20 to 100
4. Auth Service and User Service are working normally
5. After restarting Order Service, the problem disappears for 2-3 hours
6. Order Service logs: "Waiting for connection from pool" repeats hundreds of times

Determine:
1. The root cause
2. Why is the problem periodic (every 2-3 hours)?
3. Why does a restart help?
4. How to fix it without restarts?
5. How to prevent it in the future?"""),

    ("V4-3: Reverse engineer + prove", """I have a black box — a function f(x, y):

f(1, 1) = 1
f(2, 3) = 8
f(3, 2) = 9
f(4, 1) = 16
f(1, 5) = 1
f(5, 2) = 25
f(3, 3) = 27
f(2, 5) = 32
f(10, 1) = 100
f(2, 10) = 1024

1. Determine the formula for f(x, y). Show your reasoning.
2. Compute f(7, 3) and f(3, 7).
3. Write a Python function and verify it on all 10 examples.
4. Do there exist x, y > 0 such that f(x, y) = f(y, x) where x ≠ y? Find all pairs for x, y ∈ [1, 20]."""),

    ("V4-4: Logical fallacies", """Find the logical fallacies in EACH statement. Name the type of fallacy and explain.

1. "Python is 100x slower than C, therefore you cannot build high-load systems in Python"

2. "GPT-4 passed the bar exam, therefore AI can replace lawyers"

3. "90% of employees at our company are satisfied with their salary (according to an internal anonymous survey), therefore salaries are fair"

4. "Google's quantum computer solved a problem in 200 seconds that would take a supercomputer 10,000 years, therefore quantum computers are 1.5 billion times faster than regular ones"

5. "Startup X grew 300% in one year. If you invest now, in 3 years it will grow 2700%"

6. "A study showed that people who eat chocolate live longer. Therefore, chocolate extends life" """),

    ("V4-5: Contradicting sources", """Two experts give opposite recommendations:

Expert A: "Microservice architecture is the only correct approach for scalable systems. Monoliths don't scale."

Expert B: "Microservices are overhyped complexity. A monolith with proper design scales better and cheaper."

Write an analysis of 300-400 words:
1. Find the kernel of truth in BOTH positions
2. Identify the contexts where each one is right
3. Propose your own position with specific selection criteria
4. Give 2 real-world company examples for each approach"""),

    ("V4-6: Self-verification", """Solve the problem, then INTENTIONALLY check your solution for errors.

Problem: A company sold 1000 units of a product.
60% at a price of $50, 25% at a price of $75, the rest at a price of $100.
Weighted average selling price = ?

Steps:
1. Solve the problem
2. List possible errors you could have made
3. Verify each computation step separately
4. Give the final answer with confidence level (%)"""),

    ("V4-7: Technical RFC", """Write a technical RFC (Request for Comments) of 500-700 words:

Topic: "Protocol for automatic migration of hot experts between nodes in a distributed MoE inference cluster"

Context: A 228B parameter MoE model, 256 experts, 62 layers. A cluster of 4 nodes with 96GB RAM each. Experts are distributed across nodes, but usage patterns change.

The RFC should contain:
- Abstract (50 words)
- Problem Statement
- Proposed Solution (specific protocol)
- Message Format (specific fields)
- Migration Algorithm (step by step)
- Failure Modes and Recovery
- Performance Considerations"""),
]

results_file = os.path.join(OUT_DIR, "results.jsonl")
for name, prompt in TESTS:
    print(f"\n{'='*60}", flush=True)
    print(f"{name}", flush=True)
    print(f"{'='*60}", flush=True)
    t0 = time.time()
    try:
        answer, thinking, tokens = ask(prompt)
        elapsed = time.time() - t0
        print(f"Time: {elapsed:.1f}s | Tokens: {tokens} | Answer: {len(answer)} chars", flush=True)
        print(f"\n{answer[:2500]}", flush=True)
        with open(results_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({"test": name, "answer": answer, "thinking": thinking[:5000] if thinking else "", "tokens": tokens, "elapsed": elapsed}, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"ERROR: {e}", flush=True)
        with open(results_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({"test": name, "answer": f"ERROR: {e}", "tokens": 0, "elapsed": time.time() - t0}, ensure_ascii=False) + "\n")
    sys.stdout.flush()
print(f"\n{'='*60}\nALL V4 TESTS COMPLETE. Results: {results_file}\n{'='*60}")
