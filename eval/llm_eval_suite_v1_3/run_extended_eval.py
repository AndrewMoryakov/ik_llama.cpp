#!/usr/bin/env python3
"""Extended Eval v1 — covers gaps not addressed by fast_qc and deep_eval.

Focus areas:
- State tracking (CPU simulation)
- Adversarial/trick questions
- Edge-of-capability reasoning (no single correct answer)
- Non-tech domain knowledge
- Long coherent generation

Usage:
  python run_extended_eval.py
  EVAL_USE_COMPLETION=1 EVAL_MAX_TOKENS=4000 python run_extended_eval.py
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

from eval_common import (
    OUT_DIR,
    RUN_ID,
    EvalClient,
    RunMetadata,
    append_jsonl,
    contains_word_case_insensitive,
    ensure_dir,
    keyword_score,
    write_json,
)


SUITE_NAME = "extended_eval_v1"
RUN_DIR = os.path.join(OUT_DIR, SUITE_NAME, RUN_ID)
RESULTS_JSONL = os.path.join(RUN_DIR, "results.jsonl")
SUMMARY_JSON = os.path.join(RUN_DIR, "summary.json")
SUMMARY_TXT = os.path.join(RUN_DIR, "summary.txt")
METADATA_JSON = os.path.join(RUN_DIR, "metadata.json")


@dataclass
class TestCase:
    test_id: str
    name: str
    weight: int
    prompt: str
    scorer: Callable[[str], Tuple[int, Dict[str, Any], Dict[str, int]]]
    max_tokens: Optional[int] = None


# ────────────────────────────────────────────────────────────────
# EXT-01: CPU simulation — state tracking through 16 instructions
# ────────────────────────────────────────────────────────────────

def score_ext_01(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    lowered = answer.lower()
    score = 0

    # Key checkpoints
    if "c" in lowered and "10" in answer:
        # C=10 after ADD+POP (steps 5-6)
        if re.search(r"c\s*=\s*10", lowered) or "pop c" in lowered and "10" in answer:
            score += 2
            dims["correctness"] += 2

    if "a" in lowered and "20" in answer:
        # A=20 after MUL (step 8)
        if re.search(r"a\s*=\s*20", lowered):
            score += 2
            dims["correctness"] += 2

    # SUB result: first popped - second popped = 10 - 20 = -10
    if "-10" in answer:
        score += 3
        dims["correctness"] += 3
    elif "10" in answer and "sub" in lowered:
        # Got SUB but wrong sign — partial credit
        score += 1
        dims["correctness"] += 1

    # JMP_GT: should jump (A=20 > B=-10)
    if "gt" in lowered and ("jump" in lowered or "skip" in lowered or "jmp" in lowered):
        score += 1
        dims["reasoning"] += 1

    # Final output: A=20, B=-10, C=10
    if "20" in answer and "-10" in answer and "10" in answer:
        final_match = re.search(r"(?:out|output|final).*?20.*?-10.*?10", lowered)
        if final_match:
            score += 2
            dims["correctness"] += 2

    return min(score, 10), {"preview": answer[:1200]}, dims


# ────────────────────────────────────────────────────────────────
# EXT-02: Trick questions — adversarial reasoning
# ────────────────────────────────────────────────────────────────

def score_ext_02(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    lowered = answer.lower()
    score = 0
    hits = []

    # Q1: 17 sheep, all but 9 ran away → 9
    if re.search(r"\b9\b", answer) and not re.search(r"\b8\b.*(?:remain|left|stay)", lowered):
        score += 1; hits.append("Q1")
        dims["correctness"] += 1

    # Q2: survivors are not buried
    if any(tok in lowered for tok in ["not buried", "don't bury", "survivors are alive", "alive", "aren't buried", "not bury"]):
        score += 2; hits.append("Q2")
        dims["reasoning"] += 2

    # Q3: kilogram = kilogram
    if any(tok in lowered for tok in ["same", "equal", "weigh the same", "both weigh", "identical"]):
        score += 1; hits.append("Q3")
        dims["correctness"] += 1

    # Q4: 5 sons + 1 sister = 6 children
    if re.search(r"\b6\b", answer) and not re.search(r"\b10\b.*(?:child|kid)", lowered):
        score += 2; hits.append("Q4")
        dims["reasoning"] += 2

    # Q5: light bulb — turn on switch 1, wait, turn off, turn on switch 2, enter
    if any(tok in lowered for tok in ["warm", "heat", "hot", "temperature", "touch"]):
        score += 2; hits.append("Q5")
        dims["reasoning"] += 2

    # Q6: 8 balls, balance scale → 2 weighings
    if re.search(r"\b2\b.*weigh", lowered) or re.search(r"two.*weigh", lowered):
        score += 1; hits.append("Q6")
        dims["correctness"] += 1

    # Q7: 5 machines, 5 parts, 5 minutes → 100 machines make 100 parts in 5 minutes
    if re.search(r"\b5\b.*minute", lowered) and not re.search(r"\b100\b.*minute", lowered):
        score += 1; hits.append("Q7")
        dims["correctness"] += 1

    return min(score, 10), {"hits": hits, "preview": answer[:1200]}, dims


# ────────────────────────────────────────────────────────────────
# EXT-03: Team analysis — multi-factor, no single correct answer
# ────────────────────────────────────────────────────────────────

def score_ext_03(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    lowered = answer.lower()
    score = 0

    # Should identify Beta as highest tech debt (31 bugs / 78 tasks = 40%, 45min review)
    if any(tok in lowered for tok in ["beta.*tech", "beta.*debt", "beta.*bug", "beta.*quality"]):
        score += 3
        dims["correctness"] += 3
    elif re.search(r"beta.*31.*bug|beta.*40%|beta.*highest.*bug", lowered):
        score += 3
        dims["correctness"] += 3

    # Should identify Gamma as highest risk (lost team lead)
    if any(tok in lowered for tok in ["gamma.*risk", "gamma.*lead", "gamma.*bus factor", "team lead.*left", "lost.*lead"]):
        score += 3
        dims["reasoning"] += 3

    # Should note Gamma has best bug rate (8/52 = 15%)
    if re.search(r"gamma.*(?:best|lowest|fewest).*bug|gamma.*15%|gamma.*quality", lowered):
        score += 2
        dims["correctness"] += 2

    # Recommendations present for each team
    recommend_count = len(re.findall(r"(?:recommend|suggestion|should|advise).*(?:alpha|beta|gamma)", lowered))
    if recommend_count >= 3:
        score += 2
        dims["discipline"] += 2
    elif recommend_count >= 1:
        score += 1
        dims["discipline"] += 1

    return min(score, 10), {"preview": answer[:1200]}, dims


# ────────────────────────────────────────────────────────────────
# EXT-04: Logical fallacies — adversarial reasoning
# ────────────────────────────────────────────────────────────────

def score_ext_04(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    lowered = answer.lower()
    score = 0
    found = 0

    fallacy_markers = [
        # Q1: Python vs C
        ["false dilemma", "hasty generalization", "oversimplification", "bottleneck", "not the language"],
        # Q2: GPT-4 bar exam
        ["generalization", "narrow test", "soft skill", "not the same", "passing exam"],
        # Q3: salary survey
        ["ad populum", "subjective", "selection bias", "survivorship", "external market"],
        # Q4: quantum
        ["cherry-pick", "specific task", "narrow", "not general", "apples and oranges"],
        # Q5: startup growth
        ["extrapolat", "naive", "compound", "sustain", "diminishing"],
        # Q6: chocolate
        ["correlation", "causation", "confound", "reverse caus", "not imply"],
    ]

    for markers in fallacy_markers:
        if any(m in lowered for m in markers):
            found += 1

    score = min(10, found * 2)  # 2 points per found fallacy, max 10
    dims["correctness"] = min(6, found)
    dims["reasoning"] = min(4, max(0, found - 3))

    return min(score, 10), {"fallacies_found": found, "preview": answer[:1200]}, dims


# ────────────────────────────────────────────────────────────────
# EXT-05: Domain breadth — medicine + history + ethics
# ────────────────────────────────────────────────────────────────

def score_ext_05(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    lowered = answer.lower()
    score = 0

    # Medicine: ACE/ARB + bradykinin
    med_hits = keyword_score(lowered, [
        ["ace inhibitor", "captopril"],
        ["bradykinin", "cough"],
        ["arb", "losartan", "receptor blocker"],
    ])
    score += min(3, med_hits)
    dims["correctness"] += min(3, med_hits)

    # History: concrete facts about Roman Empire
    hist_hits = keyword_score(lowered, [
        ["roman", "rome", "empire"],
        ["fall", "476", "western"],
        ["dark ages", "knowledge", "preserved"],
        ["road", "aqueduct", "engineering"],
    ])
    score += min(4, hist_hits)
    dims["correctness"] += min(4, hist_hits)

    # Ethics: AI bias — disparate impact, fairness
    ethics_hits = keyword_score(lowered, [
        ["bias", "fairness", "disparate"],
        ["audit", "monitor", "test"],
        ["recommend", "deploy", "reject", "refine"],
    ])
    score += min(3, ethics_hits)
    dims["reasoning"] += min(3, ethics_hits)

    return min(score, 10), {"preview": answer[:1200]}, dims


# ────────────────────────────────────────────────────────────────
# EXT-06: System design — architecture under real constraints
# ────────────────────────────────────────────────────────────────

def score_ext_06(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    lowered = answer.lower()
    score = 0

    # Concrete technologies (not abstract)
    tech_hits = keyword_score(lowered, [
        ["redis", "memcached", "valkey"],
        ["cdn", "cloudfront", "cloudflare", "fastly"],
        ["postgresql", "postgres", "mysql", "dynamodb"],
        ["kafka", "rabbitmq", "sqs", "pubsub", "message queue"],
        ["kubernetes", "k8s", "docker", "ecs"],
    ])
    score += min(3, tech_hits)
    dims["correctness"] += min(3, tech_hits)

    # Cache invalidation strategy
    cache_hits = keyword_score(lowered, [
        ["ttl", "time to live", "expir"],
        ["invalidat", "purge", "bust"],
        ["event-driven", "pub/sub", "webhook", "notify"],
    ])
    score += min(2, cache_hits)
    dims["reasoning"] += min(2, cache_hits)

    # Personalization without killing cache
    personal_hits = keyword_score(lowered, [
        ["segment", "cohort", "group", "cluster"],
        ["edge", "edge compute", "personalize at edge"],
        ["partial cache", "shared base", "overlay"],
        ["user profile", "user feature", "user embedding"],
    ])
    score += min(2, personal_hits)
    dims["reasoning"] += min(2, personal_hits)

    # Multi-region awareness
    if any(tok in lowered for tok in ["region", "geo", "latency", "us ", "eu ", "asia"]):
        score += 1
        dims["discipline"] += 1

    # Budget consciousness ($5000/month)
    if any(tok in lowered for tok in ["$5000", "5000", "budget", "cost"]):
        score += 1
        dims["discipline"] += 1

    # Scaling discussion (100M DAU)
    if any(tok in lowered for tok in ["100m", "100 million", "10x", "bottleneck", "shard", "partition", "horizontal"]):
        score += 1
        dims["reasoning"] += 1

    return min(score, 10), {"preview": answer[:1500]}, dims


TESTS: List[TestCase] = [
    TestCase(
        test_id="EXT-01",
        name="CPU simulation — state tracking",
        weight=10,
        scorer=score_ext_01,
        max_tokens=2500,
        prompt="""Simulate a CPU executing these instructions. Registers: A=0, B=0, C=0. Stack: empty.

