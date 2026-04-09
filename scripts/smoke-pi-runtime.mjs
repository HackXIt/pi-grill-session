import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const piCliPath = resolve(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "pi.cmd" : "pi");
const systemPrompt =
	"Call the questionnaire tool immediately. Do not use any other tools. Do not read files. Do not ask follow-up questions before calling the questionnaire tool.";
const prompt =
	"Use the questionnaire tool right now to ask one question with two options: red and blue. Then tell me what happened.";

const result = spawnSync(
	piCliPath,
	[
		"--offline",
		"--extension",
		"./src/index.ts",
		"--no-tools",
		"--no-skills",
		"--append-system-prompt",
		systemPrompt,
		"--mode",
		"json",
		"--print",
		"--no-session",
		"/grill",
		prompt,
	],
	{
		cwd: repoRoot,
		encoding: "utf8",
		env: {
			...process.env,
			PI_OFFLINE: "1",
		},
	},
);

if (result.status !== 0) {
	console.error("pi smoke failed: local pi exited non-zero.");
	if (result.stdout) {
		console.error(result.stdout);
	}
	if (result.stderr) {
		console.error(result.stderr);
	}
	process.exit(result.status ?? 1);
}

let questionnaireToolCalled = false;
let noUiFallbackObserved = false;

for (const line of result.stdout.split(/\r?\n/)) {
	if (!line.trim()) {
		continue;
	}

	let event;
	try {
		event = JSON.parse(line);
	} catch {
		continue;
	}

	if (event.type !== "agent_end" || !Array.isArray(event.messages)) {
		continue;
	}

	for (const message of event.messages) {
		if (message?.role !== "toolResult" || message.toolName !== "questionnaire") {
			continue;
		}

		questionnaireToolCalled = true;
		const text = Array.isArray(message.content)
			? message.content
					.filter((item) => item?.type === "text" && typeof item.text === "string")
					.map((item) => item.text)
					.join("\n")
			: "";
		if (text.includes("Interactive questionnaire unavailable: no UI is attached.")) {
			noUiFallbackObserved = true;
		}
	}
}

if (!questionnaireToolCalled) {
	console.error("pi smoke failed: questionnaire tool was not called.");
	console.error(result.stdout);
	process.exit(1);
}

if (!noUiFallbackObserved) {
	console.error("pi smoke failed: questionnaire tool loaded, but the expected no-UI fallback was not observed.");
	console.error(result.stdout);
	process.exit(1);
}

console.log("pi smoke passed: questionnaire tool loaded and returned the expected no-UI fallback.");
