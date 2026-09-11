#!/usr/bin/env python3
"""Fast QC v2 for post-quantization degradation checks with baseline comparison and fail gates.

Usage:
  python run_fast_qc.py
  EVAL_API_BASE=http://127.0.0.1:8080 EVAL_OUT=bench_results python run_fast_qc.py
  EVAL_USE_COMPLETION=1 EVAL_QUANT_NAME=Q4_K_XL python run_fast_qc.py
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

from eval_common import (
    API_BASE,
    OUT_DIR,
    RUN_ID,
    CodeExecutionDisabled,
    CodeTestResult,
    EvalClient,
    RunMetadata,
    append_jsonl,
    compare_summary_to_baseline,
    contains_word_case_insensitive,
    count_sentences,
    ensure_dir,
    extract_code,
    extract_xml_block,
    format_delta,
    get_baseline_summary_from_env,
    safe_exec_python,
    split_paragraphs,
    strict_json_loads,
    write_json,
    write_text,
)


SUITE_NAME = "fast_qc_v2"
RUN_DIR = os.path.join(OUT_DIR, SUITE_NAME, RUN_ID)
RESULTS_JSONL = os.path.join(RUN_DIR, "results.jsonl")
SUMMARY_JSON = os.path.join(RUN_DIR, "summary.json")
SUMMARY_TXT = os.path.join(RUN_DIR, "summary.txt")
METADATA_JSON = os.path.join(RUN_DIR, "metadata.json")

SECTION_WEIGHTS = {
    "exactness": 20,
    "extraction": 25,
    "instruction_following": 15,
    "code": 30,
    "diagnosis": 10,
}

TEST_SECTIONS = {
    "FQC-01": "exactness",
    "FQC-02": "exactness",
    "FQC-03": "extraction",
    "FQC-04": "extraction",
    "FQC-05": "instruction_following",
    "FQC-06": "code",
    "FQC-07": "code",
    "FQC-08": "diagnosis",
}

FAIL_TOTAL_THRESHOLD = float(os.environ.get("EVAL_FAIL_TOTAL_THRESHOLD", "78"))
BORDERLINE_TOTAL_THRESHOLD = float(os.environ.get("EVAL_BORDERLINE_TOTAL_THRESHOLD", "85"))
FAIL_TOTAL_DROP = float(os.environ.get("EVAL_FAIL_TOTAL_DROP", "5"))
FAIL_CODE_JSON_DROP = float(os.environ.get("EVAL_FAIL_CODE_JSON_DROP", "8"))
CRITICAL_MIN_PCT = float(os.environ.get("EVAL_CRITICAL_MIN_PCT", "0.6"))
FAIL_ON_GATE = os.environ.get("EVAL_FAIL_ON_GATE", "0") == "1"



@dataclass
class TestCase:
    test_id: str
    name: str
    weight: int
    prompt: str
    scorer: Callable[[str], Tuple[int, Dict[str, Any]]]
    max_tokens: Optional[int] = None


# ---------- Scorers ----------

def score_fqc_01(answer: str) -> Tuple[int, Dict[str, Any]]:
    data, err = strict_json_loads(answer)
    details: Dict[str, Any] = {"parse_error": err}
    if not isinstance(data, dict):
        return 0, details

    score = 0
    units = data.get("units", {})
    revenue = data.get("revenue", {})
    verification = data.get("verification", {})

    if units == {"tier1": 600, "tier2": 250, "tier3": 150}:
        score += 3
    if revenue == {"tier1": 30000, "tier2": 18750, "tier3": 15000, "total": 63750}:
        score += 3

    wap = data.get("weighted_average_price")
    if isinstance(wap, (int, float)) and math.isclose(float(wap), 63.75, rel_tol=0.0, abs_tol=1e-9):
        score += 2

    if verification == {
        "units_sum_ok": True,
        "revenue_sum_ok": True,
        "average_recomputed_ok": True,
    }:
        score += 1

    possible_errors = data.get("possible_errors")
    confidence_pct = data.get("confidence_pct")
    if (
        isinstance(possible_errors, list)
        and len(possible_errors) >= 2
        and all(isinstance(x, str) and x.strip() for x in possible_errors[:2])
        and isinstance(confidence_pct, (int, float))
        and 70 <= float(confidence_pct) <= 100
    ):
        score += 1

    details["parsed"] = data
    return min(score, 10), details


def score_fqc_02(answer: str) -> Tuple[int, Dict[str, Any]]:
    data, err = strict_json_loads(answer)
    details: Dict[str, Any] = {"parse_error": err}
    if not isinstance(data, dict):
        return 0, details
    score = 0
    algorithm = str(data.get("algorithm", "")).lower()
    if "caesar" in algorithm:
        score += 3
    shift = data.get("shift")
    if shift == 3:
        score += 2
    if str(data.get("decrypted", "")).upper() == "SECRET MESSAGE":
        score += 3
    if str(data.get("encrypted", "")).upper() == "SBWKRQ":
        score += 2
    details["parsed"] = data
    return min(score, 10), details


def score_fqc_03(answer: str) -> Tuple[int, Dict[str, Any]]:
    data, err = strict_json_loads(answer)
    details: Dict[str, Any] = {"parse_error": err}
    if not isinstance(data, dict):
        return 0, details
    score = 4  # strict JSON only if parser succeeded on whole answer

    if data.get("company") == "TechVision" and data.get("year") == 2024:
        score += 2

    revenue = data.get("revenue", {})
    if revenue == {"value": 4.2, "unit": "billion", "currency": "rubles", "growth_pct": 23}:
        score += 3

    profit = data.get("profit", {})
    if profit == {"value": 890, "unit": "million", "currency": "rubles", "growth_pct": 15}:
        score += 2

    if data.get("employees") == {"previous": 1200, "current": 1450}:
        score += 1

    markets = data.get("markets", [])
    expected_markets = [
        {"country": "Russia", "share_pct": 65},
        {"country": "Kazakhstan", "share_pct": 20},
        {"country": "Uzbekistan", "share_pct": 15},
    ]
    if markets == expected_markets:
        score += 2

    plans = data.get("plans", [])
    if data.get("ceo") == "Alexei Petrov" and plans == [{"action": "enter", "market": "Turkish market", "year": 2025}]:
        score += 1

    details["parsed"] = data
    return min(score, 15), details


def score_fqc_04(answer: str) -> Tuple[int, Dict[str, Any]]:
    data, err = strict_json_loads(answer)
    details: Dict[str, Any] = {"parse_error": err}
    if not isinstance(data, dict):
        return 0, details

    score = 0
    if data.get("assignee") == "Alex":
        score += 2

    actions = data.get("actions", [])
    if isinstance(actions, list):
        action_tasks = [a.get("task") for a in actions if isinstance(a, dict)]
        normalized = set(action_tasks)
        expected = {
            "prepare migration plan for PostgreSQL 16",
            "send incident summary to client after root cause is confirmed",
            "update runbook with pool timeout settings",
        }
        if normalized == expected:
            score += 4
        if len(actions) == 3:
            score += 2
        deadlines = {a.get("task"): a.get("deadline") for a in actions if isinstance(a, dict)}
        if deadlines.get("prepare migration plan for PostgreSQL 16") == "July 15":
            score += 2

    details["parsed"] = data
    return min(score, 10), details


def score_fqc_05(answer: str) -> Tuple[int, Dict[str, Any]]:
    details: Dict[str, Any] = {}
    email_block = extract_xml_block(answer, "EMAIL")
    json_block = extract_xml_block(answer, "JSON")
    if not email_block or not json_block:
        return 0, {"error": "missing EMAIL or JSON block"}

    score = 2
    self_check, err = strict_json_loads(json_block)
    details["parse_error"] = err
    details["self_check"] = self_check

    paragraphs = split_paragraphs(email_block)
    if len(paragraphs) == 4:
        score += 3

    sent_counts = [count_sentences(p) for p in paragraphs]
    if len(paragraphs) == 4 and all(c == 2 for c in sent_counts):
        score += 3

    cloudsync_count = len(re.findall(r"\bCloudSync Pro\b", email_block))
    if cloudsync_count == 1:
        score += 2

    if "July 15" in email_block and ("20% discount" in email_block or "20 percent discount" in email_block):
        score += 2

    if not contains_word_case_insensitive(email_block, "but"):
        score += 2

    if email_block.strip().endswith("?"):
        score += 1

    details["email_paragraphs"] = paragraphs
    details["sentence_counts"] = sent_counts
    return min(score, 15), details


def run_deep_equal_tests(func) -> CodeTestResult:
    tests = [
        (({"a": 1, "b": 2}, {"b": 2, "a": 1}), True),
        (([1, 2], [2, 1]), False),
        (((0.1 + 0.2), 0.3), True),
        (({"a": [1, {"b": None}]}, {"a": [1, {"b": None}]}), True),
        (((True), 1), False),
        (({"x": [1, 2, 3]}, {"x": [1, 2]}), False),
        (({"x": 1.0000000001}, {"x": 1.0}), True),
        (({"x": 1.0001}, {"x": 1.0}), False),
        ((None, None), True),
        (("1", 1), False),
    ]
    failures: List[str] = []
    passed = 0
    for idx, (args, expected) in enumerate(tests, start=1):
        try:
            actual = func(*args)
            if actual == expected:
                passed += 1
            else:
                failures.append(f"test {idx}: expected {expected}, got {actual}")
        except Exception as exc:  # noqa: BLE001
            failures.append(f"test {idx}: exception {exc}")
    return CodeTestResult(passed=passed, total=len(tests), failures=failures)


def score_fqc_06(answer: str) -> Tuple[int, Dict[str, Any]]:
    code = extract_code(answer)
    details: Dict[str, Any] = {"code_preview": code[:500]}
    try:
        ns = safe_exec_python(code)
    except CodeExecutionDisabled as exc:
        # Not the same as a wrong answer: we declined to run it.
        details["executed"] = False
        details["error"] = str(exc)
        return 0, details
    except Exception as exc:  # noqa: BLE001
        details["error"] = str(exc)
        return 0, details

    func = ns.get("deep_equal")
    if not callable(func):
        return 0, {**details, "error": "deep_equal not found"}

    score = 3
    result = run_deep_equal_tests(func)
    details["test_result"] = {"passed": result.passed, "total": result.total, "failures": result.failures}

    # first 4 as public tests, remaining 6 as hidden tests
    public_passed = result.total - len([f for f in result.failures if int(re.search(r"test (\d+)", f).group(1)) <= 4]) if result.failures else min(4, result.passed)
    # compute explicitly for robustness
    public_failures = 0
    for f in result.failures:
        m = re.search(r"test (\d+)", f)
        if m and int(m.group(1)) <= 4:
            public_failures += 1
    public_passed = 4 - public_failures
    hidden_passed = result.passed - public_passed

    score += max(0, min(7, round(7 * public_passed / 4)))
    score += max(0, min(10, round(10 * hidden_passed / 6)))
    return min(score, 20), details


def run_merge_intervals_tests(func) -> CodeTestResult:
    tests = [
        (([],), []),
        (([[1, 3], [2, 4]],), [[1, 4]]),
        (([[1, 3], [3, 5]],), [[1, 5]]),
        (([[1, 10], [2, 3], [4, 8]],), [[1, 10]]),
        (([[5, 7], [1, 2], [2, 3]],), [[1, 3], [5, 7]]),
        (([[1, 2], [4, 5]],), [[1, 2], [4, 5]]),
    ]
    failures: List[str] = []
    passed = 0
    for idx, (args, expected) in enumerate(tests, start=1):
        try:
            actual = func(*args)
            if actual == expected:
                passed += 1
            else:
                failures.append(f"test {idx}: expected {expected}, got {actual}")
        except Exception as exc:  # noqa: BLE001
            failures.append(f"test {idx}: exception {exc}")
    return CodeTestResult(passed=passed, total=len(tests), failures=failures)


def score_fqc_07(answer: str) -> Tuple[int, Dict[str, Any]]:
    code = extract_code(answer)
    details: Dict[str, Any] = {"code_preview": code[:500]}
    try:
        ns = safe_exec_python(code)
    except CodeExecutionDisabled as exc:
        # Not the same as a wrong answer: we declined to run it.
        details["executed"] = False
        details["error"] = str(exc)
        return 0, details
    except Exception as exc:  # noqa: BLE001
        details["error"] = str(exc)
        return 0, details

    func = ns.get("merge_intervals")
    if not callable(func):
        return 0, {**details, "error": "merge_intervals not found"}

    result = run_merge_intervals_tests(func)
    details["test_result"] = {"passed": result.passed, "total": result.total, "failures": result.failures}

    score = 2
    public_failures = 0
    for f in result.failures:
        m = re.search(r"test (\d+)", f)
        if m and int(m.group(1)) <= 3:
            public_failures += 1
    public_passed = 3 - public_failures
    hidden_passed = result.passed - public_passed
    score += max(0, min(3, public_passed))
    score += max(0, min(5, round(5 * hidden_passed / 3)))
    return min(score, 10), details


def score_fqc_08(answer: str) -> Tuple[int, Dict[str, Any]]:
    data, err = strict_json_loads(answer)
    details: Dict[str, Any] = {"parse_error": err}
    if not isinstance(data, dict):
        return 0, details

    score = 0
    root = str(data.get("root_cause", "")).lower()
    periodic = str(data.get("why_periodic", "")).lower()
    restart = str(data.get("why_restart_helps", "")).lower()
    fixes = " ".join(data.get("fixes", [])) if isinstance(data.get("fixes"), list) else ""
    prevention = " ".join(data.get("prevention", [])) if isinstance(data.get("prevention"), list) else ""

    if any(token in root for token in ["connection leak", "pool exhaustion", "connections not returned", "db pool exhausted"]):
        score += 4
    if any(token in periodic for token in ["accumul", "leak", "gradual", "scheduled", "over time"]):
        score += 2
    if any(token in restart for token in ["reset", "recreate", "pool", "state", "connections"]):
        score += 1
    if any(token in fixes.lower() for token in ["close", "finally", "context manager", "timeout", "pool size", "return connection"]):
        score += 2
    if any(token in prevention.lower() for token in ["monitor", "observability", "alert", "test", "instrument", "metrics"]):
        score += 1

    details["parsed"] = data
    return min(score, 10), details


TESTS: List[TestCase] = [
    TestCase(
        test_id="FQC-01",
        name="Arithmetic + self-check",
        weight=10,
        scorer=score_fqc_01,
        prompt="""Solve the problem and return STRICT JSON only.