1. SET A 7
2. SET B 3
3. PUSH A
4. PUSH B
5. ADD          // pops the top two values, adds them, pushes result
6. POP C        // pops top value into C
7. SET A 2
8. MUL A C      // A = A * C, result in A
9. PUSH A
10. PUSH C
11. SUB         // pops top two: first popped - second popped, pushes result
12. POP B
13. CMP A B     // compare A and B, set FLAG: "GT" if A>B, "EQ" if A==B, "LT" if A<B
14. JMP_GT 16   // if FLAG == "GT", jump to instruction 16
15. SET A 0     // otherwise execute this
16. OUT A B C   // output values of A, B, C

Show the state of registers and stack after EACH instruction.
What is the final OUT output?""",
    ),
    TestCase(
        test_id="EXT-02",
        name="Trick questions — adversarial reasoning",
        weight=10,
        scorer=score_ext_02,
        max_tokens=1500,
        prompt="""Answer each question. Be careful — some contain traps.

1. A farmer had 17 sheep. All but 9 ran away. How many are left?

2. A plane flies from Moscow to New York and crashes exactly on the US-Canada border. Where do they bury the survivors?

3. Which is heavier: a kilogram of iron or a kilogram of feathers?

4. A family has 5 sons. Each son has a sister. How many children are in the family?

