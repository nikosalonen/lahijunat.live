/** @format */

import { describe, expect, it } from "vitest";
import { POPULAR_STATIONS } from "../popularStations";
import stationsSnapshot from "../stations-snapshot.json";

describe("POPULAR_STATIONS", () => {
	it("has no duplicates", () => {
		expect(new Set(POPULAR_STATIONS).size).toBe(POPULAR_STATIONS.length);
	});

	it("names stations that exist in the network", () => {
		const known = new Set(stationsSnapshot.map((s) => s.shortCode));
		const missing = POPULAR_STATIONS.filter((code) => !known.has(code));
		expect(missing).toEqual([]);
	});
});
