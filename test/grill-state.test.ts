import { describe, expect, it } from "vitest";
import {
	activateGrillSession,
	completeGrillSession,
	getActiveGrillSessionInstruction,
	restoreGrillSessionState,
	GRILL_SESSION_COMPLETION_MARKER,
	GRILL_SESSION_STATE_ENTRY,
	GRILL_SESSION_COMPLETION_TOOL,
} from "../src/grill-state";

describe("grill session state", () => {
	it("activates once and keeps start/end transitions idempotent", () => {
		const activated = activateGrillSession(undefined, "command");
		const activatedAgain = activateGrillSession(activated, "command");
		const completed = completeGrillSession(activatedAgain);
		const completedAgain = completeGrillSession(completed);

		expect(activated).toEqual({
			active: true,
			activationSource: "command",
			completed: false,
		});
		expect(activatedAgain).toEqual(activated);
		expect(completed).toEqual({
			active: false,
			activationSource: "command",
			completed: true,
		});
		expect(completedAgain).toEqual(completed);
	});

	it("restores the latest state from branch-local custom entries", () => {
		const restored = restoreGrillSessionState([
			{ type: "custom", customType: GRILL_SESSION_STATE_ENTRY, data: { active: true, activationSource: "plain-text", completed: false } },
			{ type: "message", message: { role: "user", content: "branch divergence" } },
			{ type: "custom", customType: GRILL_SESSION_STATE_ENTRY, data: { active: false, activationSource: "plain-text", completed: true } },
		]);

		expect(restored).toEqual({
			active: false,
			activationSource: "plain-text",
			completed: true,
		});
	});

	it("exports the shared completion contract and a questionnaire-first active-session instruction", () => {
		expect(GRILL_SESSION_COMPLETION_TOOL).toBe("complete_grill_session");
		expect(GRILL_SESSION_COMPLETION_MARKER).toBe("[GRILL SESSION COMPLETE]");

		const instruction = getActiveGrillSessionInstruction();
		expect(instruction).toContain("grill session");
		expect(instruction).toContain("questionnaire");
		expect(instruction).toContain("Prefer the questionnaire tool over plain-text questioning");
		expect(instruction).toContain("current frontier batch");
		expect(instruction).toContain("[GRILL SESSION COMPLETE]");
	});
});
