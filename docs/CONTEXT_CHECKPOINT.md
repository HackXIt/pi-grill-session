# Context Checkpoint

Last updated: 2026-04-08

## Goal

Build a new pi extension/skill that improves `grill-me` by replacing serial Q&A with an interactive multi-tab questionnaire flow.

The interactive flow should:
- run automatically for the full grill session
- collect each frontier batch before the agent continues
- use pi’s TUI
- preserve readable answers in chat history
- return actual structured answers to the model

## Constraints and Preferences

- All `grill-me` interactions should be interactive in pi’s TUI.
- Questionnaire must support:
  - default answer options from the agent
  - a recommended option marker
  - a freeform/custom answer path
  - option selection plus optional notes
- User wants to answer all questions in a batch first; only then should the agent continue.
- This behavior should persist until the grill decision tree is complete.
- Follow-up clarification rounds should use the same interactive prompt style.
- Automatic opening is preferred once a grill session is active; manual fallback must exist.
- User may start grill sessions at conversation start or later after research; they do not want to manually open questionnaires every round.
- Answers should be visible in chat history in readable form.
- The model should receive the actual answers, not just a prose summary.
- Activation should support explicit commands/skills and strong plain-text trigger matches.
- Completion should use a dedicated completion tool and a strict user-visible marker phrase.
- Important design decisions should be persisted somewhere useful, often markdown in the repo.
- V1 should include repo + README + package + working CI/consumption path.
- Automated tests are required for logic and acceptance-criteria-driven behavior; exploratory manual testing happens in pi.
- Post-v1 work should be tracked as local file issues using pi-kanban; only epic-level post-v1 items go to GitLab.

## Research Completed

The following local pi docs/examples were reviewed:
- `~/.pi/agent/skills/grill-me/SKILL.md`
- `.../docs/extensions.md`
- `.../docs/sdk.md`
- `.../docs/tui.md`
- `.../examples/extensions/README.md`
- `.../examples/extensions/question.ts`
- `.../examples/extensions/questionnaire.ts`
- `.../examples/rpc-extension-ui.ts`
- `.../pi-kanban/README.md`
- `.../pi-kanban/skills/kanban/SKILL.md`

Key result:
- `examples/extensions/questionnaire.ts` is the closest existing interaction model and should be reused conceptually rather than rebuilt from scratch.

## Prototype History

Prototype extension path:
- `~/.pi/agent/extensions/grill-prototype.ts`

Supporting prototype data:
- `/home/hackxit/git-stash/tmp/grill-batch3.json`

Prototype commands:
- `/grill-prototype`
- `/grill-prototype batch2`
- `/grill-prototype-file path/to/questions.json`

Prototype currently demonstrates:
- custom TUI questionnaire opening
- built-in multiple batches
- JSON-driven questionnaires
- synthetic answer submission via `pi.sendUserMessage(...)`

Prototype limitation:
- it does **not** yet implement the final production payload/flow model.

## Key Design Decisions

### Interaction model
- Use an extension, not only a skill.
- Keep `grill-me` behavior interactive in pi’s TUI.
- Use frontier-based batching: ask one batch per current decision frontier, wait for submission, then continue.
- The primary mechanism should be an automatic custom-tool-driven questionnaire.
- Manual commands must exist as fallback.

### Activation
Support all of:
- explicit `/skill:grill-me`
- alias like `/grill`
- strong plain-text “grill me” detection

Plain-text behavior:
- strong match auto-activates
- ambiguous match asks for confirmation

### Skill strategy
- Add a companion skill named `grill-session`.
- Do not replace `grill-me` immediately.
- Merge/replace later only if the new flow proves successful.

### Questionnaire UX
Each question must support:
- predefined options
- recommendation visibility on the option and in question/header context
- fully custom answers
- selected option + optional notes on the same tab

### Answer model
- The model must receive the actual answers in structured form.
- Readable chat rendering is also required for user history/debuggability.

### Session behavior
- Once activated, grill mode remains active until completion.
- Follow-up clarification rounds use the same questionnaire style.
- File-based questionnaire loading was only for prototyping, not final UX.

