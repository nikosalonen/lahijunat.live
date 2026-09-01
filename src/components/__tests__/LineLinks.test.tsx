/** @format */

import { cleanup, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import LineLinks from "@/components/LineLinks";
import type { LineStats, Station } from "@/types";

const stations: Station[] = [
	{
		name: "Helsinki",
		shortCode: "HKI",
		location: { latitude: 0, longitude: 0 },
	},
	{ name: "Kerava", shortCode: "KE", location: { latitude: 0, longitude: 0 } },
	{
		name: "Aviapolis",
		shortCode: "AVP",
		location: { latitude: 0, longitude: 0 },
	},
];

const line = (over: Partial<LineStats> = {}): LineStats => ({
	trainsPerDay: 220,
	firstDeparture: "04.05",
	lastDeparture: "00.51",
	endpoints: ["HKI", "KE"],
	via: null,
	stations: ["HKI", "KE"],
	...over,
});

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("LineLinks", () => {
	it("links each line by its lowercase letter", () => {
		const { getByRole } = render(
			<LineLinks stations={stations} lines={[{ line: "K", stats: line() }]} />,
		);
		expect(
			getByRole("link", { name: /Helsinki – Kerava/ }).getAttribute("href"),
		).toBe("/linja/k/");
	});

	it("names the far point of a ring line", () => {
		const ring = line({ endpoints: ["HKI", "HKI"], via: "AVP" });
		const { container } = render(
			<LineLinks stations={stations} lines={[{ line: "I", stats: ring }]} />,
		);
		expect(container.textContent).toContain("Helsinki – Aviapolis – Helsinki");
	});

	it("counts stations in the active language", () => {
		localStorage.setItem("lang", "sv");
		const { container } = render(
			<LineLinks
				stations={stations}
				lines={[{ line: "K", stats: line({ stations: ["HKI", "KE", "AVP"] }) }]}
			/>,
		);
		expect(container.textContent).toContain("3 stationer");
	});
});
