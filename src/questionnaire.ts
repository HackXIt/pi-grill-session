import {
	buildQuestionnaireResult,
	renderQuestionnaireResult,
	type QuestionnaireAnswerInput,
	type QuestionnaireBatch,
	type QuestionnaireOption,
	type QuestionnaireResult,
} from "./domain";

export interface QuestionnaireDraftAnswer extends QuestionnaireAnswerInput {}

export type QuestionnaireDraftAnswers = Record<string, QuestionnaireDraftAnswer | undefined>;

export type QuestionnaireAnswerMode = "unanswered" | "option" | "custom";

export function getQuestionAnswerMode(answer?: QuestionnaireDraftAnswer): QuestionnaireAnswerMode {
	if (!answer) {
		return "unanswered";
	}

	if (answer.customAnswer?.trim()) {
		return "custom";
	}

	if (answer.selectedOptionId) {
		return "option";
	}

	return "unanswered";
}

export function selectQuestionOption(
	batch: QuestionnaireBatch,
	answers: QuestionnaireDraftAnswers,
	questionId: string,
	selectedOptionId: string,
): QuestionnaireDraftAnswers {
	const question = batch.questions.find((item) => item.id === questionId);
	if (!question) {
		throw new Error(`Unknown question id: ${questionId}`);
	}

	const option = question.options.find((item) => item.id === selectedOptionId);
	if (!option) {
		throw new Error(`Unknown option id '${selectedOptionId}' for question ${questionId}`);
	}

	const existing = answers[questionId];
	return {
		...answers,
		[questionId]: {
			questionId,
			selectedOptionId,
			...(question.allowNotes && existing?.notes ? { notes: existing.notes } : {}),
		},
	};
}

export function setQuestionCustomAnswer(
	batch: QuestionnaireBatch,
	answers: QuestionnaireDraftAnswers,
	questionId: string,
	customAnswer: string,
): QuestionnaireDraftAnswers {
	const question = batch.questions.find((item) => item.id === questionId);
	if (!question) {
		throw new Error(`Unknown question id: ${questionId}`);
	}
	if (!question.allowCustomAnswer) {
		throw new Error(`Question ${questionId} does not allow custom answers`);
	}

	const trimmed = customAnswer.trim();
	return {
		...answers,
		[questionId]: trimmed
			? {
					questionId,
					customAnswer: trimmed,
				}
			: {
					questionId,
				},
	};
}

export function setQuestionNotes(
	batch: QuestionnaireBatch,
	answers: QuestionnaireDraftAnswers,
	questionId: string,
	notes: string,
): QuestionnaireDraftAnswers {
	const question = batch.questions.find((item) => item.id === questionId);
	if (!question) {
		throw new Error(`Unknown question id: ${questionId}`);
	}
	if (!question.allowNotes) {
		throw new Error(`Question ${questionId} does not allow notes`);
	}

	const existing = answers[questionId];
	if (getQuestionAnswerMode(existing) !== "option" || !existing?.selectedOptionId) {
		throw new Error(`Question ${questionId} must have a selected option before notes can be set`);
	}

	const trimmed = notes.trim();
	return {
		...answers,
		[questionId]: {
			questionId,
			selectedOptionId: existing.selectedOptionId,
			...(trimmed ? { notes: trimmed } : {}),
		},
	};
}

export function canSubmitQuestionnaire(batch: QuestionnaireBatch, answers: QuestionnaireDraftAnswers): boolean {
	return batch.questions.every((question) => getQuestionAnswerMode(answers[question.id]) !== "unanswered");
}

export function renderQuestionnaireOptionLabel(option: QuestionnaireOption): string {
	return option.recommended ? `${option.label} [recommended]` : option.label;
}

export function toQuestionnaireAnswerInputs(
	batch: QuestionnaireBatch,
	answers: QuestionnaireDraftAnswers,
): QuestionnaireAnswerInput[] {
	return batch.questions
		.map((question) => answers[question.id])
		.filter((answer): answer is QuestionnaireDraftAnswer => getQuestionAnswerMode(answer) !== "unanswered")
		.map((answer) => ({
			questionId: answer.questionId,
			...(answer.selectedOptionId ? { selectedOptionId: answer.selectedOptionId } : {}),
			...(answer.customAnswer?.trim() ? { customAnswer: answer.customAnswer.trim() } : {}),
			...(answer.notes?.trim() ? { notes: answer.notes.trim() } : {}),
		}));
}

export function buildQuestionnaireSubmission(
	batch: QuestionnaireBatch,
	answers: QuestionnaireDraftAnswers,
): { result: QuestionnaireResult; renderedLines: string[] } {
	const result = buildQuestionnaireResult(batch, toQuestionnaireAnswerInputs(batch, answers));
	return {
		result,
		renderedLines: renderQuestionnaireResult(batch, result),
	};
}

export function buildModelVisibleQuestionnaireSubmission(
	batch: QuestionnaireBatch,
	result: QuestionnaireResult,
): string {
	return JSON.stringify(
		{
			type: "questionnaire_submission",
			...(batch.title ? { title: batch.title } : {}),
			answers: result.answers,
		},
		null,
		2,
	);
}
