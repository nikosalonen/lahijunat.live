/** @format */

import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import RouteSummary from "@/components/RouteSummary";
import type { RouteStats, StationStats } from "@/types";

const stats: RouteStats = {
	trainsPerDay: 165,
	firstDeparture: "04.18",
	lastDeparture: "00.48",
	medianDuration: 28,
	lines: ["I", "P"],
};

afterEach(cleanup);

describe("RouteSummary", () => {
	it("shows the summary for the route in the URL", () => {
		const { container } = render(
			<RouteSummary
				routeStats={stats}
				stationStats={null}
				statsFrom="HKI"
				statsTo="LEN"
				activeFrom="HKI"
				activeTo="LEN"
			/>,
		);

		expect(container.textContent).toContain("165");
		expect(container.textContent).toContain("28");
	});

	it("hides itself once another route is selected", () => {
		const { container } = render(
			<RouteSummary
				routeStats={stats}
				stationStats={null}
				statsFrom="HKI"
				statsTo="LEN"
				activeFrom="HKI"
				activeTo="TKL"
			/>,
		);

		expect(container.textContent).toBe("");
	});

	it("shows station facts when the URL names one station", () => {
		const stationStats: StationStats = {
			destinations: 76,
			lines: ["I", "P"],
			firstDeparture: "04.18",
			lastDeparture: "00.48",
		};

		const { container } = render(
			<RouteSummary
				routeStats={null}
				stationStats={stationStats}
				statsFrom="HKI"
				statsTo={null}
				activeFrom="HKI"
				activeTo={null}
			/>,
		);

		expect(container.textContent).toContain("76");
	});

	it("renders nothing for a route without statistics", () => {
		const { container } = render(
			<RouteSummary
				routeStats={null}
				stationStats={null}
				statsFrom="KKN"
				statsTo="RI"
				activeFrom="KKN"
				activeTo="RI"
			/>,
		);

		expect(container.textContent).toBe("");
	});
});
