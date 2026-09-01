/** @format */

import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import StationLinks from "@/components/StationLinks";
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

describe("StationLinks", () => {
	it("links each station by its lowercase short code", () => {
		const { getByRole } = render(
			<StationLinks
				stations={stations}
				codes={["KE"]}
				titleKey="popularStations"
			/>,
		);

		expect(getByRole("link", { name: "Kerava" }).getAttribute("href")).toBe(
			"/ke/",
		);
	});

	it("keeps non-ASCII codes lowercase", () => {
		const { getByRole } = render(
			<StationLinks
				stations={stations}
				codes={["KÄP"]}
				titleKey="popularStations"
			/>,
		);

		expect(getByRole("link", { name: "Käpylä" }).getAttribute("href")).toBe(
			"/käp/",
		);
	});

	it("skips codes that are not in the network", () => {
		const { queryAllByRole } = render(
			<StationLinks
				stations={stations}
				codes={["KE", "XXX"]}
				titleKey="popularStations"
			/>,
		);

		expect(queryAllByRole("link")).toHaveLength(1);
	});

	it("renders nothing when no code resolves", () => {
		const { container } = render(
			<StationLinks
				stations={stations}
				codes={["XXX"]}
				titleKey="popularStations"
			/>,
		);

		expect(container.querySelector("nav")).toBeNull();
	});
});

describe("StationLinks on a page", () => {
	it("sorts alphabetically and omits the heading when asked", () => {
		const { container, queryByRole } = render(
			<StationLinks
				stations={stations}
				codes={["KÄP", "HKI", "KE"]}
				titleKey="allStations"
				variant="page"
				sortByName
				showHeading={false}
			/>,
		);

		const labels = [...container.querySelectorAll("a")].map(
			(a) => a.textContent,
		);
		expect(labels).toEqual(["Helsinki", "Kerava", "Käpylä"]);
		expect(queryByRole("heading")).toBeNull();
	});

	it("keeps the given order by default", () => {
		const { container } = render(
			<StationLinks
				stations={stations}
				codes={["KE", "HKI"]}
				titleKey="popularStations"
			/>,
		);

		const labels = [...container.querySelectorAll("a")].map(
			(a) => a.textContent,
		);
		expect(labels).toEqual(["Kerava", "Helsinki"]);
	});
});
