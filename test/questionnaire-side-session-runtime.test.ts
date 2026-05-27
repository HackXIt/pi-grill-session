import { describe, expect, it, vi } from "vitest";
import { runQuestionnaireBatch } from "../src/questionnaire-runtime";
import type { SideSessionRecord } from "../src/side-session/types";

const DOWN = "\u001b[B";
const ENTER = "\r";

const theme = {
	fg: (_name: string, text: string) => text,
	bg: (_name: string, text: string) => text,
};
function createTui() {
	return { requestRender: vi.fn(), stop: vi.fn(), start: vi.fn() };
}
const tui = createTui();

function record(overrides: Partial<SideSessionRecord> = {}): SideSessionRecord {
	return {
		id: "side-1",
		sourceQuestionId: "scope",
		summary: "Compared options.",
		childSessionRef: "child-ref",
		createdAt: "2026-05-27T00:00:00.000Z",
		...overrides,
	};
}

const batchInput = {
	title: "Side sessions",
	questions: [
		{
			id: "scope",
			label: "Scope",
			prompt: "Pick scope",
			allowNotes: true,
			allowCustomAnswer: false,
			options: [{ id: "minimal", label: "Minimal" }],
		},
	],
};

describe("questionnaire side-session runtime", () => {
	it("renders a Side Session Action only in interactive questionnaires", async () => {
		let renderedLines: string[] = [];
		await runQuestionnaireBatch(batchInput, {
			hasUI: true,
			ui: {
				custom: vi.fn().mockImplementation((build) => {
					const component = build(tui, theme, undefined, vi.fn());
					renderedLines = component.render(80);
					return Promise.resolve({ cancelled: true, answers: {}, sideSessionRecords: {} });
				}),
			},
		} as never);

		expect(renderedLines.join("\n")).toContain("Open side session");
	});

	it("leaves no-UI recovery unchanged and does not call the launcher", async () => {
		const launch = vi.fn();
		const outcome = await runQuestionnaireBatch(batchInput, { hasUI: false } as never, {
			sideSessions: { launch },
		});

		expect(launch).not.toHaveBeenCalled();
		expect(outcome).toMatchObject({
			status: "pending",
			contentText:
				"Interactive questionnaire unavailable: no UI is attached. Recover with /grill-reopen when UI is available, or stop with /grill-end.",
		});
	});

	it("opens a side session with current question and keeps manual return as a record without selecting an answer", async () => {
		const launch = vi.fn().mockResolvedValue(record());
		const chooseImport = vi.fn().mockResolvedValue("manual");
		let component: any;
		await runQuestionnaireBatch(batchInput, {
			hasUI: true,
			cwd: "/repo/project",
			ui: {
				custom: vi.fn().mockImplementation((build) => {
					component = build(tui, theme, undefined, vi.fn());
					return Promise.resolve({ cancelled: true, answers: {}, sideSessionRecords: {} });
				}),
			},
		} as never, { sideSessions: { launch, chooseImport } });

		await component.handleInput(DOWN);
		await component.handleInput(ENTER);

		expect(launch).toHaveBeenCalledWith(expect.objectContaining({ sourceQuestionId: "scope", cwd: "/repo/project" }));
		expect(chooseImport).toHaveBeenCalledWith(record());
		expect(component.render(80).join("\n")).toContain("Side session: Compared options. (child-ref)");
		expect(component.render(80).join("\n")).toContain("○ Minimal");
	});

	it("suspends the questionnaire TUI while the side session owns the terminal", async () => {
		const localTui = createTui();
		const launch = vi.fn().mockResolvedValue(record());
		let component: any;
		await runQuestionnaireBatch(batchInput, {
			hasUI: true,
			cwd: "/repo/project",
			ui: {
				custom: vi.fn().mockImplementation((build) => {
					component = build(localTui, theme, undefined, vi.fn());
					return Promise.resolve({ cancelled: true, answers: {}, sideSessionRecords: {} });
				}),
			},
		} as never, { sideSessions: { launch, chooseImport: vi.fn().mockResolvedValue("manual") } });

		await component.handleInput(DOWN);
		await component.handleInput(ENTER);

		expect(localTui.stop.mock.invocationCallOrder[0]).toBeLessThan(launch.mock.invocationCallOrder[0]);
		expect(localTui.start.mock.invocationCallOrder[0]).toBeGreaterThan(launch.mock.invocationCallOrder[0]);
		expect(localTui.requestRender).toHaveBeenCalledWith(true);
	});

	it("shows a side-session error and stays on the same question when launch rejects", async () => {
		const localTui = createTui();
		const notify = vi.fn();
		const launch = vi.fn().mockRejectedValue(new Error("Side-session return sidecar must include childSessionRef"));
		let component: any;
		await runQuestionnaireBatch(batchInput, {
			hasUI: true,
			cwd: "/repo/project",
			ui: {
				notify,
				custom: vi.fn().mockImplementation((build) => {
					component = build(localTui, theme, undefined, vi.fn());
					return Promise.resolve({ cancelled: true, answers: {}, sideSessionRecords: {} });
				}),
			},
		} as never, { sideSessions: { launch, chooseImport: vi.fn().mockResolvedValue("manual") } });

		await component.handleInput(DOWN);
		await expect(component.handleInput(ENTER)).resolves.toBeUndefined();

		expect(localTui.start).toHaveBeenCalled();
		expect(localTui.requestRender).toHaveBeenCalledWith(true);
		expect(notify).toHaveBeenCalledWith(
			"Side session failed: Side-session return sidecar must include childSessionRef",
			"error",
		);
		expect(component.render(80).join("\n")).toContain("Open side session");
		expect(component.render(80).join("\n")).not.toContain("Side session:");
	});

	it("imports an option suggestion into the draft but does not submit the batch", async () => {
		const done = vi.fn();
		let component: any;
		const sideRecord = record({
			suggestion: { mode: "option", questionId: "scope", selectedOptionId: "minimal", notes: "Keep it small." },
		});
		await runQuestionnaireBatch(batchInput, {
			hasUI: true,
			cwd: "/repo/project",
			ui: {
				custom: vi.fn().mockImplementation((build) => {
					component = build(tui, theme, undefined, done);
					return Promise.resolve({ cancelled: true, answers: {}, sideSessionRecords: {} });
				}),
			},
		} as never, { sideSessions: { launch: vi.fn().mockResolvedValue(sideRecord), chooseImport: vi.fn().mockResolvedValue("import") } });

		await component.handleInput(DOWN);
		await component.handleInput(ENTER);

		const rendered = component.render(80).join("\n");
		expect(rendered).toContain("● Minimal");
		expect(rendered).toContain("Notes: Keep it small.");
		expect(done).not.toHaveBeenCalled();
	});

	it("handles the default import choice inside the questionnaire UI after a side session returns", async () => {
		const done = vi.fn();
		let component: any;
		const sideRecord = record({
			suggestion: { mode: "option", questionId: "scope", selectedOptionId: "minimal", notes: "Keep it small." },
		});
		await runQuestionnaireBatch(batchInput, {
			hasUI: true,
			cwd: "/repo/project",
			ui: {
				custom: vi.fn().mockImplementation((build) => {
					component = build(tui, theme, undefined, done);
					return Promise.resolve({ cancelled: true, answers: {}, sideSessionRecords: {} });
				}),
				select: vi.fn(() => {
					throw new Error("nested select should not be used from the questionnaire component");
				}),
			},
		} as never, { sideSessions: { launch: vi.fn().mockResolvedValue(sideRecord) } });

		await component.handleInput(DOWN);
		await component.handleInput(ENTER);
		expect(component.render(80).join("\n")).toContain("Import suggestion");

		await component.handleInput(DOWN);
		await component.handleInput(ENTER);

		const rendered = component.render(80).join("\n");
		expect(rendered).toContain("● Minimal");
		expect(rendered).toContain("Notes: Keep it small.");
		expect(done).not.toHaveBeenCalled();
	});

	it("asks for confirmation before replacing an existing side-session record", async () => {
		let component: any;
		const launch = vi.fn().mockResolvedValue(record({ id: "side-2", summary: "Replacement." }));
		const confirmReplace = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		await runQuestionnaireBatch(batchInput, {
			hasUI: true,
			cwd: "/repo/project",
			ui: {
				custom: vi.fn().mockImplementation((build) => {
					component = build(tui, theme, undefined, vi.fn());
					return Promise.resolve({ cancelled: true, answers: {}, sideSessionRecords: {} });
				}),
			},
		} as never, {
			sideSessions: {
				launch: vi.fn().mockResolvedValueOnce(record()).mockImplementation(launch),
				chooseImport: vi.fn().mockResolvedValue("manual"),
				confirmReplace,
			},
		});

		await component.handleInput(DOWN);
		await component.handleInput(ENTER);
		await component.handleInput(ENTER);
		expect(confirmReplace).toHaveBeenCalledTimes(1);
		expect(launch).not.toHaveBeenCalled();
		expect(component.render(80).join("\n")).toContain("Compared options.");

		await component.handleInput(ENTER);
		expect(launch).toHaveBeenCalledTimes(1);
		expect(component.render(80).join("\n")).toContain("Replacement.");
	});
});
