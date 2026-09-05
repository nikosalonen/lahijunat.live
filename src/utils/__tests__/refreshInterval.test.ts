import { describe, expect, it } from "vitest";
import type { Train } from "@/types";
import {
	getAdaptiveRefreshInterval,
	REFRESH_INTERVALS,
} from "@/utils/refreshInterval";

const now = new Date("2026-09-05T10:00:00Z");

function trainDepartingIn(minutes: number, differenceInMinutes = 0): Train {
	const scheduledTime = new Date(
		now.getTime() + minutes * 60_000,
	).toISOString();
	return {
		trainNumber: 1,
		timeTableRows: [
			{
				type: "DEPARTURE",
				stationShortCode: "EPO",
				scheduledTime,
				differenceInMinutes,
				trainStopping: true,
				commercialStop: true,
			},
		],
	} as unknown as Train;
}

describe("getAdaptiveRefreshInterval", () => {
	it("idles when there are no trains at all", () => {
		expect(getAdaptiveRefreshInterval([], now)).toBe(REFRESH_INTERVALS.IDLE);
		expect(REFRESH_INTERVALS.IDLE).toBe(10 * 60_000);
	});

	it("polls slowly when the next train is far away", () => {
		expect(getAdaptiveRefreshInterval([trainDepartingIn(120)], now)).toBe(
			REFRESH_INTERVALS.LOW,
		);
	});

	it("polls fastest when a train leaves within five minutes", () => {
		expect(getAdaptiveRefreshInterval([trainDepartingIn(3)], now)).toBe(
			REFRESH_INTERVALS.URGENT,
		);
	});

	it("polls often for a late train within half an hour", () => {
		expect(getAdaptiveRefreshInterval([trainDepartingIn(25, 4)], now)).toBe(
			REFRESH_INTERVALS.HIGH,
		);
	});
});
