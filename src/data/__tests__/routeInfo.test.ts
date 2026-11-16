/** @format */

import { describe, expect, it } from "vitest";
import { stations as allStations } from "@/__tests__/fixtures/stations";
import { buildOriginRouteInfo, buildRouteInfo } from "../routeInfo";
import { getRouteStats, getStationStats } from "../routeStats";
import { getStationPlace, getTicket } from "../stationInfo";

describe("buildRouteInfo", () => {
	it("describes a route between two stations", () => {
		const route = getRouteStats("HKI", "TKL", allStations);
		expect(buildRouteInfo("HKI", "TKL", allStations)).toEqual({
			route,
			station: null,
			lines: route?.lines,
			hasReverse: true,
			place: getStationPlace("HKI"),
			ticket: getTicket("HKI", "TKL"),
		});
	});

	it("describes a single station", () => {
		const station = getStationStats("HKI", allStations);
		expect(buildRouteInfo("HKI", null, allStations)).toEqual({
			route: null,
			station,
			lines: station?.lines,
			hasReverse: false,
			place: getStationPlace("HKI"),
			ticket: null,
		});
	});
});

describe("buildOriginRouteInfo", () => {
	const info = buildOriginRouteInfo("HKI", allStations);

	it("holds the departure station's own info", () => {
		expect(info.station).toEqual(buildRouteInfo("HKI", null, allStations));
	});

	it("holds every route with direct trains from the station", () => {
		expect(info.routes.TKL).toEqual(buildRouteInfo("HKI", "TKL", allStations));
	});

	it("leaves out pairs with no direct train", () => {
		expect(info.routes).not.toHaveProperty("HKI");
		for (const entry of Object.values(info.routes)) {
			expect(entry.route).not.toBeNull();
		}
	});
});
