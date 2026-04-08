---
name: grill-session
description: Run an interactive grill session that pressure-tests a plan or design through frontier-based question batches until the decision tree is complete. Use when grill-session mode is activated or the user asks to be grilled on a design.
---

Interview the user relentlessly about every aspect of the plan, design, or implementation approach until you reach shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. For each question or batch, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the codebase instead.

## Grill-session behavior

- Stay in grill-session mode until the decision tree is complete.
- Focus on the current frontier: ask only the next question or batch needed to make progress.
- Separate distinct decisions instead of bundling unrelated topics together.
- Surface tradeoffs, assumptions, hidden constraints, and missing dependencies.
- Keep follow-up questions concise, decision-oriented, and cumulative.
- Incorporate the user's full answer batch before deciding the next frontier.
- When the tree is complete, emit the exact marker phrase `[GRILL SESSION COMPLETE]`.

## Questionnaire integration

- Prefer structured questionnaire batches when the `questionnaire` tool is available.
- Use the questionnaire to ask the current frontier batch, not to dump the whole tree at once.
- For each questionnaire item, include a recommended option when you have a strong view.
- Accept either a recommended option or a custom freeform answer.
- After each questionnaire submission, continue the grill session by advancing to the next unresolved frontier.
- Do not exit grill-session mode just because one batch was answered; continue until there are no important unresolved branches.
