import { describe, expect, it } from "vitest";
import { normalizeQuestionnaireBatch } from "../src/domain";
import { buildSideSessionContextPackage, buildSideSessionPrompt } from "../src/side-session/context-package";

const batch = normalizeQuestionnaireBatch({
	title: "Architecture choice",
	intro: "Pick the v1 shape.",
	questions: [
		{
			id: "launcher",
			label: "Launcher",
			prompt: "How should the helper session run?",
			allowNotes: true,
			options: [
				{ id: "child-pi", label: "Child pi", recommended: true, description: "Normal blocking process" },
				{ id: "agent-session", label: "In-memory agent session" },
			],
		},
		{
			id: "return",
			label: "Return",
			prompt: "How should answers come back?",
			options: [{ id: "sidecar", label: "Sidecar JSON" }],
		},
	],
});

describe("side-session context package", () => {
	it("builds a prompt with the source question and all options", () => {
		const contextPackage = buildSideSessionContextPackage({
			batch,
			sourceQuestionId: "launcher",
			sidecarReturnPath: "/tmp/return.json",
		});

		const prompt = buildSideSessionPrompt(contextPackage);

		expect(prompt).toContain("How should the helper session run?");
		expect(prompt).toContain("child-pi — Child pi [recommended]");
		expect(prompt).toContain("agent-session — In-memory agent session");
		expect(prompt).toContain("Return: How should answers come back?");
	});

	it("includes the current draft answer", () => {
		const contextPackage = buildSideSessionContextPackage({
			batch,
			sourceQuestionId: "launcher",
			sidecarReturnPath: "/tmp/return.json",
			answers: { launcher: { questionId: "launcher", selectedOptionId: "child-pi", notes: "Keep it blocking." } },
		});

		expect(buildSideSessionPrompt(contextPackage)).toContain("Current source draft: option child-pi; notes: Keep it blocking.");
	});

	it("includes the sidecar path and grill-side-return instructions", () => {
		const contextPackage = buildSideSessionContextPackage({
			batch,
			sourceQuestionId: "launcher",
			sidecarReturnPath: "/tmp/grill-side-return.json",
		});

		const prompt = buildSideSessionPrompt(contextPackage);

		expect(prompt).toContain("/grill-side-return");
		expect(prompt).toContain("/tmp/grill-side-return.json");
		expect(prompt).toContain("returning a suggestion shuts down this side session but never submits the parent questionnaire");
		expect(prompt).toContain('/grill-side-return {"summary":"Compared options."');
	});

	it("includes Project Read-Only Mode instructions", () => {
		const prompt = buildSideSessionPrompt(
			buildSideSessionContextPackage({ batch, sourceQuestionId: "launcher", sidecarReturnPath: "/tmp/return.json" }),
		);

		expect(prompt).toContain("Project Read-Only Mode");
		expect(prompt).toContain("inspect files but do not mutate files");
	});

	it("includes parent cwd and session references when provided", () => {
		const prompt = buildSideSessionPrompt(
			buildSideSessionContextPackage({
				batch,
				sourceQuestionId: "launcher",
				sidecarReturnPath: "/tmp/return.json",
				parentCwd: "/repo/project",
				parentSessionRef: "session-abc",
			}),
		);

		expect(prompt).toContain("Parent cwd: /repo/project");
		expect(prompt).toContain("Parent session branch: session-abc");
	});
});
