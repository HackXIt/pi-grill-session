# Spike: side-session extension reuse for questionnaire side sessions

## Decision

Do **not** take a direct dependency on `pi-interactive-shell` internals for v1 questionnaire side sessions.

Do inspect/reuse design patterns from newer side-conversation extensions, especially `pi-btw` and `@pi-unipi/btw`, because they are closer to the desired UX than `pi-interactive-shell`. They still do not expose a stable extension-to-extension launcher API, so the v1 implementation should keep a local side-session boundary.

Implement a minimal local blocking child-`pi` process launcher for this feature, and keep the launcher boundary narrow enough to switch to an upstream API later if one is added.

## Evidence inspected

Maintainer source inspected from `https://github.com/nicobailon/pi-interactive-shell` at commit `df4771e9105d29bde9b8f32858df6139c1c90605`.

Relevant source paths:

- `package.json`
- `index.ts`
- `overlay-component.ts`
- `pty-session.ts`
- `session-manager.ts`
- `spawn.ts`
- `tool-schema.ts`
- npm tarball `pi-interactive-shell@0.13.0`

## Findings

### Package surface

The npm package publishes TypeScript source files but has no `exports` or `main` field. The intended integration surface is the pi package entrypoint declared in `package.json`:

```json
"pi": {
  "extensions": ["./index.ts"],
  "skills": ["./skills"]
}
```

There is no stable exported helper such as `launchInteractiveShell(ctx, options)` that another extension can call.

Several internals are exported from their individual files, including `InteractiveShellOverlay`, `PtyTerminalSession`, `parseSpawnArgs`, and `resolveSpawn`, but these are file-level implementation exports rather than a documented extension-to-extension API.

### Runtime compatibility

This repo uses:

- `@earendil-works/pi-coding-agent@0.75.5`
- `@earendil-works/pi-tui@0.75.5`

The maintainer source and npm package import:

- `@mariozechner/pi-coding-agent`
- `@mariozechner/pi-tui`

A local smoke import of the cloned `index.ts` from this repo failed because those runtime packages are not installed here:

```text
ERR_MODULE_NOT_FOUND Cannot find package '@mariozechner/pi-tui' imported from .../pi-interactive-shell/index.ts
```

Installing those packages would introduce a second pi/TUI runtime namespace rather than reusing this repo's current peer dependencies.

### Programmatic reuse

The extension registers the `interactive_shell` tool and `/spawn`, `/attach`, `/dismiss` commands from inside `index.ts`. The launch flow we need is implemented as a private `startNewSession` closure, not exported.

The current `ExtensionAPI` supports registering tools/commands/shortcuts and calling `ctx.ui.custom(...)`, but it does not expose a supported way for one extension to invoke another registered tool directly from questionnaire UI code.

Therefore, the clean reuse options are currently blocked:

1. Calling `interactive_shell` as a tool from questionnaire code: no supported extension API found.
2. Importing the overlay/session internals directly: possible only through unstable file paths and currently incompatible package imports.
3. Depending on the pi package as-is: only registers agent-facing tools/commands, not a child-session launcher API.

## Smoke commands run

```bash
cd /tmp/pi-github-repos/nicobailon/pi-interactive-shell
npm pack pi-interactive-shell@0.13.0 --json
```

Confirmed the npm tarball includes TS source files and no `exports`/`main` field.

```bash
cd main
node --input-type=module -e "import('/tmp/pi-github-repos/nicobailon/pi-interactive-shell/spawn.ts').then(m=>console.log(Object.keys(m)))"
```

Result:

```text
[ 'parseSpawnArgs', 'resolveSpawn' ]
```

This proves some pure helper internals can be imported from the maintainer source checkout.

```bash
cd main
node --input-type=module -e "import('/tmp/pi-github-repos/nicobailon/pi-interactive-shell/index.ts')"
```

Result:

```text
ERR_MODULE_NOT_FOUND Cannot find package '@mariozechner/pi-tui' imported from /tmp/pi-github-repos/nicobailon/pi-interactive-shell/index.ts
```

This proves the full extension entrypoint is not compatible with this repo's current dependency namespace without additional package changes.

## Other extension candidates checked

