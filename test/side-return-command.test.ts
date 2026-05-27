import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMAND_GRILL_SIDE_RETURN, registerGrillSideReturnCommand } from "../src/side-session/side-return-command";

type CommandHandler = (args: string, ctx: any) => Promise<void>;

function createPiDouble() {
	const commands = new Map<string, CommandHandler>();
	return {
		pi: {
			registerCommand(name: string, options: { handler: CommandHandler }) {
				commands.set(name, options.handler);
			},
		},
		commands,
	};
}

function customResult(draft: unknown) {
	return vi.fn().mockResolvedValue({ cancelled: false, draft });
}

describe("/grill-side-return command", () => {
	afterEach(() => {
		delete process.env.GRILL_SIDE_RETURN_PATH;
		delete process.env.GRILL_SIDE_SOURCE_QUESTION_ID;
		delete process.env.GRILL_SIDE_CONTEXT_PATH;
	});

	it("registers the command", () => {
		const { pi, commands } = createPiDouble();

		registerGrillSideReturnCommand(pi as never);

		expect(commands.has(COMMAND_GRILL_SIDE_RETURN)).toBe(true);
	});

	it("rejects non-interactive args", async () => {
		const { pi, commands } = createPiDouble();
		registerGrillSideReturnCommand(pi as never);

		await expect(commands.get(COMMAND_GRILL_SIDE_RETURN)!("{}", { ui: { notify: vi.fn() } })).rejects.toThrow(
			"interactive",
		);
	});

	it("writes a valid option sidecar from the interactive form and shuts down the child session", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-command-"));
		process.env.GRILL_SIDE_RETURN_PATH = join(dir, "return.json");
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		process.env.GRILL_SIDE_CONTEXT_PATH = join(dir, "context.json");
		await writeFile(
			process.env.GRILL_SIDE_CONTEXT_PATH,
			JSON.stringify({ sourceQuestion: { options: [{ id: "minimal", label: "Minimal" }] } }),
			"utf8",
		);
		const notify = vi.fn();
		const shutdown = vi.fn();
		const { pi, commands } = createPiDouble();
		registerGrillSideReturnCommand(pi as never);
		try {
			await commands.get(COMMAND_GRILL_SIDE_RETURN)!("", {
				hasUI: true,
				ui: {
					notify,
					custom: customResult({
						mode: "option",
						summary: "Compared scope options.",
						selectedOptionId: "minimal",
						customAnswer: "",
						notes: "Small slice",
					}),
				},
				sessionManager: { getSessionFile: () => "/tmp/child.jsonl" },
				shutdown,
			});

			expect(JSON.parse(await readFile(process.env.GRILL_SIDE_RETURN_PATH, "utf8"))).toEqual({
				sourceQuestionId: "scope",
				summary: "Compared scope options.",
				childSessionRef: "/tmp/child.jsonl",
				answer: { mode: "option", questionId: "scope", selectedOptionId: "minimal", notes: "Small slice" },
			});
			expect(notify).toHaveBeenCalledWith(expect.stringContaining(process.env.GRILL_SIDE_RETURN_PATH), "info");
			expect(shutdown).toHaveBeenCalledTimes(1);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("writes a valid custom sidecar from the interactive form", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-command-"));
		process.env.GRILL_SIDE_RETURN_PATH = join(dir, "return.json");
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		const { pi, commands } = createPiDouble();
		registerGrillSideReturnCommand(pi as never);
		try {
			await commands.get(COMMAND_GRILL_SIDE_RETURN)!("", {
				hasUI: true,
				ui: {
					notify: vi.fn(),
					custom: customResult({
						mode: "custom",
						summary: "Drafted custom.",
						selectedOptionId: "",
						customAnswer: "Something else",
						notes: "",
					}),
				},
				sessionManager: {},
				shutdown: vi.fn(),
			});

			expect(JSON.parse(await readFile(process.env.GRILL_SIDE_RETURN_PATH, "utf8"))).toMatchObject({
				answer: { mode: "custom", questionId: "scope", customAnswer: "Something else" },
				childSessionRef: "child-pi-session",
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("does not write or shut down when the interactive form is cancelled", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-command-"));
		process.env.GRILL_SIDE_RETURN_PATH = join(dir, "return.json");
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		const notify = vi.fn();
		const shutdown = vi.fn();
		const { pi, commands } = createPiDouble();
		registerGrillSideReturnCommand(pi as never);
		try {
			await commands.get(COMMAND_GRILL_SIDE_RETURN)!("", {
				hasUI: true,
				ui: { notify, custom: vi.fn().mockResolvedValue({ cancelled: true, draft: {} }) },
				shutdown,
			});

			await expect(readFile(process.env.GRILL_SIDE_RETURN_PATH, "utf8")).rejects.toThrow("ENOENT");
			expect(notify).toHaveBeenCalledWith("Side-session return cancelled", "info");
			expect(shutdown).not.toHaveBeenCalled();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
