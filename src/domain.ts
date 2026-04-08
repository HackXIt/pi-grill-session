export interface QuestionnaireOptionInput {
	id: string;
	label: string;
	description?: string;
	recommended?: boolean;
}

export interface QuestionnaireQuestionInput {
	id: string;
	label?: string;
	prompt: string;
	options: QuestionnaireOptionInput[];
	allowCustomAnswer?: boolean;
	allowNotes?: boolean;
}

export interface QuestionnaireBatchInput {
	title?: string;
	intro?: string;
	questions: QuestionnaireQuestionInput[];
}

export interface QuestionnaireOption extends QuestionnaireOptionInput {
	recommended: boolean;
}

export interface QuestionnaireQuestion {
	id: string;
	label: string;
	prompt: string;
	options: QuestionnaireOption[];
	allowCustomAnswer: boolean;
	allowNotes: boolean;
}

export interface QuestionnaireBatch {
	title?: string;
	intro?: string;
	questions: QuestionnaireQuestion[];
}

export interface QuestionnaireAnswerInput {
	questionId: string;
	selectedOptionId?: string;
	customAnswer?: string;
	notes?: string;
}

export interface OptionQuestionnaireAnswer {
	questionId: string;
	questionLabel: string;
	mode: "option";
	selectedOptionId: string;
	selectedOptionLabel: string;
	notes?: string;
}

export interface CustomQuestionnaireAnswer {
	questionId: string;
	questionLabel: string;
	mode: "custom";
	customAnswer: string;
}

export type QuestionnaireAnswer = OptionQuestionnaireAnswer | CustomQuestionnaireAnswer;

export interface QuestionnaireResult {
	answers: QuestionnaireAnswer[];
	summaryLines: string[];
}

export function normalizeQuestionnaireBatch(input: QuestionnaireBatchInput): QuestionnaireBatch {
	return {
		title: input.title,
		intro: input.intro,
		questions: input.questions.map((question, index) => ({
			id: question.id,
			label: question.label || `Q${index + 1}`,
			prompt: question.prompt,
			options: question.options.map((option) => ({
				...option,
				recommended: option.recommended === true,
			})),
			allowCustomAnswer: question.allowCustomAnswer !== false,
			allowNotes: question.allowNotes === true,
		})),
	};
}

export function buildQuestionnaireResult(
	batch: QuestionnaireBatch,
	answers: QuestionnaireAnswerInput[],
): QuestionnaireResult {
	const resultAnswers: QuestionnaireAnswer[] = answers.map((answer) => {
		const question = batch.questions.find((item) => item.id === answer.questionId);
		if (!question) {
			throw new Error(`Unknown question id: ${answer.questionId}`);
		}

		if (answer.customAnswer && answer.customAnswer.trim()) {
			return {
				questionId: question.id,
				questionLabel: question.label,
				mode: "custom",
				customAnswer: answer.customAnswer.trim(),
			};
		}

		if (!answer.selectedOptionId) {
			throw new Error(`Answer for question ${question.id} must include selectedOptionId or customAnswer`);
		}

		const option = question.options.find((item) => item.id === answer.selectedOptionId);
		if (!option) {
			throw new Error(`Unknown option id '${answer.selectedOptionId}' for question ${question.id}`);
		}

		const notes = answer.notes?.trim();
		return {
			questionId: question.id,
			questionLabel: question.label,
			mode: "option",
			selectedOptionId: option.id,
			selectedOptionLabel: option.label,
			...(notes ? { notes } : {}),
		};
	});

	return {
		answers: resultAnswers,
		summaryLines: resultAnswers.map((answer) => {
			if (answer.mode === "custom") {
				return `- ${answer.questionLabel}: custom answer: ${answer.customAnswer}`;
			}
			const notesSuffix = answer.notes ? ` (notes: ${answer.notes})` : "";
			return `- ${answer.questionLabel}: selected ${answer.selectedOptionId} — ${answer.selectedOptionLabel}${notesSuffix}`;
		}),
	};
}

export function renderQuestionnaireResult(batch: QuestionnaireBatch, result: QuestionnaireResult): string[] {
	const titleSuffix = batch.title ? `: ${batch.title}` : "";
	return [`Questionnaire submitted${titleSuffix}`, ...result.summaryLines];
}
