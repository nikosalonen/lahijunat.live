import type { Duration, Train } from "../types";

/**
 * Format an ISO date string into a Finnish locale time.
 * @param date - ISO date string to format
 * @param includeSeconds - Whether to include seconds in the output (default: false)
 */
export const formatTime = (date: string, includeSeconds = false) => {
	return new Date(date).toLocaleTimeString("fi-FI", {
		hour: "2-digit",
		minute: "2-digit",
		...(includeSeconds && { second: "2-digit" }),
	});
};

/**
 * Calculate a duration between two timestamps and express it as hours and minutes.
 */
export const calculateDuration = (
	start: Date | string,
	end: Date | string,
): Duration => {
	const startMs =
		typeof start === "string" ? new Date(start).getTime() : start.getTime();
	const endMs =
		typeof end === "string" ? new Date(end).getTime() : end.getTime();
	const durationMinutes = Math.round((endMs - startMs) / (1000 * 60));
	return {
		hours: Math.floor(durationMinutes / 60),
		minutes: durationMinutes % 60,
	};
};

/**
 * Resolve a timetable row into an accurate departure moment prioritising realtime data.
 */
export const getDepartureDate = (row: Train["timeTableRows"][0]): Date => {
	return new Date(row.actualTime ?? row.liveEstimateTime ?? row.scheduledTime);
};

/**
 * Resolve a timetable row into an arrival moment using live estimates when available.
 */
export const getArrivalDate = (row: Train["timeTableRows"][0]): Date => {
	return new Date(row.liveEstimateTime ?? row.scheduledTime);
};

/** How much longer or shorter than the median counts as a different speed. */
const SPEED_MARGIN = 0.15;

/**
 * Real minutes a journey must differ by before it is called fast or slow.
 *
 * A percentage on its own labels trains over a difference the timetable can
 * barely express. On Ainola–Jokela the median is 11 minutes, so 15% is 1.65
 * minutes and the very next timetable minute reads as "slow" even though
 * every train is the same R service and the gap is dwell time. Asking for a
 * few real minutes as well keeps the label for the cases it was meant for,
 * such as the two ring-rail directions between Helsinki and the airport: 28
 * minutes one way against 33 the other.
 */
const MIN_SPEED_DIFFERENCE_MINUTES = 3;

export type DurationSpeedType = "fast" | "slow" | "normal";

/**
 * How one journey's length compares with the other trains on the same route.
 *
 * A train has to be both proportionally and materially different from the
 * median to earn a label; anything else is "normal". Pass the route's journey
 * times sorted ascending.
 */
export const classifyDuration = (
	durationMinutes: number,
	sortedDurations: number[],
): DurationSpeedType => {
	if (sortedDurations.length < 2) return "normal";

	const median = sortedDurations[Math.floor(sortedDurations.length / 2)];
	const slowThreshold = Math.max(
		median * (1 + SPEED_MARGIN),
		median + MIN_SPEED_DIFFERENCE_MINUTES,
	);
	const fastThreshold = Math.min(
		median * (1 - SPEED_MARGIN),
		median - MIN_SPEED_DIFFERENCE_MINUTES,
	);

	if (durationMinutes <= fastThreshold) return "fast";
	if (durationMinutes >= slowThreshold) return "slow";
	return "normal";
};
