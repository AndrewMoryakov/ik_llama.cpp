"""Run the Eval Suite against a running llama-server."""
import json, urllib.request, time, sys, os

API = os.environ.get("EVAL_API", "http://127.0.0.1:8080/v1/chat/completions")
OUT_DIR = os.environ.get("EVAL_OUT", "bench_results/2026-03-22_eval_suite_v4")
TIMEOUT = int(os.environ.get("EVAL_TIMEOUT", "900"))

os.makedirs(OUT_DIR, exist_ok=True)

def ask(prompt, max_tokens=1024):
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
    ("Test 01: Reasoning (boxes)", 1024, 'There are 5 boxes in a room: red, blue, green, yellow, and white.\nThe red box contains the key to the blue one.\nThe blue box contains the key to the green one.\nThe green box contains the key to the white one and a note: "The key to the yellow box is in the white one."\nThe white box contains the key to the yellow one.\nThe yellow box contains the prize.\n\nThe red box is open. All others are locked.\nDescribe step by step how to reach the prize. What is the minimum number of "open a box" actions needed?'),
    ("Test 02: Code (merge_intervals)", 1024, 'Write a Python function merge_intervals(intervals: list[tuple[int, int]]) -> list[tuple[int, int]] that merges overlapping intervals.\n\nExamples:\n- merge_intervals([(1,3), (2,6), (8,10), (15,18)]) -> [(1,6), (8,10), (15,18)]\n- merge_intervals([(1,4), (4,5)]) -> [(1,5)]\n- merge_intervals([]) -> []\n- merge_intervals([(1,1)]) -> [(1,1)]\n\nInclude type hints and handle edge cases.'),
    ("Test 03: Bug finding", 1024, 'Find all bugs in this code and explain each one:\n\ndef calculate_average(numbers):\n    total = 0\n    for i in range(len(numbers)):\n        total += numbers[i]\n    average = total / len(numbers)\n    return round(average, 2)\n\ndef process_data(data):\n    results = []\n    for item in data:\n        if item["type"] == "numeric":\n            avg = calculate_average(item["values"])\n            item["average"] = avg\n            results.append(item)\n\n    sorted_results = sorted(results, key=lambda x: x["average"], reverse=True)\n\n    top_3 = sorted_results[:3]\n    for i, result in enumerate(top_3):\n        result["rank"] = i\n\n    return results\n\ndata = [\n    {"type": "numeric", "values": [1, 2, 3]},\n    {"type": "text", "values": ["a", "b"]},\n    {"type": "numeric", "values": []},\n    {"type": "numeric", "values": [10, 20]},\n]\n\nprint(process_data(data))'),
    ("Test 04: JSON extraction", 1024, 'Analyze this text and return the result strictly in JSON format:\n\n"TechVision increased its revenue by 23% in 2024 to 4.2 billion rubles.\nNet profit was 890 million rubles, which is 15% more than the previous year.\nThe company\'s staff grew from 1200 to 1450 people. Main markets: Russia (65%),\nKazakhstan (20%), Uzbekistan (15%). Company CEO Alexei Petrov announced plans\nto enter the Turkish market in 2025."\n\nJSON format:\n{\n  "company": "name",\n  "year": number,\n  "revenue": {"value": number, "currency": "currency", "growth_pct": number},\n  "profit": {"value": number, "currency": "currency", "growth_pct": number},\n  "employees": {"current": number, "previous": number},\n  "markets": [{"country": "country", "share_pct": number}],\n  "ceo": "name",\n  "plans": ["string"]\n}'),
    ("Test 05: Math (trains)", 1024, 'A train leaves Moscow at 9:00 traveling at 80 km/h toward Saint Petersburg (700 km away).\nAnother train leaves Saint Petersburg at 10:00 traveling at 120 km/h toward Moscow.\n\n1. At what time do they meet?\n2. How far from Moscow is the meeting point?\n3. If a bird starts flying from Moscow at 9:00 at 200 km/h, flying back and forth between the two trains until they meet, what total distance does the bird fly?\n\nShow your work step by step.'),
    ("Test 06: Summarization", 512, 'Summarize the following in exactly 3 bullet points, each no longer than 20 words:\n\nThe transformer architecture, introduced in the paper "Attention Is All You Need" by Vaswani et al. in 2017,\nrevolutionized natural language processing by replacing recurrent neural networks with a self-attention mechanism.\nThis allowed models to process all tokens in a sequence simultaneously rather than sequentially, dramatically\nimproving training efficiency. The architecture consists of an encoder and decoder, each made up of multiple\nlayers of multi-head attention and feed-forward networks. Pre-training on large corpora followed by fine-tuning\non specific tasks became the dominant paradigm, leading to models like BERT, GPT, and T5. The scalability of\ntransformers enabled the creation of increasingly large language models, culminating in systems with hundreds\nof billions of parameters. However, the quadratic complexity of self-attention with respect to sequence length\nremains a significant computational challenge, spurring research into efficient attention mechanisms like\nsparse attention, linear attention, and flash attention.'),
    ("Test 07: Multilingual code", 1024, 'I am working on a Python project. Here is my code:\n\ndef fetch_user_data(user_id):\n    response = requests.get(f"https://api.example.com/users/{user_id}")\n    data = response.json()\n    return data["name"], data["email"]\n\nProblem: sometimes the API returns 404 or 500, and the code crashes.\n\nRewrite the function so that:\n1. HTTP errors (4xx, 5xx) are handled\n2. There is retry with exponential backoff (maximum 3 attempts)\n3. It returns an Optional tuple or None on failure\n4. Errors are logged\n\nWrite the code and comments in English.'),
    ("Test 08: Magic square", 1024, 'Place the numbers 1 through 9 in a 3x3 grid such that:\n- The sum of each row = 15\n- The sum of each column = 15\n- The sum of each diagonal = 15\n\nShow the solution as a table and prove that all sums equal 15.'),
    ("Test 09: SQL chain", 1500, 'You are a database administrator. Execute these steps IN ORDER and show the SQL for each:\n\n1. Create a table "employees" with columns: id (int, primary key, auto increment), name (varchar 100), department (varchar 50), salary (decimal 10,2), hire_date (date)\n2. Insert 5 employees with realistic data\n3. Create an index on department\n4. Write a query to find the average salary per department, only showing departments with average salary > 50000\n5. Write a query to find employees hired in the last 6 months who earn above the company average\n6. Create a view combining steps 4 and 5\n\nFor each step, write the SQL and briefly explain what it does.'),
    ("Test 10: Ambiguous query", 512, 'how to make python run faster'),
    ("Test 11: AIME math", 1024, 'Find the number of ordered pairs (a, b) of positive integers such that:\n\na^2 + b^2 = a^3\n\nExpress your answer as a single integer.\nShow your complete reasoning.'),
    ("Test 12: CPU simulation", 1500, 'Simulate a CPU executing these instructions. Registers: A=0, B=0, C=0. Stack: empty.\n\n1. SET A 7\n2. SET B 3\n3. PUSH A\n4. PUSH B\n5. ADD          // pops the top two values from the stack, adds them, pushes the result back\n6. POP C        // pops the top value from the stack into C\n7. SET A 2\n8. MUL A C      // A = A * C, result goes into A\n9. PUSH A\n10. PUSH C\n11. SUB         // pops the top two values: first popped - second popped, pushes the result\n12. POP B\n13. CMP A B     // compare A and B, set FLAG: "GT" if A>B, "EQ" if A==B, "LT" if A<B\n14. JMP_GT 16   // if FLAG == "GT", jump to instruction 16\n15. SET A 0     // otherwise execute this\n16. OUT A B C   // output the values of A, B, C\n\nShow the state of registers and the stack after EACH instruction.\nWhat will the final OUT output be?'),
    ("Test 13: Trick questions", 1024, 'Answer each question. Be careful — some questions contain tricks.\n\n1. A farmer had 17 sheep. All but 9 ran away. How many are left?\n\n2. A plane flies from Moscow to New York and crashes exactly on the border of the USA and Canada. Where do they bury the survivors?\n\n3. Which is heavier: a kilogram of iron or a kilogram of feathers?\n\n4. A family has 5 sons. Each son has a sister. How many children are in the family?\n\n5. In front of you are three switches. Behind a wall is a room with one light bulb (a regular incandescent bulb). You can enter the room only once. How do you determine which switch controls the light bulb?\n\n6. You have 8 identical-looking balls. One of them is heavier than the rest. You have a balance scale. What is the minimum number of weighings that will guarantee finding the heavy ball?\n\n7. If 5 machines make 5 parts in 5 minutes, how many minutes will it take 100 machines to make 100 parts?'),
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
