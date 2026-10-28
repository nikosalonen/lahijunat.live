/** @format */

/**
 * Browser side of train alerts: push support detection, the opt-in decision,
 * the push subscription and the calls to /api/alerts.
 * Nothing here throws; failures come back as a result value.
 */

import type { TimeTableRow, Train } from "@/types";
import { helsinkiParts } from "./helsinkiTime";
import { getCurrentLanguage } from "./language";
import { getLocalizedStationName } from "./stationNames";
import { getFavorites } from "./storage";
import { showToast } from "./toast";
import { t } from "./translations";

export interface AlertTarget {
	trainNumber: number;
	departureDate: string;
	from: string;
	to: string;
	fromName: string;
	toName: string;
	title: string;
	/**
	 * The language the title's station names are in. Re-syncs send this
	 * rather than the current language, so the title and body always match.
	 */
	lang: string;
	/**
	 * The train, or its stop at `from` or `to`, was cancelled when marked. The
	 * card already showed that, so the server does not push it again.
	 */
	cancelled: boolean;
}

export type PushSupport = "supported" | "needs-home-screen" | "unsupported";

/** Fired when the user should be asked once whether they want alerts. */
export const ALERT_OPT_IN_EVENT = "alert-opt-in";

/** Fired when the alerts preference or notification permission changes. */
export const ALERTS_STATE_EVENT = "alerts-state-changed";

const PREFERENCE_KEY = "pushAlerts";
const SNOOZE_KEY = "pushAlertsSnoozeUntil";
const HINT_SHOWN_KEY = "pushAlertsHomeScreenHintShown";
const SNOOZE_DAYS = 14;
const ALERTS_URL = "/api/alerts";

function readStorage(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStorage(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Storage can be blocked (private mode); alerts still work for this session.
	}
}

export function isAlertsFeatureEnabled(): boolean {
	return (
		import.meta.env.PUBLIC_PUSH_ALERTS_ENABLED !== "false" &&
		Boolean(import.meta.env.PUBLIC_VAPID_PUBLIC_KEY)
	);
}

function isIos(): boolean {
	return (
		/iPhone|iPad|iPod/.test(navigator.userAgent) ||
		(navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
	);
}

export function getPushSupport(): PushSupport {
	if (
		typeof navigator !== "undefined" &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window
	) {
		return "supported";
	}
	// iOS only exposes push to web apps added to the Home Screen.
	if (typeof navigator !== "undefined" && isIos()) return "needs-home-screen";
	return "unsupported";
}

/**
 * The rider's part of the trip: a departure at `from` followed by an arrival
 * at `to`. Ring trains (I, P) pass Pasila and Helsinki twice, so when several
 * pairs qualify the shortest ride wins. The job has the same rule in
 * netlify/lib/decideAlerts.ts.
 */
function findSegment(
	rows: TimeTableRow[],
	from: string,
	to: string,
): { departure: TimeTableRow; arrival: TimeTableRow } | null {
	let best: { departure: TimeTableRow; arrival: TimeTableRow } | null = null;
	let bestLength = Number.POSITIVE_INFINITY;
	// The closest departure before an arrival gives that arrival's shortest ride.
	let lastDeparture = -1;
	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		if (
			row.type === "ARRIVAL" &&
			row.stationShortCode === to &&
			lastDeparture >= 0
		) {
			if (index - lastDeparture < bestLength) {
				best = { departure: rows[lastDeparture], arrival: row };
				bestLength = index - lastDeparture;
			}
		}
		if (row.type === "DEPARTURE" && row.stationShortCode === from) {
			lastDeparture = index;
		}
	}
	return best;
}

/**
 * Describe the journey a favorite alert is about. Returns null when the
 * train does not call at both stations in the right order. `names` holds the
 * Finnish station names; live rows carry no station object, so without them
 * the title falls back to the station codes.
 */
export function buildAlertTarget(
	train: Train,
	from: string,
	to: string,
	names: { from?: string; to?: string } = {},
): AlertTarget | null {
	const segment = findSegment(train.timeTableRows, from, to);
	if (!segment) return null;
	const { departure: fromRow, arrival: toRow } = segment;

	// The record key uses the date the train left its first station, which can
	// differ from the date at `from` for trains running past midnight.
	const departureDate = helsinkiParts(
		new Date(train.originDepartureTime ?? train.timeTableRows[0].scheduledTime),
	).date;
	const fromName = getLocalizedStationName(
		names.from ?? fromRow.station?.name ?? from,
		from,
	);
	const toName = getLocalizedStationName(
		names.to ?? toRow.station?.name ?? to,
		to,
	);
	const line =
		train.commuterLineID || `${train.trainType} ${train.trainNumber}`;
	const time = helsinkiParts(new Date(fromRow.scheduledTime)).time;

	return {
		trainNumber: Number(train.trainNumber),
		departureDate,
		from,
		to,
		fromName,
		toName,
		title: `${line} ${time} ${fromName} → ${toName}`,
		lang: getCurrentLanguage(),
		cancelled: train.cancelled || fromRow.cancelled || toRow.cancelled,
	};
}

export function getAlertsPreference(): "on" | "off" | null {
	const value = readStorage(PREFERENCE_KEY);
	return value === "on" || value === "off" ? value : null;
}

function notifyStateChanged(): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(ALERTS_STATE_EVENT));
}

export function setAlertsPreference(value: "on" | "off"): void {
	writeStorage(PREFERENCE_KEY, value);
	notifyStateChanged();
}

