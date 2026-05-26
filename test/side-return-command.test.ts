import { mkdtemp, readFile, rm } from "node:fs/promises";
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

describe("/grill-side-return command", () => {
	afterEach(() => {
		delete process.env.GRILL_SIDE_RETURN_PATH;
		delete process.env.GRILL_SIDE_SOURCE_QUESTION_ID;
	});

	it("registers the command", () => {
		const { pi, commands } = createPiDouble();

		registerGrillSideReturnCommand(pi as never);

		expect(commands.has(COMMAND_GRILL_SIDE_RETURN)).toBe(true);
	});

	it("rejects when sidecar env vars are absent", async () => {
		const { pi, commands } = createPiDouble();
		registerGrillSideReturnCommand(pi as never);

		await expect(commands.get(COMMAND_GRILL_SIDE_RETURN)!("{}", { ui: { notify: vi.fn() } })).rejects.toThrow(
			"GRILL_SIDE_RETURN_PATH",
		);
	});

	it("writes a valid option sidecar", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-command-"));
		process.env.GRILL_SIDE_RETURN_PATH = join(dir, "return.json");
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		const notify = vi.fn();
		const { pi, commands } = createPiDouble();
		registerGrillSideReturnCommand(pi as never);
		try {
			await commands.get(COMMAND_GRILL_SIDE_RETURN)!(
				JSON.stringify({
					summary: "Compared scope options.",
					answer: { mode: "option", selectedOptionId: "minimal", notes: "Small slice" },
				}),
				{ ui: { notify }, sessionManager: { getSessionFile: () => "/tmp/child.jsonl" } },
			);

			expect(JSON.parse(await readFile(process.env.GRILL_SIDE_RETURN_PATH, "utf8"))).toEqual({
				sourceQuestionId: "scope",
				summary: "Compared scope options.",
				childSessionRef: "/tmp/child.jsonl",
				answer: { mode: "option", questionId: "scope", selectedOptionId: "minimal", notes: "Small slice" },
			});
			expect(notify).toHaveBeenCalledWith(expect.stringContaining(process.env.GRILL_SIDE_RETURN_PATH), "info");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("writes a valid custom sidecar", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-command-"));
		process.env.GRILL_SIDE_RETURN_PATH = join(dir, "return.json");
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		const { pi, commands } = createPiDouble();
		registerGrillSideReturnCommand(pi as never);
		try {
			await commands.get(COMMAND_GRILL_SIDE_RETURN)!(
				JSON.stringify({ summary: "Drafted custom.", answer: { mode: "custom", customAnswer: "Something else" } }),
				{ ui: { notify: vi.fn() }, sessionManager: {} },
			);

			expect(JSON.parse(await readFile(process.env.GRILL_SIDE_RETURN_PATH, "utf8"))).toMatchObject({
				answer: { mode: "custom", questionId: "scope", customAnswer: "Something else" },
				childSessionRef: "child-pi-session",
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects malformed JSON args", async () => {
		process.env.GRILL_SIDE_RETURN_PATH = "/tmp/return.json";
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		const { pi, commands } = createPiDouble();
		registerGrillSideReturnCommand(pi as never);

		await expect(commands.get(COMMAND_GRILL_SIDE_RETURN)!("not json", { ui: { notify: vi.fn() } })).rejects.toThrow(
			"JSON",
		);
	});
});
