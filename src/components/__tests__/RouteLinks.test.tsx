/** @format */

import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import RouteLinks from "@/components/RouteLinks";
import type { Station } from "@/types";

const station = (shortCode: string, name: string): Station => ({
	name,
	shortCode,
	location: { latitude: 0, longitude: 0 },
});

const stations = [
	station("HKI", "Helsinki"),
	station("KE", "Kerava"),
	station("KÄP", "Käpylä"),
];

afterEach(cleanup);

describe("RouteLinks", () => {
	it("renders a lowercase link per route with both station names", () => {
		const { getByRole } = render(
			<RouteLinks
				stations={stations}
				routes={[{ from: "KE", to: "HKI" }]}
				titleKey="popularRoutes"
			/>,
		);

		const link = getByRole("link", { name: "Kerava → Helsinki" });
		expect(link.getAttribute("href")).toBe("/ke/hki/");
	});

	it("encodes nothing itself but keeps non-ASCII codes lowercase", () => {
		const { getByRole } = render(
			<RouteLinks
				stations={stations}
				routes={[{ from: "KÄP", to: "HKI" }]}
				titleKey="popularRoutes"
			/>,
		);

		expect(
			getByRole("link", { name: "Käpylä → Helsinki" }).getAttribute("href"),
		).toBe("/käp/hki/");
	});

	it("skips routes whose stations are not in the network", () => {
		const { queryAllByRole } = render(
			<RouteLinks
				stations={stations}
				routes={[
					{ from: "KE", to: "HKI" },
					{ from: "KE", to: "XXX" },
				]}
				titleKey="popularRoutes"
			/>,
		);

		expect(queryAllByRole("link")).toHaveLength(1);
	});

	it("renders nothing when no route can be resolved", () => {
		const { container } = render(
			<RouteLinks
				stations={stations}
				routes={[{ from: "XXX", to: "YYY" }]}
				titleKey="popularRoutes"
			/>,
		);

		expect(container.querySelector("nav")).toBeNull();
	});
});
