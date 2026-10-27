/** @format */

import type { ActiveMessage } from "./passengerInfo";

const PAGE_OPENED_AT = Date.now();

// The app polls every 60 s and caches each response for 60 s, so an
// announcement can reach the page up to about two minutes after it went live.
const ARRIVAL_GRACE_MS = 2 * 60_000;

const reportedIds = new Set<string>();

/**
 * Return the announcements that went live after the page opened and have not
 * been reported yet, and mark them as reported. Announcements that were
 * already live on opening are never returned: the card shows them anyway, so
 * only ones that appear while the user is watching need extra attention.
 * Each announcement is reported once per page load, so re-renders and
 * remounts do not repeat a toast or pulse.
 */
export function takeNewArrivals(
	messages: ActiveMessage[],
	pageOpenedAt: number = PAGE_OPENED_AT,
): ActiveMessage[] {
	const cutoff = pageOpenedAt - ARRIVAL_GRACE_MS;
	const arrivals: ActiveMessage[] = [];
	for (const message of messages) {
		if (reportedIds.has(message.id)) continue;
		const startedAt = Date.parse(message.startValidity);
		if (Number.isNaN(startedAt) || startedAt < cutoff) continue;
		reportedIds.add(message.id);
		arrivals.push(message);
	}
	return arrivals;
}

// Test-only helper to forget which announcements were reported.
export function __resetAnnouncementArrivalsForTests(): void {
	reportedIds.clear();
}
