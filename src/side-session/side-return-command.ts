import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export const COMMAND_GRILL_SIDE_RETURN = "grill-side-return";

interface SideReturnCommandArgs {
	summary: string;
	answer:
		| { mode: "option"; selectedOptionId: string; notes?: string }
		| { mode: "custom"; customAnswer: string };
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArgs(args: string): SideReturnCommandArgs {
	let parsed: unknown;
	try {
		parsed = JSON.parse(args || "{}");
	} catch (error) {
		throw new Error(`Invalid /grill-side-return JSON: ${(error as Error).message}`);
	}
	if (!isObject(parsed) || typeof parsed.summary !== "string" || !parsed.summary.trim()) {
		throw new Error("/grill-side-return requires a non-empty summary");
	}
	if (!isObject(parsed.answer)) {
		throw new Error("/grill-side-return requires an answer object");
	}
	if (parsed.answer.mode === "option") {
		if (typeof parsed.answer.selectedOptionId !== "string" || !parsed.answer.selectedOptionId.trim()) {
			throw new Error("/grill-side-return option answer requires selectedOptionId");
		}
		return {
			summary: parsed.summary.trim(),
			answer: {
				mode: "option",
				selectedOptionId: parsed.answer.selectedOptionId.trim(),
				...(typeof parsed.answer.notes === "string" && parsed.answer.notes.trim()
					? { notes: parsed.answer.notes.trim() }
					: {}),
			},
		};
	}
	if (parsed.answer.mode === "custom") {
		if (typeof parsed.answer.customAnswer !== "string" || !parsed.answer.customAnswer.trim()) {
			throw new Error("/grill-side-return custom answer requires customAnswer");
		}
		return {
			summary: parsed.summary.trim(),
			answer: { mode: "custom", customAnswer: parsed.answer.customAnswer.trim() },
		};
	}
	throw new Error("/grill-side-return answer mode must be option or custom");
}

function getChildSessionRef(ctx: Partial<ExtensionCommandContext>): string {
	return ctx.sessionManager?.getSessionFile?.() ?? "child-pi-session";
}

export function registerGrillSideReturnCommand(pi: Pick<ExtensionAPI, "registerCommand">) {
	pi.registerCommand(COMMAND_GRILL_SIDE_RETURN, {
		description: "Write a questionnaire side-session return suggestion for the parent questionnaire.",
		handler: async (args, ctx) => {
			const returnPath = process.env.GRILL_SIDE_RETURN_PATH;
			const sourceQuestionId = process.env.GRILL_SIDE_SOURCE_QUESTION_ID;
			if (!returnPath || !sourceQuestionId) {
				throw new Error("GRILL_SIDE_RETURN_PATH and GRILL_SIDE_SOURCE_QUESTION_ID must be set");
			}
			const parsed = parseArgs(args);
			const answer =
				parsed.answer.mode === "option"
					? {
							mode: "option" as const,
							questionId: sourceQuestionId,
							selectedOptionId: parsed.answer.selectedOptionId,
							...(parsed.answer.notes ? { notes: parsed.answer.notes } : {}),
					  }
					: {
							mode: "custom" as const,
							questionId: sourceQuestionId,
							customAnswer: parsed.answer.customAnswer,
					  };
			await mkdir(dirname(returnPath), { recursive: true });
			await writeFile(
				returnPath,
				JSON.stringify(
					{
						sourceQuestionId,
						summary: parsed.summary,
						childSessionRef: getChildSessionRef(ctx),
						answer,
					},
					null,
					2,
				),
				"utf8",
			);
			ctx.ui.notify(`Wrote side-session return suggestion to ${returnPath}`, "info");
			ctx.shutdown();
		},
	});
}
