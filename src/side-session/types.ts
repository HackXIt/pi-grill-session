import type { QuestionnaireAnswerInput } from "../domain";

export type SideSessionAnswerSuggestion =
	| {
			mode: "option";
			questionId: string;
			selectedOptionId: string;
			notes?: string;
	  }
	| {
			mode: "custom";
			questionId: string;
			customAnswer: string;
	  };

export interface SideSessionRecord {
	id: string;
	sourceQuestionId: string;
	summary: string;
	childSessionRef: string;
	createdAt: string;
	suggestion?: SideSessionAnswerSuggestion;
	exitCode?: number | null;
	signal?: string | null;
}

export interface SideSessionReturnSidecar {
	sourceQuestionId: string;
	summary: string;
	childSessionRef: string;
	answer: SideSessionAnswerSuggestion;
}

export function sideSessionSuggestionToAnswerInput(suggestion: SideSessionAnswerSuggestion): QuestionnaireAnswerInput {
	if (suggestion.mode === "custom") {
		return {
			questionId: suggestion.questionId,
			customAnswer: suggestion.customAnswer,
		};
	}
	return {
		questionId: suggestion.questionId,
		selectedOptionId: suggestion.selectedOptionId,
		...(suggestion.notes ? { notes: suggestion.notes } : {}),
	};
}
