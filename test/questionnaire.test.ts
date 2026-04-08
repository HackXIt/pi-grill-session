import { describe, expect, it } from "vitest";
import { normalizeQuestionnaireBatch } from "../src/domain";
import {
	buildModelVisibleQuestionnaireSubmission,
	buildQuestionnaireSubmission,
	canSubmitQuestionnaire,
	getQuestionAnswerMode,
	renderQuestionnaireOptionLabel,
	selectQuestionOption,
	setQuestionCustomAnswer,
	setQuestionNotes,
	type QuestionnaireDraftAnswers,
} from "../src/questionnaire";

describe("questionnaire state", () => {
	it("blocks submission until every question has an answer", () => {
		const batch = normalizeQuestionnaireBatch({
			questions: [
				{
					id: "activation",
					label: "Activation",
					prompt: "How should grill mode activate?",
					allowNotes: true,
					options: [{ id: "grill", label: "/grill", recommended: true }],
				},
				{
					id: "payload",
					label: "Payload",
					prompt: "What should the model receive?",
					options: [{ id: "structured", label: "Structured answers" }],
				},
			],
		});

		let answers: QuestionnaireDraftAnswers = {};

		expect(canSubmitQuestionnaire(batch, answers)).toBe(false);

		answers = selectQuestionOption(batch, answers, "activation", "grill");
		expect(getQuestionAnswerMode(answers.activation)).toBe("option");
		expect(canSubmitQuestionnaire(batch, answers)).toBe(false);

		answers = selectQuestionOption(batch, answers, "payload", "structured");
		expect(canSubmitQuestionnaire(batch, answers)).toBe(true);
	});

	it("switches from option mode with notes to custom mode by clearing selection state", () => {
		const batch = normalizeQuestionnaireBatch({
			questions: [
				{
					id: "scope",
					label: "Scope",
					prompt: "What should v1 include?",
					allowNotes: true,
					allowCustomAnswer: true,
					options: [{ id: "ux", label: "Questionnaire UI only" }],
				},
			],
		});

		const answers = setQuestionCustomAnswer(
			batch,
			{
				scope: {
					questionId: "scope",
					selectedOptionId: "ux",
					notes: "Keep activation flow in the next ticket.",
				},
			},
			"scope",
			"UI slice only",
		);

		expect(answers.scope).toEqual({
			questionId: "scope",
			customAnswer: "UI slice only",
		});
		expect(getQuestionAnswerMode(answers.scope)).toBe("custom");
	});

	it("switches from custom mode back to option mode by clearing the custom answer", () => {
		const batch = normalizeQuestionnaireBatch({
			questions: [
				{
					id: "payload",
					label: "Payload",
					prompt: "What should the model receive?",
					allowCustomAnswer: true,
					options: [{ id: "structured", label: "Structured answers" }],
				},
			],
		});

		const answers = selectQuestionOption(
			batch,
			setQuestionCustomAnswer(batch, {}, "payload", "A bespoke markdown artifact"),
			"payload",
			"structured",
		);

		expect(answers.payload).toEqual({
			questionId: "payload",
			selectedOptionId: "structured",
		});
		expect(getQuestionAnswerMode(answers.payload)).toBe("option");
	});

	it("keeps notes attached to option mode and renders recommended options visibly", () => {
		const batch = normalizeQuestionnaireBatch({
			title: "Batch 1",
			questions: [
				{
					id: "activation",
					label: "Activation",
					prompt: "How should grill mode activate?",
					allowNotes: true,
					options: [{ id: "grill", label: "/grill", recommended: true }],
				},
			],
		});

		let answers = selectQuestionOption(batch, {}, "activation", "grill");
		answers = setQuestionNotes(batch, answers, "activation", "Keep a plain-text trigger too.");

		expect(answers.activation).toEqual({
			questionId: "activation",
			selectedOptionId: "grill",
			notes: "Keep a plain-text trigger too.",
		});
		expect(getQuestionAnswerMode(answers.activation)).toBe("option");
		expect(renderQuestionnaireOptionLabel(batch.questions[0].options[0])).toBe("/grill [recommended]");
		expect(buildQuestionnaireSubmission(batch, answers).renderedLines).toEqual([
			"Questionnaire submitted: Batch 1",
			"- Activation: selected grill — /grill (notes: Keep a plain-text trigger too.)",
		]);
	});

	it("builds model-visible submission content with structured answers", () => {
		const batch = normalizeQuestionnaireBatch({
			title: "Batch 1",
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

		let answers = selectQuestionOption(batch, {}, "activation", "grill");
		answers = setQuestionNotes(batch, answers, "activation", "Keep a plain-text trigger too.");
		answers = setQuestionCustomAnswer(batch, answers, "skill-name", "grill-session");

		const submission = buildQuestionnaireSubmission(batch, answers);
		const content = buildModelVisibleQuestionnaireSubmission(batch, submission.result);

		expect(JSON.parse(content)).toEqual({
			type: "questionnaire_submission",
			title: "Batch 1",
			answers: [
				{
					questionId: "activation",
					questionLabel: "Activation",
					mode: "option",
					selectedOptionId: "grill",
					selectedOptionLabel: "/grill",
					notes: "Keep a plain-text trigger too.",
				},
				{
					questionId: "skill-name",
					questionLabel: "Skill Name",
					mode: "custom",
					customAnswer: "grill-session",
				},
			],
		});
	});
});
