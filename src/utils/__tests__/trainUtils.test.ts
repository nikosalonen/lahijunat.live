import { describe, expect, it } from "vitest";
import { formatDuration } from "../trainUtils";

describe("formatDuration", () => {
	it("shows only minutes for trips under an hour", () => {
		expect(formatDuration({ hours: 0, minutes: 54 })).toBe("54 min");
	});

	it("shows hours and minutes for longer trips", () => {
		expect(formatDuration({ hours: 1, minutes: 5 })).toBe("1 h 5 min");
	});

	it("drops zero minutes on whole hours", () => {
		expect(formatDuration({ hours: 2, minutes: 0 })).toBe("2 h");
	});
});
