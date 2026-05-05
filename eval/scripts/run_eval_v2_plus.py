"""Run Eval Suite V2 + V2-11 bonus test against a running llama-server."""
import json, urllib.request, time, sys, os

API = os.environ.get("EVAL_API", "http://127.0.0.1:8080/v1/chat/completions")
OUT_DIR = os.environ.get("EVAL_OUT", "bench_results/eval_v2_plus")
TIMEOUT = int(os.environ.get("EVAL_TIMEOUT", "900"))

os.makedirs(OUT_DIR, exist_ok=True)

def ask(prompt, max_tokens=1500):
    body = json.dumps({
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }).encode()
    req = urllib.request.Request(API, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read())
    return data["choices"][0]["message"]["content"], data.get("usage", {})

TESTS = [
    ("V2-1: Business calc", 1500, """A company has 3 projects: Alpha, Beta, Gamma.
- Alpha generates $100K/month, requires 5 developers, grows at 10% per month
- Beta generates $80K/month, requires 3 developers, grows at 20% per month
- Gamma generates $50K/month, requires 2 developers, grows at 5% per month

The company has 8 developers. In 6 months, they need to choose only 2 out of 3 projects.

1. Calculate the revenue of each project after 6 months accounting for growth
2. Calculate the ROI (revenue per developer) for each project after 6 months
3. Which 2 projects should be kept and why?
4. Is there an option to redistribute developers for a better outcome?"""),

    ("V2-2: Cascade debug", 1500, """This Python code is supposed to parse a CSV log and return the top 5 slowest API endpoints. But it produces incorrect results. Find all the problems and fix them.

import csv
from collections import defaultdict

def analyze_api_logs(csv_path):
    stats = defaultdict(list)

    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            endpoint = row['path']
            duration = row['duration_ms']
            status = row['status']

            if status == 200:
                stats[endpoint].append(duration)

    result = {}
    for endpoint, durations in stats.items():
        result[endpoint] = {
            'avg_ms': sum(durations) / len(durations),
            'max_ms': max(durations),
            'count': len(durations),
            'p95_ms': sorted(durations)[int(len(durations) * 0.95)]
        }

    top_5 = sorted(result.items(), key=lambda x: x[1]['avg_ms'])[:5]
    return top_5

# Example CSV:
# timestamp,path,duration_ms,status
# 2024-01-01T00:00:00,/api/users,45,200
# 2024-01-01T00:00:01,/api/orders,120,200
# 2024-01-01T00:00:02,/api/users,55,500"""),

    ("V2-7: Caesar cipher", 1500, """Here are 5 examples of encoded messages and their decryptions:

"KHOOR" → "HELLO"
"ZRUOG" → "WORLD"
"FDHVDU" → "CAESAR"
"FLSKHU" → "CIPHER"
"DWWDFN" → "ATTACK"

1. Identify the encryption algorithm
2. Decrypt: "VHFUHW PHVVDJH"
3. Encrypt: "PYTHON" """),

    ("V2-8: Ethics memo", 1500, """A company developed an AI system for resume screening. Testing showed:
- Overall accuracy of 92%
- But for candidates with names typical of ethnic minorities, accuracy drops to 78%
- Without the AI system, HR managers process 50 resumes per day
- With AI — 500 resumes per day

Management wants to deploy the system because "92% is better than human bias."

Write a memo to the CEO of 300-400 words that:
1. Acknowledges the advantages of the system
2. Explains the fairness problem
3. Proposes specific steps to fix it
4. Gives a clear recommendation: deploy, refine, or reject"""),

    ("V2-11: Reverse engineer", 2000, """I have a black box — a function f(x, y) that takes two integers and returns an integer. Here are 10 examples of inputs and outputs:

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
4. Do there exist x, y > 0 such that f(x, y) = f(y, x) where x ≠ y? If yes — find all pairs for x, y ∈ [1, 20]. If no — prove it."""),
]

results_file = os.path.join(OUT_DIR, "results.jsonl")

for name, max_tok, prompt in TESTS:
    print(f"\n{'='*60}", flush=True)
    print(f"{name}", flush=True)
    print(f"{'='*60}", flush=True)
    t0 = time.time()
    try:
        answer, usage = ask(prompt, max_tokens=max_tok)
        elapsed = time.time() - t0
        print(f"Time: {elapsed:.1f}s | Tokens: prompt={usage.get('prompt_tokens',0)}, completion={usage.get('completion_tokens',0)}", flush=True)
        print(f"\n{answer[:2000]}", flush=True)
        with open(results_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({"test": name, "answer": answer, "usage": usage, "elapsed": elapsed}, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"ERROR: {e}", flush=True)
        with open(results_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({"test": name, "answer": f"ERROR: {e}", "usage": {}, "elapsed": time.time() - t0}, ensure_ascii=False) + "\n")
    sys.stdout.flush()

print(f"\n{'='*60}")
print(f"ALL TESTS COMPLETE. Results: {results_file}")
print(f"{'='*60}")
