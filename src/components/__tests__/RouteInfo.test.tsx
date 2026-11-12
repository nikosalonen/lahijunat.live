/** @format */

import { fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import RouteInfo from "@/components/RouteInfo";
import type { RouteStats, Station, StationStats } from "@/types";

const helsinki: Station = {
	name: "Helsinki",
	shortCode: "HKI",
	location: { latitude: 60.171356, longitude: 24.941444 },
};
const kerava: Station = {
	name: "Kerava",
	shortCode: "KE",
	location: { latitude: 60.404297, longitude: 25.106028 },
};

/** The real HKI-KE figures from route-stats.json. */
const route: RouteStats = {
	trainsPerDay: 172,
	firstDeparture: "04.20",
	lastDeparture: "03.37",
	medianDuration: 34,
	lines: ["D", "K", "R", "T", "Z"],
};

const station: StationStats = {
	destinations: 93,
	lines: ["A", "K", "P"],
	firstDeparture: "04.18",
	lastDeparture: "01.51",
};

const toggle = () => screen.getByRole("button", { name: /tiedot/ });

afterEach(() => {
	window.localStorage.clear();
});

describe("RouteInfo", () => {
	it("starts closed, with the summary already in the HTML for crawlers", () => {
		render(
			<RouteInfo
				from={helsinki}
				to={kerava}
				route={route}
				lines={route.lines}
			/>,
		);

		expect(toggle()).toHaveAttribute("aria-expanded", "false");
		const summary = screen.getByText(/Välillä Helsinki–Kerava/);
		expect(summary.closest("[hidden]")).not.toBeNull();
	});

	it("opens the summary and links when the toggle is pressed", () => {
		render(
			<RouteInfo
				from={helsinki}
				to={kerava}
				route={route}
				lines={route.lines}
				reverse={{ href: "/ke/hki/", from: kerava, to: helsinki }}
			/>,
		);

		fireEvent.click(toggle());

		expect(toggle()).toHaveAttribute("aria-expanded", "true");
		expect(
			screen.getByText(/Välillä Helsinki–Kerava/).closest("[hidden]"),
		).toBeNull();
		expect(
			screen.getByRole("link", { name: /Vastakkainen suunta/ }),
		).toHaveAttribute("href", "/ke/hki/");
		expect(
			screen.getByRole("link", { name: /Navigoi asemalle: Helsinki/ }),
		).toBeInTheDocument();
	});

	it("links each serving line to its own page from the closed row", () => {
		render(
			<RouteInfo
				from={helsinki}
				to={kerava}
				route={route}
				lines={["K", "R"]}
			/>,
		);

		expect(screen.getByRole("link", { name: "K-juna" })).toHaveAttribute(
			"href",
			"/linja/k/",
		);
		expect(screen.getByRole("link", { name: "R-juna" })).toHaveAttribute(
			"href",
			"/linja/r/",
		);
	});

	it("shows the typical trip time on a route page", () => {
		render(
			<RouteInfo
				from={helsinki}
				to={kerava}
				route={route}
				lines={route.lines}
			/>,
		);

		// The summary says "34 minuuttia" too; the row holds the bare figure
		expect(screen.getByText("34 min")).toBeInTheDocument();
		expect(toggle()).toHaveTextContent("Reitin tiedot");
	});

	it("names itself after the station on a station page, with no trip time", () => {
		render(
			<RouteInfo from={helsinki} station={station} lines={station.lines} />,
		);

		expect(toggle()).toHaveTextContent("Aseman tiedot");
		expect(screen.queryByText(/^\d+ min$/)).not.toBeInTheDocument();
	});

	it("folds a long line list into a +N chip that opens the panel", () => {
		const lines = ["A", "D", "E", "I", "K", "L", "P"];
		render(<RouteInfo from={helsinki} station={station} lines={lines} />);

		// One chip per phone width, and CSS shows only one of them: three
		// badges fit beside it under 390 px, four from there up to sm
		const chips = screen.getAllByRole("button", {
			name: "Näytä kaikki linjat",
		});
		expect(chips.map((chip) => chip.textContent)).toEqual(["+4", "+3"]);

		fireEvent.click(chips[0]);

		expect(toggle()).toHaveAttribute("aria-expanded", "true");
	});

	it("shows no chip when every line fits", () => {
		render(
			<RouteInfo
				from={helsinki}
				to={kerava}
				route={route}
				lines={["D", "K", "R", "T"]}
			/>,
		);

		expect(
			screen.queryByRole("button", { name: "Näytä kaikki linjat" }),
		).not.toBeInTheDocument();
	});
});