5. You have three switches. Behind a wall is a room with one incandescent light bulb. You may enter the room only once. How do you determine which switch controls the bulb?

6. You have 8 identical-looking balls. One is heavier. You have a balance scale. What is the minimum number of weighings to guarantee finding the heavy ball?

7. If 5 machines make 5 parts in 5 minutes, how many minutes will 100 machines take to make 100 parts?""",
    ),
    TestCase(
        test_id="EXT-03",
        name="Team analysis — nuanced multi-factor",
        weight=10,
        scorer=score_ext_03,
        max_tokens=2000,
        prompt="""Three teams work on the same product. Quarterly metrics:

Alpha: 45 tasks completed, 12 production bugs, avg code review 4h, turnover: 0
Beta: 78 tasks completed, 31 production bugs, avg code review 45min, turnover: 2 out of 6 left
Gamma: 52 tasks completed, 8 production bugs, avg code review 2.5h, turnover: 1 out of 5 left (the team lead)

1. Rank teams by effectiveness. Justify.
2. Which team creates the most technical debt? Why?
3. Which team has the highest risk for next quarter?
4. What would you recommend to each team?""",
    ),
    TestCase(
        test_id="EXT-04",
        name="Logical fallacies — 6 statements",
        weight=10,
        scorer=score_ext_04,
        max_tokens=2000,
        prompt="""Find the logical fallacy in EACH statement. Name the type and explain.

