# KB-0014 Implementation Plan: Questionnaire Side Sessions

Status: planning only. Do not implement from this file unless explicitly assigned.

## Resolved architecture decisions

- Implement questionnaire side sessions with a normal blocking child `pi` process.
- Do not use `pi-interactive-shell` internals directly.
- Do not use `pi-btw` / `@pi-unipi/btw` in-memory `AgentSession` as the architecture.
- Those packages are references only for UI/context ideas.
- Parent questionnaire remains blocked and restorable.
- Child writes return suggestions through `/grill-side-return` sidecar JSON.
- Parent shows an import dialog; importing never submits the questionnaire batch.
- Each source question has at most one replaceable side-session record.

## Slice 1 — Side-session domain types and return-suggestion validation

### Files

Add:

- `src/side-session/types.ts`
- `src/side-session/return-suggestion.ts`
- `test/side-session-return-suggestion.test.ts`

Touch only if needed:

- `src/questionnaire.ts` for a small pure helper to apply an imported answer.

### Behavior

Define side-session types:

- `SideSessionAnswerSuggestion`
  - option mode: `mode: "option"`, `questionId`, `selectedOptionId`, optional `notes`
  - custom mode: `mode: "custom"`, `questionId`, `customAnswer`
- `SideSessionRecord`
  - `id`
  - `sourceQuestionId`
  - `summary`
  - `childSessionRef`
  - `createdAt`
  - optional `suggestion`
  - optional child exit metadata
- `SideSessionReturnSidecar`
  - `sourceQuestionId`
  - `summary`
  - `childSessionRef`
  - `answer`

Validation rules:

- Reject missing or non-object JSON.
- Reject `sourceQuestionId` mismatch.
- Reject answer for another question.
- Reject option suggestion if option id is not in the source question.
- Reject notes if source question does not allow notes.
- Reject custom answer if source question does not allow custom answers.
- Trim `summary`, `notes`, and `customAnswer`.
- Reject empty summary.
- Reject empty custom answer.
- Accept only existing questionnaire answer shapes: selected option plus optional notes, or custom answer.
- Missing sidecar file should mean “no suggestion”, not a crash.

### Test order

1. Valid option suggestion with notes parses into a record/suggestion.
2. Valid custom suggestion parses into a record/suggestion.
3. Unknown option id is rejected.
4. Notes are rejected when `allowNotes: false`.
5. Custom answer is rejected when `allowCustomAnswer: false`.
6. Missing sidecar returns no suggestion / manual record path without throwing.

### Acceptance criteria

- Pure validation runs without pi/TUI.
- Invalid child output cannot mutate parent draft answers.
- Valid output converts into a typed `SideSessionRecord` with optional suggestion.

## Slice 2 — Context package and prompt construction

### Files

Add:

- `src/side-session/context-package.ts`
- `test/side-session-context-package.test.ts`

### Behavior

Build a deterministic `SideSessionContextPackage` from:

- normalized batch title and intro
- all current questions, compactly rendered
- source question id, label, prompt, options, recommendations, `allowNotes`, `allowCustomAnswer`
- current draft answer for the source question
- current draft answers for the whole batch
- parent cwd/session reference if available
- sidecar return path
- source question id

Build a child prompt that states:

- this is a temporary questionnaire Side Session
- first summarize relevant context
- help the user answer the source question
- parent project is Project Read-Only Mode by instruction: inspect files but do not mutate files in the parent project
- use `/grill-side-return` to write an importable suggestion
- returning a suggestion never submits the parent questionnaire
- valid return shapes are selected option plus optional notes, or custom answer

### Test order

1. Prompt includes source question and all options.
2. Prompt includes current draft answer.
3. Prompt includes sidecar path and `/grill-side-return` instructions.
4. Prompt includes Project Read-Only Mode instruction.
5. Prompt includes parent session/cwd reference when provided.

### Acceptance criteria

- Prompt construction is deterministic and snapshot-friendly.
- No launcher/process code is involved.
- Context package contains enough information for the child to help without mutating parent state.

## Slice 3 — Child `pi` launcher boundary

