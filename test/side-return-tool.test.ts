import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	registerGrillSideReturnTools,
	TOOL_GRILL_SIDE_RETURN_CUSTOM,
	TOOL_GRILL_SIDE_RETURN_OPTION,
} from "../src/side-session/side-return-tool";

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

describe("side-return tools", () => {
	afterEach(() => {
		delete process.env.GRILL_SIDE_RETURN_PATH;
		delete process.env.GRILL_SIDE_SOURCE_QUESTION_ID;
	});

	it("registers split side-return tools without the ambiguous legacy tool", () => {
		const { pi, tools } = createPiDouble();

		registerGrillSideReturnTools(pi as never);

		expect(Array.from(tools.keys())).toEqual([TOOL_GRILL_SIDE_RETURN_OPTION, TOOL_GRILL_SIDE_RETURN_CUSTOM]);
		expect(tools.has("grill_side_return")).toBe(false);
	});

	it("writes an option sidecar, derives session fields, and shuts down", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-tool-"));
		process.env.GRILL_SIDE_RETURN_PATH = join(dir, "return.json");
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		const notify = vi.fn();
		const shutdown = vi.fn();
		const { pi, tools } = createPiDouble();
		registerGrillSideReturnTools(pi as never);
		try {
			const result = await tools.get(TOOL_GRILL_SIDE_RETURN_OPTION)!.execute(
				"tool-1",
				{ summary: "Picked minimal.", questionId: "scope", selectedOptionId: "minimal", notes: "Small slice" },
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

	it("writes a custom sidecar", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-tool-"));
		process.env.GRILL_SIDE_RETURN_PATH = join(dir, "return.json");
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		const { pi, tools } = createPiDouble();
		registerGrillSideReturnTools(pi as never);
		try {
			await tools.get(TOOL_GRILL_SIDE_RETURN_CUSTOM)!.execute(
				"tool-1",
				{ summary: "Custom.", customAnswer: "Something else" },
				undefined,
				undefined,
				{ ui: { notify: vi.fn() }, shutdown: vi.fn() },
			);

			expect(JSON.parse(await readFile(process.env.GRILL_SIDE_RETURN_PATH, "utf8"))).toMatchObject({
				summary: "Custom.",
				answer: { mode: "custom", questionId: "scope", customAnswer: "Something else" },
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects a mismatched answer question id", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-tool-"));
		process.env.GRILL_SIDE_RETURN_PATH = join(dir, "return.json");
		process.env.GRILL_SIDE_SOURCE_QUESTION_ID = "scope";
		const { pi, tools } = createPiDouble();
		registerGrillSideReturnTools(pi as never);
		try {
			await expect(
				tools.get(TOOL_GRILL_SIDE_RETURN_CUSTOM)!.execute(
					"tool-1",
					{ summary: "Wrong question.", questionId: "other", customAnswer: "Nope" },
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
