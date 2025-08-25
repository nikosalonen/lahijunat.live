import type { Duration, Train } from "../types";

export const formatTime = (date: string) => {
	return new Date(date).toLocaleTimeString("fi-FI", {
		hour: "2-digit",
		minute: "2-digit",
	});
};

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

export const getDepartureDate = (row: Train["timeTableRows"][0]): Date => {
	return new Date(row.actualTime ?? row.liveEstimateTime ?? row.scheduledTime);
};

export const getArrivalDate = (row: Train["timeTableRows"][0]): Date => {
	return new Date(row.liveEstimateTime ?? row.scheduledTime);
};
