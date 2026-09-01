/** @format */

import { describe, expect, it } from "vitest";
import type { Station } from "../../types";
import { getLineStats, getLines, getStationStats } from "../routeStats";
import stationsSnapshot from "../stations-snapshot.json";

const allStations = stationsSnapshot as Station[];
const withoutStation = (shortCode: string): Station[] =>
	allStations.filter((station) => station.shortCode !== shortCode);

describe("getLines", () => {
	it("returns lines in alphabetical order", () => {
		const letters = getLines(allStations).map(({ line }) => line);
		expect(letters.length).toBeGreaterThan(5);
		expect([...letters].sort()).toEqual(letters);
	});

	it("names only stations that exist in the network", () => {
		const known = new Set(allStations.map((s) => s.shortCode));
		for (const { line, stats } of getLines(allStations)) {
			const unknown = [...stats.stations, ...stats.endpoints].filter(
				(code) => !known.has(code),
			);
			expect(unknown, `line ${line}`).toEqual([]);
		}
	});

	it("lists each station once and covers both endpoints", () => {
		for (const { line, stats } of getLines(allStations)) {
			expect(new Set(stats.stations).size, `line ${line}`).toBe(
				stats.stations.length,
			);
			expect(stats.stations, `line ${line}`).toContain(stats.endpoints[0]);
			expect(stats.stations, `line ${line}`).toContain(stats.endpoints[1]);
		}
	});

	it("lists stations in travel order, from Helsinki where it is served", () => {
		for (const { line, stats } of getLines(allStations)) {
			// A corridor, not a handful of scattered legs
			expect(stats.stations.length, `line ${line}`).toBeGreaterThan(3);
			if (stats.stations.includes("HKI")) {
				expect(stats.stations.indexOf("HKI"), `line ${line}`).toBeLessThan(
					stats.stations.length / 2,
				);
			}
		}
	});

	it("gives a ring line a far point and a plain line none", () => {
		for (const { line, stats } of getLines(allStations)) {
			const isRing = stats.endpoints[0] === stats.endpoints[1];
			expect(stats.via !== null, `line ${line}`).toBe(isRing);
		}
	});
});

describe("getLineStats", () => {
	it("finds a line whatever the case", () => {
		const [{ line }] = getLines(allStations);
		expect(getLineStats(line, allStations)).not.toBeNull();
		expect(getLineStats(line.toLowerCase(), allStations)).toEqual(
			getLineStats(line, allStations),
		);
	});

	it("returns null for a line that does not run", () => {
		expect(getLineStats("Q", allStations)).toBeNull();
		expect(getLineStats(null, allStations)).toBeNull();
	});
});

describe("a station closed for renovation", () => {
	// Kera has closed for months at a time; it sits mid-line on E, L and U
	const CLOSED = "KEA";

	it("drops it from every line that served it", () => {
		for (const { line, stats } of getLines(withoutStation(CLOSED))) {
			expect(stats.stations, `line ${line}`).not.toContain(CLOSED);
		}
	});

	it("counts one station fewer on the lines that served it", () => {
		const before = getLineStats("E", allStations);
		const after = getLineStats("E", withoutStation(CLOSED));
		expect(before?.stations).toContain(CLOSED);
		expect(after?.stations.length).toBe((before?.stations.length ?? 0) - 1);
	});

	it("moves the label to a station still open when an end closes", () => {
		const before = getLineStats("K", allStations);
		const closedEnd = before?.endpoints[1] as string;
		const after = getLineStats("K", withoutStation(closedEnd));
		expect(after?.endpoints[1]).not.toBe(closedEnd);
		expect(after?.stations).toContain(after?.endpoints[1]);
	});

	it("counts only open destinations in a station's own summary", () => {
		const before = getStationStats("HKI", allStations);
		const after = getStationStats("HKI", withoutStation(CLOSED));
		expect(before?.destinations).toBeGreaterThan(0);
		expect(after?.destinations).toBe((before?.destinations ?? 0) - 1);
	});

	it("has no summary of its own once closed", () => {
		expect(getStationStats(CLOSED, withoutStation(CLOSED))).toBeNull();
	});
});
