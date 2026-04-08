---
id: KB-0010
type: feature
depends_on: []
minimum_thinking: high
---

# Establish reproducible build, typecheck, and CI baseline

## Summary

The repo currently relies on passing Vitest plus hidden global pi installs, which makes fresh-checkout builds false-green. Establish the minimal v1 build baseline so `npm install`, `npm test`, `npm run typecheck`, and one pi smoke path are reproducible from the repo itself. This ticket owns dependency/type declaration, verification scripts, CI, and README install/use instructions. It does not own post-v1 npm publication or versioning automation.

## Lane Notes

- Current lane: 2-planned
- Order: 01
- Owner: unassigned

## References

- `.kanban/1-to_refine/KB-0009-reality-check-production-readiness-gaps.md`
- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`
- `README.md`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `src/index.ts`
- `src/questionnaire-tool.ts`
- `test/index.test.ts`
- `test/questionnaire.test.ts`

## Acceptance Criteria

- [ ] `package.json` / `package-lock.json` declare or explicitly shim/document every dependency and type needed for a fresh-checkout install + typecheck of the current extension entrypoint and questionnaire runtime; no hidden reliance on globally installed pi packages or implicit Node typings.
- [ ] A repo-local `typecheck` script is added and passes after a clean install.
- [ ] `README.md` documents the supported local install/use flow, required pi prerequisites, and the repo verification commands for test + typecheck + smoke.
- [ ] CI is added for clean install + `npm test` + `npm run typecheck` + at least one repo-local pi smoke path that proves `src/index.ts` can load the questionnaire runtime successfully.
- [ ] The smoke path exercises normal runtime loading, not the Vitest-only `shouldSkipQuestionnaireRuntimeLoad()` branch.
- [ ] `KB-0008` remains scoped only to post-v1 publication/versioning hardening.

## Verification

- `npm ci`
- `npm test`
- `npm run typecheck`
- `npm ls --depth=0`
- `PI_OFFLINE=1 pi -e ./src/index.ts --mode json -p --no-session "Use the questionnaire tool right now to ask one question with two options: red and blue. Then tell me what happened."`
- inspect CI config/run and confirm the same install + test + typecheck + smoke steps are enforced from a clean checkout

## Notes

- Derived from the `KB-0009` reality-check findings ticket.
- Prefer real package dependencies over broad `any` escapes or relaxed compiler settings. If upstream pi packages do not ship usable types, add the narrowest local shims possible for only the APIs consumed here.
- Keep this ticket focused on making the current repo buildable and verifiable. Do not pull npm publication, version bump automation, or update-channel policy back into v1 scope here; that stays in `KB-0008`.
- Expected file surface is likely `package.json`, `package-lock.json`, `tsconfig.json`, `README.md`, CI config, and small local type declarations if needed.

## Change Log

- created from `KB-0009` refinement