Problem:
A company sold 1000 units of a product.
60% at $50 each, 25% at $75 each, and the rest at $100 each.
What is the weighted average selling price?

Return exactly this JSON schema:
{
  \"units\": {\"tier1\": 0, \"tier2\": 0, \"tier3\": 0},
  \"revenue\": {\"tier1\": 0, \"tier2\": 0, \"tier3\": 0, \"total\": 0},
  \"weighted_average_price\": 0,
  \"possible_errors\": [\"\", \"\"],
  \"verification\": {
    \"units_sum_ok\": true,
    \"revenue_sum_ok\": true,
    \"average_recomputed_ok\": true
  },
  \"confidence_pct\": 0
}""",
    ),
    TestCase(
        test_id="FQC-02",
        name="Exact symbolic transform",
        weight=10,
        scorer=score_fqc_02,
        prompt="""Return STRICT JSON only.

Examples:
\"KHOOR\" -> \"HELLO\"
\"ZRUOG\" -> \"WORLD\"
\"FDHVDU\" -> \"CAESAR\"
\"FLSKHU\" -> \"CIPHER\"
\"DWWDFN\" -> \"ATTACK\"

Tasks:
1. Identify the algorithm
2. Decrypt: \"VHFUHW PHVVDJH\"
3. Encrypt: \"PYTHON\"

