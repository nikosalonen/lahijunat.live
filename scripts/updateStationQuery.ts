import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
	fetchStations,
	fetchTrainsLeavingFromStation,
} from "../src/utils/api.js";

/**
 * Automated script to find stations without commuter traffic and update STATION_QUERY
 * This replaces the manual process of running check-stations and updating the query by hand
 */

const API_FILE_PATH = join(process.cwd(), "src/utils/api.ts");
const DELAY_BETWEEN_REQUESTS = 5000; // 5 seconds to be respectful to the API

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findStationsWithoutDestinations(): Promise<string[]> {
	console.log("🔍 Finding stations without commuter destinations...");

	const stations = await fetchStations();
	const stationsWithoutDestinations: string[] = [];

	console.log(`📊 Checking ${stations.length} stations...`);

	for (const [index, station] of stations.entries()) {
		try {
			console.log(
				`[${index + 1}/${stations.length}] Checking ${station.name} (${station.shortCode})...`,
			);

			// Add delay between requests to be respectful to the API
			if (index > 0) {
				console.log(
					`⏳ Waiting ${DELAY_BETWEEN_REQUESTS / 1000}s before next request...`,
				);
				await delay(DELAY_BETWEEN_REQUESTS);
			}

			const destinations = await fetchTrainsLeavingFromStation(
				station.shortCode,
			);

			if (destinations.length === 0) {
				stationsWithoutDestinations.push(station.shortCode);
				console.log(
					`❌ No destinations found for: ${station.name} (${station.shortCode})`,
				);
			} else {
				console.log(
					`✅ Found ${destinations.length} destinations for: ${station.name} (${station.shortCode})`,
				);
			}
		} catch (error) {
			console.error(`💥 Error checking station ${station.name}:`, error);
			// Add to exclusion list if there's an error (safer to exclude)
			stationsWithoutDestinations.push(station.shortCode);
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

async function main(): Promise<void> {
	try {
		console.log("🚀 Starting automated station query update...");
		console.log(`📅 Started at: ${new Date().toISOString()}`);

		// Find stations without destinations
		const excludedStations = await findStationsWithoutDestinations();

		console.log("\n📋 Summary:");
		console.log(`❌ Stations to exclude: ${excludedStations.length}`);
		console.log(`📝 Excluded stations: ${excludedStations.join(", ")}`);

		// Generate new query
		const newQuery = generateStationQuery(excludedStations);

		// Update the file
		updateApiFile(newQuery);

		console.log("\n🎉 Station query update completed successfully!");
		console.log(`⏰ Finished at: ${new Date().toISOString()}`);
	} catch (error) {
		console.error("💥 Error during station query update:", error);
		process.exit(1);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { main as updateStationQuery };