1. "Python is 100x slower than C, therefore you cannot build high-load systems in Python"
2. "GPT-4 passed the bar exam, therefore AI can replace lawyers"
3. "90% of employees are satisfied with their salary (internal anonymous survey), therefore salaries are fair"
4. "Google's quantum computer solved a problem in 200 seconds that would take a supercomputer 10,000 years — therefore quantum computers are 1.5 billion times faster"
5. "A startup grew 300% in one year. If you invest now, it will grow 2700% in 3 years"
6. "Studies show people who eat chocolate live longer. Therefore chocolate extends life" """,
    ),
    TestCase(
        test_id="EXT-05",
        name="Domain breadth — medicine, history, ethics",
        weight=10,
        scorer=score_ext_05,
        max_tokens=2500,
        prompt="""Answer three questions from different domains. Factual accuracy matters.

1. MEDICINE: How do ACE inhibitors (captopril) differ from ARBs (losartan) in mechanism? Which is preferred when a patient has dry cough? Why does the cough happen?

2. HISTORY: If the Roman Empire had not fallen in 476 AD, how might science have developed differently by the year 1000? Give 2-3 concrete arguments based on real historical trends.

3. ETHICS: A company built an AI resume screener with 92% overall accuracy, but only 78% for ethnic minority candidates. The CEO says "92% is better than human bias." Write a 100-word counter-argument explaining why this reasoning is flawed.""",
    ),
    TestCase(
        test_id="EXT-06",
        name="System design — caching under constraints",
        weight=10,
        scorer=score_ext_06,
        max_tokens=2500,
        prompt="""Design a caching system for a news website with 10 million DAU.

