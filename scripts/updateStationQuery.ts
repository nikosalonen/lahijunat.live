import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchTrainsLeavingFromStation } from "../src/utils/api.js";

// Read package.json dynamically for version
const getVersion = (): string => {
	try {
		const packagePath = join(process.cwd(), "package.json");
		const packageContent = readFileSync(packagePath, "utf-8");
		const packageJson = JSON.parse(packageContent);
		return packageJson.version;
	} catch {
		return "unknown";
	}
};

/**
 * Automated script to find stations without commuter traffic and update STATION_QUERY
 * This replaces the manual process of running check-stations and updating the query by hand
 */

const API_FILE_PATH = join(process.cwd(), "src/utils/api.ts");
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds to be respectful to the API
const MAX_RETRIES = 2;
const CONCURRENCY = 3;
const SANITY_THRESHOLD = 0.3; // abort if >30% of stations change status
const MAX_ABSOLUTE_CHANGES = 10;

// GraphQL query to fetch ALL stations with passenger traffic (no exclusions)
const ALL_STATIONS_QUERY = `query GetAllStations {
	stations(where:{
		and:[
			{passengerTraffic:{equals:true}}
		]
	}){
		name
		shortCode
		location
	}
}`;

interface Station {
	name: string;
	shortCode: string;
	location: {
		latitude: number;
		longitude: number;
	};
}

interface GraphQLStation {
	name: string;
	shortCode: string;
	location: [number, number];
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllStations(): Promise<Station[]> {
	console.log("🌍 Fetching ALL stations (no exclusions) from GraphQL API...");

	const response = await fetch(
		"https://rata.digitraffic.fi/api/v2/graphql/graphql",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept-Encoding": "gzip",
				"User-Agent": `lahijunat.live/${getVersion()}`,
			},
			body: JSON.stringify({ query: ALL_STATIONS_QUERY }),
		},
	);

	if (!response.ok) {
		throw new Error(`Failed to fetch all stations: ${response.statusText}`);
	}

	const result = await response.json();

	// Check for GraphQL errors
	if (result.errors) {
		throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
	}

	// Check if the response has the expected structure
	if (!result?.data?.stations) {
		throw new Error(
			`Invalid response format from GraphQL API. Response: ${JSON.stringify(result)}`,
		);
	}

	const stations = result.data.stations.map(
		(station: GraphQLStation): Station => ({
			...station,
			name: station.name.replace(" asema", ""),
			location: {
				longitude: station.location[0],
				latitude: station.location[1],
			},
		}),
	);

	if (stations.length === 0) {
		throw new Error(
			"GraphQL API returned zero stations. This likely indicates an API issue.",
		);
	}

	console.log(
		`✅ Fetched ${stations.length} total stations with passenger traffic`,
	);
	return stations;
}

