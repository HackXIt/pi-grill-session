import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export const COMMAND_GRILL = "grill";
export const COMMAND_GRILL_END = "grill-end";
export const SKILL_GRILL_SESSION = "grill-session";

export default function grillSessionExtension(pi: ExtensionAPI) {
	pi.registerCommand(COMMAND_GRILL, {
		description: "Start or continue an interactive grill session",
		handler: async (_args, ctx) => {
			ctx.ui.notify("grill-session skeleton loaded", "info");
		},
	});

	pi.registerCommand(COMMAND_GRILL_END, {
		description: "End the active grill session",
		handler: async (_args, ctx) => {
			ctx.ui.notify("grill-session skeleton end command not implemented yet", "warning");
		},
	});
}
