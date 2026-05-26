import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, Key, matchesKey, truncateToWidth, wrapTextWithAnsi, type EditorTheme } from "@earendil-works/pi-tui";
import {
	normalizeQuestionnaireBatch,
	type QuestionnaireBatch,
	type QuestionnaireBatchInput,
	type QuestionnaireQuestion,
	type QuestionnaireResult,
} from "./domain";
import type { PendingQuestionnaireReason } from "./grill-state";
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
import { launchQuestionnaireSideSession } from "./side-session/launcher";
import type { SideSessionRecord } from "./side-session/types";

interface QuestionRow {
	kind: "option" | "notes" | "custom" | "side-session";
	optionId?: string;
}

interface InputState {
	questionId: string;
	field: "notes" | "custom";
}

export interface PendingQuestionnaireOutcome {
	status: "pending";
	batch: QuestionnaireBatch;
	renderedLines: string[];
	contentText: string;
	cancelled: true;
	pendingReason: PendingQuestionnaireReason;
	sideSessionRecords?: Record<string, SideSessionRecord | undefined>;
}

export interface SubmittedQuestionnaireOutcome {
	status: "submitted";
	batch: QuestionnaireBatch;
	result: QuestionnaireResult;
	renderedLines: string[];
	contentText: string;
	cancelled: false;
	sideSessionRecords: Record<string, SideSessionRecord | undefined>;
}

export type QuestionnaireRuntimeOutcome = PendingQuestionnaireOutcome | SubmittedQuestionnaireOutcome;

export type SideSessionImportChoice = "manual" | "import" | "view" | "discard";

export interface QuestionnaireSideSessionController {
	launch(request: {
		batch: QuestionnaireBatch;
		sourceQuestionId: string;
		cwd: string;
		answers: QuestionnaireDraftAnswers;
		parentSessionRef?: string;
	}): Promise<SideSessionRecord>;
	chooseImport?(record: SideSessionRecord): Promise<SideSessionImportChoice>;
	confirmReplace?(record: SideSessionRecord): Promise<boolean>;
}

export interface RunQuestionnaireBatchOptions {
	sideSessions?: Partial<QuestionnaireSideSessionController>;
}

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
	rows.push({ kind: "side-session" });
	return rows;
}

function startInput(editor: Editor, input: InputState, answers: QuestionnaireDraftAnswers) {
	const current = answers[input.questionId];
	const text = input.field === "notes" ? current?.notes ?? "" : current?.customAnswer ?? "";
	editor.setText(text);
}

export function pushWrappedQuestionnaireLine(lines: string[], text: string, width: number) {
	if (!text) {
		lines.push("");
		return;
	}

	lines.push(...wrapTextWithAnsi(text, Math.max(1, width)));
}

export function buildQuestionnaireRecoveryText(reason: PendingQuestionnaireReason): string {
	const prefix =
		reason === "no-ui"
			? "Interactive questionnaire unavailable: no UI is attached."
			: "User cancelled the questionnaire.";
	const reopenHint = reason === "no-ui" ? " when UI is available" : "";
	return `${prefix} Recover with /grill-reopen${reopenHint}, or stop with /grill-end.`;
}

