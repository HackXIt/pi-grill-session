import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import type { QuestionnaireBatch, QuestionnaireResult } from "./domain";
import type { PendingQuestionnaireBatch } from "./grill-state";
import { runQuestionnaireBatch } from "./questionnaire-runtime";

interface QuestionnaireToolDetails {
	batch: QuestionnaireBatch;
	result?: QuestionnaireResult;
	renderedLines: string[];
	cancelled: boolean;
	pendingReason?: PendingQuestionnaireBatch["reason"];
}

export interface QuestionnaireToolHandlers {
	onPendingBatch?(pendingBatch: PendingQuestionnaireBatch): void;
	onQuestionnaireSubmitted?(submission: { batch: QuestionnaireBatch; result: QuestionnaireResult }): void;
}

const QuestionnaireOptionSchema = Type.Object({
	id: Type.String({ description: "Unique identifier for the option" }),
	label: Type.String({ description: "Display label for the option" }),
	description: Type.Optional(Type.String({ description: "Optional supporting text" })),
	recommended: Type.Optional(Type.Boolean({ description: "Whether this option is the recommended choice" })),
});

const QuestionnaireQuestionSchema = Type.Object({
	id: Type.String({ description: "Unique identifier for the question" }),
	label: Type.Optional(Type.String({ description: "Short label shown in the question tab" })),
	prompt: Type.String({ description: "Question prompt shown in the questionnaire" }),
	options: Type.Array(QuestionnaireOptionSchema, { description: "Available options for the question" }),
	allowCustomAnswer: Type.Optional(
		Type.Boolean({ description: "Allow the user to replace option selection with a custom answer" }),
	),
	allowNotes: Type.Optional(
		Type.Boolean({ description: "Allow optional notes while staying in option-selection mode" }),
	),
});

const QuestionnaireBatchSchema = Type.Object({
	title: Type.Optional(Type.String({ description: "Optional questionnaire title" })),
	intro: Type.Optional(Type.String({ description: "Optional introductory text" })),
	questions: Type.Array(QuestionnaireQuestionSchema, {
		description: "Questions to ask in one questionnaire batch",
		minItems: 1,
	}),
});

export function registerQuestionnaireTool(pi: ExtensionAPI, handlers: QuestionnaireToolHandlers = {}) {
	pi.registerTool({
		name: "questionnaire",
		label: "Questionnaire",
		description: "Open an interactive multi-question questionnaire and wait for the full batch of answers.",
		promptSnippet: "Open an interactive questionnaire that collects a full answer batch before continuing.",
		promptGuidelines: [
			"Use this tool when the user should answer a whole batch of questions before the conversation continues.",
			"Provide recommended options when you have a preferred path.",
		],
		parameters: QuestionnaireBatchSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const outcome = await runQuestionnaireBatch(params, ctx);
			if (outcome.status === "pending") {
				handlers.onPendingBatch?.({ batch: outcome.batch, reason: outcome.pendingReason });
				return {
					content: [{ type: "text", text: outcome.contentText }],
					details: {
						batch: outcome.batch,
						renderedLines: outcome.renderedLines,
						cancelled: true,
						pendingReason: outcome.pendingReason,
					} satisfies QuestionnaireToolDetails,
				};
			}

			handlers.onQuestionnaireSubmitted?.({ batch: outcome.batch, result: outcome.result });
			return {
				content: [{ type: "text", text: outcome.contentText }],
				details: {
					batch: outcome.batch,
					result: outcome.result,
					renderedLines: outcome.renderedLines,
					cancelled: false,
				} satisfies QuestionnaireToolDetails,
			};
		},
		renderCall(args, theme) {
			const questionCount = Array.isArray(args.questions) ? args.questions.length : 0;
			const title = typeof args.title === "string" && args.title.trim() ? `: ${args.title.trim()}` : "";
			return new Text(
				theme.fg("toolTitle", theme.bold("questionnaire")) +
					theme.fg("muted", ` ${questionCount} question${questionCount === 1 ? "" : "s"}${title}`),
				0,
				0,
			);
		},
		renderResult(result, _options, theme) {
			const details = result.details as QuestionnaireToolDetails | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}
			if (details.cancelled) {
				return new Text(theme.fg("warning", details.renderedLines.join("\n")), 0, 0);
			}
			return new Text(details.renderedLines.join("\n"), 0, 0);
		},
	});
}