Return:
{
  \"algorithm\": \"\",
  \"shift\": 0,
  \"decrypted\": \"\",
  \"encrypted\": \"\"
}""",
    ),
    TestCase(
        test_id="FQC-03",
        name="Strict JSON extraction",
        weight=15,
        scorer=score_fqc_03,
        prompt="""Analyze the text and return STRICT JSON only. No extra text.

Text:
\"TechVision increased its revenue by 23% to 4.2 billion rubles in 2024.
Net profit was 890 million rubles, 15% more than the previous year.
The company grew from 1200 to 1450 employees.
Key markets: Russia (65%), Kazakhstan (20%), Uzbekistan (15%).
CEO Alexei Petrov announced plans to enter the Turkish market in 2025.\"

Return:
{
  \"company\": \"\",
  \"year\": 0,
  \"revenue\": {\"value\": 0, \"unit\": \"\", \"currency\": \"\", \"growth_pct\": 0},
  \"profit\": {\"value\": 0, \"unit\": \"\", \"currency\": \"\", \"growth_pct\": 0},
  \"employees\": {\"previous\": 0, \"current\": 0},
  \"markets\": [
    {\"country\": \"\", \"share_pct\": 0}
  ],
  \"ceo\": \"\",
  \"plans\": [
    {\"action\": \"\", \"market\": \"\", \"year\": 0}
  ]
}""",
    ),
    TestCase(
        test_id="FQC-04",
        name="Distractor-aware extraction",
        weight=10,
        scorer=score_fqc_04,
        prompt="""Return STRICT JSON only.

