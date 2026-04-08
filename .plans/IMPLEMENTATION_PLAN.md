# Implementation Plan

## Success criteria

1. Starting with `/skill:grill-session`, `/grill`, or strong plain-text trigger activates grill mode.
2. When the model needs a decision batch, the questionnaire opens automatically.
3. Each question supports:
   - options
   - recommendation marker
   - custom freeform answer
   - selected option + optional notes
4. The agent does not continue until the whole batch is submitted.
5. Submitted answers are available:
   - to the model as structured results
   - to the user as readable chat history
6. Grill mode persists across rounds until completion.
7. Completion works via dedicated completion tool or `/grill-end`.
8. Completion emits a strict visible marker phrase.
9. Manual fallback exists if automatic interaction fails.
10. Logic around activation/state/payload/completion has automated tests.
11. Repo includes working package metadata, CI, and install/use docs.
12. Post-v1 work is tracked in local pi-kanban, with only epic-level GitLab tracking later.

## Delivery slices

### Slice 1: Repo + extension skeleton
- package metadata
- extension entrypoint
- basic commands
- test harness setup

### Slice 2: Questionnaire domain model and normalization
- batch schema
- answer schema
- payload shaping
- tests for shape/normalization

### Slice 3: Interactive questionnaire UI
- multi-question prompt
- recommendation marker
- custom answer
- selected option + optional notes

### Slice 4: Grill session state and activation
- `/grill`
- `/grill-end`
- companion skill activation path
- plain-text trigger handling
- persistence/reconstruction tests

### Slice 5: Tool-driven automatic flow
- questionnaire tool
- readable rendering
- auto-open behavior
- completion tool + marker phrase

### Slice 6: Documentation and CI
- README
- install instructions
- CI
- local backlog seeding

## Testing strategy

Automate logic that is stable and provable:
- activation detection
- state transitions
- payload shaping
- completion logic
- fallback behavior

Use exploratory testing inside pi for iterative TUI feedback.
