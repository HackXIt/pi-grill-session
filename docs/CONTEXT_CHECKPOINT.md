# Context Checkpoint

Last updated: 2026-05-27

## Goal

Build and maintain a pi extension/skill that improves `grill-me` by replacing serial Q&A with interactive multi-tab questionnaire batches. The extension keeps grill-session mode active until the decision tree is complete and returns structured answers to the model.

## Current repository

Repo root:

- `/home/hackxit/git-stash/mirror-personal/pi-grill-session.git/main`

Important files:

- `README.md` — usage, commands, tools, side-session UX, and verification.
- `CONTEXT.md` — project ubiquitous language.
- `docs/PRD-questionnaire-side-sessions.md` — implemented side-session PRD.
- `docs/spike-questionnaire-side-sessions-interactive-shell-reuse.md` — launcher reuse spike.
- `docs/adr/0001-questionnaire-side-sessions-use-interactive-child-pi.md` — side-session launcher decision.
- `src/index.ts` — extension entrypoint and commands.
- `src/questionnaire-tool.ts` — `questionnaire` tool registration.
- `src/questionnaire-runtime.ts` — questionnaire TUI, pending behavior, side-session import flow.
- `src/side-session/*` — context packaging, launcher, return suggestions, return tools/command.
- `skills/grill-session/SKILL.md` and `skills/grill-session-docs/SKILL.md` — packaged skills.

## Implemented behavior

### Grill activation and lifecycle

- `/grill` starts or continues grill-session mode.
- Strong plain-text “grill me” activation is normalized into the canonical skill command.
- Ambiguous “grill” messages ask for confirmation.
- `/grill-end` ends the session and emits `[GRILL SESSION COMPLETE]`.
- Autonomous kanban role sessions skip questionnaire/grill runtime loading; `kanban operator` remains allowed by skill guidance because it is user-owned and interactive.

### Questionnaire tool

The `questionnaire` tool:

- opens an interactive multi-tab TUI when UI is attached
- asks one batch at a time and waits for the full batch before the agent continues
- supports options, recommended markers, option notes, and custom answers
- renders readable chat history and returns structured answer details
- records pending batches when cancelled or when no UI is attached
- supports `/grill-reopen` for pending cancelled/no-UI batches

### Questionnaire side sessions

Interactive question tabs include an **Open side session** action.

V1 side sessions:

- suspend the parent questionnaire TUI before launching the child
- launch a normal blocking child `pi` process in the parent project
- write a context package with source question, full batch context, current draft answers, parent cwd, parent session reference, and sidecar return path
- instruct the child to discuss first, respect instruction-only Project Read-Only Mode for the parent project, and only return after explicit user confirmation
- resume the parent questionnaire after child exit, including failure handling
- show an import prompt with manual return, import suggestion, view record, and discard choices
- import only existing answer shapes: selected option + optional notes, or custom answer
- never submit the parent questionnaire automatically
- keep at most one current Side Session Record per source question and ask before replacement

Child-side return surfaces:

- `grill_side_return_option`
- `grill_side_return_custom`
- `/grill-side-return`

The split tools replaced the earlier single-tool UX so model/tool routing is clearer for option vs custom returns. The interactive command reads side-session context so option ids can be selected from the source question.

## Key design decisions

- Use an extension plus companion skills, not a skill-only approach.
- Keep grill sessions frontier-based: one current decision batch, then continue to the next unresolved frontier.
- Prefer the `questionnaire` tool for batches whenever available.
- Keep no-UI behavior recoverable rather than trying to run headless side sessions.
- Use a local blocking child-`pi` launcher for side sessions in v1. The spike found useful side-conversation references but no stable compatible extension-to-extension launcher API.
- Keep the side-session launcher boundary narrow so it can be swapped for a future upstream API.
- Treat Project Read-Only Mode as instruction-only in v1.
- Store side-session return data in sidecar JSON and always ask before importing.

## Verification

Automated baseline:

```bash
npm test
npm run typecheck
npm run smoke:pi
```

Manual interactive side-session checklist:

```bash
npm run smoke:side-session
```

`smoke:side-session` is intentionally a printed manual checklist because it requires a real interactive pi TUI/PTY session.

## Backlog notes

Kanban remains under `.kanban/`. Current side-session work is reflected in the PRD, spike, ADR, code, tests, and README. Future candidates include release/distribution hardening, generic interview framework extraction, and non-grill skill support.

## Resume prompt for a new agent session

If resuming documentation or implementation from this folder:

1. Read `README.md`, `CONTEXT.md`, and `docs/PRD-questionnaire-side-sessions.md`.
2. Inspect `src/questionnaire-runtime.ts` and `src/side-session/*` for side-session behavior.
3. Run `npm test`, `npm run typecheck`, and `npm run smoke:pi` after code changes.
4. Use `npm run smoke:side-session` for the manual interactive side-session checklist.
