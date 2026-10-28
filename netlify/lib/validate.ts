import { helsinkiParts } from "../../src/utils/helsinkiTime";
import type { AlertLang, PushKeys } from "./types";

export interface SubscribeInput {
	subscription: { endpoint: string; keys: PushKeys };
	trainNumber: number;
	departureDate: string;
	from: string;
	to: string;
	fromName: string;
	toName: string;
	title: string;
	lang: AlertLang;
	removeAfter: string;
	/** The card already showed the train or the rider's stop as cancelled. */
	cancelled: boolean;
}

export interface DeleteInput {
	endpoint: string;
	trainNumber?: number;
	departureDate?: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_REMOVE_AFTER_MS = 36 * 60 * 60_000;
const KEY_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;
const STATION_PATTERN = /^[A-ZÄÖÅ]{1,5}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LANGS: readonly string[] = ["fi", "sv", "en"];

const MAX_ENDPOINT_CHARS = 1024;
const ISO_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function hasUnsafeChar(text: string): boolean {
	for (const char of text) {
		const code = char.charCodeAt(0);
		if (code <= 0x20 || code === 0x7f || char === "\\") return true;
	}
	return false;
}

/**
 * Returns the normalized URL of an allowed push endpoint, or null.
 * web-push parses the endpoint with Node's legacy `url.parse`, so anything the
 * two parsers could read differently (ports, userinfo, backslashes) is refused.
 */
export function normalizePushEndpoint(endpoint: string): string | null {
	if (endpoint.length > MAX_ENDPOINT_CHARS || hasUnsafeChar(endpoint)) {
		return null;
	}
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return null;
	}
	if (url.protocol !== "https:") return null;
	if (url.port !== "" || url.username !== "" || url.password !== "") {
		return null;
	}
	const host = url.hostname;
	if (!/^[a-z0-9.-]+$/.test(host)) return null;
	// No legacy `url.parse` comparison: the strict character, userinfo and port
	// rules above already cover differences between the two parsers.
	const allowed =
		host === "fcm.googleapis.com" ||
		host === "updates.push.services.mozilla.com" ||
		host.endsWith(".push.apple.com") ||
		host.endsWith(".notify.windows.com");
	return allowed ? url.href : null;
}

/** Only real push services, so the job never POSTs to an address a caller picked. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
	return normalizePushEndpoint(endpoint) !== null;
}

type Fail = { ok: false; error: string };
// Names the field only. The value may be an endpoint or key and must not be echoed.
const fail = (field: string): Fail => ({
	ok: false,
	error: `invalid ${field}`,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown, max: number): value is string =>
	typeof value === "string" && value.length >= 1 && value.length <= max;

const isTrainNumber = (value: unknown): value is number =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= 1 &&
	value <= 99999;

/** Yesterday, today or tomorrow by Helsinki calendar date. No instant shifting, so DST is safe. */
function isNearHelsinkiDate(date: string, now: Date): boolean {
	if (!DATE_PATTERN.test(date)) return false;
	const [year, month, day] = helsinkiParts(now).date.split("-").map(Number);
	return [-1, 0, 1].some(
		(offset) =>
			new Date(Date.UTC(year, month - 1, day + offset))
				.toISOString()
				.slice(0, 10) === date,
	);
}

export function parseSubscribeBody(
	body: unknown,
	now: Date,
): Parsed<SubscribeInput> {
	if (!isObject(body)) return fail("body");
	const { subscription } = body;
	if (!isObject(subscription)) return fail("subscription");
	const { endpoint, keys } = subscription;
	const normalizedEndpoint =
		typeof endpoint === "string" ? normalizePushEndpoint(endpoint) : null;
	if (normalizedEndpoint === null) return fail("subscription.endpoint");
	if (!isObject(keys)) return fail("subscription.keys");
	const { p256dh, auth } = keys;
	for (const [name, value] of [
		["p256dh", p256dh],
		["auth", auth],
	] as const) {
		if (
			typeof value !== "string" ||
			value.length > 200 ||
			!KEY_PATTERN.test(value)
		) {
			return fail(`subscription.keys.${name}`);
		}
	}

	const { trainNumber, departureDate, from, to, fromName, toName } = body;
	if (!isTrainNumber(trainNumber)) return fail("trainNumber");
	if (
		typeof departureDate !== "string" ||
		!isNearHelsinkiDate(departureDate, now)
	) {
		return fail("departureDate");
	}
	if (typeof from !== "string" || !STATION_PATTERN.test(from)) {
		return fail("from");
	}
	if (typeof to !== "string" || !STATION_PATTERN.test(to)) return fail("to");
	if (!isText(fromName, 60)) return fail("fromName");
	if (!isText(toName, 60)) return fail("toName");
	const { title, lang, removeAfter } = body;
	if (!isText(title, 120)) return fail("title");
	if (typeof lang !== "string" || !LANGS.includes(lang)) return fail("lang");
	const removeAfterMs =
		typeof removeAfter === "string" && ISO_PATTERN.test(removeAfter)
			? Date.parse(removeAfter)
			: Number.NaN;
	if (
		Number.isNaN(removeAfterMs) ||
		removeAfterMs <= now.getTime() ||
		removeAfterMs - now.getTime() > MAX_REMOVE_AFTER_MS
	) {
		return fail("removeAfter");
	}
	const { cancelled } = body;
	if (cancelled !== undefined && typeof cancelled !== "boolean") {
		return fail("cancelled");
	}

	return {
		ok: true,
		value: {
			subscription: {
				endpoint: normalizedEndpoint,
				keys: { p256dh: p256dh as string, auth: auth as string },
			},
			trainNumber,
			departureDate,
			from,
			to,
			fromName,
			toName,
			title,
			lang: lang as AlertLang,
			removeAfter: new Date(removeAfterMs).toISOString(),
			cancelled: cancelled === true,
		},
	};
}

/** `trainNumber` and `departureDate` come together or not at all. */
export function parseDeleteBody(body: unknown): Parsed<DeleteInput> {
	if (!isObject(body)) return fail("body");
	const { endpoint, trainNumber, departureDate } = body;
	const normalized =
		typeof endpoint === "string" ? normalizePushEndpoint(endpoint) : null;
	if (normalized === null) return fail("endpoint");
	if (trainNumber === undefined && departureDate === undefined) {
		return { ok: true, value: { endpoint: normalized } };
	}
	if (!isTrainNumber(trainNumber)) return fail("trainNumber");
	if (typeof departureDate !== "string" || !DATE_PATTERN.test(departureDate)) {
		return fail("departureDate");
	}
	return {
		ok: true,
		value: { endpoint: normalized, trainNumber, departureDate },
	};
}
