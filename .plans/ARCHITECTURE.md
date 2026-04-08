# Architecture

## Goal

Build a pi extension and companion skill that turn grill sessions into repeated interactive questionnaire rounds. The agent should ask a batch of frontier questions, pause for all answers, then continue only after batch submission.

## Primary components

### 1. Extension runtime
Responsible for:
- activation (`/grill`, companion skill, strong plain-text trigger)
- grill session state lifecycle
- registering custom tools and commands
- fallback behavior when automatic interaction fails

### 2. Questionnaire tool
Primary interaction mechanism.

The model calls a custom tool that:
- opens an interactive multi-question prompt automatically
- collects all answers before continuing
- returns structured answers in tool result `details`
- renders a readable summary into chat history

### 3. Completion tool
The model calls a dedicated completion tool to end grill mode. The assistant also emits a strict visible marker phrase for the user.

### 4. Companion skill
`grill-session` instructs the model to:
- use frontier-based batches
- present option lists
- include recommendations
- support custom freeform answers
- support selected option + optional notes
- continue interactive questioning until completion

## Interaction model

1. User starts a grill session
2. Extension marks grill mode active
3. Model researches and identifies current frontier questions
4. Model calls questionnaire tool
5. Extension opens questionnaire UI automatically
6. User answers full batch collectively
7. Tool returns structured answers + readable summary
8. Model continues reasoning
9. Repeat until model calls completion tool or user runs `/grill-end`

## State model

Session state should track:
- whether grill mode is active
- how it was activated
- whether completion occurred
- last batch metadata for fallback/recovery

Persist state minimally and reconstruct on `session_start` from session entries.

## Payload model

Each question should support:
- `id`
- `label`
- `prompt`
- `options[]`
- recommendation metadata
- custom-answer support
- optional notes-on-selection support

Each answer should support:
- selected option id/label when applicable
- custom answer when applicable
- optional notes
- whether the answer came from selection or custom input

## Fallbacks

If automatic interactive UI is unavailable or fails:
- expose manual commands
- provide a recoverable path to reopen or complete the pending batch
- degrade to normal text questioning only when necessary

## Persistence of outcomes

Important design decisions should be persistable to project files when asked. This is not mandatory automatic behavior for every session in v1.

## Out of scope for v1

- generic interview framework
- non-grill skill support
- rich artifact generation beyond the minimum needed
