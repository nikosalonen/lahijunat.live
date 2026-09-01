/** @format */

import { beforeEach, describe, expect, it } from "vitest";
import type { RouteStats } from "@/types";
import { formatRouteSummary } from "@/utils/routeSummary";

const stats: RouteStats = {
	trainsPerDay: 174,
	firstDeparture: "04.05",
	lastDeparture: "03.40",
	medianDuration: 34,
	lines: ["D", "K", "R", "T", "V", "Z"],
};

describe("formatRouteSummary", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("fills every number into the Finnish sentence", () => {
		expect(formatRouteSummary(stats)).toBe(
			"Suoria junia noin 174 vuorokaudessa. " +
				"Matka kestää keskimäärin 34 min. " +
				"Linjat D, K, R, T, V, Z. " +
				"Ensimmäinen juna 04.05, viimeinen 03.40.",
		);
	});

	it("uses the singular when one line serves the route", () => {
		const summary = formatRouteSummary({ ...stats, lines: ["P"] });
		expect(summary).toContain("Linja P.");
		expect(summary).not.toContain("Linjat");
	});

	it("translates with the active language", () => {
		localStorage.setItem("lang", "en");
		expect(formatRouteSummary(stats)).toContain(
			"About 174 direct trains per day.",
		);

		localStorage.setItem("lang", "sv");
		expect(formatRouteSummary(stats)).toContain(
			"Cirka 174 direkta tåg per dygn.",
		);
	});

	it("leaves no placeholders behind in any language", () => {
		for (const lang of ["fi", "en", "sv"]) {
			localStorage.setItem("lang", lang);
			expect(formatRouteSummary(stats)).not.toMatch(/[{}]/);
		}
	});
});
