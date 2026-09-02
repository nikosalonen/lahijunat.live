/** @format */

import { cleanup, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PageHeading from "@/components/PageHeading";
import type { Station } from "@/types";

const stations: Station[] = [
	{
		name: "Helsinki",
		shortCode: "HKI",
		location: { latitude: 0, longitude: 0 },
	},
	{ name: "Kerava", shortCode: "KE", location: { latitude: 0, longitude: 0 } },
];

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("PageHeading", () => {
	it("fills placeholders in the title", () => {
		const { getByRole } = render(
			<PageHeading titleKey="lineHeading" titleValues={{ line: "K" }} />,
		);
		expect(getByRole("heading").textContent).toBe("K-juna");
	});

	it("shows the route from station codes", () => {
		const { container } = render(
			<PageHeading
				titleKey="lineHeading"
				titleValues={{ line: "K" }}
				subtitleCodes={["HKI", "KE"]}
				stations={stations}
			/>,
		);
		expect(container.textContent).toContain("Helsinki – Kerava");
	});

	it("translates the title and the lead-in", () => {
		localStorage.setItem("lang", "en");
		const { container, getByRole } = render(
			<PageHeading
				titleKey="lineHeading"
				titleValues={{ line: "K" }}
				introKey="lineIntro"
				introValues={{ first: "04.05", last: "00.51" }}
			/>,
		);
		expect(getByRole("heading").textContent).toBe("K train");
		expect(container.textContent).toContain("Trains run from 04.05 to 00.51");
		expect(container.textContent).not.toMatch(/[{}]/);
	});

	it("leaves no placeholder unfilled in any language", () => {
		for (const lang of ["fi", "en", "sv"]) {
			cleanup();
			localStorage.setItem("lang", lang);
			const { container } = render(
				<PageHeading
					titleKey="lineHeading"
					titleValues={{ line: "I" }}
					introKey="lineIntro"
					introValues={{ first: "04.31", last: "23.36" }}
				/>,
			);
			expect(container.textContent, lang).not.toMatch(/[{}]/);
		}
	});
});
