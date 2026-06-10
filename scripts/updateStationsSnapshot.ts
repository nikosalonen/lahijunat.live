import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regenerates src/data/stations-snapshot.json from the live STATION_QUERY in
 * src/utils/api.ts. The snapshot is the build-time fallback for fetchStations:
 * Digitraffic occasionally returns 403 to shared CI runner IPs, and without a
 * fallback a single failed request kills the whole prerender.
 *
 * Self-contained — extracts the query from api.ts source (same pattern as
 * updateStationQuery.ts) instead of importing browser-oriented modules.
 */

const API_FILE_PATH = join(process.cwd(), "src/utils/api.ts");
const SNAPSHOT_PATH = join(process.cwd(), "src/data/stations-snapshot.json");
const GRAPHQL_URL = "https://rata.digitraffic.fi/api/v2/graphql/graphql";
// The commuter network is ~80 stations; abort on implausibly small results
const MIN_EXPECTED_STATIONS = 50;

function getVersion(): string {
	try {
		const packagePath = join(process.cwd(), "package.json");
		const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
		return packageJson.version;
	} catch (error) {
		console.warn("Could not read version from package.json:", error);
		return "unknown";
	}
}

function extractStationQuery(): string {
	const apiSource = readFileSync(API_FILE_PATH, "utf-8");
	const match = apiSource.match(
		/const STATION_QUERY = `(query GetStations \{[\s\S]*?)`;/,
	);
	if (!match) {
		throw new Error("STATION_QUERY not found in src/utils/api.ts");
	}
	return match[1];
}

interface GraphQLStation {
	name: string;
	shortCode: string;
	location: [number, number];
}

async function main(): Promise<void> {
	const query = extractStationQuery();
	const response = await fetch(GRAPHQL_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Accept-Encoding": "gzip",
			"User-Agent": `lahijunat.live/${getVersion()}`,
		},
		body: JSON.stringify({ query }),
	});
	if (!response.ok) {
		throw new Error(
			`GraphQL request failed: ${response.status} ${response.statusText}`,
		);
	}
	const result = await response.json();
	if (result.errors) {
		throw new Error(`GraphQL error: ${JSON.stringify(result.errors)}`);
	}

	const stations = (result.data.stations as GraphQLStation[])
		.map((station) => ({
			name: station.name.replace(" asema", ""),
			shortCode: station.shortCode,
			location: {
				latitude: station.location[1],
				longitude: station.location[0],
			},
		}))
		.sort((a, b) => a.shortCode.localeCompare(b.shortCode, "fi"));

	if (stations.length < MIN_EXPECTED_STATIONS) {
		throw new Error(
			`Sanity check failed: only ${stations.length} stations returned (expected >= ${MIN_EXPECTED_STATIONS})`,
		);
	}

	mkdirSync(join(process.cwd(), "src/data"), { recursive: true });
	writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(stations, null, "\t")}\n`);
	console.log(
		`Wrote ${stations.length} stations to src/data/stations-snapshot.json`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
