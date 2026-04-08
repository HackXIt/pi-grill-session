---
id: KB-0011
type: feature
depends_on:
  - KB-0004
  - KB-0005
  - KB-0010
minimum_thinking: high
---

# Persist pending batches and add recovery command

## Summary

Current fallback behavior can report failure, but it cannot recover operationally. Extend grill-session state with minimal pending-batch metadata and add a single repo-local reopen path so a cancelled or no-UI questionnaire batch can be resumed instead of being silently lost. This ticket owns interrupted-batch lifecycle safety. It does not own the broader multi-round orchestration/completion-tool happy path.

## Lane Notes

- Current lane: 2-planned
- Order: 02
- Owner: unassigned

## References

- `.kanban/1-to_refine/KB-0009-reality-check-production-readiness-gaps.md`
- `.kanban/5-done/KB-0004-build-interactive-questionnaire-ui.md`
- `.kanban/5-done/02-KB-0005-activation-state-and-completion-flow.md`
- `.kanban/2-planned/01-KB-0010-reproducible-build-typecheck-and-ci-baseline.md`
- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`
- `src/index.ts`
- `src/grill-state.ts`
- `src/questionnaire-tool.ts`
- `src/questionnaire.ts`
- `src/domain.ts`
- `test/index.test.ts`
- `test/grill-state.test.ts`
- `test/questionnaire.test.ts`

## Acceptance Criteria

- [ ] Persisted grill-session state includes minimal branch-local pending-batch metadata sufficient to reopen the last failed/cancelled questionnaire batch and restore that metadata on `session_start` / `session_tree`.
- [ ] When a questionnaire attempt fails because no UI is attached or the user cancels, the extension records the pending batch instead of silently losing it or marking the session completed.
- [ ] A single repo-local recovery command (`/grill-reopen`) replays the pending batch through the current questionnaire runtime; a successful submission clears or replaces the pending metadata through the same shared state path.
- [ ] User-visible fallback/cancel output tells the user how to recover (`/grill-reopen`) or explicitly stop (`/grill-end`).
- [ ] Explicit end/completion paths clear pending metadata and do not leave the session stranded as completed-with-pending-batch or active-without-recovery-path.
- [ ] Automated tests cover pending-metadata persistence/reconstruction, no-UI/cancel transitions, and `/grill-reopen` behavior. Live pi verification covers both non-UI fallback messaging and one interactive cancel/reopen round.

## Verification

- `npm test`
- `npm run typecheck`
- `PI_OFFLINE=1 pi -e ./src/index.ts --mode json -p --no-session "Use the questionnaire tool right now to ask one question with two options: red and blue. Then tell me what happened."` (confirm recovery instructions mention `/grill-reopen` and `/grill-end`)
- Load the extension in interactive pi, start a questionnaire-capable grill flow, cancel a batch, run `/grill-reopen`, and confirm the same batch reopens and can be submitted successfully.
- In interactive pi, confirm `/grill-end` from a pending-batch state clears the pending metadata and does not leave later prompts in a fake active state.

## Notes

- Derived from the `KB-0009` reality-check findings ticket.
- Keep the pending state minimal: enough normalized batch data to reopen the last frontier batch, plus only the smallest extra metadata needed for user guidance/debugging.
- Reuse the existing `/grill-end` path as the explicit abandon/complete route. Do not add a second overlapping “clear pending” command unless implementation research proves `/grill-end` is insufficient.
- Do not generalize this into a reusable draft-management subsystem. v1 only needs the last pending grill batch.

## Change Log

- created from `KB-0009` refinement
