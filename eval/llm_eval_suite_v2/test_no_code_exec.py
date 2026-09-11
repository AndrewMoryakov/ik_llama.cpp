#!/usr/bin/env python3
"""Checks that the evaluator no longer runs the model's code.

Run: python3 eval/llm_eval_suite_v2/test_no_code_exec.py
"""

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import eval_common
from eval_common import CodeExecutionDisabled, safe_exec_python, validate_python_code
import run_fast_qc


def check(name, cond, extra=""):
    print(f"  {'ok  ' if cond else 'FAIL'} {name}{('   ' + extra) if extra else ''}")
    return cond


def main():
    results = []

    # 1. the call itself refuses
    try:
        safe_exec_python("x = 1")
        results.append(check("safe_exec_python refuses", False, "it returned instead of raising"))
    except CodeExecutionDisabled as exc:
        results.append(check("safe_exec_python refuses", True, str(exc)[:50]))

    # 2. a payload with a side effect leaves no trace
    marker = os.path.join(tempfile.gettempdir(), "ik_eval_should_not_exist.txt")
    if os.path.exists(marker):
        os.unlink(marker)
    payload = (
        "import builtins\n"
        f"builtins.open({marker!r}, 'w').write('executed')\n"
    )
    try:
        safe_exec_python(payload)
    except Exception:
        pass
    results.append(check("side effect did not happen", not os.path.exists(marker)))
    if os.path.exists(marker):
        os.unlink(marker)

    # 3. the AST filter was never a boundary, and this records why.
    #    An escape reached through attributes carries no forbidden name, so the
    #    filter passes it. If exec is ever restored behind this filter, the
    #    payload below runs.
    escape = "cls = ().__class__.__bases__[0]\nsubs = cls.__subclasses__()\n"
    filter_passed = True
    try:
        validate_python_code(escape)
    except eval_common.CodeValidationError:
        filter_passed = False
    results.append(check("AST filter accepts an attribute escape", filter_passed,
                         "this is why exec was removed rather than filtered harder"))

    # 4. a code task reports itself as not executed, not merely wrong
    answer = "```python\ndef deep_equal(a, b):\n    return a == b\n```"
    score, details = run_fast_qc.score_fqc_06(answer)
    results.append(check("code task scores 0", score == 0, f"score={score}"))
    results.append(check("code task marked not executed", details.get("executed") is False,
                         f"executed={details.get('executed')!r}"))

    # 5. the summary says so out loud
    text = run_fast_qc.build_fast_qc_summary_text({
        "run_dir": "/tmp/x", "tests": [], "total_score": 0, "total_max": 100,
        "pct": 0.0, "section_totals": {}, "not_executed": ["FQC-06", "FQC-07"],
    })
    incomplete_lines = [l for l in text.splitlines() if "INCOMPLETE" in l]
    results.append(check("summary text says INCOMPLETE", bool(incomplete_lines),
                         incomplete_lines[0][:70] if incomplete_lines else ""))

    failed = results.count(False)
    print(f"\n{len(results) - failed}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
