/** @format */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { OriginRouteInfo, RouteInfoData } from "../../types";
import { fetchRouteInfo } from "../routeInfo";

const stationEntry: RouteInfoData = {
	route: null,
	station: {
		destinations: 1,
		lines: ["R"],
		firstDeparture: "05.00",
		lastDeparture: "23.00",
	},
	lines: ["R"],
	hasReverse: false,
	place: { zone: "A", address: "Kaivokatu 1" },
	ticket: null,
};

const routeEntry: RouteInfoData = {
	route: {
		trainsPerDay: 100,
		firstDeparture: "05.00",
		lastDeparture: "23.00",
		medianDuration: 14,
		lines: ["R"],
		lineDurations: { R: 14 },
		daytimeGap: null,
	},
	station: null,
	lines: ["R"],
	hasReverse: true,
	place: { zone: "A", address: "Kaivokatu 1" },
	ticket: { kind: "hsl", fares: ["AB"] },
};

const file: OriginRouteInfo = {
	station: stationEntry,
	routes: { TKL: routeEntry },
};

const respondWith = (body: unknown, ok = true) =>
	vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });

// The module keeps one file per origin for the whole session, so each test
// asks about an origin no other test uses.
describe("fetchRouteInfo", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("reads the departure station's file", async () => {
		const fetchMock = respondWith(file);
		vi.stubGlobal("fetch", fetchMock);

		await fetchRouteInfo("AAA", "TKL");

		expect(fetchMock).toHaveBeenCalledWith("/route-info/aaa.json");
	});

	it("returns the route to the destination", async () => {
		vi.stubGlobal("fetch", respondWith(file));
		expect(await fetchRouteInfo("BBB", "TKL")).toEqual(routeEntry);
	});

	it("returns the station's own info when there is no destination", async () => {
		vi.stubGlobal("fetch", respondWith(file));
		expect(await fetchRouteInfo("CCC", null)).toEqual(stationEntry);
	});

	it("returns null for a destination with no direct train", async () => {
		vi.stubGlobal("fetch", respondWith(file));
		expect(await fetchRouteInfo("DDD", "TPE")).toBeNull();
	});

	it("reads each station's file only once", async () => {
		const fetchMock = respondWith(file);
		vi.stubGlobal("fetch", fetchMock);

		await fetchRouteInfo("EEE", "TKL");
		await fetchRouteInfo("EEE", null);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("returns null and tries again later when the file fails to load", async () => {
		vi.stubGlobal("fetch", respondWith(null, false));
		expect(await fetchRouteInfo("FFF", "TKL")).toBeNull();

		vi.stubGlobal("fetch", respondWith(file));
		expect(await fetchRouteInfo("FFF", "TKL")).toEqual(routeEntry);
	});

	it("returns null when the network is down", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
		expect(await fetchRouteInfo("GGG", "TKL")).toBeNull();
	});
});
