import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regenerates src/data/route-stats.json: a summary per station pair with direct
 * commuter service, the list of every pair served at all, and a summary per
 * commuter line.
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
/** A line needs this many daily trains before it gets a page. */
const MIN_TRAINS_PER_LINE = 2;
/**
 * A line's longest run must cover this much of the stations it touches. Some
 * line IDs cover scattered two-stop legs rather than a corridor — line V ran 14
 * trains over 19 stations with a longest run of 3 — and there is no honest way
 * to put those stations in travel order.
 */
const MIN_CORRIDOR_COVERAGE = 0.6;
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

interface LineAccumulator {
	trains: number;
	departures: number[];
	/** How many runs shared each "FIRST|LAST" pair of stops. */
	pairCounts: Map<string, number>;
	/** The longest run seen for each "FIRST|LAST" pair. */
	runs: Map<string, string[]>;
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

/**
 * Merges a line's runs into one list of stations in travel order.
 *
 * A line is a path, but no single run has to cover it: trains turn back early,
 * run limited-stop legs, or serve a branch. So the longest run becomes the
 * backbone and every other run is folded into it — flipped first if it travels
 * the other way, then its unseen stations slotted in next to the neighbour they
 * follow. Helsinki leads where the line reaches it, which is the direction
 * people read these lists in.
 */
function orderLineStations(runs: string[][]): string[] {
	const cleaned = runs
		.map((run) => [...new Set(run)])
		.sort((a, b) => b.length - a.length);
	if (cleaned.length === 0) return [];

	const order = [...cleaned[0]];

	const foldIn = (run: string[]) => {
		// Insert each unseen station directly after the last station already
		// placed, so it lands between the stops it actually runs between
		let anchor = -1;
		for (const code of run) {
			const at = order.indexOf(code);
			if (at !== -1) {
				anchor = at;
				continue;
			}
			order.splice(anchor + 1, 0, code);
			anchor += 1;
		}
	};

	for (const run of cleaned.slice(1)) {
		const shared = run.filter((code) => order.includes(code));
		// Two shared stations are enough to tell which way this run travels
		const runsBackwards =
			shared.length >= 2 &&
			order.indexOf(shared[0]) > order.indexOf(shared[shared.length - 1]);
		foldIn(runsBackwards ? [...run].reverse() : run);
	}

	const helsinki = order.indexOf("HKI");
	if (helsinki > order.length / 2) order.reverse();

	return order;
}

/**
 * The stops a run repeats after its last new station: how a ring line gets
 * back to where it started. Empty for a run that never revisits a stop.
 */
function returnStops(run: string[]): string[] {
	const seen = new Set<string>();
	let lastNew = -1;
	run.forEach((code, index) => {
		if (seen.has(code)) return;
		seen.add(code);
		lastNew = index;
	});
	return run.slice(lastNew + 1);
}

/**
 * What each commuter line looks like on this day: how many trains it runs, when
 * they start and finish, and every run it makes grouped by where it starts and
 * ends. Runs are grouped rather than merged because the longest run of the day
 * is often a depot move, which describes the line badly — the most repeated
 * pattern is the line as passengers know it.
 */
function collectLines(
	trains: ApiTrain[],
	known: Set<string>,
): Map<string, LineAccumulator> {
	const lines = new Map<string, LineAccumulator>();

	for (const train of trains) {
		const line = train.commuterLineID;
		if (!line) continue;

		const stops = commercialStops(train).filter((s) => known.has(s.shortCode));
		if (stops.length < 2) continue;

		let accumulator = lines.get(line);
		if (!accumulator) {
			accumulator = {
				trains: 0,
				departures: [],
				pairCounts: new Map(),
				runs: new Map(),
			};
			lines.set(line, accumulator);
		}

		accumulator.trains += 1;
		if (stops[0].departure !== undefined) {
			accumulator.departures.push(stops[0].departure);
		}

		const sequence = stops.map((stop) => stop.shortCode);
		const pair = `${sequence[0]}|${sequence[sequence.length - 1]}`;
		accumulator.pairCounts.set(
			pair,
			(accumulator.pairCounts.get(pair) ?? 0) + 1,
		);
		const longest = accumulator.runs.get(pair);
		if (!longest || sequence.length > longest.length) {
			accumulator.runs.set(pair, sequence);
		}
	}

	return lines;
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
	const lines = new Map<string, LineAccumulator>();

	for (const day of windowEndingOn(date)) {
		const trains = await fetchCommuterTrains(day);
		const dayRoutes = collectRoutes(trains, known);
		for (const key of dayRoutes.keys()) served.add(key);
		if (day === date) routes = dayRoutes;

		// Trains and times describe the weekday; the stop list takes the longest
		// run seen all week, so a line that ran only a short leg on the Tuesday
		// is not described by that leg alone.
		for (const [line, dayLine] of collectLines(trains, known)) {
			const accumulator = lines.get(line) ?? {
				trains: 0,
				departures: [],
				pairCounts: new Map<string, number>(),
				runs: new Map<string, string[]>(),
			};
			for (const [pair, count] of dayLine.pairCounts) {
				accumulator.pairCounts.set(
					pair,
					(accumulator.pairCounts.get(pair) ?? 0) + count,
				);
			}
			for (const [pair, sequence] of dayLine.runs) {
				const longest = accumulator.runs.get(pair);
				if (!longest || sequence.length > longest.length) {
					accumulator.runs.set(pair, sequence);
				}
			}
			if (day === date) {
				accumulator.trains = dayLine.trains;
				accumulator.departures = dayLine.departures;
			}
			lines.set(line, accumulator);
		}
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

	const lineStats: Record<string, unknown> = {};
	for (const [line, accumulator] of [...lines].sort(([a], [b]) =>
		a.localeCompare(b),
	)) {
		if (accumulator.trains < MIN_TRAINS_PER_LINE) continue;

		const departures = accumulator.departures
			.map(localMinutes)
			.sort((a, b) => serviceDayOffset(a) - serviceDayOffset(b));

		// The pattern the line runs most often is the one to describe it by
		const [typicalPair] = [...accumulator.pairCounts].sort(
			([, a], [, b]) => b - a,
		)[0];
		const typicalRun = accumulator.runs.get(typicalPair) ?? [];
		const pairEnds = typicalPair.split("|");

		// The label describes the typical run; the station list covers every stop
		// the line makes, in travel order, because the page links to each one
		const runs = [...accumulator.runs.values()];
		const stations = orderLineStations(runs);
		const longestRun = Math.max(...runs.map((run) => new Set(run).size));
		if (longestRun < stations.length * MIN_CORRIDOR_COVERAGE) {
			console.log(
				`Skipping line ${line}: longest run covers ${longestRun} of ${stations.length} stations, so it has no single corridor`,
			);
			continue;
		}

		lineStats[line] = {
			trainsPerDay: accumulator.trains,
			firstDeparture: formatMinutes(departures[0]),
			lastDeparture: formatMinutes(departures[departures.length - 1]),
			// Named in the order the station list runs, so the label and the list
			// agree on which way round the line is
			endpoints: [...pairEnds].sort(
				(a, b) => stations.indexOf(a) - stations.indexOf(b),
			),
			// A run that ends where it started is a ring: name the far point so
			// the line is recognisable ("Helsinki - Aviapolis - Helsinki")
			via:
				pairEnds[0] === pairEnds[1]
					? (typicalRun[Math.floor(typicalRun.length / 2)] ?? null)
					: null,
			stations,
			// Deduplicating the list above loses the way back round a ring; keep
			// it so the line page can draw the whole loop
			returnStops: pairEnds[0] === pairEnds[1] ? returnStops(typicalRun) : [],
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
				lines: lineStats,
				served: [...served].sort(),
			},
			null,
			"\t",
		)}\n`,
	);
	console.log(
		`Wrote ${routeCount} summaries, ${Object.keys(lineStats).length} lines and ${served.size} served pairs to src/data/route-stats.json`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
