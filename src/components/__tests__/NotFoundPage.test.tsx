/** @format */

import { cleanup, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import NotFoundPage from "@/components/NotFoundPage";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("NotFoundPage", () => {
	it("explains the problem and offers the main pages", () => {
		const { getByRole } = render(<NotFoundPage />);
		expect(getByRole("heading", { level: 1 }).textContent).toBe(
			"Sivua ei löytynyt",
		);
		expect(getByRole("link", { name: "Etusivulle" }).getAttribute("href")).toBe(
			"/",
		);
		expect(
			getByRole("link", { name: "Kaikki asemat" }).getAttribute("href"),
		).toBe("/asemat/");
		expect(getByRole("link", { name: "Linjat" }).getAttribute("href")).toBe(
			"/linjat/",
		);
	});

	it("follows the active language", () => {
		localStorage.setItem("lang", "en");
		const { getByRole } = render(<NotFoundPage />);
		expect(getByRole("heading", { level: 1 }).textContent).toBe(
			"Page not found",
		);
	});
});
