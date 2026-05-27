import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import type { QuestionnaireBatch } from "../domain";
import type { QuestionnaireDraftAnswers } from "../questionnaire";
import { buildSideSessionContextPackage, buildSideSessionPrompt } from "./context-package";
import { parseSideSessionReturnSidecar } from "./return-suggestion";
import type { SideSessionRecord } from "./types";

export interface SideSessionRunnerRequest {
	command: "pi";
	cwd: string;
	env: NodeJS.ProcessEnv;
	prompt: string;
}

export interface SideSessionRunnerResult {
	exitCode: number | null;
	signal: string | null;
}

export type SideSessionRunner = (request: SideSessionRunnerRequest) => Promise<SideSessionRunnerResult>;

export interface LaunchQuestionnaireSideSessionParams {
	batch: QuestionnaireBatch;
	sourceQuestionId: string;
	cwd: string;
	answers?: QuestionnaireDraftAnswers;
	parentSessionRef?: string;
	runner?: SideSessionRunner;
	sidecarReturnPath?: string;
	createdAt?: string;
}

export const defaultSideSessionRunner: SideSessionRunner = ({ command, cwd, env, prompt }) => {
	return new Promise((resolve, reject) => {
		const child = spawn(command, [prompt], {
			cwd,
			env,
			stdio: "inherit",
		});
		child.on("error", reject);
		child.on("exit", (exitCode, signal) => resolve({ exitCode, signal }));
	});
};

async function createSidecarPath(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "grill-side-session-"));
	await mkdir(dir, { recursive: true });
	return join(dir, "return.json");
}

function manualRecord(params: {
	sourceQuestionId: string;
	createdAt?: string;
	exitCode: number | null;
	signal: string | null;
}): SideSessionRecord {
	return {
		id: `side-session-${params.sourceQuestionId}-${Date.now()}`,
		sourceQuestionId: params.sourceQuestionId,
		summary: "Side session returned without an import suggestion.",
		childSessionRef: "child-pi-session",
		createdAt: params.createdAt ?? new Date().toISOString(),
		exitCode: params.exitCode,
		signal: params.signal,
	};
}

export async function launchQuestionnaireSideSession({
	batch,
	sourceQuestionId,
	cwd,
	answers,
	parentSessionRef,
	runner = defaultSideSessionRunner,
	sidecarReturnPath,
	createdAt,
}: LaunchQuestionnaireSideSessionParams): Promise<SideSessionRecord> {
	const returnPath = sidecarReturnPath ?? (await createSidecarPath());
	const contextPackage = buildSideSessionContextPackage({
		batch,
		sourceQuestionId,
		sidecarReturnPath: returnPath,
		answers,
		parentCwd: cwd,
		parentSessionRef,
	});
	const contextPath = join(dirname(returnPath), "context.json");
	await writeFile(contextPath, JSON.stringify(contextPackage, null, 2), "utf8");
	const prompt = buildSideSessionPrompt(contextPackage);
	const result = await runner({
		command: "pi",
		cwd,
		prompt,
		env: {
			...process.env,
			GRILL_SIDE_RETURN_PATH: returnPath,
			GRILL_SIDE_CONTEXT_PATH: contextPath,
			GRILL_SIDE_SOURCE_QUESTION_ID: sourceQuestionId,
			GRILL_SIDE_PARENT_CWD: cwd,
		},
	});

	const record = await parseSideSessionReturnSidecar({
		path: returnPath,
		batch,
		sourceQuestionId,
		createdAt,
		exitCode: result.exitCode,
		signal: result.signal,
	});
	return record ?? manualRecord({ sourceQuestionId, createdAt, exitCode: result.exitCode, signal: result.signal });
}
