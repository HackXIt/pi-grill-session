# pi-grill-session

Interactive grill-session extension for pi.

## Install as a pi package

From GitHub:

```bash
pi install git:github.com/HackXIt/pi-grill-session
```

Or test it without installing permanently:

```bash
pi -e git:github.com/HackXIt/pi-grill-session
```

## Load locally during development

```bash
pi --extension /home/hackxit/git-stash/pi-grill-session/src/index.ts
```

## Commands

Current commands:

- `/grill`
- `/grill-end`

## Development

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm test
npm run typecheck
npm run package:check
```

## CI

CI validates:

- `npm test`
- `npm run typecheck`
- `npm pack`

## Planning and execution

- canonical plans: `.plans/`
- executable work: `.kanban/`
