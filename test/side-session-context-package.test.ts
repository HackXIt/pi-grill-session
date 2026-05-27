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
	it("starts the prompt with a side-session title for the questionnaire and source question", () => {
		const contextPackage = buildSideSessionContextPackage({
			batch,
			sourceQuestionId: "launcher",
			sidecarReturnPath: "/tmp/return.json",
		});

		expect(buildSideSessionPrompt(contextPackage).split("\n")[0]).toBe("Side-Session: Architecture choice Launcher");
	});

	it("omits the questionnaire title from the side-session title when the batch is untitled", () => {
		const untitledBatch = normalizeQuestionnaireBatch({
			questions: [
				{
					id: "scope",
					label: "Scope",
					prompt: "Pick scope",
					options: [{ id: "small", label: "Small" }],
				},
			],
		});
		const contextPackage = buildSideSessionContextPackage({
			batch: untitledBatch,
			sourceQuestionId: "scope",
			sidecarReturnPath: "/tmp/return.json",
		});

		expect(buildSideSessionPrompt(contextPackage).split("\n")[0]).toBe("Side-Session: Scope");
	});

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

	it("includes guarded side-return instructions", () => {
		const contextPackage = buildSideSessionContextPackage({
			batch,
			sourceQuestionId: "launcher",
			sidecarReturnPath: "/tmp/grill-side-return.json",
		});

		const prompt = buildSideSessionPrompt(contextPackage);

		expect(prompt).toContain("Do not return an answer immediately");
		expect(prompt).toContain("Only return a suggestion after the user explicitly confirms");
		expect(prompt).toContain("grill_side_return_option");
		expect(prompt).toContain("grill_side_return_custom");
		expect(prompt).toContain("/grill-side-return");
		expect(prompt).toContain("/tmp/grill-side-return.json");
		expect(prompt).toContain("returning a suggestion shuts down this side session but never submits the parent questionnaire");
	});

	it("explicitly forbids nested grill sessions", () => {
		const prompt = buildSideSessionPrompt(
			buildSideSessionContextPackage({ batch, sourceQuestionId: "launcher", sidecarReturnPath: "/tmp/return.json" }),
		);

		expect(prompt).toContain("do not start grill-session mode");
		expect(prompt).toContain("do not ask whether to start one");
		expect(prompt).toContain("do not run nested grill questionnaires");
		expect(prompt).toContain("Help answer the source question only");
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
