# Prompt for coding-agent session: implement KB-0014 questionnaire side sessions

You are in `/home/hackxit/git-stash/mirror-personal/pi-grill-session.git/main` working on `pi-grill-session`.

Implement `KB-0014` using TDD, in small executable slices. Do not skip tests. Start by reading these files completely:

- `CONTEXT.md`
- `docs/PRD-questionnaire-side-sessions.md`
- `docs/adr/0001-questionnaire-side-sessions-use-interactive-child-pi.md`
- `docs/spike-questionnaire-side-sessions-interactive-shell-reuse.md`
- `.kanban/0-open/KB-0014-add-questionnaire-side-sessions.md`
- `.kanban/4-in_review/KB-0013-spike-pi-interactive-shell-reuse-for-side-sessions.md`
- `.plans/KB-0014-questionnaire-side-sessions-plan.md`

Important architectural decisions:

- Implement questionnaire side sessions using a normal blocking child `pi` process.
- Do not use `pi-interactive-shell` internals directly.
- Do not use `pi-btw` / `@pi-unipi/btw` in-memory `AgentSession` as the architecture.
- Treat those packages as references only for UI/context ideas.
- Parent questionnaire remains blocked/restorable.
- Child writes return suggestions through `/grill-side-return` sidecar JSON.
- Parent shows an import dialog; import never submits the batch.
- Maintain one replaceable side-session record per source question.

Implementation requirements:

1. Follow `.plans/KB-0014-questionnaire-side-sessions-plan.md` slice-by-slice.
2. Use red-green-refactor:
   - write one focused failing test,
   - verify it fails for the expected reason,
   - implement the minimum code,
   - rerun the test,
   - repeat.
3. Keep changes surgical and match existing style.
4. Do not add broad abstractions, alternate launch modes, background sessions, monitor modes, attach support, worktrees, model selectors, or global side-conversation features.
5. Preserve no-UI questionnaire fallback behavior exactly: no side-session affordance or launcher path in no-UI mode.
6. Keep `pi-interactive-shell`, `pi-btw`, and `@pi-unipi/btw` out of runtime dependencies/imports.
7. Prefer pure modules first:
   - return-suggestion validation
   - context package/prompt construction
   - launcher boundary with injected runner
   - child command
   - questionnaire UI wiring
   - persistence/details
   - smoke script

Expected files to add include:

- `src/side-session/types.ts`
- `src/side-session/return-suggestion.ts`
- `src/side-session/context-package.ts`
- `src/side-session/launcher.ts`
- `src/side-session/side-return-command.ts`
- `test/side-session-return-suggestion.test.ts`
- `test/side-session-context-package.test.ts`
- `test/side-session-launcher.test.ts`
- `test/side-return-command.test.ts`
- `test/questionnaire-side-session-runtime.test.ts`
- `scripts/smoke-questionnaire-side-session.mjs`

Expected files to touch include:

- `src/questionnaire-runtime.ts`
- `src/questionnaire.ts` only for pure answer-application helper if useful
- `src/questionnaire-tool.ts` for result details/records if needed
- `src/grill-state.ts` only if pending recovery records are persisted
- `src/index.ts` to register `/grill-side-return`
- `package.json` for smoke script if added

Verification before handing off:

- `npm test`
- `npm run typecheck`
- `npm run smoke:pi`
- run or document the new side-session smoke script if it cannot be stable in CI

When complete, summarize:

- implemented slices
- files changed
- tests added
- verification commands and results
- any deferred behavior or known limitations