Task: extract ONLY the action items assigned to Alex.
Ignore discussion notes, rejected ideas, and tentative suggestions.

Meeting notes:
- Maria: let's maybe revisit pricing next month
- Alex: prepare migration plan for PostgreSQL 16 by July 15
- Rejected: move everything to microservices immediately
- Ivan: collect logs from the canary deployment
- Alex: send incident summary to client after root cause is confirmed
- Tentative: maybe evaluate ClickHouse in Q4
- Alex: update runbook with pool timeout settings
- Discussion: people are tired of noisy alerts
- Oksana: draft hiring plan for SRE role

Return:
{
  \"assignee\": \"Alex\",
  \"actions\": [
    {\"task\": \"\", \"deadline\": null}
  ]
}""",
    ),
    TestCase(
        test_id="FQC-05",
        name="Multi-constraint formatting",
        weight=15,
        scorer=score_fqc_05,
        prompt="""Write an email that satisfies ALL constraints below.
After the email, return a JSON self-check.

Constraints:
1. Exactly 4 paragraphs in the email
2. Each paragraph has exactly 2 sentences
3. Mention the product name CloudSync Pro exactly once
4. Mention the date July 15
5. Mention a 20% discount
6. Do not use the word \"but\" anywhere
7. Final sentence of the email must be a question

