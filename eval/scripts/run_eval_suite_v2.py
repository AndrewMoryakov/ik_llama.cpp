"""Run the Eval Suite V2 against a running llama-server."""
import json, urllib.request, time, sys, os

API = os.environ.get("EVAL_API", "http://127.0.0.1:8080/v1/chat/completions")
OUT_DIR = os.environ.get("EVAL_OUT", "bench_results/eval_suite_v2")
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

    ("V2-3: Parser + trace", 1500, """Given the following grammar (BNF):

expr     ::= term (('+' | '-') term)*
term     ::= factor (('*' | '/') factor)*
factor   ::= NUMBER | '(' expr ')' | '-' factor
NUMBER   ::= [0-9]+

1. Write a recursive descent parser in Python that evaluates the expression.
2. Show a step-by-step computation trace for the expression: 3 + 4 * (2 - 1)
3. What is the result?"""),

    ("V2-4: Counterfactual history", 1500, """Imagine an alternate history: the Roman Empire did not fall in 476 AD but continued to exist.

Answer these specific questions:
1. How would this have affected the development of science by the year 1000?
2. Would the Americas have been discovered earlier or later? Why?
3. Would the Industrial Revolution have occurred? If so, approximately when?
4. What would the world map look like by the year 2000?

For each answer, provide 2-3 specific arguments based on real historical trends."""),

    ("V2-5: LRU Cache + tests", 1500, """Write an LRUCache class in Python with support for:
1. get(key) — O(1)
2. put(key, value) — O(1)
3. capacity — maximum number of elements
4. On overflow, the least recently used element is evicted
5. A stats() method — returns a dict with hits, misses, evictions

Then write 5 unit tests covering:
- basic usage
- overflow
- updating an existing key
- access updates "recency"
- statistics are correct

Use only the Python standard library (no lru_cache)."""),

    ("V2-6: System analysis", 1500, """The team proposes three solutions to speed up the backend:

Solution A: "Add a Redis cache in front of PostgreSQL"
- Expected speedup: 10x for reads
- Cost: $200/month
- Risk: cache invalidation, stale data

Solution B: "Migrate from Python to Go"
- Expected speedup: 5x
- Cost: 3 months of rewriting
- Risk: losing the Python ML ecosystem

Solution C: "Add PostgreSQL read replicas"
- Expected speedup: 3x for reads
- Cost: $500/month
- Risk: eventual consistency

Context: 80% of the load is reads, 20% is writes. Team of 4 people. The product is an ML platform for data analysis. Current latencies: avg 800ms, p95 2500ms. SLA: p95 < 500ms.

Analyze each solution and propose an optimal strategy. Justify with numbers."""),

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

    ("V2-9: Multilingual", 1500, """Write the same Python package installation instructions in three languages.

Requirements:
1. Russian: formal style, using the polite "Vy" form of address
2. English: casual developer style, with humor
3. 日本語 (Japanese): polite keigo style

The instructions should cover:
- Installation via pip
- Creating a virtual environment
- Verifying the installation
- What to do if there is an error

Each version — no more than 150 words."""),

    ("V2-10: System design", 1500, """Design a caching system for a news website with 10 million DAU.

Requirements:
- News updates every 5 minutes
- Personalized feed for each user
- Infrastructure budget: $5000/month
- Acceptable latency: < 200ms for 99% of requests
- Must work across 3 regions (US, EU, Asia)

Describe:
1. The architecture (with specific technologies)
2. The cache invalidation strategy
3. How to provide personalization without losing cache efficiency
4. What will break first at 100M DAU and how to fix it"""),
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
        print(f"\n{answer[:1500]}", flush=True)
        with open(results_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({"test": name, "answer": answer, "usage": usage, "elapsed": elapsed}, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"ERROR: {e}", flush=True)
        with open(results_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({"test": name, "answer": f"ERROR: {e}", "usage": {}, "elapsed": time.time() - t0}, ensure_ascii=False) + "\n")
    sys.stdout.flush()

print(f"\n{'='*60}")
print(f"ALL V2 TESTS COMPLETE. Results: {results_file}")
print(f"{'='*60}")
