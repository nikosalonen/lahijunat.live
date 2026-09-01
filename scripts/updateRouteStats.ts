import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regenerates src/data/route-stats.json: a summary per station pair with direct
 * commuter service, plus the list of every pair served at all.
 *
 * Route pages are otherwise near-identical — same layout, same text, only the
 * station names differ — and Google's sitelinks guidance asks sites to "avoid
 * content repetition". These summaries give each page facts of its own.
 *
 * The summaries describe one weekday, which is what most visitors travel on.
 * The served list covers a full week, because it decides whether a page gets
 * indexed and a pair with weekend-only service must not be dropped.
 *
 * A day's trains come from one request (~900 kB gzipped), so the result is
 * committed to the repo rather than fetched during the build: Digitraffic
 * occasionally 403s CI runner IPs, and the build must not depend on it.
 *
 * Run with: pnpm run update-route-stats
 */

const TRAINS_URL = "https://rata.digitraffic.fi/api/v1/trains";
const STATIONS_PATH = join(process.cwd(), "src/data/stations-snapshot.json");
const OUTPUT_PATH = join(process.cwd(), "src/data/route-stats.json");
const TIME_ZONE = "Europe/Helsinki";

/** A route needs this many daily trains before it gets a summary. */
const MIN_TRAINS_PER_DAY = 2;
/** Days of timetable to scan when deciding which pairs have any service. */
const SERVED_WINDOW_DAYS = 7;
/**
 * The service day starts at 04:00 local time, so a 00.26 train counts as the
 * last one of the previous evening rather than the first of the morning.
 */
const SERVICE_DAY_START_MINUTES = 4 * 60;
/** Sanity check: the commuter network has thousands of served pairs. */
const MIN_EXPECTED_ROUTES = 500;

interface TimeTableRow {
	type: "ARRIVAL" | "DEPARTURE";
	stationShortCode: string;
	scheduledTime: string;
	cancelled?: boolean;
	trainStopping?: boolean;
	commercialStop?: boolean;
}

interface ApiTrain {
	trainCategory: string;
	cancelled?: boolean;
	commuterLineID?: string;
	timeTableRows: TimeTableRow[];
}

interface Stop {
	shortCode: string;
	arrival?: number;
	departure?: number;
}

interface Accumulator {
	departures: number[];
	durations: number[];
	lines: Set<string>;
}

function getVersion(): string {
	const packageJson = JSON.parse(
		readFileSync(join(process.cwd(), "package.json"), "utf-8"),
	);
	return packageJson.version ?? "unknown";
}

/**
 * The most recent Tuesday, as a departureDate. Weekday timetables are the ones
 * most visitors see, and a fixed weekday keeps the numbers comparable between
 * runs.
 */
function lastTuesday(today = new Date()): string {
	const date = new Date(
		Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
	);
	// getUTCDay: 0 = Sunday, 2 = Tuesday
	const daysSinceTuesday = (date.getUTCDay() - 2 + 7) % 7 || 7;
	date.setUTCDate(date.getUTCDate() - daysSinceTuesday);
	return date.toISOString().slice(0, 10);
}

/** Commercial stops in timetable order, with arrival and departure times. */
function commercialStops(train: ApiTrain): Stop[] {
	const stops: Stop[] = [];

	for (const row of train.timeTableRows) {
		if (row.cancelled) continue;
		// trainStopping is false for pass-throughs; commercialStop is false for
		// technical stops passengers cannot use
		if (row.trainStopping !== true || row.commercialStop !== true) continue;

		const time = Date.parse(row.scheduledTime);
		if (!Number.isFinite(time)) continue;

		let stop = stops.at(-1);
		if (!stop || stop.shortCode !== row.stationShortCode) {
			stop = { shortCode: row.stationShortCode };
			stops.push(stop);
		}

		if (row.type === "ARRIVAL") {
			stop.arrival = time;
		} else {
			stop.departure = time;
		}
	}

	return stops;
}

