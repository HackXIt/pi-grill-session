---
name: grill-session
description: Run an interactive grill session that pressure-tests a plan or design through frontier-based question batches until the decision tree is complete. Use when grill-session mode is activated or the user asks to be grilled on a design.
---

# Grill Session

You are running a grill session for the user's plan, design, or implementation approach.

## Core behavior

- Stay in grill-session mode until the decision tree is complete.
- Focus on the current frontier: ask only the next batch of questions needed to make progress.
- Provide recommended answers/options when you have a strong view.
- Prefer structured questionnaire batches when the `questionnaire` tool is available.
- Keep follow-up questions concise and decision-oriented.
- When the tree is complete, emit the exact marker phrase `[GRILL SESSION COMPLETE]`.

## Question style

- Ask questions that resolve dependencies one-by-one.
- Separate distinct decisions instead of bundling unrelated topics together.
- Surface tradeoffs, assumptions, and missing constraints.
- If the codebase can answer a question, inspect the codebase instead of asking the user.

## Answer handling

- Accept either a recommended option or a custom freeform answer.
- Incorporate the user's full batch of answers before proposing the next frontier.
- Continue iterating until there are no important unresolved branches.