### Files

Add:

- `src/side-session/launcher.ts`
- `test/side-session-launcher.test.ts`

Touch later, not in this slice unless wiring demands it:

- `src/questionnaire-runtime.ts`

### Boundary

Expose one narrow function, conceptually:

```ts
launchQuestionnaireSideSession(request): Promise<SideSessionRecord>
```

Use an injectable child-process runner for tests.

Default implementation:

1. Create a temp sidecar JSON path.
2. Build context package and child prompt.
3. Spawn a normal blocking child `pi` process.
4. Pass prompt as the child pi startup prompt.
5. Set environment variables:
   - `GRILL_SIDE_RETURN_PATH`
   - `GRILL_SIDE_SOURCE_QUESTION_ID`
   - optionally `GRILL_SIDE_PARENT_CWD`
6. Run in parent project cwd.
7. Wait for exit.
8. Parse sidecar if present.
9. Return a `SideSessionRecord`.

Do not import or call:

- `pi-interactive-shell`
- `pi-btw`
- `@pi-unipi/btw`
- in-memory `AgentSession`

### Test order

1. Launcher calls injected runner with command `pi`, cwd, env, and prompt.
2. Launcher reads sidecar after child exit and returns suggestion.
3. Launcher returns manual/no-suggestion record when no sidecar exists.
4. Non-zero child exit still returns a record/import-dialog path if sidecar exists, with exit status captured.
5. Cleanup does not delete sidecar before parsing.

### Acceptance criteria

- Parent code depends only on the local launcher interface.
- Launcher is blocking.
- Sidecar parsing is delegated to Slice 1 validator.
- Future upstream launcher replacement is localized to this module.

## Slice 4 — Questionnaire UI action, import dialog, replacement flow

### Files

Touch:

- `src/questionnaire-runtime.ts`
- possibly `src/questionnaire.ts`

Add:

- `test/questionnaire-side-session-runtime.test.ts`

### Runtime behavior

Inside `runQuestionnaireBatch`, track records keyed by source question id:

```ts
let sideSessionRecords: Record<string, SideSessionRecord | undefined> = {};
```

Add a per-question row/action, for example `kind: "side-session"`, displayed as:

- `Open side session`
- if a record exists, show summary/reference indicator
- if replacing, make the UI text explicit, e.g. `Replace side session…`

Flow:

1. User focuses Side Session Action and presses Enter.
2. If a record exists for this source question, ask for replacement confirmation.
3. If replacement is declined, restore questionnaire unchanged.
4. Launch child through an injected/default side-session controller.
5. Parent questionnaire remains blocked while child runs.
6. After child exits, show Import Dialog.
7. Import Dialog options:
   - return manually, keep record, no answer change
   - import suggestion, if a valid suggestion exists
   - view record
   - discard record
8. Import applies only to draft answers.
9. Import never submits the questionnaire batch.

Recommended signature change:

```ts
runQuestionnaireBatch(params, ctx, options?: {
  sideSessions?: QuestionnaireSideSessionController;
})
```

Tests should inject fake launcher/dialog decisions rather than spawning real pi.

### Test order

1. Rendered interactive questionnaire includes Side Session Action when `hasUI: true`.
2. No-UI recovery output remains unchanged and no side-session launcher is called.
3. Pressing Enter on Side Session Action calls launcher with current question and draft answer.
4. Manual return keeps record but leaves draft answer unchanged.
5. Importing option suggestion sets selected option plus notes.
6. Importing custom suggestion sets custom answer.
7. Import does not submit the batch automatically.
8. Existing record causes confirmation before replacement.
9. Declining replacement keeps old record and does not launch.
10. Accepting replacement replaces only that question’s record.

### Acceptance criteria

- Side Session Action appears only in interactive questionnaires.
- Existing keyboard behavior remains intact.
- Import is reviewable and never auto-submits.
- One replaceable record per source question is enforced.

## Slice 5 — `/grill-side-return` child command

### Files

Add:

- `src/side-session/side-return-command.ts`
- `test/side-return-command.test.ts`

Touch:

- `src/index.ts`

