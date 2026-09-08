# Known Limits And Open Questions

## Known Limits

1. There is still no single strong architecture-specific public headline win.
2. `MiniMax M2.5` still lacks the final expensive `off vs auto` closeout after the policy bug fix.
3. The huge-model story is stronger than before, but still not fully benchmark-closed.
4. Research-only paths remain useful internally, but must not be confused with stable defaults.
5. Custom quantization work is a strategic direction, not a closed public result.

## Open Questions

### 1. MiniMax Policy Closeout

Question:

- after the `rtr auto` bug fix, is `auto` actually viable for huge `MiniMax`, or does `off` remain the only practical baseline?

Best next benchmark:

- `tg32`: `off` vs `auto`
- `pg32,4`: `off` vs `auto`
- runtime default hot-expert budget

### 2. Next MiniMax Optimization Line

Question:

- if `rtr auto` does not become viable, is the next real win in expert locality / paging behavior?

### 3. Next gpt-oss Engine Line

Question:

- can the next strong architecture-specific win be obtained from `gpt-oss-20b` decode-side mixed-path work?

### 4. Public Release Freeze

Question:

- when should the private lab snapshot be split into a cleaner public fork and/or PR-sized public changes?

## Decision Rule

1. Close `MiniMax off vs auto` first if the goal is huge-model clarity.
2. Move to `gpt-oss-20b` decode-side optimization if the goal is the next likely engine win.
3. Keep public claims narrower than internal engineering reality.
