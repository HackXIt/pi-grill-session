import type { QuestionnaireBatch, QuestionnaireQuestion } from "../domain";
import { getQuestionAnswerMode, type QuestionnaireDraftAnswers } from "../questionnaire";

export interface SideSessionContextPackage {
	batchTitle?: string;
	batchIntro?: string;
	questions: Array<{
		id: string;
		label: string;
		prompt: string;
		options: Array<{ id: string; label: string; description?: string; recommended: boolean }>;
		allowNotes: boolean;
		allowCustomAnswer: boolean;
		draftAnswer: string;
	}>;
	sourceQuestion: QuestionnaireQuestion;
	sourceDraftAnswer: string;
	sidecarReturnPath: string;
	parentCwd?: string;
	parentSessionRef?: string;
}

export interface BuildSideSessionContextPackageParams {
	batch: QuestionnaireBatch;
	sourceQuestionId: string;
	sidecarReturnPath: string;
	answers?: QuestionnaireDraftAnswers;
	parentCwd?: string;
	parentSessionRef?: string;
}

function renderDraftAnswer(questionId: string, answers: QuestionnaireDraftAnswers = {}): string {
	const answer = answers[questionId];
	const mode = getQuestionAnswerMode(answer);
	if (mode === "custom") {
		return `custom: ${answer?.customAnswer?.trim()}`;
	}
	if (mode === "option") {
		const notes = answer?.notes?.trim() ? `; notes: ${answer.notes.trim()}` : "";
		return `option ${answer?.selectedOptionId}${notes}`;
	}
	return "unanswered";
}

export function buildSideSessionContextPackage({
	batch,
	sourceQuestionId,
	sidecarReturnPath,
	answers,
	parentCwd,
	parentSessionRef,
}: BuildSideSessionContextPackageParams): SideSessionContextPackage {
	const sourceQuestion = batch.questions.find((question) => question.id === sourceQuestionId);
	if (!sourceQuestion) {
		throw new Error(`Unknown source question id: ${sourceQuestionId}`);
	}

	return {
		...(batch.title?.trim() ? { batchTitle: batch.title.trim() } : {}),
		...(batch.intro?.trim() ? { batchIntro: batch.intro.trim() } : {}),
		questions: batch.questions.map((question) => ({
			id: question.id,
			label: question.label,
			prompt: question.prompt,
			options: question.options.map((option) => ({
				id: option.id,
				label: option.label,
				...(option.description ? { description: option.description } : {}),
				recommended: option.recommended,
			})),
			allowNotes: question.allowNotes,
			allowCustomAnswer: question.allowCustomAnswer,
			draftAnswer: renderDraftAnswer(question.id, answers),
		})),
		sourceQuestion,
		sourceDraftAnswer: renderDraftAnswer(sourceQuestionId, answers),
		sidecarReturnPath,
		...(parentCwd ? { parentCwd } : {}),
		...(parentSessionRef ? { parentSessionRef } : {}),
	};
}

function renderQuestion(question: SideSessionContextPackage["questions"][number]): string[] {
	const lines = [`- ${question.label}: ${question.prompt}`, `  id: ${question.id}`, `  current draft: ${question.draftAnswer}`];
	for (const option of question.options) {
		lines.push(`  option ${option.id} — ${option.label}${option.recommended ? " [recommended]" : ""}`);
		if (option.description) {
			lines.push(`    ${option.description}`);
		}
	}
	lines.push(`  allows notes: ${question.allowNotes ? "yes" : "no"}`);
	lines.push(`  allows custom answer: ${question.allowCustomAnswer ? "yes" : "no"}`);
	return lines;
}

function buildSideSessionTitle(contextPackage: SideSessionContextPackage): string {
	const parts = [contextPackage.batchTitle, contextPackage.sourceQuestion.label].filter(
		(part): part is string => typeof part === "string" && part.trim().length > 0,
	);
	return `Side-Session: ${parts.join(" ")}`;
}

export function buildSideSessionPrompt(contextPackage: SideSessionContextPackage): string {
	const lines: string[] = [
		buildSideSessionTitle(contextPackage),
		"You are in a temporary questionnaire Side Session.",
		"First summarize relevant context, then help the user answer the source question.",
		"This is already a helper side session: do not start grill-session mode, do not ask whether to start one, and do not run nested grill questionnaires. Help answer the source question only.",
		"Parent project is in Project Read-Only Mode by instruction: inspect files but do not mutate files in the parent project.",
		"Do not return an answer immediately. First discuss the question with the user.",
		"Only return a suggestion after the user explicitly confirms they want to return/import/finalize it; if they say no, continue this side-session conversation.",
		"When confirmed, use grill_side_return_option for a selected option, grill_side_return_custom for a custom answer, or the interactive /grill-side-return command to write an importable suggestion.",
		"Valid return shapes are selected option plus optional notes, or custom answer with a non-empty summary.",
		"returning a suggestion shuts down this side session but never submits the parent questionnaire; the parent will ask before importing it.",
		`Sidecar return path: ${contextPackage.sidecarReturnPath}`,
	];

	if (contextPackage.parentCwd) {
		lines.push(`Parent cwd: ${contextPackage.parentCwd}`);
	}
	if (contextPackage.parentSessionRef) {
		lines.push(`Parent session branch: ${contextPackage.parentSessionRef}`);
	}
	if (contextPackage.batchTitle) {
		lines.push(`Batch title: ${contextPackage.batchTitle}`);
	}
	if (contextPackage.batchIntro) {
		lines.push(`Batch intro: ${contextPackage.batchIntro}`);
	}

	lines.push("", "Source question:");
	lines.push(...renderQuestion(contextPackage.questions.find((question) => question.id === contextPackage.sourceQuestion.id)!));
	lines.push(`Current source draft: ${contextPackage.sourceDraftAnswer}`);
	lines.push("", "Current questionnaire batch:");
	for (const question of contextPackage.questions) {
		lines.push(...renderQuestion(question));
	}

	return lines.join("\n");
}
