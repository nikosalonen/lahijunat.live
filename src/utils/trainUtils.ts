import type { Duration, Train } from "../types";

export const formatTime = (date: string) => {
	return new Date(date).toLocaleTimeString("fi-FI", {
		hour: "2-digit",
		minute: "2-digit",
	});
};

export const calculateDuration = (start: string, end: string): Duration => {
	const durationMinutes = Math.round(
		(new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60),
	);
	return {
		hours: Math.floor(durationMinutes / 60),
		minutes: durationMinutes % 60,
	};
};

export const getDepartureDate = (row: Train["timeTableRows"][0]): Date => {
	return new Date(
		row.actualTime ?? row.liveEstimateTime ?? row.scheduledTime,
	);
};