async function fetchWithRetry(
	station: Station,
): Promise<{ shortCode: string; hasDestinations: boolean | null }> {
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			if (attempt > 0) {
				const backoff = DELAY_BETWEEN_REQUESTS * 2 ** attempt;
				console.log(
					`🔄 Retry ${attempt}/${MAX_RETRIES} for ${station.shortCode} (waiting ${backoff / 1000}s)...`,
				);
				await delay(backoff);
			}

			const destinations = await fetchTrainsLeavingFromStation(
				station.shortCode,
			);

			if (destinations.length === 0) {
				console.log(
					`❌ No destinations found for: ${station.name} (${station.shortCode})`,
				);
				return { shortCode: station.shortCode, hasDestinations: false };
			}
			console.log(
				`✅ Found ${destinations.length} destinations for: ${station.name} (${station.shortCode})`,
			);
			return { shortCode: station.shortCode, hasDestinations: true };
		} catch (error) {
			console.error(
				`💥 Error checking station ${station.name} (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
				error,
			);
			// Don't retry on programming/parse errors — they won't recover
			if (error instanceof TypeError || error instanceof SyntaxError) {
				break;
			}
		}
	}

	console.warn(
		`⚠️ All retries failed for ${station.name} (${station.shortCode}) — skipping (keeping current status)`,
	);
	return { shortCode: station.shortCode, hasDestinations: null };
}

async function findStationsWithoutDestinations(
	currentExcluded: string[],
): Promise<string[]> {
	console.log("🔍 Finding stations without commuter destinations...");

	const allStations = await fetchAllStations();
	const results: { shortCode: string; hasDestinations: boolean | null }[] = [];

	console.log(
		`📊 Checking ${allStations.length} stations with concurrency=${CONCURRENCY}...`,
	);

	// Process stations with limited concurrency
	const pending = new Set<Promise<void>>();

	for (const [index, station] of allStations.entries()) {
		console.log(
			`[${index + 1}/${allStations.length}] Checking ${station.name} (${station.shortCode})...`,
		);

		// Stagger requests by DELAY_BETWEEN_REQUESTS
		if (index > 0) {
			await delay(DELAY_BETWEEN_REQUESTS);
		}

		const task = fetchWithRetry(station)
			.then((result) => {
				results.push(result);
			})
			.catch((error) => {
				console.error(
					`💥 Unexpected error processing ${station.shortCode}:`,
					error,
				);
				results.push({ shortCode: station.shortCode, hasDestinations: null });
			});
		let tracked: Promise<void>;
		tracked = task.finally(() => pending.delete(tracked));
		pending.add(tracked);

		// Wait for a slot when concurrency limit is reached
		if (pending.size >= CONCURRENCY) {
			await Promise.race(pending);
		}
	}

	// Wait for all remaining
	await Promise.all(pending);

	if (results.length !== allStations.length) {
		throw new Error(
			`Results mismatch: got ${results.length} results for ${allStations.length} stations. Some stations may have been silently dropped.`,
		);
	}

	// Abort if too many stations errored — likely an API outage
	const errorCount = results.filter((r) => r.hasDestinations === null).length;
	const errorRate =
		allStations.length > 0 ? errorCount / allStations.length : 1;
	console.log(
		`\n📊 Check results: ${results.length} checked, ${errorCount} errors (${Math.round(errorRate * 100)}%)`,
	);
	if (errorRate > SANITY_THRESHOLD) {
		throw new Error(
			`🚨 Too many stations failed to check: ${errorCount}/${allStations.length} (${Math.round(errorRate * 100)}%). This likely indicates an API issue. Aborting.`,
		);
	}

	// Build exclusion list: exclude stations with no destinations,
	// keep current status for stations that errored (null)
	const stationsWithoutDestinations: string[] = [];
	for (const result of results) {
		if (result.hasDestinations === false) {
			stationsWithoutDestinations.push(result.shortCode);
		} else if (result.hasDestinations === null) {
			// Keep current status for errored stations
			if (currentExcluded.includes(result.shortCode)) {
				stationsWithoutDestinations.push(result.shortCode);
			}
		}
	}

	return stationsWithoutDestinations;
}

function generateStationQuery(excludedStations: string[]): string {
	const excludeLines = excludedStations
		.sort() // Sort alphabetically for consistency
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
	console.log("📝 Updating STATION_QUERY in api.ts...");

	const fileContent = readFileSync(API_FILE_PATH, "utf-8");

	// Find the STATION_QUERY definition using regex
	const queryRegex = /const STATION_QUERY = `query GetStations \{[\s\S]*?\}`;/;

	if (!queryRegex.test(fileContent)) {
		throw new Error("Could not find STATION_QUERY in api.ts file");
	}

	const updatedContent = fileContent.replace(queryRegex, newQuery);

	writeFileSync(API_FILE_PATH, updatedContent, "utf-8");
	console.log("✅ Successfully updated STATION_QUERY in api.ts");
}

function getCurrentExcludedStations(): string[] {
	const fileContent = readFileSync(API_FILE_PATH, "utf-8");
	const queryMatch = fileContent.match(
		/const STATION_QUERY = `query GetStations \{[\s\S]*?\}`;/,
	);

	if (!queryMatch) {
		throw new Error("Could not find STATION_QUERY in api.ts");
	}

	const query = queryMatch[0];
	const excludeMatches = query.matchAll(
		/\{shortCode:\{unequals:"([^"]+)"\}\}/g,
	);

	return Array.from(excludeMatches, (match) => match[1]).sort();
}

async function main(): Promise<void> {
	console.log("🚀 Starting automated station query update...");
	console.log(`📅 Started at: ${new Date().toISOString()}`);

	// Get current exclusions
	const currentExcluded = getCurrentExcludedStations();
	console.log(`\n📋 Currently excluded stations: ${currentExcluded.length}`);
	console.log(`Current: ${currentExcluded.join(", ")}`);

	// Find stations without destinations
	const newExcluded = await findStationsWithoutDestinations(currentExcluded);

	// Calculate differences
	const toAdd = newExcluded.filter((code) => !currentExcluded.includes(code));
	const toRemove = currentExcluded.filter(
		(code) => !newExcluded.includes(code),
	);

	console.log("\n📊 Summary:");
	console.log(
		`✅ Stations with commuter traffic: ${toRemove.length} (will be re-included)`,
	);
	console.log(
		`❌ Stations without commuter traffic: ${newExcluded.length} (will be excluded)`,
	);
	console.log(`📈 New exclusions: ${toAdd.length} stations`);
	console.log(`📉 Removed exclusions: ${toRemove.length} stations`);

	if (toAdd.length > 0) {
		console.log(`🔴 Adding exclusions: ${toAdd.join(", ")}`);
	}
	if (toRemove.length > 0) {
		console.log(`🟢 Removing exclusions: ${toRemove.join(", ")}`);
	}

	// Only update if there are changes
	if (toAdd.length === 0 && toRemove.length === 0) {
		console.log("\n✨ No changes needed - all stations have the same status");
		return;
	}

	// Sanity check: abort if too many stations would change status
	if (
		currentExcluded.length > 0 &&
		toAdd.length / currentExcluded.length > SANITY_THRESHOLD
	) {
		throw new Error(
			`🚨 Sanity check failed: ${toAdd.length} new exclusions would be added (>${Math.round(SANITY_THRESHOLD * 100)}% of ${currentExcluded.length} current exclusions). This likely indicates an API issue. Aborting.`,
		);
	}
	if (
		currentExcluded.length > 0 &&
		toRemove.length / currentExcluded.length > SANITY_THRESHOLD
	) {
		throw new Error(
			`🚨 Sanity check failed: ${toRemove.length} exclusions would be removed (>${Math.round(SANITY_THRESHOLD * 100)}% of ${currentExcluded.length} current exclusions). This likely indicates an API issue. Aborting.`,
		);
	}

	// Absolute threshold fallback for when currentExcluded is empty
	if (currentExcluded.length === 0 && toAdd.length > MAX_ABSOLUTE_CHANGES) {
		throw new Error(
			`🚨 Sanity check failed: ${toAdd.length} stations would be excluded (absolute limit: ${MAX_ABSOLUTE_CHANGES}). This likely indicates an API issue. Aborting.`,
		);
	}

	// Generate new query
	const newQuery = generateStationQuery(newExcluded);

	// Update the file
	updateApiFile(newQuery);

	console.log("\n🎉 Station query update completed successfully!");
	console.log(`📝 Final exclusions: ${newExcluded.length} stations`);
	console.log(`⏰ Finished at: ${new Date().toISOString()}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error("💥 Unhandled error in main:", error);
		process.exit(1);
	});
}

export { main as updateStationQuery };
