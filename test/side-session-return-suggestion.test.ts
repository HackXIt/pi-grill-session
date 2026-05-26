import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeQuestionnaireBatch } from "../src/domain";
import { parseSideSessionReturnSidecar } from "../src/side-session/return-suggestion";

const batch = normalizeQuestionnaireBatch({
	questions: [
		{
			id: "scope",
			label: "Scope",
			prompt: "What should v1 include?",
			allowNotes: true,
			allowCustomAnswer: true,
			options: [
				{ id: "minimal", label: "Minimal slice" },
				{ id: "full", label: "Full feature" },
			],
		},
		{
			id: "notes-off",
			label: "Notes Off",
			prompt: "Pick one",
			allowNotes: false,
			allowCustomAnswer: false,
			options: [{ id: "a", label: "A" }],
		},
	],
});

async function withTempFile(content?: unknown) {
	const dir = await mkdtemp(join(tmpdir(), "grill-side-return-"));
	const path = join(dir, "return.json");
	if (content !== undefined) {
		await writeFile(path, JSON.stringify(content), "utf8");
	}
	return { dir, path };
}

describe("side-session return suggestion validation", () => {
	it("parses a valid option suggestion with trimmed notes into a side-session record", async () => {
		const { dir, path } = await withTempFile({
			sourceQuestionId: "scope",
			summary: " Helped compare scope options. ",
			childSessionRef: "child-session-1",
			answer: { mode: "option", questionId: "scope", selectedOptionId: "minimal", notes: " Keep it small. " },
		});
		try {
			await expect(parseSideSessionReturnSidecar({ path, batch, sourceQuestionId: "scope" })).resolves.toMatchObject({
				sourceQuestionId: "scope",
				summary: "Helped compare scope options.",
				childSessionRef: "child-session-1",
				suggestion: {
					mode: "option",
					questionId: "scope",
					selectedOptionId: "minimal",
					notes: "Keep it small.",
				},
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("parses a valid custom suggestion", async () => {
		const { dir, path } = await withTempFile({
			sourceQuestionId: "scope",
			summary: "Drafted a custom answer.",
			childSessionRef: "child-session-2",
			answer: { mode: "custom", questionId: "scope", customAnswer: " A narrower beta. " },
		});
		try {
			await expect(parseSideSessionReturnSidecar({ path, batch, sourceQuestionId: "scope" })).resolves.toMatchObject({
				suggestion: { mode: "custom", questionId: "scope", customAnswer: "A narrower beta." },
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects an unknown option id", async () => {
		const { dir, path } = await withTempFile({
			sourceQuestionId: "scope",
			summary: "Bad option.",
			childSessionRef: "child-session-3",
			answer: { mode: "option", questionId: "scope", selectedOptionId: "missing" },
		});
		try {
			await expect(parseSideSessionReturnSidecar({ path, batch, sourceQuestionId: "scope" })).rejects.toThrow(
				"Unknown option id",
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects notes when the source question does not allow notes", async () => {
		const { dir, path } = await withTempFile({
			sourceQuestionId: "notes-off",
			summary: "Notes are disallowed.",
			childSessionRef: "child-session-4",
			answer: { mode: "option", questionId: "notes-off", selectedOptionId: "a", notes: "Nope" },
		});
		try {
			await expect(parseSideSessionReturnSidecar({ path, batch, sourceQuestionId: "notes-off" })).rejects.toThrow(
				"does not allow notes",
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("rejects a custom answer when the source question does not allow custom answers", async () => {
		const { dir, path } = await withTempFile({
			sourceQuestionId: "notes-off",
			summary: "Custom is disallowed.",
			childSessionRef: "child-session-5",
			answer: { mode: "custom", questionId: "notes-off", customAnswer: "Something else" },
		});
		try {
			await expect(parseSideSessionReturnSidecar({ path, batch, sourceQuestionId: "notes-off" })).rejects.toThrow(
				"does not allow custom answers",
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("returns undefined when the sidecar file is missing", async () => {
		const { dir, path } = await withTempFile();
		try {
			await expect(parseSideSessionReturnSidecar({ path, batch, sourceQuestionId: "scope" })).resolves.toBeUndefined();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