export async function runQuestionnaireBatch(
	params: QuestionnaireBatchInput,
	ctx: Pick<ExtensionContext, "hasUI" | "ui"> & Partial<Pick<ExtensionContext, "cwd" | "sessionManager">>,
	options: RunQuestionnaireBatchOptions = {},
): Promise<QuestionnaireRuntimeOutcome> {
	const batch = normalizeQuestionnaireBatch(params);
	if (!ctx.hasUI) {
		const contentText = buildQuestionnaireRecoveryText("no-ui");
		return {
			status: "pending",
			batch,
			renderedLines: [contentText],
			contentText,
			cancelled: true,
			pendingReason: "no-ui",
		};
	}

	const interaction = await ctx.ui.custom<{
		cancelled: boolean;
		answers: QuestionnaireDraftAnswers;
		sideSessionRecords: Record<string, SideSessionRecord | undefined>;
	}>((tui, theme, _kb, done) => {
		let currentTab = 0;
		let focusIndex = 0;
		let answers: QuestionnaireDraftAnswers = {};
		let sideSessionRecords: Record<string, SideSessionRecord | undefined> = {};
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
			done({ cancelled, answers, sideSessionRecords });
		}

		async function chooseImport(record: SideSessionRecord): Promise<SideSessionImportChoice> {
			if (options.sideSessions?.chooseImport) {
				return options.sideSessions.chooseImport(record);
			}
			const choices = [
				"Return manually",
				...(record.suggestion ? ["Import suggestion"] : []),
				"View record",
				"Discard record",
			];
			const choice = await ctx.ui.select(`Side session returned: ${record.summary} (${record.childSessionRef})`, choices);
			if (choice === "Import suggestion") {
				return "import";
			}
			if (choice === "View record") {
				return "view";
			}
			if (choice === "Discard record") {
				return "discard";
			}
			return "manual";
		}

		async function confirmReplace(record: SideSessionRecord): Promise<boolean> {
			if (options.sideSessions?.confirmReplace) {
				return options.sideSessions.confirmReplace(record);
			}
			return ctx.ui.confirm("Replace side session?", `${record.summary}\n\nThis replaces the current record for this question.`);
		}

		function applySuggestion(record: SideSessionRecord) {
			if (!record.suggestion) {
				return;
			}
			if (record.suggestion.mode === "custom") {
				answers = setQuestionCustomAnswer(batch, answers, record.suggestion.questionId, record.suggestion.customAnswer);
				return;
			}
			answers = selectQuestionOption(batch, answers, record.suggestion.questionId, record.suggestion.selectedOptionId);
			if (record.suggestion.notes) {
				answers = setQuestionNotes(batch, answers, record.suggestion.questionId, record.suggestion.notes);
			}
		}

		async function openSideSession(question: QuestionnaireQuestion) {
			const existingRecord = sideSessionRecords[question.id];
			if (existingRecord && !(await confirmReplace(existingRecord))) {
				refresh();
				return;
			}
			const launcher = options.sideSessions?.launch ?? launchQuestionnaireSideSession;
			const terminalTui = tui as unknown as {
				stop: () => void;
				start: () => void;
				requestRender: (force?: boolean) => void;
			};
			let record: SideSessionRecord;
			terminalTui.stop();
			try {
				record = await launcher({
					batch,
					sourceQuestionId: question.id,
					cwd: ctx.cwd ?? process.cwd(),
					answers,
					parentSessionRef: ctx.sessionManager?.getSessionFile?.(),
				});
			} finally {
				terminalTui.start();
				terminalTui.requestRender(true);
			}
			sideSessionRecords = { ...sideSessionRecords, [question.id]: record };
			const choice = await chooseImport(record);
			if (choice === "import") {
				applySuggestion(record);
			} else if (choice === "discard") {
				sideSessionRecords = { ...sideSessionRecords, [question.id]: undefined };
			} else if (choice === "view") {
				ctx.ui.notify(`${record.summary} (${record.childSessionRef})`, "info");
			}
			clampFocus();
			refresh();
		}

		async function handleQuestionEnter(question: QuestionnaireQuestion) {
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
				return;
			}

			await openSideSession(question);
		}

		async function handleInput(data: string) {
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
					await handleQuestionEnter(question);
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
			const add = (text: string = "") => pushWrappedQuestionnaireLine(lines, text, width);
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

				if (row.kind === "custom") {
					const customSelected = mode === "custom";
					const customPrefix = customSelected ? theme.fg("success", "●") : theme.fg("dim", "○");
					const customValue = answer?.customAnswer?.trim() || "Enter a custom answer";
					add(`${prefix}${customPrefix} Custom answer: ${customValue}`);
					return;
				}

				const record = sideSessionRecords[question.id];
				const label = record ? "Replace side session…" : "Open side session";
				add(`${prefix}${theme.fg("accent", "↗")} ${label}`);
				if (record) {
					add(`    ${theme.fg("muted", `Side session: ${record.summary} (${record.childSessionRef})`)}`);
				}
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
			const add = (text: string = "") => pushWrappedQuestionnaireLine(lines, text, width);
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
			const add = (text: string = "") => pushWrappedQuestionnaireLine(lines, text, width);

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
	});

	if (interaction.cancelled) {
		const contentText = buildQuestionnaireRecoveryText("cancelled");
		return {
			status: "pending",
			batch,
			renderedLines: [contentText],
			contentText,
			cancelled: true,
			pendingReason: "cancelled",
			sideSessionRecords: interaction.sideSessionRecords,
		};
	}

	const submission = buildQuestionnaireSubmission(batch, interaction.answers);
	return {
		status: "submitted",
		batch,
		result: submission.result,
		renderedLines: submission.renderedLines,
		contentText: buildModelVisibleQuestionnaireSubmission(batch, submission.result),
		cancelled: false,
		sideSessionRecords: interaction.sideSessionRecords,
	};
}
