export function isQuestionnaireSideSessionEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
	return Boolean(env.GRILL_SIDE_RETURN_PATH && env.GRILL_SIDE_SOURCE_QUESTION_ID);
}

export function getMissingSideSessionEnvironment(env: NodeJS.ProcessEnv = process.env): string[] {
	return ["GRILL_SIDE_RETURN_PATH", "GRILL_SIDE_SOURCE_QUESTION_ID"].filter((name) => !env[name]);
}
