---
id: KB-0014
type: feature
depends_on:
  - KB-0013
minimum_thinking: high
---

# Add questionnaire side sessions

## Summary

Add per-question Side Sessions to the interactive questionnaire UI so users can open an interactive child pi session from a question tab, ask clarifying questions, and optionally import a structured draft answer without disturbing the parent questionnaire flow.

## Lane Notes

- Current lane: 0-open
- Order: n/a
- Owner: unassigned
- Implementation status: code and documentation are implemented on `main`; lane movement remains a separate kanban housekeeping action.

## References

- `docs/PRD-questionnaire-side-sessions.md`
- `docs/adr/0001-questionnaire-side-sessions-use-interactive-child-pi.md`
- `docs/spike-questionnaire-side-sessions-interactive-shell-reuse.md`
- `CONTEXT.md`
- `src/questionnaire-runtime.ts`
- `src/questionnaire.ts`
- `src/domain.ts`
- `src/questionnaire-tool.ts`

## Acceptance Criteria

- [x] Interactive questionnaires show a per-question Side Session Action.
- [x] Opening the action launches an interactive pi child session with the source question, current batch context, current draft answer, and current parent session branch reference.
- [x] The child is instructed to summarize relevant context first and respect Project Read-Only Mode for the parent project.
- [x] Parent questionnaire state is blocked and restored after the child exits.
- [x] The same extension is loaded in the child and exposes `/grill-side-return` to write sidecar JSON.
- [x] The same extension exposes split child-side return tools: `grill_side_return_option` and `grill_side_return_custom`.
- [x] Parent reads a valid sidecar Return Suggestion after child exit.
- [x] Import Dialog lets the user manually return, import suggestion, view record, or discard.
- [x] Import supports only existing answer shapes: selected option + optional notes, or custom answer.
- [x] Import changes only the source question draft and never submits the batch.
- [x] Each source question has at most one current Side Session Record; replacement requires confirmation.
- [x] No-UI questionnaire fallback remains unchanged and does not offer Side Sessions.

## Verification

- `npm test`
- `npm run typecheck`
- `npm run smoke:side-session` manual interactive checklist covering launch, exit, import, view record, replacement confirmation, and no-UI fallback

## Notes

`KB-0013` outcome: do not directly reuse `pi-interactive-shell` internals in v1. The package currently exposes a pi extension/tool surface, not a stable extension-to-extension launcher API; its source also imports the older `@mariozechner/*` pi runtime while this repo uses `@earendil-works/*`.

Expanded package survey found more relevant, newer side-conversation extensions: `pi-btw`, `@pi-unipi/btw`, `@juicesharp/rpiv-btw`, `pi-qq`, and `pi-mono-btw`. `pi-btw` / `@pi-unipi/btw` are the best references because they use `createAgentSession(...)`, in-memory sessions, custom resource loaders, and TUI overlays on the current `@earendil-works/*` runtime. They still do not expose a stable launcher API, so treat them as implementation references rather than direct dependencies.

Implement a minimal local blocking child-`pi` process launcher behind a narrow module boundary so the implementation can switch to an upstream launcher API later.

Suggested local integration path:

- `src/side-session/context-package.ts` builds the per-question context package and child prompt.
- `src/side-session/return-suggestion.ts` owns sidecar JSON parsing/validation for `/grill-side-return`.
- `src/side-session/launcher.ts` launches a normal blocking child-`pi` process and returns a Side Session Record. Do not use the `pi-btw`/`@pi-unipi/btw` in-memory `AgentSession` pattern for v1; those packages are references for UI/context design only.
- `src/questionnaire-runtime.ts` calls the launcher from the per-question Side Session Action and keeps import/replacement state local to the pending questionnaire batch.

Keep v1 launcher scope intentionally small: interactive blocking child pi only; no hands-free, dispatch, monitor, attach, background sessions, worktrees, or agent selection.

## Change Log

- created from grill-session design
- updated with `KB-0013` spike outcome: use a minimal local blocking launcher for v1
- documented implemented v1 behavior, split side-return tools, and manual side-session smoke coverage
