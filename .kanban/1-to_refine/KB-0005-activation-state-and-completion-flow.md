---
id: KB-0005
type: feature
depends_on:
  - KB-0003
minimum_thinking: high
---

# Activation, state, and completion flow

## Summary

Design and implement how grill sessions start, persist, and complete, including plain-text trigger handling, commands, and completion signaling.

## Lane Notes

- Current lane: 1-to_refine
- Order: n/a
- Owner: unassigned

## References

- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`

## Acceptance Criteria

- [ ] Start paths are defined for companion skill, command, and strong text trigger.
- [ ] Grill mode persists until completion.
- [ ] `/grill-end` exists.
- [ ] Completion tool and strict marker phrase responsibilities are defined.
- [ ] Automated tests cover state transitions.

## Verification

- `npm test`
- exploratory validation in pi

## Notes

Keep auto-activation conservative and confirm when matching is ambiguous.

## Change Log

- created
