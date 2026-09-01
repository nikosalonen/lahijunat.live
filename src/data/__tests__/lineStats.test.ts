/** @format */

import { describe, expect, it } from "vitest";
import { getLineStats, getLines } from "../routeStats";
import stationsSnapshot from "../stations-snapshot.json";

describe("getLines", () => {
	it("returns lines in alphabetical order", () => {
		const letters = getLines().map(({ line }) => line);
		expect(letters.length).toBeGreaterThan(5);
		expect([...letters].sort()).toEqual(letters);
	});

	it("names only stations that exist in the network", () => {
		const known = new Set(stationsSnapshot.map((s) => s.shortCode));
		for (const { line, stats } of getLines()) {
			const unknown = [...stats.stations, ...stats.endpoints].filter(
				(code) => !known.has(code),
			);
			expect(unknown, `line ${line}`).toEqual([]);
		}
	});

	it("lists each station once and covers both endpoints", () => {
		for (const { line, stats } of getLines()) {
			expect(new Set(stats.stations).size, `line ${line}`).toBe(
				stats.stations.length,
			);
			expect(stats.stations, `line ${line}`).toContain(stats.endpoints[0]);
			expect(stats.stations, `line ${line}`).toContain(stats.endpoints[1]);
		}
	});

	it("gives a ring line a far point and a plain line none", () => {
		for (const { line, stats } of getLines()) {
			const isRing = stats.endpoints[0] === stats.endpoints[1];
			expect(stats.via !== null, `line ${line}`).toBe(isRing);
		}
	});
});

describe("getLineStats", () => {
	it("finds a line whatever the case", () => {
		const [{ line }] = getLines();
		expect(getLineStats(line)).not.toBeNull();
		expect(getLineStats(line.toLowerCase())).toEqual(getLineStats(line));
	});

	it("returns null for a line that does not run", () => {
		expect(getLineStats("Q")).toBeNull();
		expect(getLineStats(null)).toBeNull();
	});
});
