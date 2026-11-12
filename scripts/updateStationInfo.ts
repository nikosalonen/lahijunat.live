import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Regenerates src/data/station-info.json: each station's HSL fare zone and
 * street address, and the zones each HSL ticket covers.
 *
 * Digitraffic's station metadata has neither, but HSL's open GTFS feed lists
 * every rail platform in its area with both. Stations outside the HSL area
 * are not in the feed and get no entry, which is how the site knows a trip
 * needs a VR ticket.
 *
 * The feed is a ~90 MB zip, so like route-stats.json the result is committed
 * and the build never downloads it. Needs the `unzip` command.
 *
 * Run with: pnpm run update-station-info
 */

const GTFS_URL = "https://infopalvelut.storage.hsldev.com/gtfs/hsl.zip";
const STATIONS_PATH = join(process.cwd(), "src/data/stations-snapshot.json");
const OUTPUT_PATH = join(process.cwd(), "src/data/station-info.json");

/** GTFS vehicle type of HSL's commuter rail platforms. */
const RAIL_VEHICLE_TYPE = "109";
/** The zone_id HSL gives platforms it lists but does not sell tickets for. */
const OUTSIDE_HSL_ZONE = "Ei HSL";
/** A platform this far from the station's coordinates is a different place. */
const MAX_DISTANCE_METRES = 1000;
/** Sanity check: the HSL area has dozens of commuter stations. */
const MIN_EXPECTED_STATIONS = 40;

interface SnapshotStation {
	name: string;
	shortCode: string;
	location: { latitude: number; longitude: number };
}

/** Parses RFC 4180 CSV, which GTFS uses: quoted fields may hold commas. */
function parseCsv(text: string): Record<string, string>[] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (inQuotes) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (char === '"') {
				inQuotes = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	const [header, ...body] = rows;
	const keys = header.map((key) => key.replace(/^﻿/, "").trim());
	return body
		.filter((cells) => cells.some((cell) => cell.trim() !== ""))
		.map((cells) =>
			Object.fromEntries(keys.map((key, i) => [key, (cells[i] ?? "").trim()])),
		);
}

function distanceMetres(
	a: { latitude: number; longitude: number },
	b: { latitude: number; longitude: number },
): number {
	const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
	const dLat = toRadians(b.latitude - a.latitude);
	const dLon = toRadians(b.longitude - a.longitude);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRadians(a.latitude)) *
			Math.cos(toRadians(b.latitude)) *
			Math.sin(dLon / 2) ** 2;
	return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** The value seen most often, or null when there are none. */
function mostCommon(values: string[]): string | null {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	const [top] = [...counts].sort(([, a], [, b]) => b - a);
	return top?.[0] ?? null;
}

async function downloadFeed(directory: string): Promise<string> {
	const response = await fetch(GTFS_URL);
	if (!response.ok) {
		throw new Error(
			`GTFS download failed: ${response.status} ${response.statusText}`,
		);
	}
	const path = join(directory, "hsl.zip");
	writeFileSync(path, Buffer.from(await response.arrayBuffer()));
	return path;
}

function readFromZip(zipPath: string, file: string): Record<string, string>[] {
	const text = execFileSync("unzip", ["-p", zipPath, file], {
		encoding: "utf-8",
		maxBuffer: 64 * 1024 * 1024,
	});
	return parseCsv(text);
}

/**
 * Which zones each ticket covers, from the feed's fare rules. Rules tied to
 * one bus route are left out: they are exceptions, not tickets a rail
 * traveller buys.
 */
function collectFares(
	attributes: Record<string, string>[],
	rules: Record<string, string>[],
): { id: string; price: number; zones: string[] }[] {
	const zones = new Map<string, Set<string>>();
	for (const rule of rules) {
		if (rule.route_id || !rule.contains_id) continue;
		const set = zones.get(rule.fare_id) ?? new Set<string>();
		set.add(rule.contains_id);
		zones.set(rule.fare_id, set);
	}

	return attributes
		.filter((fare) => zones.has(fare.fare_id))
		.map((fare) => ({
			id: fare.fare_id,
			price: Number(fare.price),
			zones: [...(zones.get(fare.fare_id) ?? [])].sort(),
		}))
		.sort((a, b) => a.id.localeCompare(b.id));
}

function collectStations(
	stops: Record<string, string>[],
	snapshot: SnapshotStation[],
): Record<string, { zone: string | null; address: string | null }> {
	const platformsByName = new Map<string, Record<string, string>[]>();
	for (const stop of stops) {
		if (stop.vehicle_type !== RAIL_VEHICLE_TYPE) continue;
		const platforms = platformsByName.get(stop.stop_name) ?? [];
		platforms.push(stop);
		platformsByName.set(stop.stop_name, platforms);
	}

	const result: Record<
		string,
		{ zone: string | null; address: string | null }
	> = {};
	for (const station of [...snapshot].sort((a, b) =>
		a.shortCode.localeCompare(b.shortCode),
	)) {
		// HSL names its platforms after the station, as the snapshot does
		const platforms = (platformsByName.get(station.name) ?? []).filter(
			(platform) =>
				distanceMetres(station.location, {
					latitude: Number(platform.stop_lat),
					longitude: Number(platform.stop_lon),
				}) <= MAX_DISTANCE_METRES,
		);
		if (platforms.length === 0) continue;

		const zone = mostCommon(platforms.map((platform) => platform.zone_id));
		const descriptions = platforms
			.map((platform) => platform.stop_desc)
			.filter((description) => description !== "");
		// "Kaivokatu 1" beats "Kaivokatu": a house number finds the door
		const address =
			mostCommon(
				descriptions.filter((description) => /\d/.test(description)),
			) ?? mostCommon(descriptions);

		result[station.shortCode] = {
			zone: zone && zone !== OUTSIDE_HSL_ZONE ? zone : null,
			address,
		};
	}
	return result;
}

async function main(): Promise<void> {
	const snapshot: SnapshotStation[] = JSON.parse(
		readFileSync(STATIONS_PATH, "utf-8"),
	);

	const directory = mkdtempSync(join(tmpdir(), "hsl-gtfs-"));
	try {
		const zipPath = await downloadFeed(directory);
		const [feedInfo] = readFromZip(zipPath, "feed_info.txt");
		const fares = collectFares(
			readFromZip(zipPath, "fare_attributes.txt"),
			readFromZip(zipPath, "fare_rules.txt"),
		);
		const stations = collectStations(
			readFromZip(zipPath, "stops.txt"),
			snapshot,
		);

		const count = Object.keys(stations).length;
		if (count < MIN_EXPECTED_STATIONS || fares.length === 0) {
			throw new Error(
				`Sanity check failed: ${count} stations and ${fares.length} fares found`,
			);
		}

		writeFileSync(
			OUTPUT_PATH,
			`${JSON.stringify(
				{
					// "2026-11-12 05:42:11" -> "2026-11-12"
					feedVersion: feedInfo?.feed_version?.slice(0, 10) ?? null,
					fares,
					stations,
				},
				null,
				"\t",
			)}\n`,
		);
		console.log(
			`Wrote ${count} stations and ${fares.length} fares to src/data/station-info.json`,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
