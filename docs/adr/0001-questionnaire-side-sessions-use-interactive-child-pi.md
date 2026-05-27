# Use interactive child pi sessions for questionnaire side sessions

Questionnaire Side Sessions run as temporary interactive child `pi` processes opened from a source question. The parent questionnaire TUI is suspended while the child runs, then resumed after the child exits so the user can manually return, import a suggestion, view the record, or discard it.

V1 uses a local blocking child-process launcher instead of a direct dependency on `pi-interactive-shell` or other side-conversation package internals. The prerequisite spike found useful implementation references, but no stable extension-to-extension launcher API compatible with this repo's current `@earendil-works/*` pi runtime.

Return suggestions are passed through a sidecar JSON file written by child-side return surfaces: `grill_side_return_option`, `grill_side_return_custom`, or `/grill-side-return`. The parent always asks before importing a suggestion, and importing only updates the source question draft; it never submits the parent questionnaire batch.

The launcher is isolated behind `src/side-session/launcher.ts` so it can be replaced later if pi exposes a stable interactive child-session or overlay API.
