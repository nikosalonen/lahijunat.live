export const MAX_RECORDS = 300;
export const MAX_TRAINS = 40;
export const MAX_PER_ENDPOINT = 20;
export const MAX_BODY_CHARS = 1000;
/** Covers the app's own polling lag when deciding what counts as already seen. */
export const BASELINE_GRACE_MS = 2 * 60_000;

type Env = Record<string, string | undefined>;

/** Alerts are on by default. Only the string "false" turns them off. */
export function alertsEnabled(env: Env = process.env): boolean {
	return env.PUBLIC_PUSH_ALERTS_ENABLED !== "false";
}

export function siteUrl(env: Env = process.env): string {
	return env.URL ?? "https://www.lahijunat.live";
}
