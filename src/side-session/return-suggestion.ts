import { readFile } from "node:fs/promises";
import type { QuestionnaireBatch, QuestionnaireQuestion } from "../domain";
import type { SideSessionAnswerSuggestion, SideSessionRecord } from "./types";

export interface ParseSideSessionReturnSidecarParams {
	path: string;
	batch: QuestionnaireBatch;
	sourceQuestionId: string;
	createdAt?: string;
	exitCode?: number | null;
	signal?: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, name: string): string {
	if (typeof value !== "string") {
		throw new Error(`Side-session return sidecar must include ${name}`);
	}
	return value.trim();
}

function validateQuestion(batch: QuestionnaireBatch, sourceQuestionId: string): QuestionnaireQuestion {
	const question = batch.questions.find((item) => item.id === sourceQuestionId);
	if (!question) {
		throw new Error(`Unknown source question id: ${sourceQuestionId}`);
	}
	return question;
}

function validateSuggestion(
	answer: unknown,
	question: QuestionnaireQuestion,
	sourceQuestionId: string,
): SideSessionAnswerSuggestion {
	if (!isObject(answer)) {
		throw new Error("Side-session return answer must be an object");
	}
	const questionId = readString(answer.questionId, "answer.questionId");
	if (questionId !== sourceQuestionId) {
		throw new Error(`Side-session return answer is for another question: ${questionId}`);
	}

	if (answer.mode === "option") {
		const selectedOptionId = readString(answer.selectedOptionId, "answer.selectedOptionId");
		if (!question.options.some((option) => option.id === selectedOptionId)) {
			throw new Error(`Unknown option id '${selectedOptionId}' for question ${sourceQuestionId}`);
		}
		const notes = typeof answer.notes === "string" ? answer.notes.trim() : undefined;
		if (notes && !question.allowNotes) {
			throw new Error(`Question ${sourceQuestionId} does not allow notes`);
		}
		return {
			mode: "option",
			questionId,
			selectedOptionId,
			...(notes ? { notes } : {}),
		};
	}

	if (answer.mode === "custom") {
		if (!question.allowCustomAnswer) {
			throw new Error(`Question ${sourceQuestionId} does not allow custom answers`);
		}
		const customAnswer = readString(answer.customAnswer, "answer.customAnswer");
		if (!customAnswer) {
			throw new Error("Side-session custom answer cannot be empty");
		}
		return {
			mode: "custom",
			questionId,
			customAnswer,
		};
	}

	throw new Error("Side-session return answer mode must be option or custom");
}

export async function parseSideSessionReturnSidecar({
	path,
	batch,
	sourceQuestionId,
	createdAt,
	exitCode,
	signal,
}: ParseSideSessionReturnSidecarParams): Promise<SideSessionRecord | undefined> {
	let text: string;
	try {
		text = await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return undefined;
		}
		throw error;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new Error(`Invalid side-session return JSON: ${(error as Error).message}`);
	}
	if (!isObject(parsed)) {
		throw new Error("Side-session return sidecar must be an object");
	}

	const question = validateQuestion(batch, sourceQuestionId);
	const sidecarQuestionId = readString(parsed.sourceQuestionId, "sourceQuestionId");
	if (sidecarQuestionId !== sourceQuestionId) {
		throw new Error(`Side-session return is for another source question: ${sidecarQuestionId}`);
	}
	const summary = readString(parsed.summary, "summary");
	if (!summary) {
		throw new Error("Side-session return summary cannot be empty");
	}
	const childSessionRef = readString(parsed.childSessionRef, "childSessionRef") || "child-pi-session";
	const suggestion = validateSuggestion(parsed.answer, question, sourceQuestionId);

	return {
		id: `side-session-${sourceQuestionId}-${Date.now()}`,
		sourceQuestionId,
		summary,
		childSessionRef,
		createdAt: createdAt ?? new Date().toISOString(),
		suggestion,
		...(exitCode !== undefined ? { exitCode } : {}),
		...(signal !== undefined ? { signal } : {}),
	};
}
