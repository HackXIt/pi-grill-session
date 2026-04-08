# File-based Kanban for `pi-grill-session`

This repo uses the pi-kanban lane model.

## Source of truth

1. `.kanban/`
2. git state
3. checkpoint tags
4. `.kanban/runtime/`

## Plans vs tickets

- `.plans/` holds canonical design and implementation references
- `.kanban/` holds executable tickets derived from those plans
- tickets should reference the relevant `.plans/*` files

## Lane model

- `0-open/` raw intake or future work
- `1-to_refine/` needs shaping
- `2-planned/` ready and ordered
- `3-in_progress/` actively claimed work
- `4-in_review/` waiting for verification
- `5-done/` completed and verified

## Ticket format

Use the template in `.kanban/templates/ticket.md`.

## Current project policy

- v1 work is tracked as executable kanban tickets in this repo
- post-v1 work is tracked locally in `.kanban/` unless it becomes an epic-level GitLab issue
- architecture and product intent live in `.plans/`
