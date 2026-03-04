import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
 * Self-contained — calls the Digitraffic REST API directly instead of importing from api.ts.
 */

const API_FILE_PATH = join(process.cwd(), "src/utils/api.ts");
const DELAY_BETWEEN_REQUESTS = 2000;
const SANITY_THRESHOLD = 0.3; // abort if >30% of stations change status or fail
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

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllStations(): Promise<Station[]> {
	console.log("Fetching all stations from GraphQL API...");

	const response = await fetch(
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

async function hasCommuterTrains(stationCode: string): Promise<boolean | null> {
	try {
		const url = `https://rata.digitraffic.fi/api/v1/live-trains/station/${stationCode}?minutes_before_departure=120&minutes_after_departure=0&minutes_before_arrival=0&minutes_after_arrival=0&train_categories=Commuter`;
		const response = await fetch(url, {
			headers: {
				"Accept-Encoding": "gzip",
				"User-Agent": USER_AGENT,
			},
		});

		if (!response.ok) {
			console.error(`Error checking ${stationCode}: HTTP ${response.status}`);
			return null;
		}

		const trains = await response.json();
		return Array.isArray(trains) && trains.length > 0;
	} catch (error) {
		const errorType =
			error instanceof SyntaxError
				? "JSON parse error"
				: error instanceof TypeError
					? "Network/fetch error"
					: "Unexpected error";
		console.error(`${errorType} checking ${stationCode}:`, error);
		return null;
	}
}

async function findStationsWithoutTrains(
	currentExcluded: string[],
): Promise<string[]> {
	console.log("Checking stations for commuter train traffic...");

	const allStations = await fetchAllStations();
	const excluded: string[] = [];
	let errorCount = 0;

	for (const [index, station] of allStations.entries()) {
		if (index > 0) {
			await delay(DELAY_BETWEEN_REQUESTS);
		}

		console.log(
			`[${index + 1}/${allStations.length}] ${station.name} (${station.shortCode})`,
		);

		const result = await hasCommuterTrains(station.shortCode);

		if (result === null) {
			errorCount++;
			// Preserve current status: keep excluded stations excluded, keep included stations included
			if (currentExcluded.includes(station.shortCode)) {
				excluded.push(station.shortCode);
				console.warn(
					`  Keeping ${station.shortCode} excluded (check failed, preserving current status)`,
				);
			} else {
				console.warn(
					`  Keeping ${station.shortCode} included (check failed, preserving current status)`,
				);
			}
		} else if (!result) {
			excluded.push(station.shortCode);
		}
	}

	if (errorCount > 0) {
		console.warn(
			`\n${errorCount}/${allStations.length} station checks failed — preserving their current status`,
		);
	}

	// Abort if too many errors — likely an API outage
	const errorRate = errorCount / allStations.length;
	if (errorRate > SANITY_THRESHOLD) {
		throw new Error(
			`Too many stations failed to check: ${errorCount}/${allStations.length} (${Math.round(errorRate * 100)}%). Aborting.`,
		);
	}

	return excluded;
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
	console.log("Starting station query update...");

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

export { main as updateStationQuery };
