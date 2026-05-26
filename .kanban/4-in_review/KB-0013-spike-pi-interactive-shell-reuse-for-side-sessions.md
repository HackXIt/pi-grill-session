---
id: KB-0013
type: spike
depends_on: []
minimum_thinking: high
---

# Spike pi-interactive-shell reuse for questionnaire side sessions

## Summary

Research whether `pi-interactive-shell` can be reused cleanly to launch an interactive child pi session from inside the questionnaire runtime.

## Lane Notes

- Current lane: 4-in_review
- Order: n/a
- Owner: pi

## References

- `docs/PRD-questionnaire-side-sessions.md`
- `docs/adr/0001-questionnaire-side-sessions-use-interactive-child-pi.md`
- `CONTEXT.md`
- maintainer source: `https://github.com/nicobailon/pi-interactive-shell`

## Acceptance Criteria

- [x] Inspect the maintainer source and package exports for a stable API usable by another pi extension.
- [x] Verify compatibility with this repo's pi package imports/runtime.
- [x] Decide whether to reuse pi-interactive-shell internals/API or implement a minimal local launcher.
- [x] Document the decision and the exact integration path or fallback in the feature ticket.

## Verification

- Inspected `pi-interactive-shell` maintainer source at `df4771e9105d29bde9b8f32858df6139c1c90605`.
- Expanded survey to newer side-conversation packages: `pi-btw@0.4.0`, `@pi-unipi/btw@2.0.8`, `@juicesharp/rpiv-btw@1.13.0`, `pi-qq@0.1.16`, and `pi-mono-btw@1.7.4`.
- Documented spike outcome in `docs/spike-questionnaire-side-sessions-interactive-shell-reuse.md`.
- Updated `KB-0014` with the fallback integration path and side-conversation references.
- Smoke commands:
  - `npm pack pi-interactive-shell@0.13.0 --json` confirmed tarball surface has no `exports`/`main`.
  - `node --input-type=module -e "import('/tmp/pi-github-repos/nicobailon/pi-interactive-shell/spawn.ts').then(m=>console.log(Object.keys(m)))"` proved only pure helper internals can be imported from source.
  - `node --input-type=module -e "import('/tmp/pi-github-repos/nicobailon/pi-interactive-shell/index.ts')"` failed with missing `@mariozechner/pi-tui`, confirming current runtime namespace incompatibility.
  - `npm search 'pi side question extension' --json` identified the newer `/btw` and `/qq` packages.
  - `npm pack` / source inspection confirmed `pi-btw` and `@pi-unipi/btw` use current pi runtime primitives but expose command-oriented package surfaces, not a callable launcher API.

## Notes

Do not assume the locally installed package namespace reflects the desired upstream state. Prefer reuse because terminal overlays and PTY handling are complex, but do not take a hard dependency on unstable internals without evidence.

## Change Log

- created from grill-session design
- completed initial spike; direct pi-interactive-shell reuse rejected for v1 due unstable API and runtime namespace mismatch
- expanded spike with newer side-conversation extension survey; `pi-btw` / `@pi-unipi/btw` are strong implementation references but still not direct dependencies
- recorded final direction: v1 uses a normal blocking child-`pi` process, not an in-memory `AgentSession` overlay
