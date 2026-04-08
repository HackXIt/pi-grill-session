import type { GrillActivationSource } from "./activation";

export interface GrillSessionState {
	active: boolean;
	activationSource?: GrillActivationSource;
	completed: boolean;
}

interface CustomEntry {
	type: string;
	customType?: string;
	data?: unknown;
}

export const GRILL_SESSION_STATE_ENTRY = "grill-session-state";
export const GRILL_SESSION_COMPLETION_TOOL = "complete_grill_session";
export const GRILL_SESSION_COMPLETION_MARKER = "[GRILL SESSION COMPLETE]";

const DEFAULT_GRILL_SESSION_STATE: GrillSessionState = {
	active: false,
	completed: false,
};

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
		restored = {
			active: candidate.active === true,
			activationSource: candidate.activationSource,
			completed: candidate.completed === true,
		};
	}

	return restored;
}

export function getActiveGrillSessionInstruction(): string {
	return [
		"The grill session is active.",
		"Stay in grill-session questioning mode until the decision tree is complete.",
		"Use concise frontier-based follow-up batches and emit [GRILL SESSION COMPLETE] when finished.",
	].join(" ");
}
