/** @format */
/**
 * Europe/Helsinki time helpers for the passenger-information feature.
 *
 * `deliveryRules.startTime`/`endTime` from Digitraffic are Helsinki
 * wall-clock strings (`H:mm` or `HH:mm`); broadcast windows happen
 * physically at Finnish stations regardless of the viewer's locale.
 */

export type Weekday =
	| "MONDAY"
	| "TUESDAY"
	| "WEDNESDAY"
	| "THURSDAY"
	| "FRIDAY"
	| "SATURDAY"
	| "SUNDAY";

interface HelsinkiParts {
	date: string; // YYYY-MM-DD
	time: string; // HH:mm
	weekday: Weekday;
	hour: number;
	minute: number;
}

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/Helsinki",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	// `hourCycle: "h23"` forces 00–23 output. `hour12: false` is ambiguous and
	// can resolve to "h24" (01–24) in some runtimes, where midnight is "24"
	// paired with the *previous* calendar day — which would silently break
	// Helsinki-date-based keys around midnight.
	hourCycle: "h23",
	weekday: "long",
});

/**
 * Decompose an instant into Helsinki-local calendar parts.
 */
export function helsinkiParts(d: Date): HelsinkiParts {
	const map = new Map<string, string>();
	for (const part of partsFormatter.formatToParts(d)) {
		map.set(part.type, part.value);
	}
	const year = map.get("year") ?? "1970";
	const month = map.get("month") ?? "01";
	const day = map.get("day") ?? "01";
	const hour = Number.parseInt(map.get("hour") ?? "00", 10);
	const minute = Number.parseInt(map.get("minute") ?? "0", 10);
	const weekday = (map.get("weekday") ?? "MONDAY").toUpperCase() as Weekday;
	return {
		date: `${year}-${month}-${day}`,
		time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
		weekday,
		hour,
		minute,
	};
}

/**
 * The instant of the next midnight in Helsinki after `now` (epoch ms).
 */
export function startOfNextHelsinkiDay(now: number): number {
	const { hour, minute } = helsinkiParts(new Date(now));
	// Helsinki's UTC offset is whole hours, so seconds match UTC seconds.
	const startOfMinute = now - (now % 60_000);
	const minutesLeft = 24 * 60 - (hour * 60 + minute);
	const guess = startOfMinute + minutesLeft * 60_000;
	// If the clocks change later today, `guess` lands an hour off midnight
	// (01:00 or 23:00). Move it back onto midnight.
	const landed = helsinkiParts(new Date(guess));
	const landedMinutes = landed.hour * 60 + landed.minute;
	const drift =
		landedMinutes < 12 * 60 ? landedMinutes : landedMinutes - 24 * 60;
	return guess - drift * 60_000;
}

/**
 * Parse a Helsinki wall-clock `H:mm` or `HH:mm` string into minutes since midnight.
 * Returns null if the input cannot be parsed.
 */
export function toMinutes(t: string | undefined): number | null {
	if (!t) return null;
	const match = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
	if (!match) return null;
	const hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2], 10);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
}

const dateTimeFormatter = new Intl.DateTimeFormat("fi-FI", {
	timeZone: "Europe/Helsinki",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

/**
 * Format an ISO timestamp as a Finnish date and time in Helsinki time,
 * e.g. `15.11.2026 klo 12.00`. Returns the input unchanged if it can't be parsed.
 */
export function formatHelsinkiDateTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return dateTimeFormatter.format(d);
}
