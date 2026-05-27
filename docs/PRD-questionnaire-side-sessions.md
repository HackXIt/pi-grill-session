# PRD: Questionnaire Side Sessions

Status: implemented for v1.

## Problem

While answering a questionnaire batch, the user often needs to ask clarifying questions about a source question, its options, or the surrounding plan. Asking those questions in the parent grill session disturbs the decision-tree flow and pollutes the parent context.

## Goal

Add per-question Side Sessions to the questionnaire UI. A Side Session is an interactive pi child session opened from a questionnaire question tab so the user can ask Q&A, inspect relevant project context, and optionally return a draft answer without advancing or submitting the parent questionnaire batch.

## Non-goals

- No headless side-session behavior in no-UI mode.
- No embedded mini-chat inside the questionnaire UI.
- No third questionnaire answer mode beyond existing option/custom answers.
- No automatic questionnaire submission from a Side Session.
- No v1 hard dependency on unstable side-conversation or terminal-overlay package internals.

## User experience

1. Every interactive questionnaire question tab shows a per-question Side Session Action: **Open side session**.
2. Choosing that action suspends the parent questionnaire TUI and opens a blocking child `pi` process in the parent project.
3. The parent questionnaire remains blocked and restores to the same batch/question state after the child exits.
4. The child receives a Side Session Context Package containing:
   - source question prompt, label, options, recommendation markers, and current draft answer/notes
   - current questionnaire/batch context
   - current parent working directory
   - a current parent session branch reference when available
   - sidecar paths used by the return protocol
   - an instruction to summarize relevant context first, then help the user answer
5. The child is instructed to treat the parent project as Project Read-Only Mode: inspect files, but do not mutate files in the parent project. V1 enforcement is instruction-only.
6. The user exits the child session to return.
7. The parent shows an Import Dialog over the questionnaire with actions to:
   - return manually with no answer change
   - import a Return Suggestion if one exists
   - view the Side Session Record
   - discard the record
8. Imported suggestions only set the source question draft. The user can still edit the question before submitting the batch.

## Return suggestion protocol

The child pi session loads this extension and exposes three return paths:

- `grill_side_return_option` for selected option + optional notes suggestions
- `grill_side_return_custom` for custom answer suggestions
- `/grill-side-return` for an interactive child-side return form

All return paths write the same sidecar JSON shape:

- concise side-session summary
- source question id
- answer mode: selected option plus optional notes, or custom answer
- child/session reference fields inferred by the parent where available

If no sidecar JSON exists after child exit, the Import Dialog falls back to manual return and record viewing.

## Record semantics

- Each source question has at most one current Side Session Record in an unsubmitted questionnaire batch.
- Starting a new Side Session for a question with an existing record requires confirmation and replaces the old record.
- The record stores a concise summary plus a session/reference string, not a full inline transcript.

## Scope

Side Sessions are available for all interactive questionnaire tool calls, not only active grill sessions. In no-UI mode, Side Sessions are unavailable and the current pending/reopen behavior remains.

## Implementation strategy

The prerequisite spike rejected a direct v1 dependency on `pi-interactive-shell` internals because there is no stable extension-to-extension launcher API and older inspected sources used an incompatible pi runtime namespace. Newer side-conversation packages were useful references but also lacked the required callable launcher surface.

V1 therefore implements a minimal local blocking child-`pi` launcher behind a narrow module boundary:

- `src/side-session/context-package.ts` builds the context package and child prompt.
- `src/side-session/launcher.ts` creates sidecar/context files, launches `pi`, and parses the sidecar result.
- `src/side-session/return-suggestion.ts` validates sidecar JSON and constructs records.
- `src/side-session/side-return-tool.ts` registers split child-side return tools.
- `src/side-session/side-return-command.ts` registers the interactive child-side return command.
- `src/questionnaire-runtime.ts` owns the questionnaire action, TUI suspension/resume, import dialog, replacement confirmation, and draft-answer import.

The launcher boundary is intentionally small so it can be replaced with a stable upstream overlay/launcher API later.

## Acceptance criteria

- [x] Per-question Side Session Action is visible in interactive questionnaires.
- [x] Opening a Side Session launches an interactive pi child session with the correct context package.
- [x] Parent questionnaire state is restored after child exit.
- [x] Child-side `/grill-side-return` writes a valid sidecar suggestion.
- [x] Child-side split tools write valid selected-option and custom-answer sidecar suggestions.
- [x] Parent Import Dialog can import selected option + optional notes or custom answer into the source question draft.
- [x] Import never submits the batch automatically.
- [x] Source question stores and displays a Side Session Record summary/reference.
- [x] Starting a new Side Session for a question with an existing record asks for replacement confirmation.
- [x] No-UI questionnaire fallback remains unchanged and does not offer Side Sessions.
- [x] Tests cover pure state, payload, sidecar parsing, import, replacement, context packaging, launcher behavior, and no-UI behavior.
- [x] A manual smoke checklist covers launch, exit, import, view record, replacement confirmation, and no-UI fallback via `npm run smoke:side-session`.

## Verification

Current automated verification:

```bash
npm test
npm run typecheck
npm run smoke:pi
```

Manual interactive side-session verification:

```bash
npm run smoke:side-session
```
