import type { Duration, Train } from "../types";

/**
 * Format an ISO date string into a Finnish locale HH:MM time.
 */
export const formatTime = (date: string) => {
	return new Date(date).toLocaleTimeString("fi-FI", {
		hour: "2-digit",
		minute: "2-digit",
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
