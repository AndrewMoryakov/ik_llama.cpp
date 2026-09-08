"""Eval V3: Discriminator tests designed to find differences between large (228B) and small (42B) MoE models.
Supports both standard and thinking models via /completion endpoint."""
import json, urllib.request, time, sys, os

API_BASE = os.environ.get("EVAL_API_BASE", "http://127.0.0.1:8080")
OUT_DIR = os.environ.get("EVAL_OUT", "bench_results/eval_v3")
TIMEOUT = int(os.environ.get("EVAL_TIMEOUT", "900"))
MAX_TOKENS = int(os.environ.get("EVAL_MAX_TOKENS", "4000"))
USE_COMPLETION = os.environ.get("EVAL_USE_COMPLETION", "0") == "1"

os.makedirs(OUT_DIR, exist_ok=True)

def ask_chat(prompt, max_tokens):
    body = json.dumps({
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }).encode()
    url = f"{API_BASE}/v1/chat/completions"
    req = urllib.request.Request(url, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read())
    content = data["choices"][0]["message"]["content"]
    tokens = data.get("usage", {}).get("completion_tokens", 0)
    return content, "", tokens

def ask_completion(prompt, max_tokens):
    formatted = f"<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n"
    body = json.dumps({
        "prompt": formatted,
        "n_predict": max_tokens,
        "temperature": 0.3,
        "stop": ["<|im_end|>"],
    }).encode()
    url = f"{API_BASE}/completion"
    req = urllib.request.Request(url, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read())
    raw = data.get("content", "")
    tokens = data.get("tokens_predicted", 0)
    if "</think>" in raw:
        answer = raw.split("</think>", 1)[1].strip()
        thinking = raw.split("</think>", 1)[0]
    else:
        answer = raw
        thinking = ""
    return answer, thinking, tokens

def ask(prompt, max_tokens=None):
    mt = max_tokens or MAX_TOKENS
    if USE_COMPLETION:
        return ask_completion(prompt, mt)
    return ask_chat(prompt, mt)

TESTS = [
    ("V3-1: Deep knowledge", """Name 5 consensus algorithms in distributed systems, other than Paxos and Raft.
For each one, specify:
1. Year of creation
2. Author(s)
3. Key difference from Raft
4. Which real project/product uses it

Do not make things up — only real algorithms with verifiable facts."""),

    ("V3-2: Chained code", """Write three related Python functions:

1. flatten(obj) — takes a nested dict/list of arbitrary depth, returns a flat dict with dot-notation keys. For lists, use numeric indices: {"a": [1,2]} → {"a.0": 1, "a.1": 2}

2. unflatten(flat_dict) — the reverse operation: reconstructs the nested structure from a flat dict. {"a.0": 1, "a.1": 2} → {"a": [1, 2]}

3. test_roundtrip() — verifies that unflatten(flatten(x)) == x for 5 different structures:
   - a simple dict
   - nested 3 levels deep
   - with arrays
   - with None/null values
   - with empty objects {}

Show the output of test_roundtrip()."""),

    ("V3-3: Multilingual math", """Translate the problem into 4 languages and solve it in EACH language separately. At the end, compare the answers.

Problem: "A store has 3 shelves. The first shelf has twice as many books as the second. The third shelf has 5 fewer books than the first. There are 55 books in total. How many books are on each shelf?"

Languages:
1. Russian — solve in Russian
2. English — translate and solve in English
3. 中文 — translate and solve in Chinese
4. العربية — translate and solve in Arabic

At the end: do the numerical answers match across all 4 languages?"""),

    ("V3-4: Stylistic analysis", """Determine whether these two texts were written by the same author. Support your argument with stylistic analysis.

Text 1:
"The problem of scaling distributed systems lies not so much in technical limitations as in the fundamental impossibility of simultaneously guaranteeing consistency, availability, and partition tolerance. This theorem, formulated by Eric Brewer in 2000, still defines architectural decisions in the field of cloud computing. It should be noted that practical implementations typically sacrifice strict consistency in favor of eventual consistency."

Text 2:
"You know what's infuriating about distributed systems? All these smart guys with their CAP theorems, and then you get to production — and the data diverges anyway. Seriously, has anyone ever seen a system that actually maintains strong consistency under load? I haven't. In the end, everyone writes eventual consistency and prays the user won't notice."

Analyze point by point:
1. Vocabulary (formal/colloquial, specialized/general)
2. Syntax (sentence length, complexity of constructions)
3. Tone and register
4. Common elements (topics, terms, positions)
5. Conclusion: same author or different? With what confidence?"""),

    ("V3-5: 10 constraints", """Write an email to a client. You must satisfy ALL 10 constraints simultaneously:

1. Exactly 5 paragraphs
2. First paragraph is a greeting, last is a call-to-action
3. Tone is professional yet warm (not cold)
4. Mention a specific date: July 15
5. Include a metaphor about a bridge or a journey
6. Do NOT use the word "but" even once
7. Each paragraph is exactly 2-3 sentences
8. Mention the product "CloudSync Pro"
9. Offer a 20% discount
10. End with a question

After the email, self-check: are all 10 constraints met? Mark with checkmarks."""),
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
            f.write(json.dumps({
                "test": name, "answer": answer,
                "thinking": thinking[:5000] if thinking else "",
                "tokens": tokens, "elapsed": elapsed,
            }, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"ERROR: {e}", flush=True)
        with open(results_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({"test": name, "answer": f"ERROR: {e}", "tokens": 0, "elapsed": time.time() - t0}, ensure_ascii=False) + "\n")
    sys.stdout.flush()

print(f"\n{'='*60}")
print(f"ALL V3 TESTS COMPLETE. Results: {results_file}")
print(f"{'='*60}")
