# pi-grill-session

Interactive grill-session extension for pi.

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

Current commands:

- `/grill`
- `/grill-end`
- `/grill-reopen` — reopens the last cancelled or no-UI questionnaire batch

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
PI_OFFLINE=1 npm exec -- pi --no-extensions --extension ./src/index.ts --no-tools --no-skills --append-system-prompt "Call the questionnaire tool immediately. Do not use any other tools. Do not read files. Do not ask follow-up questions before calling the questionnaire tool." --mode json --print --no-session "Use the questionnaire tool right now to ask one question with two options: red and blue. Then tell me what happened."
```

## CI

CI validates a clean checkout with:

- `npm ci`
- `npm test`
- `npm run typecheck`
- `npm run smoke:pi`

## Planning and execution

- canonical plans: `.plans/`
- executable work: `.kanban/`