export function snoozeOptIn(now: Date = new Date()): void {
	const until = new Date(now.getTime() + SNOOZE_DAYS * 24 * 60 * 60 * 1000);
	writeStorage(SNOOZE_KEY, until.toISOString());
}

function isSnoozed(): boolean {
	const until = Date.parse(readStorage(SNOOZE_KEY) ?? "");
	return !Number.isNaN(until) && Date.now() < until;
}

/** Decode the base64url VAPID key into the bytes `subscribe` expects. */
function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
	const padded = value
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(Math.ceil(value.length / 4) * 4, "=");
	const raw = atob(padded);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
	return bytes;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
	return navigator.serviceWorker.ready;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
	return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

async function getOrCreateSubscription(): Promise<PushSubscription> {
	const { pushManager } = await getRegistration();
	const key = urlBase64ToBytes(import.meta.env.PUBLIC_VAPID_PUBLIC_KEY);
	const existing = await pushManager.getSubscription();
	if (existing) {
		// After a VAPID key change the old subscription can't receive our pushes,
		// so replace it. A browser that doesn't report the key keeps its own.
		const existingKey = existing.options?.applicationServerKey;
		if (!existingKey || sameBytes(new Uint8Array(existingKey), key)) {
			return existing;
		}
		await existing.unsubscribe();
	}
	return pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: key,
	});
}

export async function enableAlerts(): Promise<"granted" | "denied" | "error"> {
	try {
		const permission = await Notification.requestPermission();
		if (permission !== "granted") {
			notifyStateChanged();
			return "denied";
		}
		await getOrCreateSubscription();
		setAlertsPreference("on");
		return "granted";
	} catch {
		return "error";
	}
}

async function sendAlertsRequest(
	method: "POST" | "DELETE",
	body: unknown,
): Promise<Response | null> {
	try {
		return await fetch(ALERTS_URL, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	} catch {
		return null;
	}
}

async function isFullResponse(response: Response): Promise<boolean> {
	if (response.status !== 503) return false;
	try {
		const data = (await response.json()) as { error?: string };
		return data.error === "full";
	} catch {
		return false;
	}
}

export async function subscribeTrainAlerts(
	target: AlertTarget,
	removeAfter: string,
	knownSubscription?: PushSubscription,
): Promise<"ok" | "full" | "error"> {
	try {
		const subscription = knownSubscription ?? (await getOrCreateSubscription());
		const response = await sendAlertsRequest("POST", {
			subscription: subscription.toJSON(),
			...target,
			removeAfter,
		});
		if (!response) return "error";
		if (response.status === 204) return "ok";
		if (await isFullResponse(response)) {
			showToast(t("alertsFull"), "info");
			return "full";
		}
		return "error";
	} catch {
		return "error";
	}
}

export async function unsubscribeTrainAlerts(ref: {
	trainNumber: number;
	departureDate: string;
}): Promise<void> {
	try {
		const subscription = await (
			await getRegistration()
		).pushManager.getSubscription();
		if (!subscription) return;
		await sendAlertsRequest("DELETE", {
			endpoint: subscription.endpoint,
			trainNumber: ref.trainNumber,
			departureDate: ref.departureDate,
		});
	} catch {
		// Nothing to undo; the server drops the record after removeAfter anyway.
	}
}

export async function disableAllAlerts(): Promise<void> {
	setAlertsPreference("off");
	try {
		const subscription = await (
			await getRegistration()
		).pushManager.getSubscription();
		if (!subscription) return;
		await sendAlertsRequest("DELETE", { endpoint: subscription.endpoint });
		await subscription.unsubscribe();
	} catch {
		// The preference is already off, so no new alerts are requested.
	}
}

/**
 * Re-register favorites with the server, for example after the push
 * subscription was lost or the server lost its records.
 */
export async function resyncAlerts(): Promise<void> {
	if (
		!isAlertsFeatureEnabled() ||
		getPushSupport() !== "supported" ||
		getAlertsPreference() === "off" ||
		Notification.permission !== "granted"
	) {
		return;
	}
	try {
		// Create a lost subscription once, even when no favorite needs posting.
		const subscription = await getOrCreateSubscription();
		const favorites = await getFavorites();
		const now = Date.now();
		for (const favorite of Object.values(favorites)) {
			if (!favorite.alertTarget || !favorite.removeAfter) continue;
			if (Date.parse(favorite.removeAfter) <= now) continue;
			await subscribeTrainAlerts(
				favorite.alertTarget,
				favorite.removeAfter,
				subscription,
			);
		}
	} catch {
		// Resync is best effort; it runs again on the next app start.
	}
}

export async function onFavoriteAdded(
	target: AlertTarget,
	removeAfter: string,
): Promise<void> {
	if (!isAlertsFeatureEnabled() || getAlertsPreference() === "off") return;

	const support = getPushSupport();
	if (support === "unsupported") return;
	if (support === "needs-home-screen") {
		if (readStorage(HINT_SHOWN_KEY)) return;
		writeStorage(HINT_SHOWN_KEY, "1");
		showToast(t("alertsHomeScreenHint"), "info");
		return;
	}

	const permission = Notification.permission;
	if (permission === "granted") {
		await subscribeTrainAlerts(target, removeAfter);
	} else if (permission === "default" && !isSnoozed()) {
		window.dispatchEvent(
			new CustomEvent(ALERT_OPT_IN_EVENT, { detail: { target, removeAfter } }),
		);
	}
}
