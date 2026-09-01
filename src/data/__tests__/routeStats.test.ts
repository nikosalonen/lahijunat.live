/** @format */

import { describe, expect, it } from "vitest";
import routeStatsData from "../route-stats.json";
import { getRouteStats, isServedRoute } from "../routeStats";

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
		const stats = getRouteStats("KE", "HKI");
		expect(stats?.trainsPerDay).toBeGreaterThan(0);
		expect(stats?.lines.length).toBeGreaterThan(0);
		expect(stats?.firstDeparture).toMatch(/^\d{2}\.\d{2}$/);
	});

	it("returns null when there are no statistics", () => {
		expect(getRouteStats("KKN", "RI")).toBeNull();
		expect(getRouteStats("KE", null)).toBeNull();
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
