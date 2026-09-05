import type { Train } from "../types";
import { getDepartureDate } from "./trainUtils";

/** How often the train list refreshes, by how soon something happens. */
export const REFRESH_INTERVALS = {
	URGENT: 15000, // 15 seconds - trains departing within 5 minutes
	HIGH: 30000, // 30 seconds - trains departing within 15 minutes or late trains
	MEDIUM: 45000, // 45 seconds - normal operations
	LOW: 90000, // 90 seconds - no immediate trains
	IDLE: 600000, // 10 minutes - no trains at all, e.g. a station closed for track work
} as const;

// Urgency thresholds (in minutes)
const URGENCY_THRESHOLDS = {
	URGENT: 5, // Trains departing within 5 minutes
	IMMINENT: 15, // Trains departing within 15 minutes
	NEARBY: 30, // Trains departing within 30 minutes
} as const;

// Calculate appropriate refresh interval based on train data
export function getAdaptiveRefreshInterval(
	trains: Train[],
	currentTime: Date,
): number {
	// Nothing on the route can change for hours; a manual refresh stays available
	if (!trains?.length) return REFRESH_INTERVALS.IDLE;

	const now = currentTime.getTime();
	let hasUrgentTrains = false;
	let hasImminentTrains = false;
	let hasLateTrains = false;

	for (const train of trains) {
		const departureRow = train.timeTableRows.find(
			(row) => row.type === "DEPARTURE",
		);

		if (!departureRow) continue;

		const departureTime = getDepartureDate(departureRow).getTime();
		const minutesToDeparture = Math.round((departureTime - now) / (1000 * 60));

		// Check if train is late
		const isLate = (departureRow.differenceInMinutes ?? 0) > 1;

		if (
			minutesToDeparture > 0 &&
			minutesToDeparture <= URGENCY_THRESHOLDS.URGENT
		) {
			hasUrgentTrains = true;
		} else if (
			minutesToDeparture > 0 &&
			minutesToDeparture <= URGENCY_THRESHOLDS.IMMINENT
		) {
			hasImminentTrains = true;
		}

		if (
			isLate &&
			minutesToDeparture > 0 &&
			minutesToDeparture <= URGENCY_THRESHOLDS.NEARBY
		) {
			hasLateTrains = true;
		}
	}

	if (hasUrgentTrains) return REFRESH_INTERVALS.URGENT;
	if (hasImminentTrains || hasLateTrains) return REFRESH_INTERVALS.HIGH;

	// Check if we have any trains in the next 30 minutes
	const hasNearbyTrains = trains.some((train) => {
		const departureRow = train.timeTableRows.find(
			(row) => row.type === "DEPARTURE",
		);
		if (!departureRow) return false;
		const departureTime = getDepartureDate(departureRow).getTime();
		const minutesToDeparture = Math.round((departureTime - now) / (1000 * 60));
		return (
			minutesToDeparture > 0 && minutesToDeparture <= URGENCY_THRESHOLDS.NEARBY
		);
	});

	return hasNearbyTrains ? REFRESH_INTERVALS.MEDIUM : REFRESH_INTERVALS.LOW;
}
