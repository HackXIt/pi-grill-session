import { describe, expect, it } from "vitest";
import extension from "../src/index";

describe("extension skeleton", () => {
	it("registers the grill commands", () => {
		const commands: string[] = [];
		const pi = {
			registerCommand(name: string) {
				commands.push(name);
			},
		} as { registerCommand(name: string, options: unknown): void };

		extension(pi as never);

		expect(commands).toEqual(["grill", "grill-end"]);
	});
});
