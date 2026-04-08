---
id: KB-0012
type: feature
depends_on:
  - KB-0004
  - KB-0005
  - KB-0010
  - KB-0011
minimum_thinking: high
---

# Complete tool-driven grill-session flow

## Summary

Deliver the remaining v1 tool-driven grill-session behavior on top of the build baseline and pending-batch lifecycle. Within pi’s extension model, “automatic” should mean the model is strongly guided to use `questionnaire` for frontier decision batches while grill mode is active and to call `complete_grill_session` when the tree is done; do not invent a parallel scheduler unless repo/API research proves that is necessary. This ticket owns completion-tool registration, tool-driven completion state changes, and verified multi-round grill-session behavior.

## Lane Notes

- Current lane: 2-planned
- Order: 03
- Owner: unassigned

## References

- `.kanban/1-to_refine/KB-0009-reality-check-production-readiness-gaps.md`
- `.kanban/5-done/KB-0004-build-interactive-questionnaire-ui.md`
- `.kanban/5-done/02-KB-0005-activation-state-and-completion-flow.md`
- `.kanban/2-planned/01-KB-0010-reproducible-build-typecheck-and-ci-baseline.md`
- `.kanban/2-planned/02-KB-0011-persist-pending-batches-and-add-recovery-command.md`
- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`
- `skills/grill-session/SKILL.md`
- `src/index.ts`
- `src/grill-state.ts`
- `src/questionnaire-tool.ts`
- `test/index.test.ts`
- `test/grill-state.test.ts`

## Acceptance Criteria

- [ ] `complete_grill_session` is registered from `src/`, and executing it reuses the shared completion contract: the session becomes inactive/completed, pending metadata is cleared, and the visible marker phrase `[GRILL SESSION COMPLETE]` is emitted once.
- [ ] Active grill-session runtime/skill guidance is updated as needed so the model uses `questionnaire` for frontier decision batches and calls `complete_grill_session` at the end, without relying on the user to type `/grill-end` during the happy path.
- [ ] Tool-driven grill sessions can span repeated batches while state remains active; after a submitted batch, the model can continue to the next frontier instead of defaulting back to serial plain-text questioning.
- [ ] After tool-driven completion, later prompts no longer receive grill-mode system-prompt injection.
- [ ] Automated coverage includes completion-tool registration/execution and any extracted helper logic needed for the active-session guidance contract.
- [ ] Review includes live pi verification of a multi-round grill session ending through the completion tool, not only `/grill-end`.

## Verification

- `npm test`
- `npm run typecheck`
- `PI_OFFLINE=1 pi -e ./src/index.ts --mode json -p --no-session "Use the completion tool right now and then tell me what happened."` (confirm the completion tool is registered and callable)
- Load the extension in interactive pi, start `/grill` on a design with at least two unresolved branches, answer one batch, confirm a follow-up tool-driven batch or direct completion decision occurs through the tool path, and verify the session ends with `[GRILL SESSION COMPLETE]`.
- After tool-driven completion in interactive pi, send a normal follow-up prompt and confirm grill-mode system-prompt injection has stopped.

## Notes

- Derived from the `KB-0009` reality-check findings ticket.
- Assumption: in pi v1, the correct seam is stronger tool/prompt/skill integration plus a real completion tool, not an extension-managed background orchestrator. If implementation research disproves that assumption, stop and re-refine before adding speculative control flow.
- Reuse shared completion/state helpers so `/grill-end` and `complete_grill_session` cannot drift on marker text or state transitions.
- Out of scope here: generic interview framework work, non-grill skill support, release automation, or persisting design outcomes to repo files.

## Change Log

- created from `KB-0009` refinement
