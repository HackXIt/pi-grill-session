import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { writeSideSessionReturnSuggestion } from "./side-return-writer";

export const TOOL_GRILL_SIDE_RETURN = "grill_side_return";

const SideReturnAnswerSchema = Type.Union([
	Type.Object({
		mode: Type.Literal("option"),
		questionId: Type.Optional(Type.String({ description: "Optional question id; if provided, must match the source question." })),
		selectedOptionId: Type.String({ description: "Option id to return to the parent questionnaire." }),
		notes: Type.Optional(Type.String({ description: "Optional rationale or notes for the selected option." })),
	}),
	Type.Object({
		mode: Type.Literal("custom"),
		questionId: Type.Optional(Type.String({ description: "Optional question id; if provided, must match the source question." })),
		customAnswer: Type.String({ description: "Custom answer text to return to the parent questionnaire." }),
	}),
]);

const SideReturnToolSchema = Type.Object({
	summary: Type.String({ description: "Non-empty summary of the side-session reasoning or recommendation." }),
	answer: SideReturnAnswerSchema,
});

export function registerGrillSideReturnTool(pi: Pick<ExtensionAPI, "registerTool">) {
	pi.registerTool({
		name: TOOL_GRILL_SIDE_RETURN,
		label: "Return side-session answer",
		description: "Return an answer suggestion from a questionnaire side session to the parent questionnaire.",
		promptSnippet: "Return a side-session answer suggestion to the parent questionnaire.",
		promptGuidelines: [
			"Only call this tool after the user explicitly confirms they want to return this answer to the parent questionnaire.",
			"If the user declines, continue the side-session conversation and do not call this tool.",
		],
		parameters: SideReturnToolSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const result = await writeSideSessionReturnSuggestion(params, ctx);
			return {
				content: [{ type: "text", text: `Returned side-session suggestion to ${result.returnPath}` }],
				details: result.sidecar,
			};
		},
	});
}
