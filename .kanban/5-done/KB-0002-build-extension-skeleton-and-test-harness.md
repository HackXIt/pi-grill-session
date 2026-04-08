---
id: KB-0002
type: feature
depends_on:
  - KB-0001
minimum_thinking: high
---

# Build extension skeleton and test harness

## Summary

Create the initial package, source layout, and automated test setup for the grill-session extension.

## Lane Notes

- Current lane: 5-done
- Order: n/a
- Owner: assistant

## References

- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`

## Acceptance Criteria

- [ ] `package.json` exists with scripts for test and lint/build as needed.
- [ ] Source layout exists for extension entrypoint and supporting modules.
- [ ] Automated tests can be run locally.
- [ ] Basic extension import or load path is documented and testable.

## Verification

- `npm test`
- `find src test -maxdepth 3 -type f | sort`

## Notes

Keep this minimal. Do not implement the full questionnaire flow in this ticket.

## Change Log

- created

- completed with package metadata, test harness, extension entrypoint, and README install path
