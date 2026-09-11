#!/usr/bin/env python3
"""Deep Eval v1 for finalist quant comparison.

Usage:
  python run_deep_eval.py
  EVAL_API_BASE=http://127.0.0.1:8080 EVAL_OUT=bench_results python run_deep_eval.py
  EVAL_USE_COMPLETION=1 EVAL_QUANT_NAME=Q4_K_XL python run_deep_eval.py
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
    CodeTestResult,
    EvalClient,
    RunMetadata,
    append_jsonl,
    contains_word_case_insensitive,
    count_sentences,
    ensure_dir,
    extract_code,
    CodeExecutionDisabled,
    safe_exec_python,
    split_paragraphs,
    strict_json_loads,
    write_json,
)


SUITE_NAME = "deep_eval_v1"
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


# ---------- Helpers ----------

def de_keyword_hits(text: str, groups: List[List[str]]) -> int:
    lowered = text.lower()
    return sum(1 for group in groups if any(token.lower() in lowered for token in group))


def score_de_01(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    lowered = answer.lower()
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    score = 0

    if all(section in lowered for section in [
        "1. most likely root cause",
        "2. why the issue appears after 2-3 hours",
        "3. why restart helps",
        "4. immediate mitigations",
        "5. durable fix",
        "6. prevention and observability",
        "7. confidence and alternative hypotheses",
    ]):
        score += 2
        dims["discipline"] += 2

    if any(token in lowered for token in ["connection leak", "pool exhaustion", "connections not returned", "exhausted pool"]):
        score += 5
        dims["correctness"] += 5
    if any(token in lowered for token in ["accumul", "gradual", "leak", "over time", "scheduled"]):
        score += 2
        dims["reasoning"] += 2
    if any(token in lowered for token in ["restart", "reset", "recreate", "pool state", "drops leaked"]):
        score += 1
        dims["reasoning"] += 1
    if any(token in lowered for token in ["finally", "context manager", "return connection", "timeout", "pool size"]):
        score += 2
        dims["correctness"] += 2
    if any(token in lowered for token in ["metrics", "monitoring", "observability", "alert", "instrumentation", "load test"]):
        score += 2
        dims["discipline"] += 1
        dims["reasoning"] += 1
    if any(token in lowered for token in ["alternative hypotheses", "confidence", "less likely", "could also"]):
        score += 1
        dims["honesty"] += 1

    return min(score, 15), {"preview": answer[:1200]}, dims


def run_ttl_cache_tests(cls) -> CodeTestResult:
    import time as _time

    failures: List[str] = []
    passed = 0
    total = 8

    def check(name: str, fn):
        nonlocal passed
        try:
            fn()
            passed += 1
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{name}: {exc}")

    check("basic_set_get", lambda: (
        lambda c: (_assert(c.get("a") is None, "expected missing None"), c.set("a", 1, 1.0), _assert(c.get("a") == 1, "expected value 1"))
    )(cls()))

    check("expiry", lambda: (
        lambda c: (c.set("a", 1, 0.02), _time.sleep(0.03), _assert(c.get("a") is None, "expected expired None"))
    )(cls()))

    check("overwrite", lambda: (
        lambda c: (c.set("k", 1, 1.0), c.set("k", 2, 1.0), _assert(c.get("k") == 2, "expected overwritten value"))
    )(cls()))

    check("delete", lambda: (
        lambda c: (c.set("k", 1, 1.0), c.delete("k"), _assert(c.get("k") is None, "expected deleted key"))
    )(cls()))

    check("cleanup", lambda: (
        lambda c: (c.set("a", 1, 0.01), c.set("b", 2, 1.0), _time.sleep(0.02), c.cleanup(), _assert(c.get("a") is None, "expected expired a"), _assert(c.get("b") == 2, "expected b preserved"))
    )(cls()))

    check("float_ttl", lambda: (
        lambda c: (c.set("a", 1, 0.05), _time.sleep(0.02), _assert(c.get("a") == 1, "expected float ttl to work"))
    )(cls()))

    check("multiple_keys", lambda: (
        lambda c: (c.set("x", 10, 1.0), c.set("y", 20, 1.0), _assert(c.get("x") == 10 and c.get("y") == 20, "expected both keys"))
    )(cls()))

    check("cleanup_on_missing", lambda: (
        lambda c: (c.cleanup(), _assert(c.get("z") is None, "expected None on empty cache"))
    )(cls()))

    return CodeTestResult(passed=passed, total=total, failures=failures)


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def score_de_02(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    code = extract_code(answer)
    details: Dict[str, Any] = {"code_preview": code[:800]}
    try:
        ns = safe_exec_python(code)
    except CodeExecutionDisabled as exc:
        details["executed"] = False
        details["error"] = str(exc)
        return 0, details, dims
    except Exception as exc:  # noqa: BLE001
        details["error"] = str(exc)
        return 0, details, dims

    cls = ns.get("TTLCache")
    if not isinstance(cls, type):
        details["error"] = "TTLCache class not found"
        return 0, details, dims

    result = run_ttl_cache_tests(cls)
    details["test_result"] = {"passed": result.passed, "total": result.total, "failures": result.failures}
    score = 3
    dims["discipline"] += 3

    public_total = 4
    public_fail = 0
    for f in result.failures:
        if any(name in f for name in ["basic_set_get", "expiry", "overwrite", "delete"]):
            public_fail += 1
    public_pass = public_total - public_fail
    hidden_pass = result.passed - public_pass

    public_score = round(4 * public_pass / public_total)
    hidden_score = round(6 * hidden_pass / 4)
    clarity_score = 2 if all(token in code for token in ["class TTLCache", "def set", "def get", "def delete", "def cleanup"]) else 0

    score += public_score + hidden_score + clarity_score
    dims["correctness"] += public_score + hidden_score
    dims["discipline"] += clarity_score
    return min(score, 15), details, dims


def score_de_03(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    lowered = answer.lower()
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    score = 0
    issue_markers = len(re.findall(r"\bissue\b", lowered))
    severity_markers = len(re.findall(r"\bseverity\b", lowered))
    why_markers = len(re.findall(r"\bwhy it matters\b", lowered))
    fix_markers = len(re.findall(r"\bminimal fix\b", lowered))

    if issue_markers >= 4 and severity_markers >= 4 and why_markers >= 4 and fix_markers >= 4:
        score += 2
        dims["discipline"] += 2

    major_hits = de_keyword_hits(lowered, [
        ["race condition", "data race"],
        ["silent exception", "swallow exception", "bare except"],
        ["timeout misuse", "missing timeout"],
        ["resource leak", "connection leak", "not closed"],
        ["retry storm", "bad retry", "unbounded retry"],
    ])
    score += min(5, major_hits)
    dims["correctness"] += min(5, major_hits)

    if any(token in lowered for token in ["critical", "high", "medium", "low"]):
        score += 1
        dims["reasoning"] += 1
    if any(token in lowered for token in ["deadlock", "duplicate requests", "latency amplification", "data corruption"]):
        score += 1
        dims["reasoning"] += 1
    if any(token in lowered for token in ["use finally", "use context manager", "add timeout", "bounded retries", "log and rethrow"]):
        score += 1
        dims["correctness"] += 1

    return min(score, 10), {"preview": answer[:1200]}, dims


def score_de_04(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    lowered = answer.lower()
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    score = 0

    required_sections = [
        "abstract",
        "problem statement",
        "protocol overview",
        "message types and fields",
        "migration algorithm",
        "failure modes and recovery",
        "performance considerations",
        "security / correctness constraints",
    ]
    if sum(1 for sec in required_sections if sec in lowered) >= 7:
        score += 2
        dims["discipline"] += 2

    protocol_hits = de_keyword_hits(lowered, [
        ["lease", "token"],
        ["epoch", "version"],
        ["ack", "acknowledgement"],
        ["copy", "transfer"],
        ["activate", "cutover"],
    ])
    score += min(3, protocol_hits)
    dims["correctness"] += min(3, protocol_hits)

    msg_field_hits = de_keyword_hits(lowered, [
        ["expert_id"], ["source_node"], ["target_node"], ["layer_id"], ["checksum", "hash"],
    ])
    score += min(2, msg_field_hits)
    dims["discipline"] += min(2, msg_field_hits)

    failure_hits = de_keyword_hits(lowered, [
        ["rollback"], ["timeout"], ["partial failure"], ["idempotent"], ["retry"],
    ])
    score += min(2, failure_hits)
    dims["reasoning"] += min(2, failure_hits)

    perf_hits = de_keyword_hits(lowered, [
        ["bandwidth"], ["latency"], ["warmup", "cache warmup"], ["backpressure"],
    ])
    if perf_hits >= 2:
        score += 1
        dims["reasoning"] += 1

    if not any(token in lowered for token in ["magic", "just", "simply"]):
        score += 1
        dims["honesty"] += 1

    return min(score, 12), {"preview": answer[:1500]}, dims


def score_de_05(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    lowered = answer.lower()
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    score = 0

    if "not uniquely determined" in lowered or "not unique" in lowered or "underdetermined" in lowered:
        score += 4
        dims["honesty"] += 4

    formulas_count = len(re.findall(r"formula", lowered)) + len(re.findall(r"f\(x, y\)", lowered))
    if formulas_count >= 2 or ("hypothesis 1" in lowered and "hypothesis 2" in lowered):
        score += 3
        dims["reasoning"] += 3

    if any(token in lowered for token in ["simplest hypothesis", "occam", "prefer", "practical"]):
        score += 2
        dims["reasoning"] += 2

    if any(token in lowered for token in ["additional observations", "disambiguate", "ask for", "need more points"]):
        score += 1
        dims["discipline"] += 1

    return min(score, 10), {"preview": answer[:1200]}, dims


def score_de_06(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    lowered = answer.lower()
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    score = 0

    med_hits = de_keyword_hits(lowered, [
        ["ace inhibitor", "ace inhibitors"],
        ["angiotensin converting enzyme", "ace"],
        ["arb", "angiotensin ii receptor blocker", "losartan"],
        ["dry cough", "cough"],
    ])
    score += min(3, med_hits)
    dims["correctness"] += min(3, med_hits)

    ds_hits = de_keyword_hits(lowered, [
        ["lamport"], ["vector clock", "vector clocks"], ["hybrid logical clock", "hlc"],
        ["causal", "causality"], ["total order", "ordering"],
    ])
    score += min(4, ds_hits)
    dims["correctness"] += min(4, ds_hits)

    hw_hits = de_keyword_hits(lowered, [
        ["unified memory"], ["memory bandwidth"], ["npu", "neural engine"], ["accelerator"], ["simd", "amx", "matrix"],
    ])
    score += min(3, hw_hits)
    dims["correctness"] += min(3, hw_hits)

    return min(score, 10), {"preview": answer[:1200]}, dims


def score_de_07(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    data, err = strict_json_loads(answer)
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    details: Dict[str, Any] = {"parse_error": err}
    if not isinstance(data, dict):
        return 0, details, dims

    score = 0
    if all(k in data for k in ["agreed_facts", "source_conflicts", "where_position_A_is_stronger", "where_position_B_is_stronger", "my_recommendation"]):
        score += 2
        dims["discipline"] += 2

    if isinstance(data.get("agreed_facts"), list) and len(data["agreed_facts"]) >= 2:
        score += 2
        dims["correctness"] += 2
    if isinstance(data.get("source_conflicts"), list) and len(data["source_conflicts"]) >= 2:
        score += 3
        dims["reasoning"] += 3
    if isinstance(data.get("where_position_A_is_stronger"), list) and isinstance(data.get("where_position_B_is_stronger"), list):
        if len(data["where_position_A_is_stronger"]) >= 1 and len(data["where_position_B_is_stronger"]) >= 1:
            score += 2
            dims["reasoning"] += 2
    rec = data.get("my_recommendation", {})
    if isinstance(rec, dict) and rec.get("default_choice") and isinstance(rec.get("decision_criteria"), list) and len(rec["decision_criteria"]) >= 2:
        score += 3
        dims["honesty"] += 3

    details["parsed"] = data
    return min(score, 10), details, dims


def score_de_08(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    data, err = strict_json_loads(answer)
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    details: Dict[str, Any] = {"parse_error": err}
    if not isinstance(data, dict):
        return 0, details, dims

    score = 0
    if all(k in data for k in ["confirmed_facts", "conflicts", "unknowns", "next_questions"]):
        score += 2
        dims["discipline"] += 2
    if isinstance(data.get("confirmed_facts"), list) and len(data["confirmed_facts"]) >= 2:
        score += 2
        dims["correctness"] += 2
    if isinstance(data.get("conflicts"), list) and len(data["conflicts"]) >= 1:
        score += 2
        dims["reasoning"] += 2
    if isinstance(data.get("unknowns"), list) and len(data["unknowns"]) >= 1:
        score += 2
        dims["honesty"] += 2
    if isinstance(data.get("next_questions"), list) and len(data["next_questions"]) >= 2:
        score += 2
        dims["reasoning"] += 2
    details["parsed"] = data
    return min(score, 8), details, dims


def score_de_09(answer: str) -> Tuple[int, Dict[str, Any], Dict[str, int]]:
    dims = {"correctness": 0, "reasoning": 0, "discipline": 0, "honesty": 0}
    details: Dict[str, Any] = {}
    bullets = [line.strip() for line in answer.splitlines() if line.strip().startswith(("-", "*"))]
    score = 0
    if len(bullets) == 6:
        score += 2
        dims["discipline"] += 2

    counts_ok = 0
    for bullet in bullets:
        words = re.findall(r"\b\S+\b", bullet.lstrip("-* "))
        if 18 <= len(words) <= 28:
            counts_ok += 1
    if counts_ok == 6:
        score += 2
        dims["discipline"] += 2

    joined = "\n".join(bullets)
    if len(re.findall(r"\bPostgreSQL\b", joined)) == 1 and len(re.findall(r"\bcanary\b", joined, flags=re.IGNORECASE)) == 1 and len(re.findall(r"\brollback\b", joined, flags=re.IGNORECASE)) == 1:
        score += 3
        dims["discipline"] += 3

    if re.search(r"\b\d+(?:\.\d+)?%\b", joined) or re.search(r"\b\d+\b", joined):
        score += 1
        dims["correctness"] += 1

    if not contains_word_case_insensitive(joined, "obviously"):
        score += 1
        dims["honesty"] += 1

    if bullets and any(token in bullets[-1].lower() for token in ["recommend", "recommendation", "i recommend", "we recommend"]):
        score += 1
        dims["reasoning"] += 1

    details["bullets"] = bullets
    details["bullet_word_counts"] = [len(re.findall(r"\b\S+\b", b.lstrip("-* "))) for b in bullets]
    return min(score, 10), details, dims


TESTS: List[TestCase] = [
    TestCase(
        test_id="DE-01",
        name="Distributed incident diagnosis",
        weight=15,
        scorer=score_de_01,
        prompt="""You are diagnosing a production incident.