### Command behavior

Register `/grill-side-return` in the extension.

Recommended child command contract:

```json
{
  "summary": "Concise side-session summary",
  "answer": {
    "mode": "option",
    "selectedOptionId": "option-id",
    "notes": "optional"
  }
}
```

or:

```json
{
  "summary": "Concise side-session summary",
  "answer": {
    "mode": "custom",
    "customAnswer": "..."
  }
}
```

The command reads:

- `GRILL_SIDE_RETURN_PATH`
- `GRILL_SIDE_SOURCE_QUESTION_ID`

It writes sidecar JSON:

```json
{
  "sourceQuestionId": "...",
  "summary": "...",
  "childSessionRef": "...",
  "answer": {
    "mode": "option",
    "selectedOptionId": "...",
    "notes": "..."
  }
}
```

`childSessionRef` should come from context/session manager if available, otherwise a clear fallback such as `child-pi-session`.

### Test order

1. Command is registered.
2. Command rejects when sidecar env vars are absent.
3. Command writes valid option sidecar.
4. Command writes valid custom sidecar.
5. Command rejects malformed JSON args.
6. Command notifies user where it wrote the sidecar.

### Acceptance criteria

- Child extension exposes `/grill-side-return`.
- Command writes only through the agreed file protocol.
- Parent validator remains final authority for import eligibility.

## Slice 6 — Persistence/session record behavior

### Files

Touch as needed:

- `src/domain.ts` if public result/details types need side-session metadata
- `src/questionnaire-tool.ts`
- `src/grill-state.ts` if pending questionnaire recovery should retain records
- `src/index.ts` if appending side-session record entries to the parent branch

Add/update tests as needed.

### Behavior

Use two levels:

1. In-questionnaire state:
   - records keyed by source question id
   - one current record per question
   - replacement confirmation enforced here
2. Parent session/tool state:
   - expose or append concise record metadata after child exit
   - do not inline full transcript
   - include child session/transcript reference
   - include source question id and summary

Recommended v1 persistence stance:

- Always keep records during the same blocked questionnaire interaction.
- Include records in tool result details.
- If low-risk, extend `PendingQuestionnaireBatch` so `/grill-reopen` can display existing records after cancellation/recovery.

### Test order

1. Tool result details include side-session records after submitted batch.
2. Pending/cancelled outcome preserves records if pending state is extended.
3. Current UI record for a question is replaced, not appended.
4. Record view shows summary and child reference, not full transcript.

### Acceptance criteria

- One current record per source question.
- Record contains summary/reference only.
- Replacement is explicit.
- No full child transcript is copied into questionnaire state.

## Slice 7 — Scripted smoke verification

### Files

Add:

- `scripts/smoke-questionnaire-side-session.mjs`

Touch:

- `package.json`

Add script, for example:

```json
"smoke:side-session": "node ./scripts/smoke-questionnaire-side-session.mjs"
```

Only include it in `ci` if it is stable in non-interactive CI. Otherwise document it as a manual/scripted smoke check.

### Smoke scenarios

1. Launch pi with this extension loaded.
2. Trigger a questionnaire.
3. Confirm Side Session Action is visible.
4. Open a child pi session.
5. In child, run `/grill-side-return` with an option suggestion.
6. Exit child.
7. Parent shows Import Dialog.
8. Import suggestion.
9. Confirm questionnaire is not submitted yet.
10. Submit parent batch manually.
11. Repeat with existing side-session record and verify replacement confirmation.
12. Run no-UI fallback and verify no side-session affordance/path is invoked.

### Acceptance criteria

- `npm test`
- `npm run typecheck`
- `npm run smoke:pi`
- manual/scripted side-session smoke passes.

## Recommended execution order

1. `src/side-session/return-suggestion.ts`
2. `src/side-session/context-package.ts`
3. `src/side-session/launcher.ts`
4. `/grill-side-return` command
5. questionnaire runtime UI/import/replacement flow
6. persistence/details behavior
7. smoke script

This order keeps the riskiest TUI work until after pure protocol, prompt, and launcher boundaries are tested.
