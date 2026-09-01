/** @format */

import { describe, expect, it } from "vitest";
import type { Station } from "../../types";
import { buildRoutePath, decodePath, resolveShortCode } from "../stationRoute";

const station = (shortCode: string, name: string): Station => ({
	name,
	shortCode,
	location: { latitude: 0, longitude: 0 },
});

const stations = [
	station("HKI", "Helsinki"),
	station("TPE", "Tampere"),
	station("KÄP", "Käpylä"),
];

describe("buildRoutePath", () => {
	it("returns the root path when no origin is selected", () => {
		expect(buildRoutePath(null, null)).toBe("/");
		expect(buildRoutePath(null, "TPE")).toBe("/");
	});

	it("lowercases the codes and adds a trailing slash", () => {
		expect(buildRoutePath("HKI", null)).toBe("/hki/");
		expect(buildRoutePath("HKI", "TPE")).toBe("/hki/tpe/");
	});

	it("handles codes with non-ASCII letters", () => {
		expect(buildRoutePath("KÄP", "HKI")).toBe("/käp/hki/");
	});
});

describe("decodePath", () => {
	it("decodes percent-encoded paths", () => {
		expect(decodePath("/k%C3%A4p/hki/")).toBe("/käp/hki/");
	});

	it("returns malformed paths unchanged", () => {
		expect(decodePath("/%E0%A4%A")).toBe("/%E0%A4%A");
	});
});

describe("resolveShortCode", () => {
	it("resolves lowercase URL codes to canonical short codes", () => {
		expect(resolveShortCode(stations, "hki")).toBe("HKI");
		expect(resolveShortCode(stations, "käp")).toBe("KÄP");
	});

	it("still resolves the old uppercase links", () => {
		expect(resolveShortCode(stations, "HKI")).toBe("HKI");
	});

	it("returns null for unknown or missing codes", () => {
		expect(resolveShortCode(stations, "xyz")).toBeNull();
		expect(resolveShortCode(stations, null)).toBeNull();
		expect(resolveShortCode(stations, undefined)).toBeNull();
	});
});
