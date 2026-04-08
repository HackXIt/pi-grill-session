---
id: KB-0003
type: feature
depends_on:
  - KB-0002
minimum_thinking: high
---

# Model questionnaire domain and payloads

## Summary

Define the questionnaire batch and answer structures, including recommendation metadata and notes support, with automated tests for normalization and payload shaping.

## Lane Notes

- Current lane: 5-done
- Order: n/a
- Owner: assistant

## References

- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`

## Acceptance Criteria

- [ ] Question and answer domain types exist.
- [ ] Support exists for custom answers and selected-option notes.
- [ ] Structured payload output is defined for tool results.
- [ ] Automated tests cover normalization and payload shaping.

## Verification

- `npm test`

## Notes

This is a logic-first slice and should be implemented before the full TUI behavior.

## Change Log

- created

- completed with pure questionnaire normalization and structured payload shaping tests
