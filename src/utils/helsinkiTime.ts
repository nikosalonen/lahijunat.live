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
	hour12: false,
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
	// `hour: "2-digit"` with `hour12: false` can yield "24" at midnight in some
	// runtimes; normalise to "00" so minute arithmetic stays well-defined.
	const hourRaw = map.get("hour") ?? "00";
	const hour = hourRaw === "24" ? 0 : Number.parseInt(hourRaw, 10);
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

const validityFormatter = new Intl.DateTimeFormat("fi-FI", {
	timeZone: "Europe/Helsinki",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

/**
 * Format an ISO timestamp as Helsinki-local `d.M.YYYY HH:mm` style for the
 * banner validity footer.
 */
export function formatValidityHelsinki(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return validityFormatter.format(d);
}
