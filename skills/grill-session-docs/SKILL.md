---
name: grill-session-docs
description: "Interactive pi version of grill-with-docs: stress-test a plan against the project domain language, sharpen terminology, and update CONTEXT.md/ADRs as decisions crystallize. Use when the user wants to be grilled with domain documentation or ubiquitous-language updates."
---

Interview the user relentlessly about every aspect of the plan, design, or implementation approach until you reach shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. For each question or batch, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the codebase instead.

This skill combines regular `grill-session` behavior with ubiquitous-language documentation. The only pi-specific difference from upstream `grill-with-docs` is that this skill prefers the `questionnaire` tool for interactive answer batches.

## Grill-session behavior

- Use this skill only in interactive manual sessions.
- Never use this skill in autonomous kanban-managed roles such as manager, implementer, reviewer, refiner, planner, reality-check, or recovery.
- `kanban operator` is allowed to use this skill because it is user-owned and interactive.
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

## Domain-awareness behavior

During codebase exploration, also look for existing documentation:

- If `CONTEXT-MAP.md` exists at the root, read it to identify multiple contexts and their `CONTEXT.md` files.
- If only a root `CONTEXT.md` exists, treat the repository as a single-context repo.
- If neither exists, create a root `CONTEXT.md` lazily when the first domain term is resolved.
- Create `docs/adr/` lazily only when the first ADR is needed.

During the grill:

- Challenge conflicts against the existing glossary immediately.
- Sharpen fuzzy or overloaded language by proposing a precise canonical term.
- Discuss concrete scenarios, especially edge cases that clarify boundaries between concepts.
- Cross-reference claims with code when the code can verify or contradict them.
- Update `CONTEXT.md` inline when a term is resolved; do not batch resolved glossary changes for later.
- Keep `CONTEXT.md` as a glossary only. Do not use it as a spec, scratch pad, or implementation-decision log.
- Offer ADRs sparingly: only when the decision is hard to reverse, surprising without context, and the result of a real trade-off.

## CONTEXT.md format

Use this structure:

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction
```

Rules:

- Be opinionated: pick the canonical term and list aliases to avoid.
- Flag conflicts explicitly in `Flagged ambiguities` with the resolution.
- Keep definitions to one or two sentences.
- Define what a term is, not what it does.
- Include only project-domain concepts, not generic programming concepts.
- Group terms under subheadings when natural clusters emerge.
- Add an example dialogue that demonstrates how the terms interact naturally.

For multi-context repos, keep a root `CONTEXT-MAP.md` with context links and relationships.

## ADR format

ADRs live in `docs/adr/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Use the smallest useful ADR:

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

Optional sections are allowed only when they add genuine value: status frontmatter, considered options, or consequences.
