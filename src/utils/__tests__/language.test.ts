import { afterEach, describe, expect, it } from "vitest";
import { getCurrentLanguage, switchLanguage } from "../language";

describe("switchLanguage", () => {
	afterEach(() => {
		window.localStorage.removeItem("lang");
		document.documentElement.lang = "fi";
	});

	it("persists the choice", () => {
		switchLanguage("sv");
		expect(getCurrentLanguage()).toBe("sv");
	});

	it("updates the document language so assistive tech reads the right one", () => {
		switchLanguage("en");
		expect(document.documentElement.lang).toBe("en");
	});
});
