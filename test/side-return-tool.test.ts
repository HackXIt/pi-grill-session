import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerGrillSideReturnTool, TOOL_GRILL_SIDE_RETURN } from "../src/side-session/side-return-tool";

type ToolExecute = (toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) => Promise<any>;

function createPiDouble() {
	const tools = new Map<string, { execute: ToolExecute; [key: string]: unknown }>();
	return {
		pi: {
			registerTool(tool: { name: string; execute: ToolExecute; [key: string]: unknown }) {
				tools.set(tool.name, tool);
			},
		},
		tools,
	};
}

describe("grill_side_return tool", () => {
	afterEach(() => {
		delete process.env.GRILL_SIDE_RETURN_PATH;
		delete process.env.GRILL_SIDE_SOURCE_QUESTION_ID;
	});

	it("registers the side-return tool", () => {
		const { pi, tools } = createPiDouble();

		registerGrillSideReturnTool(pi as never);

		expect(tools.has(TOOL_GRILL_SIDE_RETURN)).toBe(true);
	});

	it("writes a valid sidecar, derives session fields, and shuts down", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-tool-"));
		process.env.GRILL_SIDE_RETURN_PATH = join(dir, "return.json");
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		const notify = vi.fn();
		const shutdown = vi.fn();
		const { pi, tools } = createPiDouble();
		registerGrillSideReturnTool(pi as never);
		try {
			const result = await tools.get(TOOL_GRILL_SIDE_RETURN)!.execute(
				"tool-1",
				{
					summary: "Picked minimal.",
					answer: { mode: "option", questionId: "scope", selectedOptionId: "minimal", notes: "Small slice" },
				},
				undefined,
				undefined,
				{ ui: { notify }, sessionManager: { getSessionFile: () => "/tmp/child.jsonl" }, shutdown },
			);

			expect(JSON.parse(await readFile(process.env.GRILL_SIDE_RETURN_PATH, "utf8"))).toEqual({
				sourceQuestionId: "scope",
				summary: "Picked minimal.",
				childSessionRef: "/tmp/child.jsonl",
				answer: { mode: "option", questionId: "scope", selectedOptionId: "minimal", notes: "Small slice" },
			});
			expect(result.content[0].text).toContain(process.env.GRILL_SIDE_RETURN_PATH);
			expect(notify).toHaveBeenCalledWith(expect.stringContaining(process.env.GRILL_SIDE_RETURN_PATH), "info");
			expect(shutdown).toHaveBeenCalledTimes(1);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects a mismatched answer question id", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-tool-"));
		process.env.GRILL_SIDE_RETURN_PATH = join(dir, "return.json");
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		const { pi, tools } = createPiDouble();
		registerGrillSideReturnTool(pi as never);
		try {
			await expect(
				tools.get(TOOL_GRILL_SIDE_RETURN)!.execute(
					"tool-1",
					{ summary: "Wrong question.", answer: { mode: "custom", questionId: "other", customAnswer: "Nope" } },
					undefined,
					undefined,
					{ ui: { notify: vi.fn() }, shutdown: vi.fn() },
				),
			).rejects.toThrow("another question");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
