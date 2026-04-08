import { describe, expect, it } from "vitest";
import {
	buildQuestionnaireResult,
	normalizeQuestionnaireBatch,
	renderQuestionnaireResult,
	type QuestionnaireBatchInput,
} from "../src/domain";

describe("questionnaire domain", () => {
	it("normalizes labels and booleans for questions", () => {
		const batch: QuestionnaireBatchInput = {
			questions: [
				{
					id: "start-mode",
					prompt: "How should grill mode start?",
					options: [{ id: "all", label: "All of the above" }],
				},
			],
		};

		const normalized = normalizeQuestionnaireBatch(batch);

		expect(normalized.questions[0]).toMatchObject({
			id: "start-mode",
			label: "Q1",
			allowCustomAnswer: true,
			allowNotes: false,
		});
	});

	it("builds structured results for selected options with notes", () => {
		const normalized = normalizeQuestionnaireBatch({
			questions: [
				{
					id: "payload",
					label: "Payload",
					prompt: "What should the model receive?",
					allowNotes: true,
					options: [
						{ id: "answers", label: "Structured answers", recommended: true },
					],
				},
			],
		});

		const result = buildQuestionnaireResult(normalized, [
			{
				questionId: "payload",
				selectedOptionId: "answers",
				notes: "Readable history can also be rendered for the user.",
			},
		]);

		expect(result.answers).toEqual([
			{
				questionId: "payload",
				questionLabel: "Payload",
				mode: "option",
				selectedOptionId: "answers",
				selectedOptionLabel: "Structured answers",
				notes: "Readable history can also be rendered for the user.",
			},
		]);
		expect(result.summaryLines).toEqual([
			"- Payload: selected answers — Structured answers (notes: Readable history can also be rendered for the user.)",
		]);
	});

	it("builds structured results for fully custom answers", () => {
		const normalized = normalizeQuestionnaireBatch({
			questions: [
				{
					id: "skill-name",
					label: "Skill Name",
					prompt: "What should the skill be called?",
					options: [{ id: "interactive", label: "grill-me-interactive" }],
				},
			],
		});

		const result = buildQuestionnaireResult(normalized, [
			{
				questionId: "skill-name",
				customAnswer: "grill-session",
			},
		]);

		expect(result.answers).toEqual([
			{
				questionId: "skill-name",
				questionLabel: "Skill Name",
				mode: "custom",
				customAnswer: "grill-session",
			},
		]);
		expect(result.summaryLines).toEqual(["- Skill Name: custom answer: grill-session"]);
	});

	it("renders readable questionnaire submission with selected options, notes, and custom answers", () => {
		const batch = normalizeQuestionnaireBatch({
			title: "Grill Session Batch 1",
			questions: [
				{
					id: "activation",
					label: "Activation",
					prompt: "How should grill mode activate?",
					allowNotes: true,
					options: [{ id: "grill", label: "/grill", recommended: true }],
				},
				{
					id: "skill-name",
					label: "Skill Name",
					prompt: "What should the companion skill be called?",
					options: [{ id: "existing", label: "grill-me" }],
				},
			],
		});

		const result = buildQuestionnaireResult(batch, [
			{
				questionId: "activation",
				selectedOptionId: "grill",
				notes: "Keep plain-text trigger support too.",
			},
			{
				questionId: "skill-name",
				customAnswer: "grill-session",
			},
		]);

		expect(renderQuestionnaireResult(batch, result)).toEqual([
			"Questionnaire submitted: Grill Session Batch 1",
			"- Activation: selected grill — /grill (notes: Keep plain-text trigger support too.)",
			"- Skill Name: custom answer: grill-session",
		]);
	});
});
