import type { GrillActivationSource } from "./activation";
import {
	normalizeQuestionnaireBatch,
	type QuestionnaireBatch,
	type QuestionnaireBatchInput,
} from "./domain";

export type PendingQuestionnaireReason = "cancelled" | "no-ui";

export interface PendingQuestionnaireBatch {
	batch: QuestionnaireBatch;
	reason: PendingQuestionnaireReason;
}

export interface GrillSessionState {
	active: boolean;
	activationSource?: GrillActivationSource;
	completed: boolean;
	pendingBatch?: PendingQuestionnaireBatch;
}

interface CustomEntry {
	type: string;
	customType?: string;
	data?: unknown;
	message?: unknown;
}

export const GRILL_SESSION_STATE_ENTRY = "grill-session-state";
export const GRILL_SESSION_COMPLETION_TOOL = "complete_grill_session";
export const GRILL_SESSION_COMPLETION_MARKER = "[GRILL SESSION COMPLETE]";

const DEFAULT_GRILL_SESSION_STATE: GrillSessionState = {
	active: false,
	completed: false,
};

function restorePendingQuestionnaireBatch(candidate: unknown): PendingQuestionnaireBatch | undefined {
	if (!candidate || typeof candidate !== "object") {
		return undefined;
	}

	const pendingBatch = candidate as {
		reason?: unknown;
		batch?: QuestionnaireBatchInput;
	};
	if (
		(pendingBatch.reason !== "cancelled" && pendingBatch.reason !== "no-ui") ||
		!pendingBatch.batch ||
		!Array.isArray(pendingBatch.batch.questions)
	) {
		return undefined;
	}

	return {
		reason: pendingBatch.reason,
		batch: normalizeQuestionnaireBatch(pendingBatch.batch),
	};
}

export function activateGrillSession(
	state: GrillSessionState | undefined,
	activationSource: GrillActivationSource,
): GrillSessionState {
	if (state?.active && !state.completed) {
		return state;
	}

	return {
		active: true,
		activationSource,
		completed: false,
		...(state?.pendingBatch ? { pendingBatch: state.pendingBatch } : {}),
	};
}

export function setPendingQuestionnaireBatch(
	state: GrillSessionState | undefined,
	pendingBatch: PendingQuestionnaireBatch,
): GrillSessionState {
	return {
		active: state?.active === true,
		activationSource: state?.activationSource,
		completed: state?.completed === true,
		pendingBatch,
	};
}

export function clearPendingQuestionnaireBatch(state: GrillSessionState | undefined): GrillSessionState {
	if (!state?.pendingBatch) {
		return state ?? DEFAULT_GRILL_SESSION_STATE;
	}

	return {
		active: state.active,
		activationSource: state.activationSource,
		completed: state.completed,
	};
}

export function completeGrillSession(state?: GrillSessionState): GrillSessionState {
	return {
		active: false,
		activationSource: state?.activationSource,
		completed: true,
	};
}

export function restoreGrillSessionState(entries: CustomEntry[]): GrillSessionState {
	let restored = DEFAULT_GRILL_SESSION_STATE;

	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== GRILL_SESSION_STATE_ENTRY || !entry.data) {
			continue;
		}

		const candidate = entry.data as Partial<GrillSessionState>;
		const pendingBatch = restorePendingQuestionnaireBatch(candidate.pendingBatch);
		restored = {
			active: candidate.active === true,
			activationSource: candidate.activationSource,
			completed: candidate.completed === true,
			...(pendingBatch ? { pendingBatch } : {}),
		};
	}

	return restored;
}

export function getActiveGrillSessionInstruction(): string {
	return [
		"The grill session is active.",
		"Stay in grill-session questioning mode until the decision tree is complete.",
		"Ask only the current frontier batch needed to make progress.",
		"When the questionnaire tool is available, use the questionnaire for the current frontier batch.",
		"Prefer the questionnaire tool over plain-text questioning whenever it can capture the user's answer batch.",
		"Do not use grill-session behavior in autonomous kanban-managed roles such as manager, implementer, reviewer, refiner, planner, reality-check, or recovery.",
		"Reserve grill-session for interactive manual sessions, including direct user chats and kanban operator.",
		"Continue batch-by-batch until the important unresolved branches are complete, then emit [GRILL SESSION COMPLETE].",
	].join(" ");
}
