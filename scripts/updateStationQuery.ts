import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchWithRetry } from "./fetchWithRetry";
import {
	type ApiTrain,
	decideExclusions,
	servedStations,
	upcomingDates,
} from "./stationTraffic";

// Read package.json dynamically for version
function getVersion(): string {
	try {
		const packagePath = join(process.cwd(), "package.json");
		const packageContent = readFileSync(packagePath, "utf-8");
		const packageJson = JSON.parse(packageContent);
		return packageJson.version;
	} catch (error) {
		console.warn("Could not read version from package.json:", error);
		return "unknown";
	}
}

/**
 * Automated script to find stations without commuter traffic and update STATION_QUERY.
 *
 * A station counts as served when any commuter train stops there during the
 * next LOOKAHEAD_DAYS days. The window is a full week so that a weekend track
 * closure or a weekday-only line does not drop a station from the site.
 * Stations closed for longer, such as months of renovation, are excluded.
 *
 * The timetable comes from one request per day rather than one per station:
 * the per-station live-trains endpoint caps its look-ahead at about a day.
 *
 * Run with `--dry-run` to see what would change without touching any file.
 *
 * Self-contained — calls the Digitraffic API directly instead of importing from api.ts.
 */

const API_FILE_PATH = join(process.cwd(), "src/utils/api.ts");
const TRAINS_URL = "https://rata.digitraffic.fi/api/v1/trains";
const LOOKAHEAD_DAYS = 7;
const SANITY_THRESHOLD = 0.3; // abort if >30% of stations change status
const STATION_QUERY_REGEX =
	/const STATION_QUERY = `query GetStations \{[\s\S]*?\}`;/;

const USER_AGENT = `lahijunat.live/${getVersion()}`;

// GraphQL query to fetch ALL stations with passenger traffic (no exclusions)
const ALL_STATIONS_QUERY = `query GetAllStations {
	stations(where:{
		and:[
			{passengerTraffic:{equals:true}}
		]
	}){
		name
		shortCode
	}
}`;

interface Station {
	name: string;
	shortCode: string;
}

async function fetchAllStations(): Promise<Station[]> {
	console.log("Fetching all stations from GraphQL API...");

	const response = await fetchWithRetry(
		"https://rata.digitraffic.fi/api/v2/graphql/graphql",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept-Encoding": "gzip",
				"User-Agent": USER_AGENT,
			},
			body: JSON.stringify({ query: ALL_STATIONS_QUERY }),
		},
	);

	if (!response.ok) {
		throw new Error(`Failed to fetch all stations: ${response.statusText}`);
	}

	const text = await response.text();
	let result: { errors?: unknown; data?: { stations?: Station[] } };
	try {
		result = JSON.parse(text);
	} catch {
		throw new Error(
			`GraphQL API returned non-JSON response. Status: ${response.status}. Body preview: ${text.slice(0, 200)}`,
		);
	}

	if (result.errors) {
		throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
	}

	if (!result?.data?.stations) {
		throw new Error(
			`Invalid response format from GraphQL API. Response: ${JSON.stringify(result)}`,
		);
	}

	const stations: Station[] = result.data.stations.map((s: Station) => ({
		name: s.name.replace(" asema", ""),
		shortCode: s.shortCode,
	}));

	if (stations.length === 0) {
		throw new Error(
			"GraphQL API returned zero stations. This likely indicates an API issue.",
		);
	}

	console.log(`Fetched ${stations.length} stations with passenger traffic`);
	return stations;
}

