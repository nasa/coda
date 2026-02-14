## Execution Model

- Work continuously in a single session.
- Do not stop to ask for next steps.
- Do not require new prompts to continue.
- Only ask a question if truly blocked by missing information that cannot be inferred from the repo.
- If a VS Code permission dialog blocks progress (file edit, install, command run), wait for approval and continue automatically.

You may structure work into internal milestones, but do not pause between them.

---

## Refactor Discipline

- Keep the application runnable at all times.
- Avoid big-bang rewrites; evolve via replacement seams.
- Keep diffs coherent and reviewable.
- Do not mass reformat.
- Do not introduce `any`.

When multiple design options exist:

- Choose the safest minimal viable option.
- Document the decision.

---

## Backward Compatibility (Mandatory)

- Existing share links must continue to work.
- If introducing a new versioned link format, implement a decoder for the old format.
- Behavior equivalence is required; pixel-perfect layout equivalence is not required.

---

## Continuous Validation

Run checks as work progresses:

- `npm run tsc`
- `npm run lint`
- `npm run lint:css` if CSS touched
- Run tests when appropriate

Fix issues immediately before proceeding further.

---

## Decision Logging

Maintain a file at repo root:

`refactor-notes.md`

Continuously update it with:

- Current milestone
- Decisions made + rationale
- Commands run + results
- Known issues / TODO

This file replaces conversational check-ins.

---

## General Engineering Constraints

- TypeScript only; no implicit `any`.
- Prefer explicit types and small helpers over complex conditionals.
- Avoid tight coupling between layout engine and pane implementation.
- Preserve existing user-facing behaviors unless explicitly refactored.
