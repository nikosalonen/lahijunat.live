/** @format */

import { act, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteLinks from "@/components/RouteLinks";
import type { Station } from "@/types";
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
// Its name needs percent-encoding in a geo: URI, unlike "Helsinki"
const jarvenpaa: Station = {
	name: "Järvenpää",
	shortCode: "JP",
	location: { latitude: 60.473106, longitude: 25.089417 },
};

/** Pretends to be one browser until the afterEach below puts things back. */
const setUserAgent = (agent: string, maxTouchPoints = 0) => {
	vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(agent);
	Object.defineProperty(window.navigator, "maxTouchPoints", {
		value: maxTouchPoints,
		configurable: true,
	});
};

afterEach(() => {
	vi.restoreAllMocks();
	// Defining maxTouchPoints makes it an own property, so it has to be
	// removed rather than reset — otherwise a stale value leaks into the next
	// test and a plain Mac starts reading as an iPad
	Reflect.deleteProperty(window.navigator, "maxTouchPoints");
	window.localStorage.clear();
});

describe("RouteLinks", () => {
	it("links each serving line to its own page", () => {
		render(<RouteLinks lines={["K", "R"]} />);

		expect(screen.getByText("K").closest("a")).toHaveAttribute(
			"href",
			"/linja/k/",
		);
		expect(screen.getByText("R").closest("a")).toHaveAttribute(
			"href",
			"/linja/r/",
		);
	});

	it("offers the journey back when one was passed", () => {
		render(
			<RouteLinks
				lines={["K"]}
				reverse={{ href: "/ke/hki/", from: kerava, to: helsinki }}
			/>,
		);

		expect(screen.getByRole("link", { name: /Kerava/ })).toHaveAttribute(
			"href",
			"/ke/hki/",
		);
	});

	it("leaves the reverse link out when no direct train runs it", () => {
		render(<RouteLinks lines={["K"]} />);

		expect(
			screen.queryByRole("link", { name: /Kerava/ }),
		).not.toBeInTheDocument();
	});

	it("navigates to the departure station, not the destination", () => {
		render(
			<RouteLinks
				lines={["K"]}
				origin={helsinki}
				reverse={{ href: "/ke/hki/", from: kerava, to: helsinki }}
			/>,
		);

		const href =
			screen
				.getByRole("link", { name: /Navigoi asemalle/ })
				.getAttribute("href") ?? "";
		expect(href).toContain("60.171356,24.941444");
		expect(href).not.toContain("60.404297");
	});

	it("falls back to a web maps link a crawler and any desktop can follow", () => {
		setUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0");
		render(<RouteLinks lines={[]} origin={helsinki} />);

		expect(screen.getByRole("link", { name: /Helsinki/ })).toHaveAttribute(
			"href",
			"https://www.google.com/maps/dir/?api=1&destination=60.171356,24.941444",
		);
	});

	it("hands an Android reader a geo: link for their default maps app", () => {
		setUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/120");
		render(<RouteLinks lines={[]} origin={jarvenpaa} />);

		// The label is percent-encoded, or the pin name breaks on any station
		// with a Finnish vowel in it
		expect(
			screen.getByRole("link", { name: /Järvenpää/ }).getAttribute("href"),
		).toBe(
			"geo:60.473106,25.089417?q=60.473106,25.089417(J%C3%A4rvenp%C3%A4%C3%A4)",
		);
	});

	it("hands an iPhone reader an Apple Maps link that still works without Maps.app", () => {
		setUserAgent(
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605",
		);
		render(<RouteLinks lines={[]} origin={helsinki} />);

		// https rather than maps://, which is a dead tap once Maps is deleted
		expect(
			screen.getByRole("link", { name: /Helsinki/ }).getAttribute("href"),
		).toBe("https://maps.apple.com/?daddr=60.171356,24.941444");
	});

	it("treats an iPad reporting itself as a Mac as an Apple device", () => {
		setUserAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605",
			5,
		);
		render(<RouteLinks lines={[]} origin={helsinki} />);

		expect(
			screen.getByRole("link", { name: /Helsinki/ }).getAttribute("href"),
		).toBe("https://maps.apple.com/?daddr=60.171356,24.941444");
	});

	it("keeps a desktop Mac on the web link", () => {
		// 1 is the boundary the iPad check encodes: a Mac can report a single
		// touch point, an iPad reports several. Only above 1 is it an iPad.
		setUserAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605",
			1,
		);
		render(<RouteLinks lines={[]} origin={helsinki} />);

		expect(
			screen.getByRole("link", { name: /Helsinki/ }).getAttribute("href"),
		).toContain("google.com/maps");
	});

	it("keeps a touchless Mac on the web link too", () => {
		setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605");
		render(<RouteLinks lines={[]} origin={helsinki} />);

		expect(
			screen.getByRole("link", { name: /Helsinki/ }).getAttribute("href"),
		).toContain("google.com/maps");
	});

	it("offers no maps link when the station has no usable coordinates", () => {
		// The API returns location as a positional pair, so nulls do arrive.
		// A link reading destination=null,null looks fine and goes nowhere.
		const broken = {
			name: "Rikki",
			shortCode: "RIK",
			location: { latitude: null, longitude: null },
		} as unknown as Station;
		render(<RouteLinks lines={["K"]} origin={broken} />);

		expect(screen.getByText("K")).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: /Navigoi asemalle/ }),
		).not.toBeInTheDocument();
	});

	it("localises the station names it renders", () => {
		window.localStorage.setItem("lang", "sv");
		render(
			<RouteLinks
				lines={[]}
				origin={helsinki}
				reverse={{ href: "/ke/hki/", from: kerava, to: helsinki }}
			/>,
		);

		// Both the reverse link and the maps link name the station
		const reverseLink = screen.getByRole("link", { name: /Motsatt riktning/ });
		expect(reverseLink.textContent).toContain("Kervo");
		expect(reverseLink.textContent).toContain("Helsingfors");
		expect(
			screen.getByText(/Navigera till stationen: Helsingfors/),
		).toBeInTheDocument();
		expect(screen.queryByText(/Helsinki/)).not.toBeInTheDocument();
	});

	it("follows the language switcher without a reload", () => {
		render(<RouteLinks lines={[]} origin={helsinki} />);
		expect(screen.getByText(/Navigoi asemalle: Helsinki/)).toBeInTheDocument();

		act(() => {
			switchLanguage("sv");
		});

		expect(
			screen.getByText(/Navigera till stationen: Helsingfors/),
		).toBeInTheDocument();
	});

	it("renders nothing when there is nothing to link to", () => {
		const { container } = render(<RouteLinks lines={[]} />);

		expect(container).toBeEmptyDOMElement();
	});
});
