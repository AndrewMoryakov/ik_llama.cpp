# RTR migration state

Updated: 2026-07-20 (Asia/Irkutsk)

## Immutable identifiers at checkpoint

```text
handoff branch:
  repository: AndrewMoryakov/ik_llama.cpp
  branch: feature/rtr-auto-review-fixes
  checkpoint before this follow-up: d7bf2f0590e436a9b4e844854f25aee39a2563d9

upstream pull request:
  URL: https://github.com/ikawrakow/ik_llama.cpp/pull/1738
  state: open
  mergeable: true
  merge state: blocked / review required
  head repository: AndrewMoryakov/ik_llama-pr
  head branch: pr/rtr-auto-mode
  head commit: 843de95f771e2df49db7ad57161de61498b1d952
  base branch: main
  base commit: 9d07d8681ece159a89fb4e16a1f9c9f3a5fac20f
```

The same PR head commit is mirrored at
`AndrewMoryakov/ik_llama.cpp:pr/rtr-auto-mode`, but GitHub PR #1738 reads from
`AndrewMoryakov/ik_llama-pr`.

## Bootstrap on another machine

```bash
git clone https://github.com/AndrewMoryakov/ik_llama.cpp.git
cd ik_llama.cpp
git switch feature/rtr-auto-review-fixes

git remote add upstream https://github.com/ikawrakow/ik_llama.cpp.git
git remote add prfork https://github.com/AndrewMoryakov/ik_llama-pr.git
git fetch --all --prune

git worktree add -b feature/rtr-auto-pr-prep ../ik_llama.cpp-rtr-pr \
  prfork/pr/rtr-auto-mode
```

Verify before editing:

```bash
git status --short --branch
git -C ../ik_llama.cpp-rtr-pr rev-parse HEAD
git -C ../ik_llama.cpp-rtr-pr rev-list --left-right --count upstream/main...HEAD
```

Expected RTR worktree HEAD is
`843de95f771e2df49db7ad57161de61498b1d952`. The last recorded divergence was
`0 13`.

## Full-suite differential result

Both the RTR PR build and the exact upstream control build ran this selection:

```powershell
$regex = 'tokenizer-0-bert-bge|jinja|chat-template|eval-callback'
ctest --test-dir <build-dir> -C Release --output-on-failure -R $regex
```

Result on both builds: `20% tests passed, 4 tests failed out of 5`.
The plain C++ `test-jinja` test passed; `test-jinja-py` failed.

| Test | RTR PR | exact upstream base | Classification |
|---|---|---|---|
| `test-tokenizer-0-bert-bge` | failed | failed identically | baseline fixture/tokenizer issue, not RTR-only |
| `test-jinja-py` | failed | failed identically | Windows CRLF Python parity issue, not RTR-only |
| `test-chat-template` | exit `0xc0000409` | same exit/assertion | baseline failure, not RTR-only |
| `test-eval-callback` | model init failed without libcurl | same | build/environment dependency, not RTR-only |

Raw logs are committed beside this file:

- `pr-four-tests.log`
- `upstream-four-tests.log`

The original full PR suite result remains `22/26`; all RTR-specific tests pass.
The four red tests are now classified as reproduced upstream, so no RTR code
change is justified to hide them.

## Validation of the migration checkpoint

- fresh clone resolved to the pushed handoff commit;
- fresh clone was clean;
- English continuation file contained zero Cyrillic characters;
- required trace/simulator source and test files were present;
- `python tests/test-moe-cache-sim.py`: 28/28 passed;
- `py_compile` passed for simulator modules and test;
- MSVC built `test-moe-trace-writer` and `llama-cli`;
- `test-moe-trace-writer.exe` passed.

## Next action

No unresolved RTR-specific regression is known. The next agent should:

1. verify live GitHub PR state and new maintainer comments;
2. post the concise differential-test result if it is not already documented;
3. respond to `@ikawrakow` review;
4. rebase/retest only if `upstream/main` has advanced or review requests code
   changes;
5. keep MiniMax/MoE experimentation outside PR #1738.
