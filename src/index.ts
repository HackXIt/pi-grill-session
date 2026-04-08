import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	buildCanonicalGrillSkillCommand,
	classifyGrillActivationInput,
	SKILL_GRILL_SESSION,
} from "./activation";
import {
	activateGrillSession,
	completeGrillSession,
	getActiveGrillSessionInstruction,
	restoreGrillSessionState,
	GRILL_SESSION_COMPLETION_MARKER,
	GRILL_SESSION_STATE_ENTRY,
	type GrillSessionState,
} from "./grill-state";

export const COMMAND_GRILL = "grill";
export const COMMAND_GRILL_END = "grill-end";
export { SKILL_GRILL_SESSION };

const CUSTOM_MESSAGE_TYPE = "grill-session";

function shouldSkipQuestionnaireRuntimeLoad(): boolean {
	return typeof process !== "undefined" && process.env.VITEST === "true";
}

function sameState(left: GrillSessionState, right: GrillSessionState): boolean {
	return (
		left.active === right.active &&
		left.completed === right.completed &&
		left.activationSource === right.activationSource
	);
}

export async function loadQuestionnaireRuntime(pi: ExtensionAPI): Promise<void> {
	const module = await import("./questionnaire-tool");
	module.registerQuestionnaireTool(pi);
}

export default function grillSessionExtension(pi: ExtensionAPI) {
	let state: GrillSessionState = restoreGrillSessionState([]);

	if (!shouldSkipQuestionnaireRuntimeLoad()) {
		void loadQuestionnaireRuntime(pi).catch((error) => {
			console.error("Failed to load questionnaire runtime", error);
		});
	}

	function setState(next: GrillSessionState) {
		if (sameState(state, next)) {
			return;
		}
		state = next;
		pi.appendEntry(GRILL_SESSION_STATE_ENTRY, next);
	}

	function restoreStateFromBranch(ctx: { sessionManager: { getBranch(): unknown[] } }) {
		state = restoreGrillSessionState(ctx.sessionManager.getBranch() as never[]);
	}

	function sendStartupMessage(text: string, ctx: { isIdle(): boolean }) {
		if (ctx.isIdle()) {
			pi.sendUserMessage(text);
			return;
		}
		pi.sendUserMessage(text, { deliverAs: "followUp" });
	}

	pi.registerCommand(COMMAND_GRILL, {
		description: "Start or continue an interactive grill session",
		handler: async (args, ctx) => {
			setState(activateGrillSession(state, "command"));
			sendStartupMessage(buildCanonicalGrillSkillCommand(args), ctx);
		},
	});

	pi.registerCommand(COMMAND_GRILL_END, {
		description: "End the active grill session",
		handler: async (_args, _ctx) => {
			setState(completeGrillSession(state));
			pi.sendMessage({
				customType: CUSTOM_MESSAGE_TYPE,
				content: GRILL_SESSION_COMPLETION_MARKER,
				display: true,
				details: { kind: "completion-marker" },
			});
		},
	});

	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") {
			return { action: "continue" };
		}

		const match = classifyGrillActivationInput(event.text);
		if (match.kind === "explicit-skill") {
			setState(activateGrillSession(state, match.activationSource));
			return { action: "continue" };
		}
		if (match.kind === "legacy-skill" || match.kind === "strong-plain-text") {
			setState(activateGrillSession(state, match.activationSource));
			return { action: "transform", text: match.canonicalText };
		}
		if (match.kind === "ambiguous-plain-text") {
			const confirmed = await ctx.ui.confirm(
				"Start grill session?",
				'This message mentions "grill". Activate grill-session mode?',
			);
			if (!confirmed) {
				return { action: "continue" };
			}
			setState(activateGrillSession(state, match.activationSource));
			return { action: "transform", text: match.canonicalText };
		}
		return { action: "continue" };
	});

	pi.on("session_start", async (_event, ctx) => {
		restoreStateFromBranch(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		restoreStateFromBranch(ctx);
	});

	pi.on("before_agent_start", async (event) => {
		if (!state.active || state.completed) {
			return undefined;
		}
		return {
			systemPrompt: `${event.systemPrompt}\n\n${getActiveGrillSessionInstruction()}`,
		};
	});
}
