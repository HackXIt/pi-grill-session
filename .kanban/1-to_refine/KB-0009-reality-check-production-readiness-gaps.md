---
id: KB-0009
type: reality-check
depends_on: []
minimum_thinking: high
---

# Reality check: production-readiness gaps

## Summary

The repo can demo isolated pieces in pi, but it does not yet deliver the v1 contract described in `.plans/ARCHITECTURE.md` and `.plans/IMPLEMENTATION_PLAN.md`. Passing unit tests currently creates a false-green signal: the core automatic grill-session loop is still missing, fallback/recovery is not real yet, and the package is not reproducibly buildable from a fresh checkout.

## Lane Notes

- Current lane: 1-to_refine
- Order: n/a
- Owner: reality-check

## References

- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`
- `README.md`
- `package.json`
- `tsconfig.json`
- `src/index.ts`
- `src/grill-state.ts`
- `src/questionnaire-tool.ts`
- `test/index.test.ts`
- `test/questionnaire.test.ts`
- `.kanban/5-done/KB-0004-build-interactive-questionnaire-ui.md`
- `.kanban/5-done/02-KB-0005-activation-state-and-completion-flow.md`
- `.kanban/0-open/KB-0008-post-v1-release-distribution-hardening.md`

## Symptoms

### 1. Core v1 behavior is still missing from both code and backlog

The architecture and implementation plan say v1 should automatically run repeated questionnaire rounds until completion, with a dedicated completion tool and a manual fallback path.

Current repo state is materially short of that:
- `src/index.ts` activates grill mode and loads the questionnaire runtime, but it does not orchestrate frontier batches.
- `src/grill-state.ts` exports `GRILL_SESSION_COMPLETION_TOOL = "complete_grill_session"`, but no completion tool is registered anywhere in `src/`.
- `.plans/IMPLEMENTATION_PLAN.md` still includes Slice 5 (`questionnaire tool`, `auto-open behavior`, `completion tool + marker phrase`) and Slice 6 (`README`, `install instructions`, `CI`), but `.kanban/` has executable tickets only through `KB-0005` plus post-v1 epics.

This is backlog drift: the board makes the repo look closer to done than it actually is.

### 2. The fallback/recovery story is still mostly theoretical

`.plans/ARCHITECTURE.md` says failed or unavailable automatic interaction should expose manual commands and a recoverable path to reopen or complete a pending batch.

Current repo state:
- `src/questionnaire-tool.ts` returns `Interactive questionnaire unavailable: no UI is attached.` when no UI is present.
- `src/grill-state.ts` tracks only `{ active, activationSource, completed }`.
- No repo-local command or state path exists to reopen a pending questionnaire batch after cancellation/no-UI failure.
- No pending-batch metadata is persisted, even though the architecture calls out `last batch metadata for fallback/recovery`.

This means the system can fail gracefully in text, but not recover operationally.

### 3. The automated test surface is giving a false-green build signal

Observed locally:
- `npm test` passes.
- `npx tsc --noEmit` fails.
- `npm ls --depth=0` shows only `typescript` and `vitest` installed at the repo level.

Representative `tsc` failures from the current repo:
- missing modules/types for `@mariozechner/pi-coding-agent`
- missing modules/types for `@mariozechner/pi-tui`
- missing modules/types for `@sinclair/typebox`
- missing `process` / node types
- implicit `any` errors in production code paths
- a test typing mismatch in `test/grill-state.test.ts`

The weak seam is visible in code:
- `src/index.ts` skips questionnaire runtime loading under Vitest (`shouldSkipQuestionnaireRuntimeLoad()`), so the highest-risk production path is intentionally absent during the main extension tests.
- `test/index.test.ts` uses doubles for the extension API and never loads the actual questionnaire tool module through the normal runtime path.
- `test/questionnaire.test.ts` exercises pure helpers, not `src/questionnaire-tool.ts` registration/integration.

This is not “bad unit testing”; it is an integration hole. The repo is relying on manual pi smoke checks plus mocks/pure helpers to stand in for a missing reproducible build gate.

### 4. Verification standards have already started to drift

`KB-0005` was accepted even though its own live verification checklist still leaves important runtime behaviors unchecked:
- restored branch state after `/reload` or `/tree` navigation
- confirmation that grill-mode prompt injection stops after completion in live pi behavior

Those behaviors do have unit coverage, but branch-aware runtime behavior is exactly where mock-heavy tests are least convincing.

## Root Causes

### Root cause A: v1 slices were not fully converted into executable kanban work

The implementation plan still describes Slice 5 and Slice 6 as core v1 work, but the board does not contain corresponding executable tickets. Instead, the only remaining visible backlog item near packaging is `KB-0008`, which is explicitly framed as post-v1 release hardening.

That creates a planning illusion: real v1 blockers have slipped out of the active board.

### Root cause B: the activation/state layer and questionnaire runtime are not integrated around a real session lifecycle

The current state model is enough to remember “grill mode is on/off,” but not enough to manage a real interrupted questionnaire flow. The architecture expected minimal recovery metadata; the current implementation stops before that seam becomes real.

### Root cause C: passing tests are being treated as stronger evidence than they are

The repo has good pure-logic coverage, but not a trustworthy build/integration gate. Without typecheck + dependency declaration + automated pi smoke, the current green test suite mostly proves helper logic, not shippability.

## Recommended follow-on tickets / corrections

### RC-1: Add the missing v1 orchestration slice as an explicit ticket

Create a v1 executable ticket derived from `.plans/IMPLEMENTATION_PLAN.md` Slice 5 that covers:
- automatic questionnaire invocation during active grill mode
- repeated frontier batches until the tree is complete
- real registration/use of `complete_grill_session`
- the visible completion marker remaining aligned with the tool-driven completion path

### RC-2: Add a real fallback/recovery ticket for interrupted questionnaire flows

Create a v1 executable ticket that covers:
- persisting pending-batch metadata in grill-session state
- a manual reopen/recover path when UI is unavailable or the questionnaire is cancelled
- verification that failure/cancellation does not strand the session in a fake-active state

### RC-3: Add a reproducible build / CI baseline ticket and narrow KB-0008 back to true post-v1 work

Create a v1 executable ticket that covers:
- declaring or documenting the required runtime/build dependencies
- adding a `typecheck` script and making it pass
- adding CI for at least install + test + typecheck
- adding one automated smoke path that loads `src/index.ts` with the questionnaire runtime present

Correction to backlog policy:
- keep `KB-0008` for true post-v1 release/versioning automation only
- move the baseline package/CI/build work back into active v1 scope, because `.plans/IMPLEMENTATION_PLAN.md` already says that baseline is part of v1

## Acceptance Criteria

- [ ] The active board contains an explicit v1 ticket for automatic questionnaire/completion orchestration.
- [ ] The active board contains an explicit v1 ticket for pending-batch fallback/recovery.
- [ ] The active board contains an explicit v1 ticket for reproducible build/typecheck/CI baseline.
- [ ] `KB-0008` is either narrowed to true post-v1 release automation or replaced by a clearer post-v1-only ticket.
- [ ] Future review on this cleanup stream uses `npx tsc --noEmit` plus a minimal pi smoke check in addition to `npm test`.

## Verification

- `npm test`
- `npx tsc --noEmit`
- `npm ls --depth=0`
- `PI_OFFLINE=1 pi -e ./src/index.ts -p --no-session "hello"`
- inspect `.kanban/` and confirm Slice 5 / Slice 6 gaps are represented as executable v1 tickets

## Notes

- This is the single active reality-check findings ticket for the repo.
- `KB-0004` and `KB-0005` still look valid as completed slices; the problem is not that those slices were fake, but that the remaining v1 work is under-tracked and under-verified.
- Secondary drift: `README.md` still describes the repo as mostly an initial skeleton, which understates the implemented pieces while also avoiding the harder question of what is still not production-real.

## Change Log

- created from fresh repo audit
