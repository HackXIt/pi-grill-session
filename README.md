# pi-grill-session

Interactive grill-session extension for pi. It turns grill-me style interviews into structured, multi-question questionnaire batches and keeps grill mode active until the decision tree is complete.

## Features

- `/grill` command and strong “grill me” activation for interactive grill sessions.
- `questionnaire` tool that opens a multi-tab pi TUI and returns structured answers to the model.
- Option answers, recommended-option markers, optional notes, and custom answers.
- Pending-batch recovery with `/grill-reopen` when a questionnaire is cancelled or no UI is attached.
- Per-question side sessions from the questionnaire UI for clarifying a source question without submitting the parent batch.
- Child-side return tools/command for importing a draft answer back into the parent questionnaire after user review.

## Prerequisites

- Node 24+
- npm

A global `pi` install is optional for local development. The reproducible verification flow below uses the repo-local `pi` binary installed from `node_modules`.

## Try the extension

### Load from the repo checkout

```bash
npm install
npm exec -- pi --extension ./src/index.ts
```

### Install as a pi package

From GitHub:

```bash
pi install git:github.com/HackXIt/pi-grill-session
```

Or test it without installing permanently:

```bash
pi -e git:github.com/HackXIt/pi-grill-session
```

## Commands

- `/grill` — start or continue an interactive grill session.
- `/grill-end` — end the active grill session and emit `[GRILL SESSION COMPLETE]`.
- `/grill-reopen` — reopen the last cancelled or no-UI questionnaire batch.
- `/grill-side-return` — child-side interactive command used inside a side session to write an importable return suggestion.

## Tools

- `questionnaire` — opens an interactive questionnaire and waits for the full answer batch.
- `grill_side_return_option` — child-side side-session tool that returns a selected option suggestion plus optional notes.
- `grill_side_return_custom` — child-side side-session tool that returns a custom-answer suggestion.

The side-session return tools and `/grill-side-return` only write a suggestion for the parent questionnaire. They never submit the parent batch; the parent UI asks before importing.

## Questionnaire side sessions

Interactive questionnaire question tabs include an **Open side session** action. Selecting it temporarily suspends the parent questionnaire TUI, launches a blocking child `pi` process in the same project, and passes a context package containing:

- the source question, options, recommendation markers, and current draft answer
- the full current questionnaire batch
- the parent working directory and session branch reference when available
- a temporary sidecar path for return suggestions

The child prompt instructs the child session to treat the parent project as read-only by instruction, discuss the question first, and only return a suggestion after explicit user confirmation. When the child exits, the parent questionnaire resumes and shows an import prompt with manual return, import suggestion, view record, and discard choices.

Side sessions are UI-only. In no-UI questionnaire fallback paths, the batch remains pending and can be recovered with `/grill-reopen`; no side-session launcher is offered.

## Skills

- `grill-session` — regular interactive grill-me flow using pi questionnaires.
- `grill-session-docs` — grill-with-docs flow that also maintains ubiquitous-language `CONTEXT.md` documentation and offers ADRs sparingly.

## Verify the repo baseline

From a fresh checkout:

```bash
npm install
npm test
npm run typecheck
npm run smoke:pi
```

`npm run smoke:pi` uses the repo-local `pi` CLI to load `./src/index.ts`, starts grill mode with `/grill`, and verifies that the model can call the `questionnaire` tool and reach the expected non-interactive fallback:

- `Interactive questionnaire unavailable: no UI is attached.`

Equivalent direct smoke command:

```bash
PI_OFFLINE=1 npm exec -- pi --no-extensions --extension ./src/index.ts --no-skills --append-system-prompt "Call the questionnaire tool immediately. Do not use any other tools. Do not read files. Do not ask follow-up questions before calling the questionnaire tool." --mode json --print --no-session "Use the questionnaire tool right now to ask one question with two options: red and blue. Then tell me what happened."
```

Manual side-session smoke checklist:

```bash
npm run smoke:side-session
```

This prints the interactive checks for launching a side session, returning/importing a suggestion, replacement confirmation, and no-UI behavior. It is intentionally not part of CI because it requires a real interactive pi TUI/PTY session.

## CI

CI validates a clean checkout with:

- `npm ci`
- `npm test`
- `npm run typecheck`
- `npm run smoke:pi`

## Planning and execution

- canonical plans: `.plans/`
- executable work: `.kanban/`
- side-session PRD/spike/ADR: `docs/PRD-questionnaire-side-sessions.md`, `docs/spike-questionnaire-side-sessions-interactive-shell-reuse.md`, `docs/adr/0001-questionnaire-side-sessions-use-interactive-child-pi.md`
