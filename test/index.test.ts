import { beforeEach, describe, expect, it, vi } from "vitest";
import extension, { COMMAND_GRILL, COMMAND_GRILL_END } from "../src/index";
import { GRILL_SESSION_COMPLETION_MARKER, GRILL_SESSION_STATE_ENTRY } from "../src/grill-state";

type CommandHandler = (args: string, ctx: any) => Promise<void>;
type EventHandler = (event: any, ctx: any) => Promise<any>;

function createPiDouble() {
	const commands = new Map<string, CommandHandler>();
	const events = new Map<string, EventHandler>();
	const appendEntry = vi.fn();
	const sendUserMessage = vi.fn();
	const sendMessage = vi.fn();

	const pi = {
		registerCommand(name: string, options: { handler: CommandHandler }) {
			commands.set(name, options.handler);
		},
		on(name: string, handler: EventHandler) {
			events.set(name, handler);
		},
		appendEntry,
		sendUserMessage,
		sendMessage,
	};

	extension(pi as never);

	return { commands, events, appendEntry, sendUserMessage, sendMessage };
}

function createCommandContext(overrides: Record<string, unknown> = {}) {
	return {
		isIdle: () => true,
		ui: {
			notify: vi.fn(),
			confirm: vi.fn(),
		},
		...overrides,
	};
}

function createSessionContext(
	branch: any[] = [],
	overrides: Record<string, unknown> = {},
	sessionFile = "/tmp/session.jsonl",
) {
	return {
		ui: {
			notify: vi.fn(),
			confirm: vi.fn(),
		},
		sessionManager: {
			getBranch: () => branch,
			getSessionFile: () => sessionFile,
		},
		...overrides,
	};
}

