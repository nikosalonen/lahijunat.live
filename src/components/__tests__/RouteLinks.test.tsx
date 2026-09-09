/** @format */

import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteLinks from "@/components/RouteLinks";
import type { Station } from "@/types";

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
const stations = [helsinki, kerava];

/** Swaps the user agent for one render, then puts the real one back. */
const withUserAgent = (agent: string, maxTouchPoints = 0) => {
	const original = Object.getOwnPropertyDescriptor(
		window.navigator,
		"userAgent",
	);
	vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(agent);
	Object.defineProperty(window.navigator, "maxTouchPoints", {
		value: maxTouchPoints,
		configurable: true,
	});
	return () => {
		vi.restoreAllMocks();
		if (original) {
			Object.defineProperty(window.navigator, "userAgent", original);
		}
	};
};

afterEach(cleanup);

describe("RouteLinks", () => {
	it("links each serving line to its own page", () => {
		render(<RouteLinks lines={["K", "R"]} stations={stations} />);

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
				reverse={{ href: "/ke/hki/", from: "KE", to: "HKI" }}
				stations={stations}
			/>,
		);

		expect(screen.getByRole("link", { name: /Kerava/ })).toHaveAttribute(
			"href",
			"/ke/hki/",
		);
	});

	it("leaves the reverse link out when no direct train runs it", () => {
		render(<RouteLinks lines={["K"]} stations={stations} />);

		expect(
			screen.queryByRole("link", { name: /Kerava/ }),
		).not.toBeInTheDocument();
	});

	it("navigates to the departure station, not the destination", () => {
		render(<RouteLinks lines={["K"]} origin={helsinki} stations={stations} />);

		const link = screen.getByRole("link", { name: /Helsinki/ });
		expect(link.getAttribute("href")).toContain("60.171356,24.941444");
	});

	it("falls back to a web maps link a crawler and any desktop can follow", () => {
		const restore = withUserAgent(
			"Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0",
		);
		render(<RouteLinks lines={[]} origin={helsinki} stations={stations} />);

		expect(screen.getByRole("link", { name: /Helsinki/ })).toHaveAttribute(
			"href",
			"https://www.google.com/maps/dir/?api=1&destination=60.171356,24.941444",
		);
		restore();
	});

	it("hands an Android reader a geo: link for their default maps app", () => {
		const restore = withUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/120");
		render(<RouteLinks lines={[]} origin={helsinki} stations={stations} />);

		expect(
			screen.getByRole("link", { name: /Helsinki/ }).getAttribute("href"),
		).toBe("geo:60.171356,24.941444?q=60.171356,24.941444(Helsinki)");
		restore();
	});

	it("hands an iPhone reader Apple Maps", () => {
		const restore = withUserAgent(
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605",
		);
		render(<RouteLinks lines={[]} origin={helsinki} stations={stations} />);

		expect(
			screen.getByRole("link", { name: /Helsinki/ }).getAttribute("href"),
		).toBe("maps://?daddr=60.171356,24.941444");
		restore();
	});

	it("treats an iPad reporting itself as a Mac as an Apple device", () => {
		const restore = withUserAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605",
			5,
		);
		render(<RouteLinks lines={[]} origin={helsinki} stations={stations} />);

		expect(
			screen.getByRole("link", { name: /Helsinki/ }).getAttribute("href"),
		).toBe("maps://?daddr=60.171356,24.941444");
		restore();
	});

	it("renders nothing when there is nothing to link to", () => {
		const { container } = render(<RouteLinks lines={[]} stations={stations} />);

		expect(container).toBeEmptyDOMElement();
	});
});
