import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { normalizeQuestionnaireBatch } from "../src/domain";
import { launchQuestionnaireSideSession, type SideSessionRunner } from "../src/side-session/launcher";

const batch = normalizeQuestionnaireBatch({
	questions: [
		{
			id: "scope",
			label: "Scope",
			prompt: "What should v1 include?",
			allowNotes: true,
			options: [{ id: "minimal", label: "Minimal" }],
		},
	],
});

describe("side-session launcher", () => {
	it("calls the injected runner with command pi, cwd, env, and prompt", async () => {
		const runner = vi.fn<SideSessionRunner>().mockResolvedValue({ exitCode: 0, signal: null });
		const dir = await mkdtemp(join(tmpdir(), "grill-side-launcher-"));
		try {
			await launchQuestionnaireSideSession({
				batch,
				sourceQuestionId: "scope",
				cwd: "/repo/project",
				runner,
				sidecarReturnPath: join(dir, "return.json"),
			});

			expect(runner).toHaveBeenCalledWith(
				expect.objectContaining({
					command: "pi",
					cwd: "/repo/project",
					env: expect.objectContaining({
						GRILL_SIDE_SOURCE_QUESTION_ID: "scope",
						GRILL_SIDE_PARENT_CWD: "/repo/project",
					}),
					prompt: expect.stringContaining("What should v1 include?"),
				}),
			);
			expect(runner.mock.calls[0][0].env.GRILL_SIDE_RETURN_PATH).toContain("return.json");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("reads the sidecar after child exit and returns a suggestion", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-launcher-"));
		const sidecarReturnPath = join(dir, "return.json");
		const runner = vi.fn<SideSessionRunner>().mockImplementation(async () => {
			await writeFile(
				sidecarReturnPath,
				JSON.stringify({
					sourceQuestionId: "scope",
					summary: "Picked minimal.",
					childSessionRef: "child-ref",
					answer: { mode: "option", questionId: "scope", selectedOptionId: "minimal", notes: "Smallest slice" },
				}),
			);
			return { exitCode: 0, signal: null };
		});
		try {
			await expect(
				launchQuestionnaireSideSession({ batch, sourceQuestionId: "scope", cwd: "/repo/project", runner, sidecarReturnPath }),
			).resolves.toMatchObject({
				summary: "Picked minimal.",
				childSessionRef: "child-ref",
				suggestion: { mode: "option", selectedOptionId: "minimal", notes: "Smallest slice" },
				exitCode: 0,
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("returns a manual record when no sidecar exists", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-launcher-"));
		try {
			await expect(
				launchQuestionnaireSideSession({
					batch,
					sourceQuestionId: "scope",
					cwd: "/repo/project",
					runner: vi.fn().mockResolvedValue({ exitCode: 0, signal: null }),
					sidecarReturnPath: join(dir, "missing.json"),
				}),
			).resolves.toMatchObject({
				sourceQuestionId: "scope",
				summary: "Side session returned without an import suggestion.",
				childSessionRef: "child-pi-session",
				exitCode: 0,
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("captures non-zero exit status while still returning a sidecar suggestion", async () => {
		const dir = await mkdtemp(join(tmpdir(), "grill-side-launcher-"));
		const sidecarReturnPath = join(dir, "return.json");
		const runner = vi.fn<SideSessionRunner>().mockImplementation(async () => {
			await writeFile(
				sidecarReturnPath,
				JSON.stringify({
					sourceQuestionId: "scope",
					summary: "Exited after writing.",
					childSessionRef: "child-ref",
					answer: { mode: "option", questionId: "scope", selectedOptionId: "minimal" },
				}),
			);
			return { exitCode: 7, signal: null };
		});
		try {
			await expect(
				launchQuestionnaireSideSession({ batch, sourceQuestionId: "scope", cwd: "/repo/project", runner, sidecarReturnPath }),
			).resolves.toMatchObject({ exitCode: 7, suggestion: { selectedOptionId: "minimal" } });
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