Return in this format exactly:
<EMAIL>
...email here...
</EMAIL>
<JSON>
{\"paragraphs\":0,\"sentences_per_paragraph\":[],\"used_cloudsync_pro_count\":0,\"mentions_july_15\":false,\"mentions_20pct_discount\":false,\"contains_forbidden_word_but\":false,\"ends_with_question\":false}
</JSON>""",
    ),
    TestCase(
        test_id="FQC-06",
        name="Code generation with execution",
        weight=20,
        scorer=score_fqc_06,
        max_tokens=2200,
        prompt="""Write Python code only, no explanation.

Implement:
def deep_equal(a, b) -> bool

Rules:
- dict: key order does not matter
- list: element order matters
- float: compare with epsilon=1e-9
- None, bool, int, str: exact match, and type must match too
- arbitrary nested dict/list combinations

Return code only.""",
    ),
    TestCase(
        test_id="FQC-07",
        name="Bugfix snippet",
        weight=10,
        scorer=score_fqc_07,
        max_tokens=1800,
        prompt="""Return corrected Python code only.

The function should merge overlapping intervals.
Current code is buggy.

def merge_intervals(items):
    items = sorted(items)
    result = []
    for start, end in items:
        if not result:
            result.append([start, end])
        else:
            last = result[-1]
            if start < last[1]:
                last[1] = end
            else:
                result.append([start, end])
    return result

Requirements:
- overlapping intervals must merge
- touching intervals must also merge, e.g. [1,3] and [3,5] -> [1,5]
- merged end must be max(current_end, last_end)
- empty input must return []""",
    ),
    TestCase(
        test_id="FQC-08",
        name="Compact incident diagnosis",
        weight=10,
        scorer=score_fqc_08,
        prompt="""Return STRICT JSON only.

Incident:
- Every 2-3 hours, Order Service latency rises from 200ms to 5+ seconds
- CPU stays ~5%, memory stays ~40%
- PostgreSQL active connections rise from 20 to 100
- Logs contain: \"Waiting for connection from pool\"
- Restarting Order Service fixes the issue temporarily

Return:
{
  \"root_cause\": \"\",
  \"why_periodic\": \"\",
  \"why_restart_helps\": \"\",
  \"fixes\": [\"\", \"\"],
  \"prevention\": [\"\", \"\"],
  \"confidence_pct\": 0
}""",
    ),
]


def evaluate_fast_qc_gates(summary: Dict[str, Any], comparison: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    reasons: List[str] = []
    total_score = float(summary.get("total_score", 0))
    gate_status = "PASS"

    critical_tests = {"FQC-03", "FQC-05", "FQC-06"}
    for test in summary.get("tests", []):
        if test.get("test_id") in critical_tests:
            weight = float(test.get("weight", 0) or 0)
            score = float(test.get("score", 0) or 0)
            if weight > 0 and score / weight < CRITICAL_MIN_PCT:
                reasons.append(
                    f"{test['test_id']} below critical minimum: {score:.1f}/{weight:.1f} < {CRITICAL_MIN_PCT*100:.0f}%"
                )

    if total_score < FAIL_TOTAL_THRESHOLD:
        reasons.append(f"total score {total_score:.1f} below fail threshold {FAIL_TOTAL_THRESHOLD:.1f}")

    if comparison:
        total_delta = float(comparison.get("total_score_delta", 0))
        section_deltas = comparison.get("section_deltas", {}) or {}
        code_json_delta = float(section_deltas.get("code", 0)) + float(section_deltas.get("extraction", 0))

        if total_delta <= -FAIL_TOTAL_DROP:
            reasons.append(f"total score regressed by {abs(total_delta):.1f}, worse than allowed {FAIL_TOTAL_DROP:.1f}")
        if code_json_delta <= -FAIL_CODE_JSON_DROP:
            reasons.append(
                f"combined code+extraction regressed by {abs(code_json_delta):.1f}, worse than allowed {FAIL_CODE_JSON_DROP:.1f}"
            )

    if reasons:
        gate_status = "FAIL"
    elif total_score < BORDERLINE_TOTAL_THRESHOLD or (comparison and float(comparison.get("total_score_delta", 0)) < 0):
        gate_status = "BORDERLINE"

    return {
        "status": gate_status,
        "reasons": reasons,
        "thresholds": {
            "fail_total_threshold": FAIL_TOTAL_THRESHOLD,
            "borderline_total_threshold": BORDERLINE_TOTAL_THRESHOLD,
            "fail_total_drop": FAIL_TOTAL_DROP,
            "fail_code_json_drop": FAIL_CODE_JSON_DROP,
            "critical_min_pct": CRITICAL_MIN_PCT,
        },
    }


def build_fast_qc_summary_text(summary: Dict[str, Any]) -> str:
    lines = [f"Fast QC v2 summary", f"run_dir={summary['run_dir']}"]
    for r in summary["tests"]:
        lines.append(f"{r['test_id']} {r['test_name']}: {r['score']}/{r['weight']} [{r['status']}]")
    lines.append("")
    lines.append(f"TOTAL: {summary['total_score']}/{summary['total_max']} ({summary['pct']}%)")
    if summary.get("not_executed"):
        lines.append(
            "INCOMPLETE: code not run for " + ", ".join(summary["not_executed"])
            + "; those tasks scored 0 because the evaluator does not execute model code"
        )
    lines.append(f"SECTION TOTALS: {json.dumps(summary.get('section_totals', {}), ensure_ascii=False)}")
    gate = summary.get("gate", {})
    if gate:
        lines.append(f"GATE: {gate.get('status', 'UNKNOWN')}")
        for reason in gate.get("reasons", []):
            lines.append(f"  - {reason}")
    cmp = summary.get("baseline_comparison")
    if cmp:
        lines.append("BASELINE COMPARISON:")
        lines.append(
            f"  baseline={cmp.get('baseline_quant_name')} run_id={cmp.get('baseline_run_id')} total_delta={format_delta(cmp.get('total_score_delta'))} pct_delta={format_delta(cmp.get('pct_delta'))}"
        )
        if cmp.get("section_deltas"):
            lines.append(f"  section_deltas={json.dumps(cmp['section_deltas'], ensure_ascii=False)}")
        if cmp.get("top_regressions"):
            lines.append("  top_regressions:")
            for item in cmp["top_regressions"]:
                lines.append(f"    - {item['test_id']}: {format_delta(item['delta'])}")
    return "\n".join(lines) + "\n"


def run_suite() -> Dict[str, Any]:
    ensure_dir(RUN_DIR)
    metadata = RunMetadata(suite=SUITE_NAME)
    write_json(METADATA_JSON, metadata.to_dict())

    client = EvalClient()
    total_score = 0
    total_max = sum(t.weight for t in TESTS)
    results: List[Dict[str, Any]] = []

    for test in TESTS:
        print(f"\n{'=' * 72}")
        print(f"{test.test_id} | {test.name} | max {test.weight}")
        print(f"{'=' * 72}")
        start = time.time()
        status = "ok"
        answer = ""
        raw_score = 0
        details: Dict[str, Any] = {}
        tokens_out = 0
        error = None
        try:
            answer, tokens_out, _ = client.ask(test.prompt, max_tokens=test.max_tokens)
            raw_score, details = test.scorer(answer)
        except Exception as exc:  # noqa: BLE001
            status = "error"
            error = str(exc)
            details = {"error": error}
        elapsed = time.time() - start
        bounded_score = max(0, min(test.weight, raw_score))
        total_score += bounded_score

        payload = {
            **metadata.to_dict(),
            "test_id": test.test_id,
            "test_name": test.name,
            "weight": test.weight,
            "score": bounded_score,
            "elapsed_sec": round(elapsed, 3),
            "tokens_out": tokens_out,
            "status": status,
            "answer": answer,
            "details": details,
        }
        if error:
            payload["error"] = error
        append_jsonl(RESULTS_JSONL, payload)
        results.append(payload)

        print(f"score: {bounded_score}/{test.weight} | time: {elapsed:.1f}s | tokens: {tokens_out} | status: {status}")
        preview = answer[:1000] if answer else ""
        if preview:
            print(preview)
        if status != "ok":
            print(f"error: {error}")

    section_totals = {name: 0 for name in SECTION_WEIGHTS}
    for r in results:
        section = TEST_SECTIONS.get(r["test_id"])
        if section:
            section_totals[section] += r["score"]

    # A task whose code we declined to run scored zero, which on its own is
    # indistinguishable from a wrong answer. Name those tasks so the total is
    # not read as a complete result.
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
        "section_totals": section_totals,
        "section_weights": SECTION_WEIGHTS,
        "results_jsonl": RESULTS_JSONL,
        "tests": [
            {
                "test_id": r["test_id"],
                "test_name": r["test_name"],
                "score": r["score"],
                "weight": r["weight"],
                "status": r["status"],
                "section": TEST_SECTIONS.get(r["test_id"]),
            }
            for r in results
        ],
    }

    baseline = get_baseline_summary_from_env()
    comparison = compare_summary_to_baseline(summary, baseline)
    if comparison:
        summary["baseline_comparison"] = comparison

    gate = evaluate_fast_qc_gates(summary, comparison)
    summary["gate"] = gate

    write_json(SUMMARY_JSON, summary)
    write_text(SUMMARY_TXT, build_fast_qc_summary_text(summary))
    return summary


if __name__ == "__main__":
    summary = run_suite()
    print("\n" + "=" * 72)
    print(f"FAST QC COMPLETE: {summary['total_score']}/{summary['total_max']} ({summary['pct']}%)")
    print(f"Sections: {summary['section_totals']}")
    if summary.get("baseline_comparison"):
        cmp = summary["baseline_comparison"]
        print(f"Baseline delta: {format_delta(cmp['total_score_delta'])} points ({format_delta(cmp['pct_delta'])} pct)")
    print(f"Gate: {summary['gate']['status']}")
    if summary['gate']['reasons']:
        for reason in summary['gate']['reasons']:
            print(f"  - {reason}")
    print(f"Results: {summary['results_jsonl']}")
    print(f"Summary: {SUMMARY_JSON}")
    print("=" * 72)
    if FAIL_ON_GATE and summary["gate"]["status"] == "FAIL":
        sys.exit(2)
