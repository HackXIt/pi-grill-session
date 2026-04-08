import { describe, expect, it } from "vitest";
import { buildCanonicalGrillSkillCommand, classifyGrillActivationInput } from "../src/activation";

describe("grill activation input classification", () => {
	it("classifies a strong plain-text grill request and rewrites it to the canonical skill command", () => {
		expect(classifyGrillActivationInput("grill me on this design")).toEqual({
			kind: "strong-plain-text",
			activationSource: "plain-text",
			canonicalText: "/skill:grill-session grill me on this design",
		});
	});

	it("detects explicit canonical and legacy skill activations", () => {
		expect(classifyGrillActivationInput("/skill:grill-session continue from here")).toEqual({
			kind: "explicit-skill",
			activationSource: "companion-skill",
			canonicalText: "/skill:grill-session continue from here",
		});
		expect(classifyGrillActivationInput("/skill:grill-me keep going")).toEqual({
			kind: "legacy-skill",
			activationSource: "legacy-skill",
			canonicalText: "/skill:grill-session keep going",
		});
	});

	it("treats loose grill mentions as ambiguous and unrelated text as none", () => {
		expect(classifyGrillActivationInput("should we grill this further?")).toEqual({
			kind: "ambiguous-plain-text",
			activationSource: "plain-text",
			canonicalText: "/skill:grill-session should we grill this further?",
		});
		expect(classifyGrillActivationInput("hello there")).toEqual({ kind: "none" });
	});

	it("builds the canonical companion skill command with or without arguments", () => {
		expect(buildCanonicalGrillSkillCommand()).toBe("/skill:grill-session");
		expect(buildCanonicalGrillSkillCommand("compare A vs B")).toBe("/skill:grill-session compare A vs B");
	});
});