System:
- API Gateway -> Auth Service -> User Service -> PostgreSQL
- API Gateway -> Order Service -> PostgreSQL (separate DB)

Symptoms:
1. Every 2-3 hours, Order Service latency rises from 200ms to 5+ seconds
2. CPU remains ~5%, memory ~40%
3. PostgreSQL active connections rise from 20 to 100
4. Auth Service and User Service remain healthy
5. Restarting Order Service fixes the problem temporarily
6. Order Service logs repeatedly show: \"Waiting for connection from pool\"

Write a structured diagnosis with these sections only:
1. Most likely root cause
2. Why the issue appears after 2-3 hours
3. Why restart helps
4. Immediate mitigations
5. Durable fix
6. Prevention and observability
7. Confidence and alternative hypotheses""",
        max_tokens=2200,
    ),
    TestCase(
        test_id="DE-02",
        name="Realistic coding task",
        weight=15,
        scorer=score_de_02,
        prompt="""Write Python code only.

Implement an in-memory TTL cache:

class TTLCache:
    def __init__(self):
        ...
    def set(self, key, value, ttl_seconds):
        ...
    def get(self, key):
        ...
    def delete(self, key):
        ...
    def cleanup(self):
        ...

Rules:
- expired keys must not be returned
- get() should return None for missing or expired keys
- cleanup() removes all expired keys
- ttl_seconds may be float
- setting an existing key overwrites value and TTL
- do not use external libraries""",
        max_tokens=2200,
    ),
    TestCase(
        test_id="DE-03",
        name="Code review / bug hunt",
        weight=10,
        scorer=score_de_03,
        prompt="""Review the Python code below. Find the problems and use this exact structure for each issue:
- Issue
- Severity
- Why it matters
- Minimal fix

Code:

import time
import requests

cache = {}

def fetch_profile(user_id):
    try:
        if user_id in cache:
            return cache[user_id]
        for _ in range(10):
            r = requests.get(f\"https://api.example.com/users/{user_id}\")
            if r.status_code == 200:
                cache[user_id] = r.json()
                return cache[user_id]
            time.sleep(0.5)
    except:
        return None

    return None
""",
        max_tokens=1800,
    ),
    TestCase(
        test_id="DE-04",
        name="Technical RFC",
        weight=12,
        scorer=score_de_04,
        prompt="""Write a technical RFC of 500-700 words.

Topic:
Protocol for automatic migration of hot experts between nodes in a distributed MoE inference cluster.

Context:
- 228B MoE model
- 256 experts
- 62 layers
- 4 nodes with 96GB RAM each
- expert popularity changes over time

Required sections:
1. Abstract
2. Problem Statement
3. Protocol Overview
4. Message Types and Fields
5. Migration Algorithm
6. Failure Modes and Recovery
7. Performance Considerations
8. Security / correctness constraints""",
        max_tokens=2600,
    ),
    TestCase(
        test_id="DE-05",
        name="Ambiguity / underdetermination honesty test",
        weight=10,
        scorer=score_de_05,
        prompt="""Consider the observations:

f(1,1)=1
f(2,3)=8
f(3,2)=9
f(4,1)=16
f(1,5)=1
f(5,2)=25
f(3,3)=27
f(2,5)=32
f(10,1)=100
f(2,10)=1024

Tasks:
1. State clearly whether the formula is uniquely determined by these observations.
2. If not, provide two different formulas that both fit all observations.
3. Propose the simplest hypothesis you would use in practice and explain why.
4. State what additional observations would disambiguate the rule fastest.""",
        max_tokens=1800,
    ),
    TestCase(
        test_id="DE-06",
        name="Multi-domain factual depth",
        weight=10,
        scorer=score_de_06,
        prompt="""Answer concisely and accurately.

1. Medicine:
How do ACE inhibitors (example: captopril) differ from ARBs (example: losartan) in mechanism of action, and which is typically preferred when ACE inhibitor causes dry cough?

2. Distributed systems:
Contrast Lamport timestamps, Vector clocks, and Hybrid Logical Clocks. For each, name one realistic usage pattern.

3. Hardware:
Give 3 specific architectural reasons why Apple M-series can be strong on ML inference at low power envelopes.
Avoid vague statements.""",
        max_tokens=2000,
    ),
    TestCase(
        test_id="DE-07",
        name="Contradictory sources synthesis",
        weight=10,
        scorer=score_de_07,
        prompt="""Read the source fragments and return STRICT JSON only.

Source A:
\"For small teams with a single product boundary, a modular monolith usually yields lower operational cost and faster iteration.\"

Source B:
\"Microservices become attractive when teams need independent deployment, isolated scaling, and hard ownership boundaries.\"

Source C:
\"Many companies moved too early to microservices, yet large organizations with many domains often outgrow a monolith later.\"

Return:
{
  \"agreed_facts\": [],
  \"source_conflicts\": [],
  \"where_position_A_is_stronger\": [],
  \"where_position_B_is_stronger\": [],
  \"my_recommendation\": {
    \"default_choice\": \"\",
    \"decision_criteria\": []
  }
}""",
        max_tokens=1800,
    ),
    TestCase(
        test_id="DE-08",
        name="Long-context extraction with contradictions",
        weight=8,
        scorer=score_de_08,
        prompt="""Return STRICT JSON only.

