/** @format */

import { act, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import RouteSummary from "@/components/RouteSummary";
import type { RouteStats, Station, StationStats } from "@/types";
import { switchLanguage } from "@/utils/language";

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

afterEach(() => {
	window.localStorage.clear();
});

describe("RouteSummary", () => {
	it("states the figures that belong to this route and no other", () => {
		render(<RouteSummary from={helsinki} to={kerava} route={route} />);

		const text = screen.getByRole("heading", { level: 2 }).parentElement
			?.textContent;
		expect(text).toContain("172");
		expect(text).toContain("04.20");
		expect(text).toContain("03.37");
		expect(text).toContain("34");
		expect(text).toContain("Helsinki");
		expect(text).toContain("Kerava");
	});

	it("names the serving lines as a list the language reads naturally", () => {
		render(<RouteSummary from={helsinki} to={kerava} route={route} />);

		// "linjat D, K, R, T ja Z" — the last pair joined by the Finnish word
		expect(screen.getByText(/D, K, R, T ja Z/)).toBeInTheDocument();
		expect(screen.getByText(/linjat/)).toBeInTheDocument();
	});

	it("switches to the singular when only one line runs the route", () => {
		render(
			<RouteSummary
				from={helsinki}
				to={kerava}
				route={{ ...route, lines: ["R"] }}
			/>,
		);

		expect(screen.getByText(/linja R\./)).toBeInTheDocument();
		expect(screen.queryByText(/linjat/)).not.toBeInTheDocument();
	});

	it("says nothing about lines when the route has none listed", () => {
		render(
			<RouteSummary
				from={helsinki}
				to={kerava}
				route={{ ...route, lines: [] }}
			/>,
		);

		expect(screen.getByText(/172/)).toBeInTheDocument();
		expect(screen.queryByText(/linja/)).not.toBeInTheDocument();
	});

	it("describes a single station when there is no destination", () => {
		render(<RouteSummary from={helsinki} station={station} />);

		const text = screen.getByRole("heading", { level: 2 }).parentElement
			?.textContent;
		expect(text).toContain("93");
		expect(text).toContain("04.18");
		expect(text).toContain("01.51");
		expect(text).toContain("A, K ja P");
	});

	it("renders nothing for a pair with no direct service", () => {
		// An unserved route has no summary of its own, so there is nothing
		// truthful to say about it
		const { container } = render(
			<RouteSummary from={helsinki} to={kerava} route={null} />,
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("renders nothing when no figures were passed at all", () => {
		const { container } = render(<RouteSummary from={helsinki} />);

		expect(container).toBeEmptyDOMElement();
	});

	it("writes the summary in the reader's language", () => {
		window.localStorage.setItem("lang", "sv");
		render(<RouteSummary from={helsinki} to={kerava} route={route} />);

		expect(
			screen.getByText(/Mellan Helsingfors och Kervo/),
		).toBeInTheDocument();
		expect(screen.getByText(/D, K, R, T och Z/)).toBeInTheDocument();
	});

	it("follows the language switcher without a reload", () => {
		render(<RouteSummary from={helsinki} to={kerava} route={route} />);
		expect(screen.getByText(/Välillä Helsinki–Kerava/)).toBeInTheDocument();

		act(() => {
			switchLanguage("en");
		});

		expect(
			screen.getByText(/172 commuter trains run from Helsinki to Kerava/),
		).toBeInTheDocument();
	});

	it("uses a level-2 heading, below the page title", () => {
		render(<RouteSummary from={helsinki} to={kerava} route={route} />);

		expect(
			screen.getByRole("heading", { level: 2, name: /Helsinki–Kerava/ }),
		).toBeInTheDocument();
	});
});
