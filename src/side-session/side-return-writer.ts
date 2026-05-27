import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getMissingSideSessionEnvironment } from "./environment";

export type SideReturnInput = {
	summary: string;
	answer:
		| { mode: "option"; questionId?: string; selectedOptionId: string; notes?: string }
		| { mode: "custom"; questionId?: string; customAnswer: string };
};

function assertSideSessionEnvironment() {
	const missing = getMissingSideSessionEnvironment();
	if (missing.length > 0) {
		throw new Error(
			`Side-session return only works inside questionnaire side sessions; missing ${missing.join(", ")}`,
		);
	}
}

function getRequiredEnv(name: string): string {
	return process.env[name]!;
}

function getChildSessionRef(ctx: Partial<ExtensionContext>): string {
	return ctx.sessionManager?.getSessionFile?.() ?? "child-pi-session";
}

function normalizeInput(input: SideReturnInput, sourceQuestionId: string): SideReturnInput {
	const summary = input.summary.trim();
	if (!summary) {
		throw new Error("Side-session return requires a non-empty summary");
	}
	if (input.answer.questionId && input.answer.questionId !== sourceQuestionId) {
		throw new Error(`Side-session return answer is for another question: ${input.answer.questionId}`);
	}
	if (input.answer.mode === "option") {
		const selectedOptionId = input.answer.selectedOptionId.trim();
		if (!selectedOptionId) {
			throw new Error("Side-session option return requires selectedOptionId");
		}
		const notes = input.answer.notes?.trim();
		return {
			summary,
			answer: {
				mode: "option",
				questionId: sourceQuestionId,
				selectedOptionId,
				...(notes ? { notes } : {}),
			},
		};
	}
	const customAnswer = input.answer.customAnswer.trim();
	if (!customAnswer) {
		throw new Error("Side-session custom return requires customAnswer");
	}
	return {
		summary,
		answer: { mode: "custom", questionId: sourceQuestionId, customAnswer },
	};
}

export async function writeSideSessionReturnSuggestion(input: SideReturnInput, ctx: Partial<ExtensionContext>) {
	assertSideSessionEnvironment();
	const returnPath = getRequiredEnv("GRILL_SIDE_RETURN_PATH");
	const sourceQuestionId = getRequiredEnv("GRILL_SIDE_SOURCE_QUESTION_ID");
	const normalized = normalizeInput(input, sourceQuestionId);
	const sidecar = {
		sourceQuestionId,
		summary: normalized.summary,
		childSessionRef: getChildSessionRef(ctx),
		answer: normalized.answer,
	};
	await mkdir(dirname(returnPath), { recursive: true });
	await writeFile(returnPath, JSON.stringify(sidecar, null, 2), "utf8");
	ctx.ui?.notify(`Wrote side-session return suggestion to ${returnPath}`, "info");
	ctx.shutdown?.();
	return { returnPath, sidecar };
}
