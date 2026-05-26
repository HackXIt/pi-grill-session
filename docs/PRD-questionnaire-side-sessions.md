# PRD: Questionnaire Side Sessions

## Problem

While answering a questionnaire batch, the user often needs to ask clarifying questions about a source question, its options, or the surrounding plan. Asking those questions in the parent grill session disturbs the decision-tree flow and pollutes the parent context.

## Goal

Add per-question Side Sessions to the questionnaire UI. A Side Session is an interactive pi child session opened from a questionnaire question tab so the user can ask Q&A, inspect relevant project context, and optionally return a draft answer without advancing or submitting the parent questionnaire batch.

## Non-goals

- No headless side-session behavior in no-UI mode.
- No embedded mini-chat inside the questionnaire UI.
- No third questionnaire answer mode beyond existing option/custom answers.
- No automatic questionnaire submission from a Side Session.

## User experience

1. Every interactive questionnaire question tab shows a per-question Side Session Action.
2. Choosing that action opens a Side Session Overlay that runs a normal interactive pi child session.
3. The parent questionnaire remains blocked and restores to the same batch/question state after the child exits.
4. The child receives a Side Session Context Package containing:
   - source question prompt, label, options, recommendation, and current draft answer/notes
   - current questionnaire/batch context
   - a reference to the current parent session branch, using compaction summaries when present
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

The child pi session loads this extension and exposes a child-side `/grill-side-return` command. The command writes a sidecar JSON file with:

- concise side-session summary
- answer mode: selected option plus optional notes, or custom answer
- source question id
- child session/transcript reference

If no sidecar JSON exists after child exit, the Import Dialog falls back to manual return and record viewing.

## Record semantics

- Each source question has at most one current Side Session Record in an unsubmitted questionnaire batch.
- Starting a new Side Session for a question with an existing record requires confirmation and replaces the old record.
- The record stores a concise summary plus a transcript/session reference, not a full inline transcript.

## Scope

Side Sessions are available for all interactive questionnaire tool calls, not only active grill sessions. In no-UI mode, Side Sessions are unavailable and the current pending/reopen behavior remains.

## Implementation strategy

Create a separate spike ticket first to research reuse of pi-interactive-shell from the maintainer source. Prefer reuse if there is a stable, compatible API for interactive overlays. If not, document why and implement a minimal local blocking child-pi launcher that covers only this feature.

## Acceptance criteria

- [ ] Per-question Side Session Action is visible in interactive questionnaires.
- [ ] Opening a Side Session launches an interactive pi child session with the correct context package.
- [ ] Parent questionnaire state is restored after child exit.
- [ ] Child-side `/grill-side-return` writes a valid sidecar suggestion.
- [ ] Parent Import Dialog can import selected option + optional notes or custom answer into the source question draft.
- [ ] Import never submits the batch automatically.
- [ ] Source question stores and displays a Side Session Record summary/reference.
- [ ] Starting a new Side Session for a question with an existing record asks for replacement confirmation.
- [ ] No-UI questionnaire fallback remains unchanged and does not offer Side Sessions.
- [ ] Tests cover pure state, payload, sidecar parsing, import, replacement, and no-UI behavior.
- [ ] A scripted interactive pi smoke test covers launch, exit, import, view record, replacement confirmation, and no-UI fallback.