/** Local time of day, as minutes past midnight in Helsinki. */
function localMinutes(epochMs: number): number {
	const parts = new Intl.DateTimeFormat("fi-FI", {
		timeZone: TIME_ZONE,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(new Date(epochMs));
	const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
	const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
	return hour * 60 + minute;
}

function formatMinutes(minutesPastMidnight: number): string {
	const hour = Math.floor(minutesPastMidnight / 60);
	const minute = minutesPastMidnight % 60;
	return `${String(hour).padStart(2, "0")}.${String(minute).padStart(2, "0")}`;
}

/** Position within the service day, for ordering first and last departures. */
function serviceDayOffset(minutesPastMidnight: number): number {
	return (minutesPastMidnight - SERVICE_DAY_START_MINUTES + 1440) % 1440;
}

/**
 * Nearest-rank percentile of a sorted list. The journey time is reported as a
 * median rather than a range because ring rail trains reach some stations the
 * long way round: Helsinki to Pasila is 4 minutes direct and 57 the other way,
 * and "4-57 min" tells a reader nothing.
 */
function percentile(sorted: number[], fraction: number): number {
	const index = Math.min(
		sorted.length - 1,
		Math.max(0, Math.round(fraction * (sorted.length - 1))),
	);
	return sorted[index];
}

async function fetchCommuterTrains(date: string): Promise<ApiTrain[]> {
	const response = await fetch(`${TRAINS_URL}/${date}`, {
		headers: {
			"Accept-Encoding": "gzip",
			"User-Agent": `lahijunat.live/${getVersion()}`,
		},
	});
	if (!response.ok) {
		throw new Error(
			`Train request for ${date} failed: ${response.status} ${response.statusText}`,
		);
	}

	const trains: ApiTrain[] = await response.json();
	return trains.filter(
		(train) => train.trainCategory === "Commuter" && !train.cancelled,
	);
}

/** Every ordered pair of stops on a train is a route that train serves. */
function collectRoutes(
	trains: ApiTrain[],
	known: Set<string>,
): Map<string, Accumulator> {
	const routes = new Map<string, Accumulator>();

	for (const train of trains) {
		const stops = commercialStops(train).filter((s) => known.has(s.shortCode));

		for (let i = 0; i < stops.length; i++) {
			const from = stops[i];
			if (from.departure === undefined) continue;

			for (let j = i + 1; j < stops.length; j++) {
				const to = stops[j];
				if (to.arrival === undefined) continue;
				if (from.shortCode === to.shortCode) continue;

				const key = `${from.shortCode}-${to.shortCode}`;
				let accumulator = routes.get(key);
				if (!accumulator) {
					accumulator = { departures: [], durations: [], lines: new Set() };
					routes.set(key, accumulator);
				}
				accumulator.departures.push(from.departure);
				accumulator.durations.push(
					Math.round((to.arrival - from.departure) / 60_000),
				);
				if (train.commuterLineID) accumulator.lines.add(train.commuterLineID);
			}
		}
	}

	return routes;
}

/** The SERVED_WINDOW_DAYS dates ending on `lastDate`, oldest first. */
function windowEndingOn(lastDate: string): string[] {
	const end = new Date(`${lastDate}T00:00:00Z`);
	return Array.from({ length: SERVED_WINDOW_DAYS }, (_, index) => {
		const date = new Date(end);
		date.setUTCDate(date.getUTCDate() - (SERVED_WINDOW_DAYS - 1 - index));
		return date.toISOString().slice(0, 10);
	});
}

async function main(): Promise<void> {
	const stations: { shortCode: string }[] = JSON.parse(
		readFileSync(STATIONS_PATH, "utf-8"),
	);
	const known = new Set(stations.map((s) => s.shortCode));

	const date = lastTuesday();
	const served = new Set<string>();
	let routes = new Map<string, Accumulator>();

	for (const day of windowEndingOn(date)) {
		const trains = await fetchCommuterTrains(day);
		const dayRoutes = collectRoutes(trains, known);
		for (const key of dayRoutes.keys()) served.add(key);
		if (day === date) routes = dayRoutes;
		console.log(
			`${day}: ${trains.length} commuter trains, ${dayRoutes.size} routes`,
		);
	}

	const stats: Record<string, unknown> = {};
	for (const [key, accumulator] of [...routes].sort(([a], [b]) =>
		a.localeCompare(b),
	)) {
		if (accumulator.departures.length < MIN_TRAINS_PER_DAY) continue;

		const departures = accumulator.departures
			.map(localMinutes)
			.sort((a, b) => serviceDayOffset(a) - serviceDayOffset(b));
		const durations = [...accumulator.durations].sort((a, b) => a - b);

		stats[key] = {
			trainsPerDay: departures.length,
			firstDeparture: formatMinutes(departures[0]),
			lastDeparture: formatMinutes(departures[departures.length - 1]),
			medianDuration: percentile(durations, 0.5),
			lines: [...accumulator.lines].sort(),
		};
	}

	const routeCount = Object.keys(stats).length;
	if (routeCount < MIN_EXPECTED_ROUTES) {
		throw new Error(
			`Sanity check failed: only ${routeCount} routes found (expected >= ${MIN_EXPECTED_ROUTES})`,
		);
	}

	writeFileSync(
		OUTPUT_PATH,
		`${JSON.stringify(
			{
				sourceDate: date,
				servedWindowDays: SERVED_WINDOW_DAYS,
				routes: stats,
				served: [...served].sort(),
			},
			null,
			"\t",
		)}\n`,
	);
	console.log(
		`Wrote ${routeCount} summaries and ${served.size} served pairs to src/data/route-stats.json`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