Requirements:
- News updates every 5 minutes
- Personalized feed for each user
- Infrastructure budget: $5000/month
- Acceptable latency: < 200ms for 99% of requests
- Must work across 3 regions (US, EU, Asia)

Describe:
1. Architecture (with specific technologies, not abstract boxes)
2. Cache invalidation strategy
3. How to provide personalization without losing cache efficiency
4. What will break first at 100M DAU and how to fix it""",
    ),
]


def run_suite() -> Dict[str, Any]:
    ensure_dir(RUN_DIR)
    metadata = RunMetadata(suite=SUITE_NAME)
    write_json(METADATA_JSON, metadata.to_dict())
    client = EvalClient()

    total_score = 0
    total_max = sum(t.weight for t in TESTS)
    dim_totals = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    results: List[Dict[str, Any]] = []

    for test in TESTS:
        print(f"\n{'=' * 72}")
        print(f"{test.test_id} | {test.name} | max {test.weight}")
        print(f"{'=' * 72}")

        start = time.time()
        status = "ok"
        answer = ""
        score = 0
        details: Dict[str, Any] = {}
        dim_scores = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
        tokens_out = 0
        error = None
        try:
            answer, tokens_out, _ = client.ask(test.prompt, max_tokens=test.max_tokens)
            score, details, dim_scores = test.scorer(answer)
        except Exception as exc:
            status = "error"
            error = str(exc)
            details = {"error": error}

        elapsed = time.time() - start
        score = max(0, min(test.weight, score))
        total_score += score
        for k in dim_totals:
            dim_totals[k] += max(0, dim_scores.get(k, 0))

        payload = {
            **metadata.to_dict(),
            "test_id": test.test_id,
            "test_name": test.name,
            "weight": test.weight,
            "score": score,
            "elapsed_sec": round(elapsed, 3),
            "tokens_out": tokens_out,
            "status": status,
            "answer": answer,
            "dimension_scores": dim_scores,
            "details": details,
        }
        if error:
            payload["error"] = error
        append_jsonl(RESULTS_JSONL, payload)
        results.append(payload)

        print(f"score: {score}/{test.weight} | time: {elapsed:.1f}s | tokens: {tokens_out} | status: {status}")
        if answer:
            print(answer[:1200])
        if error:
            print(f"error: {error}")

    summary = {
        **metadata.to_dict(),
        "suite": SUITE_NAME,
        "run_dir": RUN_DIR,
        "total_score": total_score,
        "total_max": total_max,
        "pct": round(100 * total_score / total_max, 2) if total_max else 0.0,
        "dimension_totals": dim_totals,
        "tests": [
            {
                "test_id": r["test_id"],
                "test_name": r["test_name"],
                "score": r["score"],
                "weight": r["weight"],
                "status": r["status"],
                "dimension_scores": r["dimension_scores"],
            }
            for r in results
        ],
    }

    write_json(SUMMARY_JSON, summary)
    with open(SUMMARY_TXT, "w", encoding="utf-8") as f:
        f.write(f"Extended Eval v1 summary\nrun_dir={RUN_DIR}\n")
        for r in results:
            dims = r["dimension_scores"]
            f.write(
                f"{r['test_id']} {r['test_name']}: {r['score']}/{r['weight']} [{r['status']}] | "
                f"C={dims.get('correctness',0)} R={dims.get('reasoning',0)} "
                f"D={dims.get('discipline',0)} H={dims.get('honesty',0)}\n"
            )
        f.write(f"\nTOTAL: {total_score}/{total_max} ({summary['pct']}%)\n")
        f.write(f"DIMENSIONS: {json.dumps(dim_totals, ensure_ascii=False)}\n")
    return summary


if __name__ == "__main__":
    summary = run_suite()
    print("\n" + "=" * 72)
    print(f"EXTENDED EVAL COMPLETE: {summary['total_score']}/{summary['total_max']} ({summary['pct']}%)")
    print(f"Dimension totals: {summary['dimension_totals']}")
    print(f"Results: {RESULTS_JSONL}")
    print("=" * 72)
