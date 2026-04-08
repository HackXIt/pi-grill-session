export type GrillActivationSource = "command" | "companion-skill" | "legacy-skill" | "plain-text";

export type GrillActivationMatch =
	| {
			kind: "explicit-skill";
			activationSource: "companion-skill";
			canonicalText: string;
	  }
	| {
			kind: "legacy-skill";
			activationSource: "legacy-skill";
			canonicalText: string;
	  }
	| {
			kind: "strong-plain-text";
			activationSource: "plain-text";
			canonicalText: string;
	  }
	| {
			kind: "ambiguous-plain-text";
			activationSource: "plain-text";
			canonicalText: string;
	  }
	| {
			kind: "none";
	  };

export const SKILL_GRILL_SESSION = "grill-session";
export const SKILL_GRILL_ME = "grill-me";

export function buildCanonicalGrillSkillCommand(text?: string): string {
	const trimmed = text?.trim();
	return trimmed ? `/skill:${SKILL_GRILL_SESSION} ${trimmed}` : `/skill:${SKILL_GRILL_SESSION}`;
}

export function classifyGrillActivationInput(text: string): GrillActivationMatch {
	const trimmed = text.trim();
	if (/^\/skill:grill-session(?:\s|$)/i.test(trimmed)) {
		return {
			kind: "explicit-skill",
			activationSource: "companion-skill",
			canonicalText: trimmed,
		};
	}
	if (/^\/skill:grill-me(?:\s|$)/i.test(trimmed)) {
		return {
			kind: "legacy-skill",
			activationSource: "legacy-skill",
			canonicalText: trimmed.replace(/^\/skill:grill-me/i, `/skill:${SKILL_GRILL_SESSION}`),
		};
	}
	if (/\bgrill me\b/i.test(trimmed) || /\bgrill session\b/i.test(trimmed)) {
		return {
			kind: "strong-plain-text",
			activationSource: "plain-text",
			canonicalText: buildCanonicalGrillSkillCommand(trimmed),
		};
	}
	if (/\bgrill\b/i.test(trimmed)) {
		return {
			kind: "ambiguous-plain-text",
			activationSource: "plain-text",
			canonicalText: buildCanonicalGrillSkillCommand(trimmed),
		};
	}
	return { kind: "none" };
}
