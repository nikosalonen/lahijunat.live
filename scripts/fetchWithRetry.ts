/**
 * fetch() with retries for the maintenance scripts.
 *
 * Digitraffic occasionally answers a single request from a shared CI runner
 * with 403, and a one-off block should not fail a scheduled job. Retries cover
 * network errors and the statuses below; anything else is returned as-is so
 * callers still see a real 404 or 400 immediately.
 *
 * Delays grow threefold per attempt: with the defaults that is 5s, 15s, 45s.
 */

const RETRYABLE_STATUSES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

export interface RetryOptions {
	/** Total attempts, including the first one. */
	attempts?: number;
	/** Delay before the first retry. Each later retry waits three times longer. */
	baseDelayMs?: number;
	fetchImpl?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
	log?: (message: string) => void;
}

function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
	url: string,
	init: RequestInit = {},
	options: RetryOptions = {},
): Promise<Response> {
	const attempts = options.attempts ?? 4;
	const baseDelayMs = options.baseDelayMs ?? 5000;
	const fetchImpl = options.fetchImpl ?? fetch;
	const sleep = options.sleep ?? defaultSleep;
	const log = options.log ?? console.warn;

	let delayMs = baseDelayMs;
	for (let attempt = 1; ; attempt++) {
		const isLastAttempt = attempt >= attempts;
		let failure: string;

		try {
			const response = await fetchImpl(url, init);
			if (response.ok || !RETRYABLE_STATUSES.has(response.status)) {
				return response;
			}
			if (isLastAttempt) return response;
			failure = `HTTP ${response.status}`;
		} catch (error) {
			if (isLastAttempt) throw error;
			failure = error instanceof Error ? error.message : String(error);
		}

		log(
			`Request failed (${failure}), retrying in ${delayMs / 1000}s (attempt ${attempt}/${attempts}): ${url}`,
		);
		await sleep(delayMs);
		delayMs *= 3;
	}
}
