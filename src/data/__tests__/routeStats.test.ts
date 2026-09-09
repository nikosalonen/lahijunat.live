/** @format */

import { describe, expect, it } from "vitest";
import { stations as allStations } from "@/__tests__/fixtures/stations";
import routeStatsData from "../route-stats.json";
import {
	getLines,
	getRouteStats,
	getSitemapRouteKeys,
	isServedRoute,
} from "../routeStats";

describe("isServedRoute", () => {
	it("recognises a route with direct trains", () => {
		expect(isServedRoute("KE", "HKI")).toBe(true);
		expect(isServedRoute("HKI", "KE")).toBe(true);
	});

	it("rejects a pair with no direct service", () => {
		// Opposite ends of the network, no direct commuter train
		expect(isServedRoute("KKN", "RI")).toBe(false);
	});

	it("rejects incomplete routes", () => {
		expect(isServedRoute("KE", null)).toBe(false);
		expect(isServedRoute(null, "HKI")).toBe(false);
	});
});

describe("getRouteStats", () => {
	it("returns the summary for a served route", () => {
		const stats = getRouteStats("KE", "HKI", allStations);
		expect(stats?.trainsPerDay).toBeGreaterThan(0);
		expect(stats?.lines.length).toBeGreaterThan(0);
		expect(stats?.firstDeparture).toMatch(/^\d{2}\.\d{2}$/);
	});

	it("returns null when there are no statistics", () => {
		expect(getRouteStats("KKN", "RI", allStations)).toBeNull();
		expect(getRouteStats("KE", null, allStations)).toBeNull();
	});

	it("names only lines that have a page to link to", () => {
		// Line V runs in 92 route summaries but has no line page, so a chip
		// linking to /linja/v/ was a hard 404 on every one of them
		const pageable = new Set(getLines(allStations).map(({ line }) => line));
		const served = routeStatsData.served as string[];

		for (const key of served) {
			const [from, to] = key.split("-");
			const lines = getRouteStats(from, to, allStations)?.lines ?? [];
			expect(
				lines.filter((line) => !pageable.has(line)),
				`route ${key}`,
			).toEqual([]);
		}
	});

	it("keeps the lines that do have pages", () => {
		// The filter must not empty the list: HKI-KE is run by real, pageable
		// lines and has to keep every one of them
		const stats = getRouteStats("HKI", "KE", allStations);
		expect(stats?.lines).toContain("K");
		expect(stats?.lines.length).toBeGreaterThan(1);
	});
});

describe("getSitemapRouteKeys", () => {
	const keys = getSitemapRouteKeys();
	const served = new Set(routeStatsData.served);
	const routes = routeStatsData.routes as Record<
		string,
		{ trainsPerDay: number }
	>;

	it("lists a route the whole network runs on", () => {
		expect(keys).toContain("HKI-KE");
		expect(keys).toContain("KE-HKI");
	});

	it("lists only served routes", () => {
		expect(keys.filter((key) => !served.has(key))).toEqual([]);
	});

	it("leaves out routes with no summary of their own", () => {
		expect(keys.filter((key) => !routes[key])).toEqual([]);
	});

	it("leaves out the quietest routes", () => {
		const quietest = Math.min(...keys.map((key) => routes[key].trainsPerDay));
		expect(quietest).toBeGreaterThanOrEqual(6);

		const dropped = [...served].filter((key) => !keys.includes(key));
		expect(dropped.length).toBeGreaterThan(0);
		for (const key of dropped) {
			expect(routes[key]?.trainsPerDay ?? 0).toBeLessThan(6);
		}
	});

	it("still keeps most of the network, so the trim is not a collapse", () => {
		expect(keys.length).toBeGreaterThan(1000);
		expect(keys.length).toBeLessThan(served.size);
	});
});

describe("route-stats.json", () => {
	it("marks every summarised route as served", () => {
		const served = new Set(routeStatsData.served);
		const unserved = Object.keys(routeStatsData.routes).filter(
			(key) => !served.has(key),
		);
		expect(unserved).toEqual([]);
	});
});
