import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, Editor, type EditorTheme, Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import {
	normalizeQuestionnaireBatch,
	type QuestionnaireBatch,
	type QuestionnaireQuestion,
	type QuestionnaireResult,
} from "./domain";
import {
	buildModelVisibleQuestionnaireSubmission,
	buildQuestionnaireSubmission,
	canSubmitQuestionnaire,
	getQuestionAnswerMode,
	renderQuestionnaireOptionLabel,
	selectQuestionOption,
	setQuestionCustomAnswer,
	setQuestionNotes,
	type QuestionnaireDraftAnswers,
} from "./questionnaire";

interface QuestionnaireToolDetails {
	batch: QuestionnaireBatch;
	result?: QuestionnaireResult;
	renderedLines: string[];
	cancelled: boolean;
}

interface QuestionRow {
	kind: "option" | "notes" | "custom";
	optionId?: string;
}

interface InputState {
	questionId: string;
	field: "notes" | "custom";
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

function renderQuestionSummary(batch: QuestionnaireBatch, answers: QuestionnaireDraftAnswers): string[] {
	return batch.questions.map((question) => {
		const answer = answers[question.id];
		const mode = getQuestionAnswerMode(answer);
		if (mode === "custom") {
			return `${question.label}: ${answer?.customAnswer?.trim()}`;
		}
		if (mode === "option") {
			const option = question.options.find((item) => item.id === answer?.selectedOptionId);
			const notesSuffix = answer?.notes?.trim() ? ` (notes: ${answer.notes.trim()})` : "";
			return `${question.label}: ${option?.label ?? answer?.selectedOptionId}${notesSuffix}`;
		}
		return `${question.label}: unanswered`;
	});
}

function getQuestionRows(question: QuestionnaireQuestion, answers: QuestionnaireDraftAnswers): QuestionRow[] {
	const rows: QuestionRow[] = question.options.map((option) => ({ kind: "option", optionId: option.id }));
	const answer = answers[question.id];
	if (question.allowNotes && getQuestionAnswerMode(answer) === "option") {
		rows.push({ kind: "notes" });
	}
	if (question.allowCustomAnswer) {
		rows.push({ kind: "custom" });
	}
	return rows;
}

function startInput(editor: Editor, input: InputState, answers: QuestionnaireDraftAnswers) {
	const current = answers[input.questionId];
	const text = input.field === "notes" ? current?.notes ?? "" : current?.customAnswer ?? "";
	editor.setText(text);
}

export function registerQuestionnaireTool(pi: ExtensionAPI) {
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
			const batch = normalizeQuestionnaireBatch(params);
			if (!ctx.hasUI) {
				return {
					content: [{ type: "text", text: "Interactive questionnaire unavailable: no UI is attached." }],
					details: {
						batch,
						renderedLines: ["Interactive questionnaire unavailable: no UI is attached."],
						cancelled: true,
					} satisfies QuestionnaireToolDetails,
				};
			}

			const interaction = await ctx.ui.custom<{ cancelled: boolean; answers: QuestionnaireDraftAnswers }>(
				(tui, theme, _kb, done) => {
					let currentTab = 0;
					let focusIndex = 0;
					let answers: QuestionnaireDraftAnswers = {};
					let input: InputState | null = null;
					let cachedLines: string[] | undefined;

					const editorTheme: EditorTheme = {
						borderColor: (text) => theme.fg("accent", text),
						selectList: {
							selectedPrefix: (text) => theme.fg("accent", text),
							selectedText: (text) => theme.fg("accent", text),
							description: (text) => theme.fg("muted", text),
							scrollInfo: (text) => theme.fg("dim", text),
							noMatch: (text) => theme.fg("warning", text),
						},
					};
					const editor = new Editor(tui, editorTheme);

					function refresh() {
						cachedLines = undefined;
						tui.requestRender();
					}

					function currentQuestion(): QuestionnaireQuestion | undefined {
						return batch.questions[currentTab];
					}

					function currentRows(): QuestionRow[] {
						const question = currentQuestion();
						return question ? getQuestionRows(question, answers) : [];
					}

					function clampFocus() {
						const rows = currentRows();
						focusIndex = rows.length === 0 ? 0 : Math.max(0, Math.min(focusIndex, rows.length - 1));
					}

					editor.onSubmit = (value) => {
						if (!input) {
							return;
						}

						answers =
							input.field === "custom"
								? setQuestionCustomAnswer(batch, answers, input.questionId, value)
								: setQuestionNotes(batch, answers, input.questionId, value);
						input = null;
						editor.setText("");
						clampFocus();
						refresh();
					};

					function moveTab(delta: number) {
						const totalTabs = batch.questions.length + 1;
						currentTab = (currentTab + delta + totalTabs) % totalTabs;
						focusIndex = 0;
						refresh();
					}

					function submit(cancelled: boolean) {
						done({ cancelled, answers });
					}

					function handleQuestionEnter(question: QuestionnaireQuestion) {
						const rows = currentRows();
						const row = rows[focusIndex];
						if (!row) {
							return;
						}

						if (row.kind === "option" && row.optionId) {
							answers = selectQuestionOption(batch, answers, question.id, row.optionId);
							if (question.allowNotes) {
								focusIndex = question.options.length;
							}
							refresh();
							return;
						}

						if (row.kind === "notes") {
							input = { questionId: question.id, field: "notes" };
							startInput(editor, input, answers);
							refresh();
							return;
						}

						if (row.kind === "custom") {
							input = { questionId: question.id, field: "custom" };
							startInput(editor, input, answers);
							refresh();
						}
					}

					function handleInput(data: string) {
						if (input) {
							if (matchesKey(data, Key.escape)) {
								input = null;
								editor.setText("");
								refresh();
								return;
							}
							editor.handleInput(data);
							refresh();
							return;
						}

						if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
							moveTab(1);
							return;
						}
						if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
							moveTab(-1);
							return;
						}

						if (currentTab === batch.questions.length) {
							if (matchesKey(data, Key.enter) && canSubmitQuestionnaire(batch, answers)) {
								submit(false);
								return;
							}
							if (matchesKey(data, Key.escape)) {
								submit(true);
							}
							return;
						}

						const rows = currentRows();
						if (matchesKey(data, Key.up)) {
							focusIndex = rows.length === 0 ? 0 : Math.max(0, focusIndex - 1);
							refresh();
							return;
						}
						if (matchesKey(data, Key.down)) {
							focusIndex = rows.length === 0 ? 0 : Math.min(rows.length - 1, focusIndex + 1);
							refresh();
							return;
						}
						if (matchesKey(data, Key.enter)) {
							const question = currentQuestion();
							if (question) {
								handleQuestionEnter(question);
							}
							return;
						}
						if (matchesKey(data, Key.escape)) {
							submit(true);
						}
					}

					function renderTabBar(width: number, lines: string[]) {
						const tabs: string[] = ["← "];
						for (let index = 0; index < batch.questions.length; index += 1) {
							const question = batch.questions[index];
							const active = index === currentTab;
							const answered = getQuestionAnswerMode(answers[question.id]) !== "unanswered";
							const text = ` ${answered ? "■" : "□"} ${question.label} `;
							tabs.push(
								active
									? theme.bg("selectedBg", theme.fg("text", text)) + " "
									: theme.fg(answered ? "success" : "muted", text) + " ",
							);
						}
						const ready = canSubmitQuestionnaire(batch, answers);
						const submitText = " ✓ Submit ";
						tabs.push(
							(currentTab === batch.questions.length
								? theme.bg("selectedBg", theme.fg("text", submitText))
								: theme.fg(ready ? "success" : "dim", submitText)) + " →",
						);
						lines.push(truncateToWidth(` ${tabs.join("")}`, width));
					}

					function renderQuestionView(width: number, lines: string[], question: QuestionnaireQuestion) {
						const add = (text: string = "") => lines.push(truncateToWidth(text, width));
						const answer = answers[question.id];
						const mode = getQuestionAnswerMode(answer);
						const rows = currentRows();

						add(theme.fg("accent", `${question.label}`));
						add(theme.fg("text", ` ${question.prompt}`));
						add();

						rows.forEach((row, index) => {
							const focused = index === focusIndex;
							const prefix = focused ? theme.fg("accent", "> ") : "  ";
							if (row.kind === "option" && row.optionId) {
								const option = question.options.find((item) => item.id === row.optionId);
								if (!option) {
									return;
								}
								const selected = mode === "option" && answer?.selectedOptionId === option.id;
								const marker = selected ? theme.fg("success", "●") : theme.fg("dim", "○");
								add(`${prefix}${marker} ${renderQuestionnaireOptionLabel(option)}`);
								if (option.description) {
									add(`    ${theme.fg("muted", option.description)}`);
								}
								return;
							}

							if (row.kind === "notes") {
								const notes = answer?.notes?.trim() ? answer.notes.trim() : "Optional notes";
								add(`${prefix}${theme.fg("accent", "✎")} Notes: ${notes}`);
								return;
							}

							const customSelected = mode === "custom";
							const customPrefix = customSelected ? theme.fg("success", "●") : theme.fg("dim", "○");
							const customValue = answer?.customAnswer?.trim() || "Enter a custom answer";
							add(`${prefix}${customPrefix} Custom answer: ${customValue}`);
						});

						if (input) {
							add();
							add(theme.fg("muted", input.field === "notes" ? " Edit notes:" : " Edit custom answer:"));
							for (const line of editor.render(Math.max(1, width - 2))) {
								add(` ${line}`);
							}
							add();
							add(theme.fg("dim", " Enter saves • Esc cancels"));
						} else {
							add();
							if (mode === "custom") {
								add(theme.fg("muted", " Custom-answer mode is active; choosing an option will replace it."));
							} else if (mode === "option" && question.allowNotes) {
								add(theme.fg("muted", " Option mode is active; notes can be edited on this same tab."));
							} else {
								add(theme.fg("muted", " Choose an option or open the custom answer field."));
							}
						}
					}

					function renderSubmitView(width: number, lines: string[]) {
						const add = (text: string = "") => lines.push(truncateToWidth(text, width));
						add(theme.fg("accent", "Ready to submit"));
						add();
						for (const line of renderQuestionSummary(batch, answers)) {
							add(` ${line}`);
						}
						add();
						if (canSubmitQuestionnaire(batch, answers)) {
							add(theme.fg("success", " Press Enter to submit this batch"));
						} else {
							const missing = batch.questions
								.filter((question) => getQuestionAnswerMode(answers[question.id]) === "unanswered")
								.map((question) => question.label)
								.join(", ");
							add(theme.fg("warning", ` Unanswered: ${missing}`));
						}
					}

					function render(width: number): string[] {
						if (cachedLines) {
							return cachedLines;
						}

						const lines: string[] = [];
						const add = (text: string = "") => lines.push(truncateToWidth(text, width));

						add(theme.fg("accent", "─".repeat(width)));
						if (batch.title) {
							add(theme.fg("accent", ` ${batch.title}`));
						}
						if (batch.intro) {
							add(theme.fg("muted", ` ${batch.intro}`));
						}
						if (batch.title || batch.intro) {
							add();
						}

						renderTabBar(width, lines);
						add();

						if (currentTab === batch.questions.length) {
							renderSubmitView(width, lines);
						} else {
							const question = currentQuestion();
							if (question) {
								renderQuestionView(width, lines, question);
							}
						}

						add();
						if (!input) {
							add(theme.fg("dim", " Tab/←→ navigate • ↑↓ select • Enter confirm/edit • Esc cancel"));
						}
						add(theme.fg("accent", "─".repeat(width)));
						cachedLines = lines;
						return lines;
					}

					return {
						render,
						invalidate: () => {
							cachedLines = undefined;
						},
						handleInput,
					};
				},
			);

			if (interaction.cancelled) {
				return {
					content: [{ type: "text", text: "User cancelled the questionnaire." }],
					details: {
						batch,
						renderedLines: ["User cancelled the questionnaire."],
						cancelled: true,
					} satisfies QuestionnaireToolDetails,
				};
			}

			const submission = buildQuestionnaireSubmission(batch, interaction.answers);
			return {
				content: [{ type: "text", text: buildModelVisibleQuestionnaireSubmission(batch, submission.result) }],
				details: {
					batch,
					result: submission.result,
					renderedLines: submission.renderedLines,
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