The initial spike focused on `pi-interactive-shell`, but there are more relevant side-question packages on npm.

### `pi-btw@0.4.0`

- Published 2026-05-07.
- Uses current `@earendil-works/*` peer dependencies (`^0.74.0`).
- Implements a persistent side conversation overlay with commands such as `/btw`, `/btw:tangent`, `/btw:new`, `/btw:inject`, `/btw:summarize`, `/btw:model`, and `/btw:thinking`.
- Internally uses `createAgentSession`, `SessionManager.inMemory()`, a custom `ResourceLoader`, `ctx.ui.custom(...)`, and `pi.sendUserMessage(...)` for injection.
- More reusable conceptually than `pi-interactive-shell` because it is already a side conversation inside pi rather than a PTY wrapper around a shell command.
- Still exposes only a pi package/command surface; the useful functions are not a documented library API for another extension.

### `@pi-unipi/btw@2.0.8`

- Published 2026-05-25.
- Uses current `@earendil-works/*` peer dependencies (`^0.75.5`), matching this repo's pi runtime generation.
- Adapted from `pi-btw`, namespaced as `/unipi:btw` and backed by `@pi-unipi/core`.
- Also uses `createAgentSession`, an in-memory session, custom resource loading, and a TUI overlay.
- Best evidence that the side-conversation pattern works on the current pi runtime.
- Still not a clean dependency for this feature because it is suite-specific, command-oriented, and does not export a stable launcher API.

### `@juicesharp/rpiv-btw@1.13.0`

- Published 2026-05-25.
- Uses current `@earendil-works/*` peer dependencies.
- Implements a one-off `/btw` side question via `completeSimple(...)` plus a bottom overlay.
- Good source for lightweight prompt/context handling, but not enough for questionnaire side sessions because it is one-shot Q&A, not an interactive child session/thread with return suggestions.

### `pi-qq@0.1.16`

- Published 2026-05-18.
- Uses current `@earendil-works/*` peer dependencies.
- Similar to `rpiv-btw`: quick one-off `/qq` answers, ephemeral overlay, optional recent/full context.
- Useful reference for context slicing, but too small for the resolved feature shape.

### `pi-mono-btw@1.7.4`

- Published 2026-05-08.
- Uses current `@earendil-works/*` peer dependencies.
- Side-question panel while the main agent continues.
- Useful reference, but it is still a side-question implementation rather than a documented callable launcher API.

## Updated v1 integration path

For `KB-0014`, implement a local launcher behind a small module boundary, for example:

- `src/side-session/launcher.ts`
- `src/side-session/context-package.ts`
- `src/side-session/return-suggestion.ts`

The questionnaire runtime should call only one narrow function, conceptually:

```ts
launchQuestionnaireSideSession(ctx, request): Promise<SideSessionRecord>
```

The local launcher should be blocking and UI-only:

1. Build a Side Session Context Package for the current question.
2. Create a temporary sidecar path for `/grill-side-return` output.
3. Launch `pi` as a child process in an overlay with the context prompt.
4. Leave the parent questionnaire `ctx.ui.custom(...)` blocked until the child exits.
5. Parse the sidecar JSON if present.
6. Return a Side Session Record to the questionnaire import dialog.

An in-memory `AgentSession` overlay was considered after surveying `pi-btw` / `@pi-unipi/btw`, but rejected for this feature shape because the user explicitly wants a normal child `pi` process and the return flow benefits from normal child-session persistence/reference semantics.

Keep v1 intentionally smaller than general side-conversation packages:

- interactive blocking side session only
- no global `/btw` commands, tangent mode, injection command, model override, thinking override, dispatch, monitor, attach, background sessions, worktrees, or agent selection
- no automatic import or questionnaire submission
- instruction-only Project Read-Only Mode in v1

## Future upstream reuse path

If `pi-interactive-shell` later exposes a stable API on the current `@earendil-works/*` pi runtime, this feature should replace the local launcher internals without changing questionnaire state/import code.

The desired upstream shape would be a documented export similar to:

```ts
launchInteractiveShell(ctx, {
  command,
  cwd,
  reason,
  mode: "interactive",
  blocking: true,
}): Promise<InteractiveShellResult>
```

Until then, direct reuse is too brittle for this feature.
