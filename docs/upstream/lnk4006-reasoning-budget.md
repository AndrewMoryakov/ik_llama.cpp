# Draft report for upstream: `reasoning-budget.cpp` is compiled twice

**Status: drafted 2026-11-06, not sent.** Nothing in this file has been posted to
`ikawrakow/ik_llama.cpp`. Before it is, read that repository's contribution and
AI-disclosure policy, and confirm with the owner — see
`docs/sessions/2026-11-05-upstream-intake/closeout-2026-11-06.md`.

## What to report

`common/sampling.cpp` includes a translation unit that CMake also compiles:

- `common/sampling.cpp:6` — `#include "reasoning-budget.cpp"`
- `common/CMakeLists.txt:92` — `reasoning-budget.cpp` listed in the target sources

Every symbol defined in `reasoning-budget.cpp` therefore lands in both
`sampling.cpp.obj` and `reasoning-budget.cpp.obj`. The MSVC linker reports it as
`LNK4006: <symbol> already defined in sampling.cpp.obj; second definition
ignored`, repeated per symbol, and keeps the first definition. It is a warning,
not an error, so the build succeeds and nothing downstream notices.

Verified on upstream `main` on 2026-11-06 by reading the two files from a fresh
`--depth=1` fetch of `https://github.com/ikawrakow/ik_llama.cpp.git`, not from
this fork's tree. A search of upstream issues for `reasoning-budget` and for
`LNK4006` found no existing report.

## Why it is worth a line upstream

The duplicate definition is harmless today only because the two copies are
identical. It stops being harmless the moment anything in that file acquires
state — a static, a function-local `static`, a lazily initialised table — because
each object file would then carry its own copy and only one would be reachable
through each path. The warning is also noise in a Windows build log where real
`LNK4006` findings would read the same way.

## The fix, either way round

Pick one; both are one line.

1. Remove `#include "reasoning-budget.cpp"` from `common/sampling.cpp` and let the
   library-level compile provide the symbols, adding `#include
   "reasoning-budget.h"` if a declaration is needed.
2. Remove `reasoning-budget.cpp` from `common/CMakeLists.txt` and let it stay a
   textual include.

Option 1 is the conventional one and keeps the header/implementation split the
`.h` already implies.

## What has not been checked

Whether the GCC and Clang builds warn about this at all — the finding comes from
an MSVC build on Windows. Whether any *other* `.cpp` in `common/` is included the
same way. Neither affects the report, but both would belong in it if asked.
