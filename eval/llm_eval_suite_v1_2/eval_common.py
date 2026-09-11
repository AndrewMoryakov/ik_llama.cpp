import ast
import json
import os
import re
import time
import urllib.request
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple


API_BASE = os.environ.get("EVAL_API_BASE", "http://127.0.0.1:8080")
OUT_DIR = os.environ.get("EVAL_OUT", "bench_results")
TIMEOUT = int(os.environ.get("EVAL_TIMEOUT", "900"))
MAX_TOKENS = int(os.environ.get("EVAL_MAX_TOKENS", "3000"))
USE_COMPLETION = os.environ.get("EVAL_USE_COMPLETION", "0") == "1"
TEMPERATURE = float(os.environ.get("EVAL_TEMPERATURE", "0.0"))
SEED = os.environ.get("EVAL_SEED")
MODEL_NAME = os.environ.get("EVAL_MODEL_NAME", "unknown_model")
QUANT_NAME = os.environ.get("EVAL_QUANT_NAME", "unknown_quant")
BACKEND_NAME = os.environ.get("EVAL_BACKEND_NAME", "unknown_backend")
BACKEND_VERSION = os.environ.get("EVAL_BACKEND_VERSION", "unknown_version")
RUN_ID = os.environ.get("EVAL_RUN_ID", time.strftime("%Y%m%d_%H%M%S"))
PROMPT_MODE = "completion" if USE_COMPLETION else "chat"


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


@dataclass
class RunMetadata:
    suite: str
    model_name: str = MODEL_NAME
    quant_name: str = QUANT_NAME
    backend_name: str = BACKEND_NAME
    backend_version: str = BACKEND_VERSION
    api_base: str = API_BASE
    prompt_mode: str = PROMPT_MODE
    temperature: float = TEMPERATURE
    seed: Optional[str] = SEED
    max_tokens: int = MAX_TOKENS
    timeout_sec: int = TIMEOUT
    run_id: str = RUN_ID
    timestamp_utc: str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class EvalClient:
    def __init__(self) -> None:
        self.api_base = API_BASE.rstrip("/")
        self.timeout = TIMEOUT
        self.max_tokens = MAX_TOKENS
        self.temperature = TEMPERATURE
        self.seed = SEED
        self.use_completion = USE_COMPLETION

    def ask_chat(self, prompt: str, max_tokens: Optional[int] = None) -> Tuple[str, int, Dict[str, Any]]:
        payload: Dict[str, Any] = {
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens or self.max_tokens,
            "temperature": self.temperature,
        }
        if self.seed is not None:
            payload["seed"] = int(self.seed)
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.api_base}/v1/chat/completions",
            body,
            {"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            data = json.loads(resp.read())
        answer = data["choices"][0]["message"]["content"]
        tokens = data.get("usage", {}).get("completion_tokens", 0)
        return answer, tokens, data

    def ask_completion(self, prompt: str, max_tokens: Optional[int] = None) -> Tuple[str, int, Dict[str, Any]]:
        payload: Dict[str, Any] = {
            "prompt": f"<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n",
            "n_predict": max_tokens or self.max_tokens,
            "temperature": self.temperature,
            "stop": ["<|im_end|>"],
        }
        if self.seed is not None:
            payload["seed"] = int(self.seed)
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.api_base}/completion",
            body,
            {"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            data = json.loads(resp.read())
        raw = data.get("content", "")
        tokens = data.get("tokens_predicted", 0)
        answer = strip_thinking(raw)
        return answer, tokens, data

    def ask(self, prompt: str, max_tokens: Optional[int] = None) -> Tuple[str, int, Dict[str, Any]]:
        if self.use_completion:
            return self.ask_completion(prompt, max_tokens=max_tokens)
        return self.ask_chat(prompt, max_tokens=max_tokens)


def strip_thinking(raw: str) -> str:
    if "</think>" in raw:
        return raw.split("</think>", 1)[1].strip()
    return raw.strip()


def strict_json_loads(answer: str) -> Tuple[Optional[Any], Optional[str]]:
    stripped = answer.strip()
    try:
        return json.loads(stripped), None
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def extract_xml_block(answer: str, tag: str) -> Optional[str]:
    pattern = rf"<{tag}>\s*(.*?)\s*</{tag}>"
    match = re.search(pattern, answer, flags=re.DOTALL | re.IGNORECASE)
    if not match:
        return None
    return match.group(1).strip()


def extract_code(answer: str) -> str:
    fenced = re.search(r"```(?:python)?\s*(.*?)```", answer, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()
    return answer.strip()


def count_sentences(text: str) -> int:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return len([p for p in parts if p.strip()])


def split_paragraphs(text: str) -> List[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]


SAFE_BUILTINS = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "float": float,
    "int": int,
    "isinstance": isinstance,
    "len": len,
    "list": list,
    "max": max,
    "min": min,
    "None": None,
    "print": print,
    "range": range,
    "set": set,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
}


FORBIDDEN_IMPORTS = {"os", "sys", "subprocess", "socket", "pathlib", "shutil", "requests"}
FORBIDDEN_CALLS = {"exec", "eval", "compile", "open", "__import__", "input"}


class CodeValidationError(Exception):
    pass


def validate_python_code(code: str) -> ast.Module:
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        raise CodeValidationError(f"syntax error: {exc}") from exc

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root in FORBIDDEN_IMPORTS:
                    raise CodeValidationError(f"forbidden import: {root}")
        elif isinstance(node, ast.ImportFrom):
            module = (node.module or "").split(".")[0]
            if module in FORBIDDEN_IMPORTS:
                raise CodeValidationError(f"forbidden import: {module}")
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in FORBIDDEN_CALLS:
                raise CodeValidationError(f"forbidden call: {node.func.id}")
    return tree


class CodeExecutionDisabled(Exception):
    """Raised instead of running a model answer inside the evaluator."""


def safe_exec_python(code: str) -> Dict[str, Any]:
    """Refuses to run the model's code. Kept so callers stay unchanged.

    This used to validate_python_code() and then exec() the answer in this
    process. validate_python_code only inspects a list of names, so anything
    reached through an attribute, getattr or a built-up string walks straight
    past it. It is a lint, not a boundary, and the evaluator holds the same
    filesystem, network and credentials as whoever started it.

    Until there is a runner with real filesystem, network, time and memory
    limits, code tasks are reported as not executed rather than scored on the
    strength of an AST filter.
    """
    raise CodeExecutionDisabled(
        "running model code in the evaluator process is disabled; "
        "this task is reported as not executed"
    )


@dataclass
class CodeTestResult:
    passed: int
    total: int
    failures: List[str]


def write_json(path: str, payload: Dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def append_jsonl(path: str, payload: Dict[str, Any]) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def keyword_score(text: str, must_have_groups: List[List[str]]) -> int:
    lowered = text.lower()
    points = 0
    for group in must_have_groups:
        if any(token.lower() in lowered for token in group):
            points += 1
    return points


def contains_word_case_insensitive(text: str, word: str) -> bool:
    return re.search(rf"\b{re.escape(word)}\b", text, flags=re.IGNORECASE) is not None
