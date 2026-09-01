/** @format */

import { describe, expect, it } from "vitest";
import { POPULAR_ROUTES } from "../popularRoutes";

describe("POPULAR_ROUTES", () => {
	it("has no duplicates", () => {
		const keys = POPULAR_ROUTES.map((r) => `${r.from}-${r.to}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("never links a station to itself", () => {
		for (const route of POPULAR_ROUTES) {
			expect(route.from).not.toBe(route.to);
		}
	});
});
