import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { writeSideSessionReturnSuggestion } from "./side-return-writer";

export const TOOL_GRILL_SIDE_RETURN_OPTION = "grill_side_return_option";
export const TOOL_GRILL_SIDE_RETURN_CUSTOM = "grill_side_return_custom";

const SideReturnOptionToolSchema = Type.Object({
	summary: Type.String({ description: "Non-empty summary of the side-session reasoning or recommendation." }),
	questionId: Type.Optional(Type.String({ description: "Optional question id; if provided, must match the source question." })),
	selectedOptionId: Type.String({ description: "Exact option id to return to the parent questionnaire." }),
	notes: Type.Optional(Type.String({ description: "Optional rationale or notes for the selected option." })),
});

const SideReturnCustomToolSchema = Type.Object({
	summary: Type.String({ description: "Non-empty summary of the side-session reasoning or recommendation." }),
	questionId: Type.Optional(Type.String({ description: "Optional question id; if provided, must match the source question." })),
	customAnswer: Type.String({ description: "Custom answer text to return to the parent questionnaire." }),
});

const promptGuidelines = [
	"Only call this tool after the user explicitly confirms they want to return this answer to the parent questionnaire.",
	"If the user declines, continue the side-session conversation and do not call this tool.",
];

export function registerGrillSideReturnTools(pi: Pick<ExtensionAPI, "registerTool">) {
	pi.registerTool({
		name: TOOL_GRILL_SIDE_RETURN_OPTION,
		label: "Return side-session option",
		description: "Return a selected option suggestion from a questionnaire side session to the parent questionnaire.",
		promptSnippet: "Return a selected option suggestion to the parent questionnaire.",
		promptGuidelines,
		parameters: SideReturnOptionToolSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const result = await writeSideSessionReturnSuggestion(
				{
					summary: params.summary,
					answer: {
						mode: "option",
						...(params.questionId ? { questionId: params.questionId } : {}),
						selectedOptionId: params.selectedOptionId,
						...(params.notes ? { notes: params.notes } : {}),
					},
				},
				ctx,
			);
			return {
				content: [{ type: "text", text: `Returned side-session option suggestion to ${result.returnPath}` }],
				details: result.sidecar,
			};
		},
	});

	pi.registerTool({
		name: TOOL_GRILL_SIDE_RETURN_CUSTOM,
		label: "Return side-session custom answer",
		description: "Return a custom answer suggestion from a questionnaire side session to the parent questionnaire.",
		promptSnippet: "Return a custom answer suggestion to the parent questionnaire.",
		promptGuidelines,
		parameters: SideReturnCustomToolSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const result = await writeSideSessionReturnSuggestion(
				{
					summary: params.summary,
					answer: {
						mode: "custom",
						...(params.questionId ? { questionId: params.questionId } : {}),
						customAnswer: params.customAnswer,
					},
				},
				ctx,
			);
			return {
				content: [{ type: "text", text: `Returned side-session custom suggestion to ${result.returnPath}` }],
				details: result.sidecar,
			};
		},
	});
}
