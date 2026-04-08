# pi-grill-session

Interactive grill-session extension for pi.

## Current status

This repository currently contains the initial extension skeleton, test harness, kanban plan, and architecture documents.

## Load locally in pi

During development, load directly from the repo path:

```bash
pi --extension /home/hackxit/git-stash/pi-grill-session/src/index.ts
```

Or add it to pi package/extension configuration later.

## Commands

Current skeleton commands:

- `/grill`
- `/grill-end`

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

## Planning and execution

- canonical plans: `.plans/`
- executable work: `.kanban/`
