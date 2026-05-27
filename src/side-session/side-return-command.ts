import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Editor, Key, matchesKey, wrapTextWithAnsi, type EditorTheme } from "@earendil-works/pi-tui";
import { writeSideSessionReturnSuggestion, type SideReturnInput } from "./side-return-writer";

export const COMMAND_GRILL_SIDE_RETURN = "grill-side-return";

type Field = "summary" | "selectedOptionId" | "customAnswer" | "notes";
type Row = { kind: "mode"; mode: "option" | "custom" } | { kind: "field"; field: Field } | { kind: "submit" };

interface SideReturnDraft {
	mode: "option" | "custom";
	summary: string;
	selectedOptionId: string;
	customAnswer: string;
	notes: string;
}

function rowsFor(draft: SideReturnDraft): Row[] {
	return [
		{ kind: "mode", mode: "option" },
		{ kind: "mode", mode: "custom" },
		{ kind: "field", field: "summary" },
		{ kind: "field", field: draft.mode === "option" ? "selectedOptionId" : "customAnswer" },
		...(draft.mode === "option" ? ([{ kind: "field", field: "notes" }] as Row[]) : []),
		{ kind: "submit" },
	];
}

function fieldLabel(field: Field): string {
	return {
		summary: "Summary",
		selectedOptionId: "Selected option id",
		customAnswer: "Custom answer",
		notes: "Notes",
	}[field];
}

function fieldValue(draft: SideReturnDraft, field: Field): string {
	return draft[field];
}

function setFieldValue(draft: SideReturnDraft, field: Field, value: string): SideReturnDraft {
	return { ...draft, [field]: value };
}

function canSubmit(draft: SideReturnDraft): boolean {
	return Boolean(
		draft.summary.trim() &&
			(draft.mode === "option" ? draft.selectedOptionId.trim() : draft.customAnswer.trim()),
	);
}

function draftToInput(draft: SideReturnDraft): SideReturnInput {
	return draft.mode === "option"
		? {
				summary: draft.summary,
				answer: {
					mode: "option",
					selectedOptionId: draft.selectedOptionId,
					...(draft.notes.trim() ? { notes: draft.notes } : {}),
				},
			}
		: { summary: draft.summary, answer: { mode: "custom", customAnswer: draft.customAnswer } };
}

async function collectSideReturnInput(ctx: ExtensionCommandContext): Promise<SideReturnInput | undefined> {
	if (!ctx.hasUI) {
		throw new Error("/grill-side-return interactive UI requires an attached UI");
	}
	const outcome = await ctx.ui.custom<{ cancelled: boolean; draft: SideReturnDraft }>((tui, theme, _kb, done) => {
		let draft: SideReturnDraft = { mode: "option", summary: "", selectedOptionId: "", customAnswer: "", notes: "" };
		let focusIndex = 0;
		let inputField: Field | undefined;
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

		function clampFocus() {
			focusIndex = Math.min(focusIndex, rowsFor(draft).length - 1);
		}

		editor.onSubmit = (value) => {
			if (!inputField) return;
			draft = setFieldValue(draft, inputField, value);
			inputField = undefined;
			editor.setText("");
			refresh();
		};

		async function handleInput(data: string) {
			if (inputField) {
				if (matchesKey(data, Key.escape)) {
					inputField = undefined;
					editor.setText("");
					refresh();
					return;
				}
				editor.handleInput(data);
				refresh();
				return;
			}
			const rows = rowsFor(draft);
			if (matchesKey(data, Key.up)) {
				focusIndex = Math.max(0, focusIndex - 1);
				refresh();
				return;
			}
			if (matchesKey(data, Key.down)) {
				focusIndex = Math.min(rows.length - 1, focusIndex + 1);
				refresh();
				return;
			}
			if (matchesKey(data, Key.escape)) {
				done({ cancelled: true, draft });
				return;
			}
			if (!matchesKey(data, Key.enter)) return;
			const row = rows[focusIndex];
			if (row.kind === "mode") {
				draft = { ...draft, mode: row.mode };
				clampFocus();
				refresh();
				return;
			}
			if (row.kind === "field") {
				inputField = row.field;
				editor.setText(fieldValue(draft, row.field));
				refresh();
				return;
			}
			if (canSubmit(draft)) {
				done({ cancelled: false, draft });
			}
		}

		function render(width: number): string[] {
			if (cachedLines) return cachedLines;
			const lines: string[] = [];
			const add = (text = "") => lines.push(...wrapTextWithAnsi(text, Math.max(1, width)));
			add(theme.fg("accent", "Return side-session answer"));
			add(theme.fg("muted", "Write a suggestion to the parent questionnaire and close this side session."));
			add();
			rowsFor(draft).forEach((row, index) => {
				const prefix = index === focusIndex ? theme.fg("accent", "> ") : "  ";
				if (row.kind === "mode") {
					add(`${prefix}${draft.mode === row.mode ? theme.fg("success", "●") : theme.fg("dim", "○")} ${row.mode === "option" ? "Selected option" : "Custom answer"}`);
					return;
				}
				if (row.kind === "field") {
					const value = fieldValue(draft, row.field).trim() || "Enter value";
					add(`${prefix}${theme.fg("accent", "✎")} ${fieldLabel(row.field)}: ${value}`);
					return;
				}
				add(`${prefix}${canSubmit(draft) ? theme.fg("success", "✓ Submit and return") : theme.fg("dim", "✓ Submit and return")}`);
			});
			if (inputField) {
				add();
				add(theme.fg("muted", ` Edit ${fieldLabel(inputField)}:`));
				for (const line of editor.render(Math.max(1, width - 2))) add(` ${line}`);
				add(theme.fg("dim", " Enter saves • Esc cancels"));
			} else {
				add();
				add(theme.fg("dim", "↑↓ select • Enter edit/confirm • Esc cancel"));
			}
			cachedLines = lines;
			return lines;
		}

		return { render, invalidate: () => (cachedLines = undefined), handleInput };
	});
	return outcome.cancelled ? undefined : draftToInput(outcome.draft);
}

export function registerGrillSideReturnCommand(pi: Pick<ExtensionAPI, "registerCommand">) {
	pi.registerCommand(COMMAND_GRILL_SIDE_RETURN, {
		description: "Interactively return a questionnaire side-session answer suggestion.",
		handler: async (args, ctx) => {
			if (args.trim()) {
				throw new Error("/grill-side-return is interactive. Run it without arguments and fill in the form.");
			}
			const input = await collectSideReturnInput(ctx);
			if (!input) {
				ctx.ui.notify("Side-session return cancelled", "info");
				return;
			}
			await writeSideSessionReturnSuggestion(input, ctx);
		},
	});
}
