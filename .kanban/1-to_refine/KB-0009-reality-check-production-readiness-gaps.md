---
id: KB-0009
type: reality-check
depends_on: []
minimum_thinking: high
---

# Reality check: production-readiness gaps

## Summary

The repo still misses key v1 production-readiness behavior from `.plans/ARCHITECTURE.md` and `.plans/IMPLEMENTATION_PLAN.md`, even though isolated pieces demo well and `npm test` is green. The planning drift identified in this findings ticket has now been corrected at the board level via `KB-0010`, `KB-0011`, and `KB-0012`, but the implementation gap remains: the tool-driven multi-round grill flow is incomplete, fallback/recovery is not operational, and a fresh checkout still does not typecheck or declare the needed runtime dependencies.

## Lane Notes

- Current lane: 1-to_refine
- Order: n/a
- Owner: reality-check
- Parent findings ticket; active cleanup stream is `KB-0010` in `3-in_progress`, followed by `KB-0011` → `KB-0012` in `2-planned`

## References

- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`
- `README.md`
- `package.json`
- `tsconfig.json`
- `skills/grill-session/SKILL.md`
- `src/index.ts`
- `src/grill-state.ts`
- `src/questionnaire-tool.ts`
- `test/index.test.ts`
- `test/questionnaire.test.ts`
- `.kanban/5-done/KB-0004-build-interactive-questionnaire-ui.md`
- `.kanban/5-done/02-KB-0005-activation-state-and-completion-flow.md`
- `.kanban/3-in_progress/KB-0010-reproducible-build-typecheck-and-ci-baseline.md`
- `.kanban/2-planned/02-KB-0011-persist-pending-batches-and-add-recovery-command.md`
- `.kanban/2-planned/03-KB-0012-complete-tool-driven-grill-session-flow.md`
- `.kanban/0-open/KB-0008-post-v1-release-distribution-hardening.md`

## Symptoms

### 1. Core v1 behavior is still missing from code, even though backlog drift is now corrected

The architecture and implementation plan say v1 should automatically run repeated questionnaire rounds until completion, with a dedicated completion tool and a manual fallback path.

Current repo state is still materially short of that:
- `src/index.ts` activates grill mode and loads the questionnaire runtime, but it does not orchestrate frontier batches.
- `src/grill-state.ts` exports `GRILL_SESSION_COMPLETION_TOOL = "complete_grill_session"`, but no completion tool is registered anywhere in `src/`.
- `skills/grill-session/SKILL.md` tells the model to prefer `questionnaire` and emit `[GRILL SESSION COMPLETE]`, but the runtime does not yet enforce or complete that tool-driven lifecycle.

The planning side of this symptom has now been corrected:
- `KB-0010` captures the missing Slice 6 build/typecheck/CI baseline.
- `KB-0011` captures the missing interrupted-batch fallback/recovery lifecycle.
- `KB-0012` captures the missing Slice 5 completion-tool and multi-round grill flow.

That removes the backlog illusion, but not the underlying product gap.

### 2. The fallback/recovery story is still mostly theoretical

`.plans/ARCHITECTURE.md` says failed or unavailable automatic interaction should expose manual commands and a recoverable path to reopen or complete a pending batch.

Current repo state:
- `src/questionnaire-tool.ts` returns `Interactive questionnaire unavailable: no UI is attached.` when no UI is present.
- `src/grill-state.ts` tracks only `{ active, activationSource, completed }`.
- No repo-local command or state path exists to reopen a pending questionnaire batch after cancellation/no-UI failure.
- No pending-batch metadata is persisted, even though the architecture calls out `last batch metadata for fallback/recovery`.

This means the system can fail gracefully in text, but not recover operationally.

### 3. The automated test surface is giving a false-green build signal

Observed locally during this refinement pass:
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

The implementation plan still describes Slice 5 and Slice 6 as core v1 work, but the board originally did not contain corresponding executable tickets. Instead, the only remaining visible backlog item near packaging was `KB-0008`, which is explicitly framed as post-v1 release hardening.

That planning illusion has now been corrected by the cleanup stream `KB-0010` / `KB-0011` / `KB-0012`, but only at the ticketing layer. The implementation blockers remain open.

### Root cause B: the activation/state layer and questionnaire runtime are not integrated around a real session lifecycle

The current state model is enough to remember “grill mode is on/off,” but not enough to manage a real interrupted questionnaire flow. The architecture expected minimal recovery metadata; the current implementation stops before that seam becomes real.

### Root cause C: passing tests are being treated as stronger evidence than they are

The repo has good pure-logic coverage, but not a trustworthy build/integration gate. Without typecheck + dependency declaration + automated pi smoke, the current green test suite mostly proves helper logic, not shippability.

## Derived cleanup stream

The real seam of change is now represented as one ordered cleanup stream:

### 1. `KB-0010` — reproducible build, typecheck, and CI baseline

Owns the fresh-checkout build contract:
- declare/document the runtime and type dependencies actually used by the extension
- add a repo-local typecheck script and make it pass
- add CI for install + test + typecheck + one smoke path that loads the real questionnaire runtime
- keep `KB-0008` narrowed to true post-v1 publication/versioning work

### 2. `KB-0011` — persist pending batches and add recovery command

Owns interrupted-batch lifecycle safety:
- persist minimal pending-batch metadata in grill-session state
- expose `/grill-reopen` as the single recovery path for cancelled/no-UI batches
- clear pending metadata correctly on explicit end/completion paths
- verify cancellation/no-UI no longer strands the session in fake-active or fake-complete state

### 3. `KB-0012` — complete tool-driven grill-session flow

Owns the remaining happy-path v1 behavior on top of `KB-0010` and `KB-0011`:
- register and use `complete_grill_session`
- keep the visible marker phrase aligned with the tool-driven completion path
- verify multi-round questionnaire usage while grill mode is active
- verify grill-mode prompt injection stops after tool-driven completion

Sequencing note: `KB-0010` goes first to make the build/test seam trustworthy, `KB-0011` makes interruption state real, and `KB-0012` closes the happy path on top of that foundation.

## Acceptance Criteria

- [x] The active board contains an explicit v1 ticket for automatic questionnaire/completion orchestration (`KB-0012`).
- [x] The active board contains an explicit v1 ticket for pending-batch fallback/recovery (`KB-0011`).
- [x] The active board contains an explicit v1 ticket for reproducible build/typecheck/CI baseline (`KB-0010`).
- [x] `KB-0008` remains narrowed to true post-v1 release/versioning hardening.
- [x] The cleanup stream tickets explicitly require typecheck plus a minimal pi smoke path in addition to `npm test`.

## Verification

- `npm test`
- `npx tsc --noEmit`
- `npm ls --depth=0`
- inspect `.kanban/3-in_progress/KB-0010-reproducible-build-typecheck-and-ci-baseline.md`, `.kanban/2-planned/02-KB-0011-persist-pending-batches-and-add-recovery-command.md`, and `.kanban/2-planned/03-KB-0012-complete-tool-driven-grill-session-flow.md
- confirm each cleanup ticket links back to `KB-0009` and includes `npm test`, typecheck, and a minimal pi smoke path in its Verification section
- inspect `.kanban/0-open/KB-0008-post-v1-release-distribution-hardening.md` and confirm it remains post-v1-only with `priority: ignore`

## Notes

- This remains the single active reality-check findings ticket for the repo.
- It is the parent findings record for cleanup stream `KB-0010` / `KB-0011` / `KB-0012`; implementation should happen through those tickets, not by treating this findings document as an implementation ticket.
- `KB-0004` and `KB-0005` still look valid as completed slices; the problem is not that those slices were fake, but that the remaining v1 work was under-tracked and under-verified.
- Secondary drift remains in `README.md`: it still describes the repo as mostly an initial skeleton, which understates the implemented pieces while also avoiding the harder question of what is still not production-real.

## Change Log

- created from fresh repo audit
- refined into ordered cleanup stream `KB-0010` → `KB-0011` → `KB-0012`
- reconciled the findings ticket with current board state after re-running `npm test`, `npx tsc --noEmit`, and `npm ls --depth=0`
