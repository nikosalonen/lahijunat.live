/** @format */

import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import ErrorState from "../../components/ErrorState";
import { startOfNextHelsinkiDay } from "../helsinkiTime";
import { formatTime } from "../trainUtils";

// This file runs with TZ=Atlantic/Reykjavik (UTC+0), the zone Firefox's
// anti-fingerprinting reports. Times must still show in Helsinki time.

describe("in a non-Finnish browser time zone", () => {
	it("runs in Atlantic/Reykjavik", () => {
		expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
			"Atlantic/Reykjavik",
		);
	});

	it("formats train times in Helsinki winter time", () => {
		expect(formatTime("2026-11-16T10:05:00.000Z")).toBe("12.05");
	});

	it("formats train times in Helsinki summer time", () => {
		expect(formatTime("2026-06-16T10:05:00.000Z")).toBe("13.05");
	});

	it("shows the service issue start time in Helsinki time", () => {
		render(
			<ErrorState
				type="serviceDown"
				serviceStatus={{
					isDown: true,
					affectedSystems: [],
					issues: [
						{
							title: "Outage",
							createdAt: "2026-11-15 10:00:00 +0000 UTC",
							severity: "major",
						},
					],
					statusPageUrl: "https://status.digitraffic.fi",
				}}
			/>,
		);

		expect(screen.getByText("Outage").nextElementSibling).toHaveTextContent(
			"15.11.2026 klo 12.00",
		);
	});

	it("ends the snooze at Helsinki midnight", () => {
		// 22:00 in Helsinki, 20:00 in Reykjavik.
		const now = Date.parse("2026-11-16T20:00:00.000Z");
		expect(startOfNextHelsinkiDay(now)).toBe(
			Date.parse("2026-11-16T22:00:00.000Z"),
		);
	});
});

describe("startOfNextHelsinkiDay around daylight saving changes", () => {
	it("handles the spring change later the same day", () => {
		// 00:30 on 29 March 2026 in Helsinki; clocks jump 03:00 → 04:00.
		const now = Date.parse("2026-03-28T22:30:00.000Z");
		expect(startOfNextHelsinkiDay(now)).toBe(
			Date.parse("2026-03-29T21:00:00.000Z"),
		);
	});

	it("handles the autumn change later the same day", () => {
		// 00:30 on 25 October 2026 in Helsinki; clocks fall back 04:00 → 03:00.
		const now = Date.parse("2026-10-24T21:30:00.000Z");
		expect(startOfNextHelsinkiDay(now)).toBe(
			Date.parse("2026-10-25T22:00:00.000Z"),
		);
	});

	it("keeps seconds out of the result", () => {
		const now = Date.parse("2026-11-16T20:00:42.123Z");
		expect(startOfNextHelsinkiDay(now)).toBe(
			Date.parse("2026-11-16T22:00:00.000Z"),
		);
	});
});
