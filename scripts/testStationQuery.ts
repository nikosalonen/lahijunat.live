import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	fetchStations,
	fetchTrainsLeavingFromStation,
} from "../src/utils/api.js";

/**
 * Test script to preview what the automated station query update would do
 * This runs the same logic as updateStationQuery.ts but doesn't modify any files
 */

const API_FILE_PATH = join(process.cwd(), "src/utils/api.ts");
const DELAY_BETWEEN_REQUESTS = 5000; // Faster for testing, 5 seconds

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findStationsWithoutDestinations(): Promise<string[]> {
	console.log("🔍 Testing: Finding stations without commuter destinations...");

	const stations = await fetchStations();
	const stationsWithoutDestinations: string[] = [];

	console.log(
		`📊 Testing ${Math.min(10, stations.length)} stations (limited for testing)...`,
	);

	// Test only first 10 stations to make testing faster
	const testStations = stations.slice(0, 10);

	for (const [index, station] of testStations.entries()) {
		try {
			console.log(
				`[${index + 1}/${testStations.length}] Testing ${station.name} (${station.shortCode})...`,
			);

			if (index > 0) {
				console.log(`⏳ Waiting ${DELAY_BETWEEN_REQUESTS / 1000}s...`);
				await delay(DELAY_BETWEEN_REQUESTS);
			}

			const destinations = await fetchTrainsLeavingFromStation(
				station.shortCode,
			);

			if (destinations.length === 0) {
				stationsWithoutDestinations.push(station.shortCode);
				console.log(
					`❌ No destinations: ${station.name} (${station.shortCode})`,
				);
			} else {
				console.log(
					`✅ Found ${destinations.length} destinations: ${station.name} (${station.shortCode})`,
				);
			}
		} catch (error) {
			console.error(`💥 Error testing ${station.name}:`, error);
			stationsWithoutDestinations.push(station.shortCode);
		}
	}

	return stationsWithoutDestinations;
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

async function main(): Promise<void> {
	try {
		console.log("🧪 Testing automated station query update (DRY RUN)...");
		console.log(`📅 Started at: ${new Date().toISOString()}`);

		// Get current exclusions
		const currentExcluded = getCurrentExcludedStations();
		console.log(
			`\n📋 Currently excluded stations (${currentExcluded.length}):`,
		);
		console.log(`${currentExcluded.join(", ")}`);

		// Test a small subset of stations
		const testExcluded = await findStationsWithoutDestinations();

		console.log("\n🧪 Test Results:");
		console.log(
			`❌ Stations that would be excluded (from test sample): ${testExcluded.length}`,
		);
		console.log(`📝 Test excluded stations: ${testExcluded.join(", ")}`);

		// Show what the new query would look like (using current exclusions + test results)
		const combinedExcluded = [
			...new Set([...currentExcluded, ...testExcluded]),
		].sort();
		const newQuery = generateStationQuery(combinedExcluded);

		console.log("\n📄 Preview of updated query:");
		console.log("---".repeat(20));
		console.log(newQuery);
		console.log("---".repeat(20));

		console.log("\n📊 Summary:");
		console.log(`• Current exclusions: ${currentExcluded.length}`);
		console.log(`• Test found to exclude: ${testExcluded.length}`);
		console.log(`• Total exclusions would be: ${combinedExcluded.length}`);

		console.log("\n✅ Test completed successfully!");
		console.log("⚠️  This was a DRY RUN - no files were modified");
		console.log("🚀 To run the real update: npm run update-station-query");
	} catch (error) {
		console.error("💥 Error during test:", error);
		process.exit(1);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { main as testStationQuery };
