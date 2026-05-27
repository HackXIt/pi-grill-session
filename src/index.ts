import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	buildCanonicalGrillSkillCommand,
	classifyGrillActivationInput,
	SKILL_GRILL_SESSION,
} from "./activation";
import {
	activateGrillSession,
	clearPendingQuestionnaireBatch,
	completeGrillSession,
	getActiveGrillSessionInstruction,
	restoreGrillSessionState,
	setPendingQuestionnaireBatch,
	GRILL_SESSION_COMPLETION_MARKER,
	GRILL_SESSION_STATE_ENTRY,
	type GrillSessionState,
} from "./grill-state";
import { runQuestionnaireBatch } from "./questionnaire-runtime";
import type { QuestionnaireToolHandlers } from "./questionnaire-tool";
import { isQuestionnaireSideSessionEnvironment } from "./side-session/environment";
import { registerGrillSideReturnCommand } from "./side-session/side-return-command";
import { registerGrillSideReturnTools } from "./side-session/side-return-tool";

export const COMMAND_GRILL = "grill";
export const COMMAND_GRILL_END = "grill-end";
export const COMMAND_GRILL_REOPEN = "grill-reopen";
export { SKILL_GRILL_SESSION };

const CUSTOM_MESSAGE_TYPE = "grill-session";
const KANBAN_ROLE_SESSION_PATTERN = /(?:^|[\\/])\.kanban[\\/]runtime[\\/]sessions[\\/][^\\/]+\.jsonl$/i;

function shouldSkipQuestionnaireRuntimeLoad(): boolean {
	return typeof process !== "undefined" && process.env.VITEST === "true";
}

function isAutonomousKanbanRoleSession(sessionFile: string | undefined): boolean {
	return typeof sessionFile === "string" && KANBAN_ROLE_SESSION_PATTERN.test(sessionFile);
}

function sameState(left: GrillSessionState, right: GrillSessionState): boolean {
	return (
		left.active === right.active &&
		left.completed === right.completed &&
		left.activationSource === right.activationSource &&
		JSON.stringify(left.pendingBatch) === JSON.stringify(right.pendingBatch)
	);
}

export async function loadQuestionnaireRuntime(pi: ExtensionAPI, handlers: QuestionnaireToolHandlers = {}): Promise<void> {
	const module = await import("./questionnaire-tool");
	module.registerQuestionnaireTool(pi, handlers);
}

export default function grillSessionExtension(pi: ExtensionAPI) {
	if (isQuestionnaireSideSessionEnvironment()) {
		registerGrillSideReturnCommand(pi);
		registerGrillSideReturnTools(pi);
		return;
	}

	let state: GrillSessionState = restoreGrillSessionState([]);
	let disabledForAutonomousKanbanRole = false;
	let questionnaireRuntimeLoaded = false;
	let questionnaireRuntimeLoadPromise: Promise<void> | undefined;

	const questionnaireHandlers: QuestionnaireToolHandlers = {
		onPendingBatch(pendingBatch) {
			setState(setPendingQuestionnaireBatch(state, pendingBatch));
		},
		onQuestionnaireSubmitted() {
			setState(clearPendingQuestionnaireBatch(state));
		},
	};

	function ensureQuestionnaireRuntimeLoaded(): Promise<void> {
		if (questionnaireRuntimeLoaded || shouldSkipQuestionnaireRuntimeLoad() || disabledForAutonomousKanbanRole) {
			return Promise.resolve();
		}
		if (questionnaireRuntimeLoadPromise) {
			return questionnaireRuntimeLoadPromise;
		}
		questionnaireRuntimeLoadPromise = loadQuestionnaireRuntime(pi, questionnaireHandlers)
			.then(() => {
				questionnaireRuntimeLoaded = true;
			})
			.catch((error) => {
				questionnaireRuntimeLoaded = false;
				console.error("Failed to load questionnaire runtime", error);
			})
			.finally(() => {
				questionnaireRuntimeLoadPromise = undefined;
			});
		return questionnaireRuntimeLoadPromise;
	}

	function syncSessionMode(ctx: { sessionManager?: { getSessionFile?(): string | undefined } }) {
		disabledForAutonomousKanbanRole = isAutonomousKanbanRoleSession(ctx.sessionManager?.getSessionFile?.());
		if (!disabledForAutonomousKanbanRole) {
			void ensureQuestionnaireRuntimeLoaded();
		}
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
			syncSessionMode(ctx);
			if (disabledForAutonomousKanbanRole) {
				return;
			}
			setState(activateGrillSession(state, "command"));
			sendStartupMessage(buildCanonicalGrillSkillCommand(args), ctx);
		},
	});

	pi.registerCommand(COMMAND_GRILL_END, {
		description: "End the active grill session",
		handler: async (_args, ctx) => {
			syncSessionMode(ctx);
			if (disabledForAutonomousKanbanRole) {
				return;
			}
			setState(completeGrillSession(state));
			pi.sendMessage({
				customType: CUSTOM_MESSAGE_TYPE,
				content: GRILL_SESSION_COMPLETION_MARKER,
				display: true,
				details: { kind: "completion-marker" },
			});
		},
	});

	pi.registerCommand(COMMAND_GRILL_REOPEN, {
		description: "Reopen the last pending questionnaire batch",
		handler: async (_args, ctx) => {
			syncSessionMode(ctx);
			if (disabledForAutonomousKanbanRole) {
				return;
			}
			if (!state.pendingBatch) {
				ctx.ui.notify("No pending questionnaire batch to reopen.", "warning");
				return;
			}

			const outcome = await runQuestionnaireBatch(state.pendingBatch.batch, ctx);
			if (outcome.status === "pending") {
				setState(setPendingQuestionnaireBatch(state, { batch: outcome.batch, reason: outcome.pendingReason }));
				pi.sendMessage({
					customType: CUSTOM_MESSAGE_TYPE,
					content: [{ type: "text", text: outcome.contentText }],
					display: true,
					details: { kind: "pending-batch-status", reason: outcome.pendingReason },
				});
				return;
			}

			setState(clearPendingQuestionnaireBatch(state));
			pi.sendMessage(
				{
					customType: CUSTOM_MESSAGE_TYPE,
					content: [{ type: "text", text: outcome.renderedLines.join("\n") }],
					display: true,
					details: { kind: "pending-batch-submission" },
				},
				{ triggerTurn: true },
			);
		},
	});

	pi.on("input", async (event, ctx) => {
		syncSessionMode(ctx);
		if (disabledForAutonomousKanbanRole || event.source === "extension") {
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
		syncSessionMode(ctx);
		restoreStateFromBranch(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		syncSessionMode(ctx);
		restoreStateFromBranch(ctx);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		syncSessionMode(ctx);
		if (disabledForAutonomousKanbanRole) {
			return undefined;
		}
		await ensureQuestionnaireRuntimeLoaded();
		if (!state.active || state.completed) {
			return undefined;
		}
		return {
			systemPrompt: `${event.systemPrompt}\n\n${getActiveGrillSessionInstruction()}`,
		};
	});
}
