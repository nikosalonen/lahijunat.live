/** @format */

import { cleanup, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import LanguageSwitcher from "@/components/LanguageSwitcher";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("LanguageSwitcher", () => {
	it("names the button by its visible text plus its purpose", () => {
		localStorage.setItem("lang", "sv");
		const { getByRole } = render(<LanguageSwitcher />);
		const button = getByRole("button", { expanded: false });
		// WCAG "label in name": the visible text must be part of the name
		expect(button.textContent).toContain("Svenska");
		expect(button.textContent).toContain("Välj språk");
		expect(button.hasAttribute("aria-label")).toBe(false);
	});
});
