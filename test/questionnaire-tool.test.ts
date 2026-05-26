import { visibleWidth } from "@mariozechner/pi-tui";
import { describe, expect, it, vi } from "vitest";
import { normalizeQuestionnaireBatch } from "../src/domain";
import { runQuestionnaireBatch } from "../src/questionnaire-runtime";
import { registerQuestionnaireTool } from "../src/questionnaire-tool";

function createPiDouble() {
	let tool: any;
	return {
		pi: {
			registerTool(definition: unknown) {
				tool = definition;
			},
		},
		getTool() {
			return tool;
		},
	};
}

describe("questionnaire rendering", () => {
	it("wraps long questionnaire text within the available TUI width", async () => {
		let renderedLines: string[] = [];
		const width = 32;
		const theme = {
			fg: (_name: string, text: string) => text,
			bg: (_name: string, text: string) => text,
		};
		const tui = { requestRender: vi.fn() };

		await runQuestionnaireBatch(
			{
				title: "A long questionnaire title that should wrap instead of overflowing",
				intro: "This introduction is intentionally longer than a narrow terminal row.",
				questions: [
					{
						id: "scope",
						label: "Scope",
						prompt: "Which deliberately verbose option best describes the product scope boundary?",
						options: [
							{
								id: "documented",
								label: "Document the narrow vertical slice and defer broad platform work",
								description: "This description is also long enough to need wrapping in the questionnaire TUI.",
							},
						],
					},
				],
			},
			{
				hasUI: true,
				ui: {
					custom: vi.fn().mockImplementation((build) => {
						const component = build(tui, theme, undefined, vi.fn());
						renderedLines = component.render(width);
						return Promise.resolve({ cancelled: true, answers: {} });
					}),
				},
			} as never,
		);

		expect(renderedLines.some((line) => line.includes("overflowing"))).toBe(true);
		expect(renderedLines.every((line) => visibleWidth(line) <= width)).toBe(true);
	});
});

describe("questionnaire tool recovery", () => {
	it("records no-ui batches as pending and returns recovery instructions", async () => {
		const pendingBatch = normalizeQuestionnaireBatch({
			title: "Recovery batch",
			questions: [
				{
					id: "color",
					label: "Color",
					prompt: "Pick a color",
					options: [
						{ id: "red", label: "Red" },
						{ id: "blue", label: "Blue" },
					],
				},
			],
		});
		const onPendingBatch = vi.fn();
		const onQuestionnaireSubmitted = vi.fn();
		const { pi, getTool } = createPiDouble();

		registerQuestionnaireTool(pi as never, {
			onPendingBatch,
			onQuestionnaireSubmitted,
		});
		const tool = getTool();

		const result = await tool.execute(
			"tool-call-1",
			{
				title: "Recovery batch",
				questions: [
					{
						id: "color",
						label: "Color",
						prompt: "Pick a color",
						options: [
							{ id: "red", label: "Red" },
							{ id: "blue", label: "Blue" },
						],
					},
				],
			},
			undefined,
			undefined,
			{ hasUI: false },
		);

		expect(onPendingBatch).toHaveBeenCalledWith({ batch: pendingBatch, reason: "no-ui" });
		expect(onQuestionnaireSubmitted).not.toHaveBeenCalled();
		expect(result.content).toEqual([
			{
				type: "text",
				text: "Interactive questionnaire unavailable: no UI is attached. Recover with /grill-reopen when UI is available, or stop with /grill-end.",
			},
		]);
		expect(result.details).toMatchObject({
			batch: pendingBatch,
			renderedLines: [
				"Interactive questionnaire unavailable: no UI is attached. Recover with /grill-reopen when UI is available, or stop with /grill-end.",
			],
			cancelled: true,
			pendingReason: "no-ui",
		});
	});

	it("records cancelled batches as pending and clears pending state on submission", async () => {
		const onPendingBatch = vi.fn();
		const onQuestionnaireSubmitted = vi.fn();
		const { pi, getTool } = createPiDouble();

		registerQuestionnaireTool(pi as never, {
			onPendingBatch,
			onQuestionnaireSubmitted,
		});
		const tool = getTool();

		const cancelled = await tool.execute(
			"tool-call-1",
			{
				questions: [
					{
						id: "color",
						label: "Color",
						prompt: "Pick a color",
						options: [
							{ id: "red", label: "Red" },
							{ id: "blue", label: "Blue" },
						],
					},
				],
			},
			undefined,
			undefined,
			{
				hasUI: true,
				ui: {
					custom: vi.fn().mockResolvedValue({ cancelled: true, answers: {} }),
				},
			},
		);

		expect(onPendingBatch).toHaveBeenCalledWith({
			batch: normalizeQuestionnaireBatch({
				questions: [
					{
						id: "color",
						label: "Color",
						prompt: "Pick a color",
						options: [
							{ id: "red", label: "Red" },
							{ id: "blue", label: "Blue" },
						],
					},
				],
			}),
			reason: "cancelled",
		});
		expect(cancelled.content[0].text).toContain("/grill-reopen");
		expect(cancelled.content[0].text).toContain("/grill-end");

		await tool.execute(
			"tool-call-2",
			{
				title: "Recovery batch",
				questions: [
					{
						id: "color",
						label: "Color",
						prompt: "Pick a color",
						options: [
							{ id: "red", label: "Red" },
							{ id: "blue", label: "Blue" },
						],
					},
				],
			},
			undefined,
			undefined,
			{
				hasUI: true,
				ui: {
					custom: vi.fn().mockResolvedValue({
						cancelled: false,
						answers: {
							color: { questionId: "color", selectedOptionId: "red" },
						},
					}),
				},
			},
		);

		expect(onQuestionnaireSubmitted).toHaveBeenCalledWith({
			batch: normalizeQuestionnaireBatch({
				title: "Recovery batch",
				questions: [
					{
						id: "color",
						label: "Color",
						prompt: "Pick a color",
						options: [
							{ id: "red", label: "Red" },
							{ id: "blue", label: "Blue" },
						],
					},
				],
			}),
			result: {
				answers: [
					{
						questionId: "color",
						questionLabel: "Color",
						mode: "option",
						selectedOptionId: "red",
						selectedOptionLabel: "Red",
					},
				],
				summaryLines: ["- Color: selected red — Red"],
			},
		});
	});
});