### Completion
- Use a dedicated completion tool.
- Also emit a strict visible marker phrase.
- Manual `/grill-end` must exist.

### Persistence
- Important design decisions/results should be persisted to useful markdown files in the repo when needed.

### Packaging and repo strategy
- Use both local extension usage and a dedicated GitLab repo from day one.
- V1 must include package metadata, README, and working CI/consumption path.

### Testing bar
- Add unit/integration automation for stable logic.
- Validate interactive behavior exploratorily inside pi via `/reload`.

### Backlog strategy
- Track post-v1 work in local pi-kanban files.
- Only epic-level future work should be promoted to GitLab.

## Current Repository

Repo root:
- `/home/hackxit/git-stash/pi-grill-session`

This repository now contains:
- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`
- `.kanban/` lane structure and tickets
- `README.md`
- `package.json`
- `tsconfig.json`
- `src/index.ts`
- `src/domain.ts`
- `test/index.test.ts`
- `test/domain.test.ts`

## Current Kanban State

Completed:
- `KB-0001` bootstrap repo and kanban
- `KB-0002` extension skeleton and test harness
- `KB-0003` questionnaire domain and payloads

Refine next:
- `KB-0004` build interactive questionnaire UI
- `KB-0005` activation, state, and completion flow

Open post-v1 backlog:
- `KB-0006` generic interview framework
- `KB-0007` non-grill skill support
- `KB-0008` release/distribution hardening

## Implemented So Far

### Extension skeleton
`src/index.ts` currently provides minimal command registration for:
- `/grill`
- `/grill-end`

This is a skeleton only, not the final integrated behavior.

### Questionnaire domain model
`src/domain.ts` currently implements pure logic for:
- questionnaire batch normalization
- default labels (`Q1`, `Q2`, ...)
- default `allowCustomAnswer = true`
- default `allowNotes = false`
- recommendation normalization
- structured answer payload creation
- option selection with optional notes
- fully custom answers
- readable summary line creation

### Tests
Current passing tests cover:
- command registration
- question normalization defaults
- structured payload shaping for option + notes
- structured payload shaping for custom answers

Latest verification status:
- `npm test` passing

## Important Runtime / Environment Notes

- Real prototype verification must happen inside pi; standalone verification outside pi previously failed because module resolution did not match pi runtime.
- A prior observed error outside pi was:
  - `Error: Cannot find module '@mariozechner/pi-tui'`
- The original working directory before repo creation was not a git repo.
- `kanban setup` partially failed in this environment due to a helper asset path issue (`cp: cannot stat '/home/hackxit/.local/README.md'`), so the missing seed files were repaired manually while preserving the expected pi-kanban structure.

## Recommended Next Steps

1. Implement `KB-0004`:
   - real interactive questionnaire UI
   - recommendation marker
   - selected option + optional notes on same tab
   - custom answer path
   - full-batch submission flow
2. Implement `KB-0005`:
   - grill session state
   - activation parsing/triggers
   - completion tool contract
   - strict completion marker phrase
   - manual fallback commands
3. Replace prototype-style `pi.sendUserMessage(...)` flow with real structured tool results plus readable rendering.
4. Add companion skill:
   - `skills/grill-session/SKILL.md`
5. Add CI and finalize package/consumption path.
6. Verify end-to-end behavior inside pi with `/reload`.

## Intended Production Module Layout

Proposed target structure:
- `src/index.ts`
- `src/questionnaire.ts`
- `src/grill-state.ts`
- `src/activation.ts`
- `src/payload.ts`
- `skills/grill-session/SKILL.md`
- `tests/...`

## Resume Prompt for a New Agent Session

If resuming from this folder, the next agent should:
- read `.plans/ARCHITECTURE.md`
- read `.plans/IMPLEMENTATION_PLAN.md`
- read `.kanban/README.md`
- inspect current lane files in `.kanban/`
- continue with `KB-0004` using TDD
- preserve the design decisions listed above
