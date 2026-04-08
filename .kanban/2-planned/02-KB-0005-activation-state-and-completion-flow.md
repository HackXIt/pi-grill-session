---
id: KB-0005
type: feature
depends_on:
  - KB-0003
minimum_thinking: high
---

# Activation, state, and completion flow

## Summary

Implement the grill-session activation layer and persisted state lifecycle around the questionnaire flow: start/stop commands, skill-trigger activation, conservative plain-text matching, branch-aware state reconstruction, and the shared completion contract. This slice owns when grill mode is on or off. It does not own the questionnaire UI itself or the later automatic questionnaire/completion tool orchestration.

## Lane Notes

- Current lane: 2-planned
- Order: 02
- Owner: unassigned

## References

- `.plans/ARCHITECTURE.md`
- `.plans/IMPLEMENTATION_PLAN.md`
- `docs/CONTEXT_CHECKPOINT.md`
- `src/index.ts`
- `package.json`
- `/home/hackxit/.pi/agent/skills/grill-me/SKILL.md`
- `/home/hackxit/.local/share/mise/installs/node/25.2.1/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- `/home/hackxit/.local/share/mise/installs/node/25.2.1/lib/node_modules/@mariozechner/pi-coding-agent/docs/session.md`
- `/home/hackxit/.local/share/mise/installs/node/25.2.1/lib/node_modules/@mariozechner/pi-coding-agent/docs/skills.md`
- `/home/hackxit/.local/share/mise/installs/node/25.2.1/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/input-transform.ts`
- `/home/hackxit/.local/share/mise/installs/node/25.2.1/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/send-user-message.ts`
- `/home/hackxit/.local/share/mise/installs/node/25.2.1/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/tools.ts`
- `/home/hackxit/.local/share/mise/installs/node/25.2.1/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/pirate.ts`

## Acceptance Criteria

- [ ] A repo-local companion skill exists at `skills/grill-session/SKILL.md`, and `package.json` is updated so pi loads that skill from this package even though the repo already uses an explicit `pi` manifest.
- [ ] `/grill` activates grill mode idempotently, records activation state, and routes into the same companion-skill startup path used by other activation sources rather than inventing a second prompt contract.
- [ ] `/grill-end` marks the session completed/inactive and emits the exact visible completion marker phrase `[GRILL SESSION COMPLETE]`.
- [ ] Raw input handling distinguishes:
  - explicit `/skill:grill-session`
  - legacy `/skill:grill-me` compatibility activation
  - strong plain-text matches that auto-activate
  - ambiguous `grill` mentions that ask for confirmation before activating
  - unrelated text that does nothing
- [ ] Activation/state logic is extracted into testable pure helpers/modules, including a branch-aware reconstruction path from persisted session entries.
- [ ] Grill-session state is persisted with extension entries and reconstructed from `ctx.sessionManager.getBranch()` on `session_start` and `session_tree`, so reloads and branch navigation restore the correct active/completed state for the current branch.
- [ ] While grill mode is active and not completed, the extension adds a concise per-turn system-prompt instruction in `before_agent_start` so later turns reliably remain in grill-session mode without relying on the model to remember prior activation.
- [ ] A shared completion contract is defined in code for later slice-5 orchestration, including the future completion tool name `complete_grill_session` and the single exported marker phrase `[GRILL SESSION COMPLETE]`, even if the automatic tool invocation itself is implemented later.
- [ ] Automated tests cover input classification, state transitions, reconstruction from persisted entries, idempotent start/end behavior, and the exported completion contract constants.

## Verification

- `npm test`
- Load the extension in pi and validate:
  - `/grill` starts grill mode and continues through the companion-skill path
  - `/skill:grill-session` activates grill mode
  - `/skill:grill-me` also activates grill mode as a compatibility path
  - a strong plain-text request such as `grill me on this design` auto-activates
  - an ambiguous plain-text `grill` mention asks for confirmation instead of silently activating
  - `/grill-end` emits `[GRILL SESSION COMPLETE]`
  - after `/reload` or `/tree` navigation, the restored branch state is correct
  - after completion, later normal prompts no longer receive grill-mode system-prompt injection

## Notes

- Assumption: the canonical new skill is `grill-session`, but user muscle memory for `/skill:grill-me` should still activate grill mode. Treat `/skill:grill-me` as a compatibility trigger only; do not modify the global `~/.pi/agent/skills/grill-me/SKILL.md` file in this ticket.
- Because `package.json` already contains a `pi` manifest, adding a `skills/` directory is not enough by itself. This ticket must update the manifest to include the repo-local skill path explicitly.
- Use the `input` event for plain-text detection because it runs before skill expansion. Strong or confirmed matches should be transformed into the canonical `/skill:grill-session ...` path so activation behavior funnels through one startup contract.
- Recommended detection rule for a conservative v1 implementation:
  - strong: literal `grill me` or `grill session` request
  - ambiguous: contains `grill` but not a clear start request
  - none: everything else
- Persist state with custom extension entries (`pi.appendEntry(...)`) rather than questionnaire tool results. This state is command/input driven, not derived from a questionnaire tool result. Reconstruct from `getBranch()` so `/tree` remains correct.
- Expected state shape is minimal:
  - `active: boolean`
  - `activationSource: "command" | "companion-skill" | "legacy-skill" | "plain-text"`
  - `completed: boolean`
  - optional placeholder for future pending-batch metadata
- Keep the per-turn active-session reminder in `before_agent_start` as a temporary system-prompt suffix instead of persistent custom messages, to avoid polluting the session history every turn.
- Out of scope here:
  - questionnaire TUI behavior (`KB-0004`)
  - automatic questionnaire opening and tool-driven batch orchestration
  - the future completion tool’s full execution path beyond defining its shared contract constants
  - pending-batch reopen/recovery commands until questionnaire flow exists
- Soft sequencing note: this slice can be implemented independently of `KB-0004`, but exploratory validation is easier once the questionnaire UI entrypoint exists.
- Compatibility note: sessions without any grill-session custom entries should restore to the default inactive state.

## Change Log

- created
- refined after repo, plan, SDK doc, skill, and example review
- moved to 2-planned with explicit activation contract, branch-aware persistence, and completion marker/tool boundaries