describe("grill-session extension", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("registers grill commands and lifecycle handlers", () => {
		const { commands, events } = createPiDouble();

		expect(Array.from(commands.keys())).toEqual([COMMAND_GRILL, COMMAND_GRILL_END]);
		expect(Array.from(events.keys())).toEqual([
			"input",
			"session_start",
			"session_tree",
			"before_agent_start",
		]);
	});

	it("starts grill mode idempotently and routes through the canonical skill message", async () => {
		const { commands, appendEntry, sendUserMessage } = createPiDouble();
		const command = commands.get(COMMAND_GRILL);

		expect(command).toBeTypeOf("function");

		await command!("", createCommandContext());
		await command!("", createCommandContext());

		expect(appendEntry).toHaveBeenCalledTimes(1);
		expect(appendEntry).toHaveBeenCalledWith(GRILL_SESSION_STATE_ENTRY, {
			active: true,
			activationSource: "command",
			completed: false,
		});
		expect(sendUserMessage).toHaveBeenCalledTimes(2);
		expect(sendUserMessage).toHaveBeenNthCalledWith(1, "/skill:grill-session");
		expect(sendUserMessage).toHaveBeenNthCalledWith(2, "/skill:grill-session");
	});

	it("marks the session completed and emits the visible completion marker", async () => {
		const { commands, appendEntry, sendMessage } = createPiDouble();
		const start = commands.get(COMMAND_GRILL)!;
		const end = commands.get(COMMAND_GRILL_END)!;

		await start("", createCommandContext());
		await end("", createCommandContext());

		expect(appendEntry).toHaveBeenLastCalledWith(GRILL_SESSION_STATE_ENTRY, {
			active: false,
			activationSource: "command",
			completed: true,
		});
		expect(sendMessage).toHaveBeenCalledWith({
			customType: "grill-session",
			content: GRILL_SESSION_COMPLETION_MARKER,
			display: true,
			details: { kind: "completion-marker" },
		});
	});

	it("intercepts explicit and plain-text activation inputs conservatively", async () => {
		const explicit = createPiDouble();
		await expect(
			explicit.events.get("input")!({ text: "/skill:grill-session", source: "interactive" }, createSessionContext()),
		).resolves.toEqual({
			action: "continue",
		});
		expect(explicit.appendEntry).toHaveBeenCalledWith(GRILL_SESSION_STATE_ENTRY, {
			active: true,
			activationSource: "companion-skill",
			completed: false,
		});

		const legacy = createPiDouble();
		await expect(
			legacy.events.get("input")!({ text: "/skill:grill-me compare these options", source: "interactive" }, createSessionContext()),
		).resolves.toEqual({
			action: "transform",
			text: "/skill:grill-session compare these options",
		});
		expect(legacy.appendEntry).toHaveBeenCalledWith(GRILL_SESSION_STATE_ENTRY, {
			active: true,
			activationSource: "legacy-skill",
			completed: false,
		});

		const strong = createPiDouble();
		await expect(
			strong.events.get("input")!({ text: "grill me on this design", source: "interactive" }, createSessionContext()),
		).resolves.toEqual({
			action: "transform",
			text: "/skill:grill-session grill me on this design",
		});
		expect(strong.appendEntry).toHaveBeenCalledWith(GRILL_SESSION_STATE_ENTRY, {
			active: true,
			activationSource: "plain-text",
			completed: false,
		});

		const unrelated = createPiDouble();
		await expect(
			unrelated.events.get("input")!({ text: "tell me how the broiler works", source: "interactive" }, createSessionContext()),
		).resolves.toEqual({
			action: "continue",
		});
		await expect(
			unrelated.events.get("input")!({ text: "hello there", source: "interactive" }, createSessionContext()),
		).resolves.toEqual({
			action: "continue",
		});
		expect(unrelated.appendEntry).not.toHaveBeenCalled();
	});

	it("asks for confirmation before activating on ambiguous grill mentions", async () => {
		const { events, appendEntry } = createPiDouble();
		const input = events.get("input")!;
		const confirm = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		const ctx = createSessionContext([], { ui: { notify: vi.fn(), confirm } });

		await expect(input({ text: "should we grill this further?", source: "interactive" }, ctx)).resolves.toEqual({
			action: "transform",
			text: "/skill:grill-session should we grill this further?",
		});
		await expect(input({ text: "grill", source: "interactive" }, ctx)).resolves.toEqual({
			action: "continue",
		});

		expect(confirm).toHaveBeenCalledTimes(2);
		expect(appendEntry).toHaveBeenCalledTimes(1);
	});

	it("restores branch-local state on session events and injects per-turn instructions only while active", async () => {
		const { events } = createPiDouble();
		const sessionStart = events.get("session_start")!;
		const sessionTree = events.get("session_tree")!;
		const beforeAgentStart = events.get("before_agent_start")!;

		await sessionStart(
			{},
			createSessionContext([
				{ type: "custom", customType: GRILL_SESSION_STATE_ENTRY, data: { active: true, activationSource: "plain-text", completed: false } },
			]),
		);
		await expect(beforeAgentStart({ systemPrompt: "base prompt" }, createSessionContext())).resolves.toEqual({
			systemPrompt: expect.stringContaining("The grill session is active."),
		});

		await sessionTree(
			{},
			createSessionContext([
				{ type: "custom", customType: GRILL_SESSION_STATE_ENTRY, data: { active: false, activationSource: "plain-text", completed: true } },
			]),
		);
		await expect(beforeAgentStart({ systemPrompt: "base prompt" }, createSessionContext())).resolves.toBeUndefined();
	});

	it("stays fully inert in autonomous kanban role sessions", async () => {
		const { events, appendEntry } = createPiDouble();
		const sessionStart = events.get("session_start")!;
		const input = events.get("input")!;
		const beforeAgentStart = events.get("before_agent_start")!;
		const confirm = vi.fn();
		const sessionFile = "/repo/.kanban/runtime/sessions/manager.jsonl";
		const activeBranch = [
			{ type: "custom", customType: GRILL_SESSION_STATE_ENTRY, data: { active: true, activationSource: "plain-text", completed: false } },
		];

		await sessionStart({}, createSessionContext(activeBranch, { ui: { notify: vi.fn(), confirm } }, sessionFile));

		await expect(
			input(
				{ text: "should we grill this further?", source: "interactive" },
				createSessionContext(activeBranch, { ui: { notify: vi.fn(), confirm } }, sessionFile),
			),
		).resolves.toEqual({ action: "continue" });
		await expect(
			input(
				{ text: "/skill:grill-session", source: "interactive" },
				createSessionContext(activeBranch, { ui: { notify: vi.fn(), confirm } }, sessionFile),
			),
		).resolves.toEqual({ action: "continue" });
		await expect(
			beforeAgentStart(
				{ systemPrompt: "base prompt" },
				createSessionContext(activeBranch, { ui: { notify: vi.fn(), confirm } }, sessionFile),
			),
		).resolves.toBeUndefined();

		expect(confirm).not.toHaveBeenCalled();
		expect(appendEntry).not.toHaveBeenCalled();
	});
});