/** Every train of one day. About 1 MB gzipped, so one request per day is cheap. */
async function fetchTrainsForDate(date: string): Promise<ApiTrain[]> {
	const response = await fetchWithRetry(`${TRAINS_URL}/${date}`, {
		headers: {
			"Accept-Encoding": "gzip",
			"User-Agent": USER_AGENT,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Train request for ${date} failed: ${response.status} ${response.statusText}`,
		);
	}

	const trains = await response.json();
	if (!Array.isArray(trains)) {
		throw new Error(`Train request for ${date} returned a non-array response`);
	}
	return trains as ApiTrain[];
}

async function findStationsWithoutTrains(
	currentExcluded: string[],
): Promise<string[]> {
	const allStations = await fetchAllStations();
	const dates = upcomingDates(LOOKAHEAD_DAYS);
	console.log(
		`Checking commuter traffic from ${dates[0]} to ${dates[dates.length - 1]}...`,
	);

	const served = new Set<string>();
	let failedDays = 0;

	for (const date of dates) {
		try {
			const trains = await fetchTrainsForDate(date);
			const servedToday = servedStations(trains);
			for (const code of servedToday) served.add(code);
			console.log(`  ${date}: ${servedToday.size} stations served`);
		} catch (error) {
			failedDays++;
			console.error(`  ${date}: check failed:`, error);
		}
	}

	if (failedDays === dates.length) {
		throw new Error("No timetable day could be fetched. Aborting.");
	}
	if (failedDays > 0) {
		console.warn(
			`\n${failedDays}/${dates.length} days failed — stations without trains keep their current status`,
		);
	}

	return decideExclusions({
		allStations: allStations.map((station) => station.shortCode),
		served,
		currentExcluded,
		complete: failedDays === 0,
	});
}

function generateStationQuery(excludedStations: string[]): string {
	const excludeLines = excludedStations
		.sort()
		.map((code) => `\t\t\t{shortCode:{unequals:"${code}"}},`)
		.join("\n");

	return `const STATION_QUERY = \`query GetStations {
\tstations(where:{
\t\tand:[
\t\t\t{passengerTraffic:{equals:true}},
${excludeLines}
\t\t]
\t}){
\t\tname
\t\tshortCode
\t\tlocation
\t}
}\`;`;
}

function updateApiFile(newQuery: string): void {
	console.log("Updating STATION_QUERY in api.ts...");

	const fileContent = readFileSync(API_FILE_PATH, "utf-8");
	if (!STATION_QUERY_REGEX.test(fileContent)) {
		throw new Error("Could not find STATION_QUERY in api.ts file");
	}

	const updatedContent = fileContent.replace(STATION_QUERY_REGEX, newQuery);
	writeFileSync(API_FILE_PATH, updatedContent, "utf-8");
	console.log("Updated STATION_QUERY in api.ts");
}

function getCurrentExcludedStations(): string[] {
	const fileContent = readFileSync(API_FILE_PATH, "utf-8");
	const queryMatch = fileContent.match(STATION_QUERY_REGEX);

	if (!queryMatch) {
		throw new Error("Could not find STATION_QUERY in api.ts");
	}

	const excludeMatches = queryMatch[0].matchAll(
		/\{shortCode:\{unequals:"([^"]+)"\}\}/g,
	);

	return Array.from(excludeMatches, (match) => match[1]).sort();
}

async function main(): Promise<void> {
	const dryRun = process.argv.includes("--dry-run");
	console.log(
		dryRun
			? "Starting station query check (dry run, no files will change)..."
			: "Starting station query update...",
	);

	const currentExcluded = getCurrentExcludedStations();
	console.log(`Currently excluded: ${currentExcluded.length} stations`);

	const newExcluded = await findStationsWithoutTrains(currentExcluded);

	const toAdd = newExcluded.filter((code) => !currentExcluded.includes(code));
	const toRemove = currentExcluded.filter(
		(code) => !newExcluded.includes(code),
	);

	console.log(`\nNew exclusions: ${toAdd.length}`);
	console.log(`Removed exclusions: ${toRemove.length}`);

	if (toAdd.length > 0) console.log(`Adding: ${toAdd.join(", ")}`);
	if (toRemove.length > 0) console.log(`Removing: ${toRemove.join(", ")}`);

	if (toAdd.length === 0 && toRemove.length === 0) {
		console.log("No changes needed");
		return;
	}

	// Sanity check: abort if too many stations would change status
	const changeCount = toAdd.length + toRemove.length;
	if (currentExcluded.length > 0) {
		if (changeCount / currentExcluded.length > SANITY_THRESHOLD) {
			throw new Error(
				`Sanity check failed: ${changeCount} changes vs ${currentExcluded.length} current exclusions (>${Math.round(SANITY_THRESHOLD * 100)}%). Aborting.`,
			);
		}
	} else if (changeCount > 10) {
		throw new Error(
			`Sanity check failed: ${changeCount} exclusions from empty baseline. Aborting.`,
		);
	}

	if (dryRun) {
		console.log(
			`\nDry run: would set excluded stations to ${newExcluded.length} (was ${currentExcluded.length})`,
		);
		return;
	}

	const newQuery = generateStationQuery(newExcluded);
	updateApiFile(newQuery);

	console.log(
		`\nDone! Excluded stations: ${newExcluded.length} (was ${currentExcluded.length})`,
	);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error("Station query update failed:", error);
		process.exit(1);
	});
}
