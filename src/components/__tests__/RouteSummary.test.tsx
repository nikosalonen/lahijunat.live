/** @format */

import { act, render, screen, within } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import RouteSummary from "@/components/RouteSummary";
import type { RouteStats, Station, StationStats } from "@/types";
import { switchLanguage } from "@/utils/language";

const helsinki: Station = {
	name: "Helsinki",
	shortCode: "HKI",
	location: { latitude: 60.171356, longitude: 24.941444 },
};
const tikkurila: Station = {
	name: "Tikkurila",
	shortCode: "TKL",
	location: { latitude: 60.292166, longitude: 25.044055 },
};

/** The real HKI-TKL figures from route-stats.json. */
const route: RouteStats = {
	trainsPerDay: 385,
	firstDeparture: "04.20",
	lastDeparture: "03.37",
	medianDuration: 20,
	lines: ["D", "I", "K", "P", "R", "T", "Z"],
	lineDurations: { D: 14, I: 20, K: 20, P: 43, R: 14, T: 21, Z: 14 },
	daytimeGap: 2,
};

const station: StationStats = {
	destinations: 93,
	lines: ["A", "K", "P"],
	firstDeparture: "04.18",
	lastDeparture: "01.51",
};

/** The value next to a fact's label, e.g. "Lippu" -> "HSL ABC". */
const fact = (label: string) =>
	screen.getByText(label).nextElementSibling?.textContent;

afterEach(() => {
	window.localStorage.clear();
});

describe("RouteSummary", () => {
	it("groups lines by journey time, fastest first", () => {
		render(<RouteSummary from={helsinki} to={tikkurila} route={route} />);

		const rows = within(
			screen.getByText("Matka-aika").nextElementSibling as HTMLElement,
		).getAllByRole("listitem");
		expect(rows.map((row) => row.textContent)).toEqual([
			"DRZ14 min",
			"IKT20–21 min",
			"P43 min",
		]);
	});

	it("names the HSL ticket the trip needs", () => {
		render(
			<RouteSummary
				from={helsinki}
				to={tikkurila}
				route={route}
				ticket={{ kind: "hsl", fares: ["ABC"] }}
			/>,
		);

		expect(fact("Lippu")).toBe("HSL ABC");
	});

	it("offers every ticket that costs the same", () => {
		render(
			<RouteSummary
				from={helsinki}
				to={tikkurila}
				route={route}
				ticket={{ kind: "hsl", fares: ["AB", "BC"] }}
			/>,
		);

		expect(fact("Lippu")).toBe("HSL AB tai BC");
	});

	it("sends a trip leaving the HSL area to VR", () => {
		render(
			<RouteSummary
				from={helsinki}
				to={tikkurila}
				route={route}
				ticket={{ kind: "outsideHsl" }}
			/>,
		);

		expect(fact("Lippu")).toMatch(/VR:n lippu/);
	});

	it("leaves the frequency out where trains leave every few minutes", () => {
		render(<RouteSummary from={helsinki} to={tikkurila} route={route} />);

		expect(screen.queryByText("Vuoroväli arkisin")).not.toBeInTheDocument();
	});

	it("states the frequency on a rural route", () => {
		render(
			<RouteSummary
				from={helsinki}
				to={tikkurila}
				route={{ ...route, daytimeGap: 30 }}
			/>,
		);

		expect(fact("Vuoroväli arkisin")).toBe("noin 30 min välein");
	});

	it("says hourly in words rather than as 60 minutes", () => {
		const { rerender } = render(
			<RouteSummary
				from={helsinki}
				to={tikkurila}
				route={{ ...route, daytimeGap: 60 }}
			/>,
		);
		expect(fact("Vuoroväli arkisin")).toBe("noin tunnin välein");

		rerender(
			<RouteSummary
				from={helsinki}
				to={tikkurila}
				route={{ ...route, daytimeGap: 120 }}
			/>,
		);
		expect(fact("Vuoroväli arkisin")).toBe("noin 2 tunnin välein");
	});

	it("gives a station page its fare zone", () => {
		render(<RouteSummary from={tikkurila} station={station} zone="C" />);

		expect(fact("Lippuvyöhyke")).toBe("HSL C");
	});

	it("says when a station is outside the HSL area", () => {
		render(<RouteSummary from={tikkurila} station={station} zone={null} />);

		expect(fact("Lippuvyöhyke")).toBe("HSL-alueen ulkopuolella");
	});

	it("renders nothing for a pair with no direct service", () => {
		const { container } = render(
			<RouteSummary from={helsinki} to={tikkurila} route={null} />,
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("follows the language switcher without a reload", () => {
		render(
			<RouteSummary
				from={helsinki}
				to={tikkurila}
				route={route}
				ticket={{ kind: "hsl", fares: ["AB", "BC"] }}
			/>,
		);
		expect(fact("Lippu")).toBe("HSL AB tai BC");

		act(() => {
			switchLanguage("sv");
		});

		expect(fact("Biljett")).toBe("HSL AB eller BC");
		expect(
			screen.getByRole("heading", {
				name: "Tågförbindelser Helsingfors–Dickursby",
			}),
		).toBeInTheDocument();
	});

	it("uses a level-2 heading, below the page title", () => {
		render(<RouteSummary from={helsinki} to={tikkurila} route={route} />);

		expect(
			screen.getByRole("heading", { level: 2, name: /Helsinki–Tikkurila/ }),
		).toBeInTheDocument();
	});
});
