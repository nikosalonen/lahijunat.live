/** @format */

import { cleanup, fireEvent, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import StationIndex from "@/components/StationIndex";
import type { Station } from "@/types";

const station = (shortCode: string, name: string): Station => ({
	name,
	shortCode,
	location: { latitude: 0, longitude: 0 },
});

const stations = [
	station("LPV", "Leppävaara"),
	station("KE", "Kerava"),
	station("HKI", "Helsinki"),
	station("KÄP", "Käpylä"),
];

const lines = { KE: ["K", "R"], HKI: ["K"] };

const renderIndex = () =>
	render(<StationIndex stations={stations} lines={lines} popular={["HKI"]} />);

const headers = (container: Element) =>
	[...container.querySelectorAll("h2")].map((h) => h.textContent);
afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("StationIndex", () => {
	it("groups stations under their initial letter in Finnish order", () => {
		const { container } = renderIndex();
		expect(headers(container)).toEqual(["H", "K", "L"]);
		const labels = [...container.querySelectorAll("li > a")].map(
			(a) => a.textContent,
		);
		expect(labels).toEqual(["Helsinki", "Kerava", "Käpylä", "Leppävaara"]);
	});

	it("regroups by the Swedish name", () => {
		localStorage.setItem("lang", "sv");
		const { container } = renderIndex();
		expect(headers(container)).toEqual(["A", "H", "K"]);
		expect(container.querySelector("li > a")?.textContent).toBe("Alberga");
	});

	it("sets popular stations in bold", () => {
		const { getByRole } = renderIndex();
		expect(getByRole("link", { name: "Helsinki" }).className).toContain(
			"font-bold",
		);
		expect(getByRole("link", { name: "Kerava" }).className).not.toContain(
			"font-bold",
		);
	});

	it("links each station's lines to their pages", () => {
		const { getAllByRole } = renderIndex();
		const chips = getAllByRole("link", { name: "K-juna" });
		expect(chips.map((a) => a.getAttribute("href"))).toEqual([
			"/linja/k/",
			"/linja/k/",
		]);
		expect(getAllByRole("link", { name: "R-juna" })).toHaveLength(1);
	});

	it("filters by the shown name or the Finnish one", () => {
		localStorage.setItem("lang", "sv");
		const { container, getByRole } = renderIndex();
		const input = getByRole("searchbox");

		fireEvent.input(input, { target: { value: "ker" } });
		expect(headers(container)).toEqual(["K"]);
		expect(container.querySelectorAll("li").length).toBe(1);

		fireEvent.input(input, { target: { value: "Leppä" } });
		expect(container.querySelector("li > a")?.textContent).toBe("Alberga");
	});

	it("says when nothing matches", () => {
		const { container, getByRole } = renderIndex();
		fireEvent.input(getByRole("searchbox"), { target: { value: "zzz" } });
		expect(container.querySelectorAll("li")).toHaveLength(0);
		expect(container.textContent).toContain("Asemia ei löytynyt");
	});
});
