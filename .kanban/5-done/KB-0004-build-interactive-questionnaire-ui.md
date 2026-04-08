---
id: KB-0004
type: feature
depends_on:
  - KB-0003
minimum_thinking: high
---

# Build interactive questionnaire UI

## Summary

Replace the external prototype questionnaire with a repo-local reusable questionnaire UI module. This slice owns the multi-question TUI interaction, the per-question answer editing flow, and readable submission rendering. It does not own grill-session activation, persistence, completion, or automatic orchestration across rounds.

## Lane Notes

- Current lane: 5-done
- Order: n/a
- Owner: reviewer

## References

- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`
- `docs/CONTEXT_CHECKPOINT.md`
- `src/domain.ts`
- `src/index.ts`
- `test/domain.test.ts`
- `/home/hackxit/.pi/agent/extensions/grill-prototype.ts`
- `/home/hackxit/.local/share/mise/installs/node/25.2.1/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/questionnaire.ts`

## Acceptance Criteria

- [x] A repo-local questionnaire module is added and wired from `src/index.ts` so the extension has a reusable production questionnaire entrypoint instead of relying on the external prototype file.
- [x] The UI supports one tab per question plus a final submit step for multi-question batches, and batch submission is blocked until every question has either a selected option or a custom answer.
- [x] Recommended options are visibly marked in the question view.
- [x] For questions with `allowNotes`, the user can select an option and edit optional notes without leaving that same question tab; the answer stays revisitable before final submit.
- [x] For questions with `allowCustomAnswer`, the user can enter a fully custom answer from the same question tab, and custom-answer mode is mutually exclusive with option-selection mode.
- [x] Submission uses the `src/domain.ts` batch/result model and produces a readable rendered result suitable for chat history / tool result display instead of synthetic `pi.sendUserMessage(...)` text.
- [x] Automated tests cover extracted non-TUI logic from the questionnaire layer, including answer-mode transitions and submit-readiness rules.

## Verification

- [x] `npm test`
- [x] `PI_OFFLINE=1 pi -e ./src/index.ts -p --no-session "hello"` (extension loads with repo-local questionnaire runtime wiring present)
- [x] `PI_OFFLINE=1 pi -e ./src/index.ts --mode json -p --no-session "Use the questionnaire tool right now to ask one question with two options: red and blue. Then tell me what happened."` (tool is registered/callable; no-UI fallback path exercised)
- [x] Load the extension in interactive pi and exercise the questionnaire entrypoint used by the implementation; confirm:
  - [x] recommended marker is visible
  - [x] option selection plus same-tab notes editing works
  - [x] custom-answer path works
  - [x] unanswered batches cannot be submitted
  - [x] submitted output is readable in history/result rendering
- [x] Confirm the model-visible tool result includes the actual structured answers, not only prose content (verified by pure helper test plus `src/questionnaire-tool.ts` wiring to tool `content`)

## Notes

- Assumption: KB-0004 owns the reusable questionnaire surface itself; KB-0005 still owns grill-session activation, persisted session state, `/grill` semantics, `/grill-end`, completion signaling, and conservative plain-text trigger handling.
- In-scope files are expected to center on a new questionnaire module plus minimal wiring in `src/index.ts`, with only small `src/domain.ts` adjustments if the current payload types are insufficient for the UI.
- Keep the interaction flow simple:
  1. user navigates question tabs and can revisit answers before submission
  2. selecting an option records an answer immediately
  3. if notes are allowed, notes are edited inline/on the same question tab rather than as a separate question or later screen
  4. entering a custom answer clears any option/notes for that question; selecting an option clears any existing custom answer
  5. final submit happens only from the submit tab once every question is answered
- Do not carry forward prototype-only behaviors as the production contract:
  - file-based JSON questionnaire loading
  - built-in batch fixtures
  - posting answers back via `pi.sendUserMessage(...)`
- Keep automated tests focused on extracted pure helpers/state logic. Do not try to make Node tests prove pi TUI internals that require the live pi runtime.
- If tool registration is the cleanest way to make rendered results visible in history, that minimal wiring is in scope; automatic tool invocation/orchestration is not.

## Implementation Notes

- Added `src/questionnaire.ts` for extracted questionnaire state helpers covering answer-mode transitions, notes/custom-answer exclusivity, submit readiness, submission rendering via `src/domain.ts`, and model-visible JSON submission content generation.
- Added `src/questionnaire-tool.ts` as the repo-local production questionnaire tool with tabbed TUI flow, same-tab notes/custom editing, recommended markers, readable tool-result rendering, and structured-answer JSON in tool `content` for submitted batches.
- Updated `src/index.ts` to load the repo-local questionnaire runtime from the extension entrypoint while leaving KB-0005 activation/session behavior untouched.
- Added `test/questionnaire.test.ts` for pure questionnaire-layer behavior, including model-visible submission content coverage.
- Completed interactive verification in a real pseudo-TTY pi session using a scripted key sequence against the live questionnaire UI; observed `/grill [recommended]`, same-tab notes editing, submit blocking with `Unanswered: Scope`, custom-answer entry, and readable rendered submission lines after submit.

## Review Outcome

- Accepted in review; moved to `5-done`.
- Verified `npm test`.
- Verified extension load with `PI_OFFLINE=1 pi -e ./src/index.ts -p --no-session "hello"`.
- Verified non-UI tool fallback with `PI_OFFLINE=1 pi -e ./src/index.ts --mode json -p --no-session "Use the questionnaire tool right now to ask one question with two options: red and blue. Then tell me what happened."`; observed the registered `questionnaire` tool call plus tool result `Interactive questionnaire unavailable: no UI is attached.` in the JSON log.
- Verified the success-path tool `content`/`details` contract with `PI_OFFLINE=1 pi -e /tmp/review-questionnaire-contract.ts -p --no-session "/review-questionnaire-contract"`; observed JSON `content` carrying structured `questionnaire_submission` answers and readable `renderedLines` in `details`.
- Spot-checked the live interactive pi flow in a pseudo-TTY session; observed `/grill [recommended]`, same-tab notes editing, submit blocking with `Unanswered: Scope`, custom answer `UI slice only`, readable rendered submission, and final assistant reply `OK` after submit.

## Change Log

- created
- refined after repo, plan, prototype, and test review
- moved to 2-planned with explicit interaction flow, scope boundaries, and verification steps
- claimed for implementation and moved to 3-in_progress
- implemented repo-local questionnaire state/tool modules and passed `npm test`
- manual pi verification still pending in review
- review rejected; returned to 3-in_progress due to model-visible payload gap and incomplete live pi verification
- fixed the model-visible submission payload gap by emitting structured-answer JSON in tool `content`
- added pure questionnaire-layer coverage for the model-visible submission payload contract
- completed live interactive pi verification and prepared the ticket for review
- accepted in review and moved to 5-done