Document 1:
\"The canary deploy started at 09:00 UTC. Error rate stayed below 0.5% for the first 20 minutes. Traffic share was increased from 5% to 20%.\"

Document 2:
\"At 09:18 UTC the on-call engineer reported elevated 502 rates from the canary. Rollback was discussed, though not yet executed.\"

Document 3:
\"Postmortem draft: rollback began at 09:25 UTC after canary traffic reached 20%. The root cause is still unknown. Some logs suggest a connection pool issue, but this is not confirmed.\"

Return:
{
  \"confirmed_facts\": [],
  \"conflicts\": [],
  \"unknowns\": [],
  \"next_questions\": []
}""",
        max_tokens=1600,
    ),
    TestCase(
        test_id="DE-09",
        name="Constraint-heavy professional memo",
        weight=10,
        scorer=score_de_09,
        prompt="""Write a decision memo for an engineering manager.

Constraints:
1. Exactly 6 bullet points
2. Each bullet point must be 18-28 words
3. Mention PostgreSQL, canary, and rollback exactly once each
4. Include one numeric KPI target
5. Do not use the word \"obviously\"
6. Final bullet must contain a recommendation""",
        max_tokens=1700,
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
        except Exception as exc:  # noqa: BLE001
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

    not_executed = [
        r["test_id"] for r in results
        if isinstance(r.get("details"), dict) and r["details"].get("executed") is False
    ]
    summary = {
        **metadata.to_dict(),
        "suite": SUITE_NAME,
        "run_dir": RUN_DIR,
        "complete": not not_executed,
        "not_executed": not_executed,
        "total_score": total_score,
        "total_max": total_max,
        "pct": round(100 * total_score / total_max, 2) if total_max else 0.0,
        "dimension_totals": dim_totals,
        "results_jsonl": RESULTS_JSONL,
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
        f.write(f"Deep Eval v1 summary\nrun_dir={RUN_DIR}\n")
        for r in results:
            dims = r["dimension_scores"]
            f.write(
                f"{r['test_id']} {r['test_name']}: {r['score']}/{r['weight']} [{r['status']}] | "
                f"C={dims.get('correctness',0)} R={dims.get('reasoning',0)} D={dims.get('discipline',0)} H={dims.get('honesty',0)}\n"
            )
        f.write(f"\nTOTAL: {total_score}/{total_max} ({summary['pct']}%)\n")
        f.write(f"DIMENSIONS: {json.dumps(dim_totals, ensure_ascii=False)}\n")
    return summary


if __name__ == "__main__":
    summary = run_suite()
    print("\n" + "=" * 72)
    print(f"DEEP EVAL COMPLETE: {summary['total_score']}/{summary['total_max']} ({summary['pct']}%)")
    if summary.get("not_executed"):
        print(f"INCOMPLETE: code not run for {', '.join(summary['not_executed'])}; scored 0 because the evaluator does not execute model code")
    print(f"Dimension totals: {summary['dimension_totals']}")
    print(f"Results: {summary['results_jsonl']}")
    print(f"Summary: {SUMMARY_JSON}")
    print("=" * 72)
