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

- Current lane: 5-done
- Order: n/a
- Owner: reviewer

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

- [x] `package.json` / `package-lock.json` declare or explicitly shim/document every dependency and type needed for a fresh-checkout install + typecheck of the current extension entrypoint and questionnaire runtime; no hidden reliance on globally installed pi packages or implicit Node typings.
- [x] A repo-local `typecheck` script is added and passes after a clean install.
- [x] `README.md` documents the supported local install/use flow, required pi prerequisites, and the repo verification commands for test + typecheck + smoke.
- [x] CI is added for clean install + `npm test` + `npm run typecheck` + at least one repo-local pi smoke path that proves `src/index.ts` can load the questionnaire runtime successfully.
- [x] The smoke path exercises normal runtime loading, not the Vitest-only `shouldSkipQuestionnaireRuntimeLoad()` branch.
- [x] `KB-0008` remains scoped only to post-v1 publication/versioning hardening.

## Verification

- `npm ci`
- `npm test`
- `npm run typecheck`
- `npm ls --depth=0`
- `npm run smoke:pi`
- `PI_OFFLINE=1 npm exec -- pi --extension ./src/index.ts --no-tools --no-skills --append-system-prompt "Call the questionnaire tool immediately. Do not use any other tools. Do not read files. Do not ask follow-up questions before calling the questionnaire tool." --mode json --print --no-session "/grill" "Use the questionnaire tool right now to ask one question with two options: red and blue. Then tell me what happened."`
- inspect `.github/workflows/ci.yml` and confirm the same install + test + typecheck + smoke steps are enforced from a clean checkout

## Notes

- Derived from the `KB-0009` reality-check findings ticket.
- Prefer real package dependencies over broad `any` escapes or relaxed compiler settings. If upstream pi packages do not ship usable types, add the narrowest local shims possible for only the APIs consumed here.
- Keep this ticket focused on making the current repo buildable and verifiable. Do not pull npm publication, version bump automation, or update-channel policy back into v1 scope here; that stays in `KB-0008`.
- Expected file surface is likely `package.json`, `package-lock.json`, `tsconfig.json`, `README.md`, CI config, and small local type declarations if needed.

## Progress Notes

- 2026-04-08 implementer baseline check completed before code changes.
- 2026-04-09 implementer confirmed the repo-local dependency/type baseline is now present: `npm ci`, `npm test`, `npm run typecheck`, and `npm ls --depth=0` all pass from the checkout with repo-local `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@sinclair/typebox`, and `@types/node` installed.
- 2026-04-09 implementer added a deterministic repo-local smoke script at `scripts/smoke-pi-runtime.mjs` and wired it to `npm run smoke:pi`.
- 2026-04-09 implementer made the smoke path deterministic by using the repo-local `pi` CLI with `--no-tools`, `--no-skills`, an appended system prompt that forces immediate questionnaire use, and `"/grill"` to trigger the normal runtime load path before the prompt turn.
- 2026-04-09 implementer verified that the direct smoke run produced a real `questionnaire` tool call and returned `Interactive questionnaire unavailable: no UI is attached.`, which proves `src/index.ts` loaded the questionnaire runtime outside the Vitest-only skip branch.
- 2026-04-09 implementer updated `README.md` with Node/npm prerequisites, repo-local development usage, and the supported verification flow, and updated `.github/workflows/ci.yml` to enforce `npm ci`, `npm test`, `npm run typecheck`, and `npm run smoke:pi` on clean checkout.
- 2026-04-09 implementer moved the ticket to `4-in_review` after local verification completed successfully.
- 2026-04-09 reviewer re-ran `npm ci`, `npm test`, `npm run typecheck`, `npm ls --depth=0`, `npm run smoke:pi`, and the direct `PI_OFFLINE=1 npm exec -- pi ...` smoke command; inspected `.github/workflows/ci.yml` plus `.kanban/0-open/KB-0008-post-v1-release-distribution-hardening.md`; accepted the ticket and moved it to `5-done`.

## Review Outcome

- Accepted and moved to `5-done`.
- Verified `npm ci`, `npm test`, `npm run typecheck`, `npm ls --depth=0`, and `npm run smoke:pi` from the repo checkout.
- Verified the direct repo-local `pi` smoke command listed in the ticket; observed a real `questionnaire` tool call plus tool result `Interactive questionnaire unavailable: no UI is attached.`, which confirms `src/index.ts` loaded the questionnaire runtime outside the Vitest-only skip path.
- Inspected `.github/workflows/ci.yml`; it enforces `npm ci`, `npm test`, `npm run typecheck`, and `npm run smoke:pi` on clean checkout.
- Inspected `.kanban/0-open/KB-0008-post-v1-release-distribution-hardening.md`; it remains scoped to post-v1 release/distribution hardening.

## Change Log

- created from `KB-0009` refinement
- 2026-04-08 implementer recorded baseline verification and current blockers before implementation
- 2026-04-09 implementer added `scripts/smoke-pi-runtime.mjs` and `package.json` `smoke:pi` / `ci` script updates.
- 2026-04-09 implementer updated `README.md` local install/use and verification instructions.
- 2026-04-09 implementer updated `.github/workflows/ci.yml` to enforce clean-install test, typecheck, and smoke verification.
- 2026-04-09 reviewer accepted the ticket after re-running the clean-install baseline checks, smoke verification, and CI/KB-0008 scope review.
