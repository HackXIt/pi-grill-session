---
id: KB-0004
type: feature
depends_on:
  - KB-0003
minimum_thinking: high
---

# Build interactive questionnaire UI

## Summary

Turn the prototype interaction into the real reusable questionnaire UI with support for recommendation markers, selected option plus optional notes, and full-batch submission.

## Lane Notes

- Current lane: 1-to_refine
- Order: n/a
- Owner: unassigned

## References

- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`
- prototype extension under `~/.pi/agent/extensions/grill-prototype.ts`

## Acceptance Criteria

- [ ] UI supports multi-question batch submission.
- [ ] Recommendation is visible in UI.
- [ ] User can choose an option and optionally add notes on the same tab.
- [ ] User can provide a fully custom answer instead.
- [ ] Result can be rendered readably into chat history.

## Verification

- exploratory validation in pi
- targeted automated tests for non-TUI logic extracted from the UI layer

## Notes

Refine the exact interaction flow before implementation.

## Change Log

- created
