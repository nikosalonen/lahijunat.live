/**
 * Pure helpers for deciding which stations have commuter traffic.
 *
 * Used by updateStationQuery.ts. Kept free of network and file access so the
 * decision logic can be unit tested with small fixtures.
 */

export interface TimeTableRow {
	stationShortCode: string;
	cancelled?: boolean;
	trainStopping?: boolean;
	commercialStop?: boolean;
}

export interface ApiTrain {
	trainCategory: string;
	cancelled?: boolean;
	timeTableRows: TimeTableRow[];
}

const TIME_ZONE = "Europe/Helsinki";

/** Station codes where at least one running commuter train makes a stop passengers can use. */
export function servedStations(trains: ApiTrain[]): Set<string> {
	const served = new Set<string>();

	for (const train of trains) {
		if (train.trainCategory !== "Commuter" || train.cancelled) continue;

		for (const row of train.timeTableRows) {
			if (row.cancelled) continue;
			// trainStopping is false for pass-throughs; commercialStop is false for
			// technical stops passengers cannot use
			if (row.trainStopping !== true || row.commercialStop !== true) continue;
			served.add(row.stationShortCode);
		}
	}

	return served;
}

/** `days` consecutive departure dates starting from today in Finnish time. */
export function upcomingDates(days: number, today = new Date()): string[] {
	// en-CA formats as YYYY-MM-DD, which is what the trains endpoint expects
	const first = new Intl.DateTimeFormat("en-CA", {
		timeZone: TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(today);
	const start = new Date(`${first}T00:00:00Z`);

	return Array.from({ length: days }, (_, index) => {
		const date = new Date(start);
		date.setUTCDate(date.getUTCDate() + index);
		return date.toISOString().slice(0, 10);
	});
}

/**
 * The new exclusion list, sorted.
 *
 * A station with trains is always included. A station without trains is
 * excluded when every day of the window was fetched (`complete`). When some
 * days failed, the evidence is one-sided, so such a station keeps its current
 * status instead of being newly excluded.
 */
export function decideExclusions(opts: {
	allStations: string[];
	served: Set<string>;
	currentExcluded: string[];
	complete: boolean;
}): string[] {
	const current = new Set(opts.currentExcluded);

	return opts.allStations
		.filter((code) => {
			if (opts.served.has(code)) return false;
			return opts.complete || current.has(code);
		})
		.sort();
}
