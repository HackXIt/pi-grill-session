#!/usr/bin/env node

console.log(`Questionnaire side-session smoke check (manual/scripted):

1. Launch pi in this repo with the extension loaded.
2. Trigger the questionnaire tool with an interactive batch.
3. Verify each question tab shows "Open side session".
4. Open the side session, run /grill-side-return with an option or custom suggestion, then exit child pi.
5. Verify the parent questionnaire offers import, imports only into the draft, and does not submit automatically.
6. Open another side session from the same source question and verify replacement confirmation.
7. Run a no-UI questionnaire path and verify no side-session affordance or launcher path appears.

This smoke is intentionally documented instead of automated in CI because it requires a stable interactive pi TUI/PTY session.
`);
