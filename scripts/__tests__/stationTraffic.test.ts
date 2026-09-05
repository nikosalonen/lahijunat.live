import { describe, expect, it } from "vitest";
import {
	type ApiTrain,
	decideExclusions,
	servedStations,
	upcomingDates,
} from "../stationTraffic";

function train(
	overrides: Partial<ApiTrain> & {
		rows: [string, Partial<ApiTrain["timeTableRows"][number]>?][];
	},
): ApiTrain {
	const { rows, ...rest } = overrides;
	return {
		trainCategory: "Commuter",
		timeTableRows: rows.map(([stationShortCode, row]) => ({
			stationShortCode,
			trainStopping: true,
			commercialStop: true,
			...row,
		})),
		...rest,
	};
}

describe("servedStations", () => {
	it("lists every station where a commuter train makes a commercial stop", () => {
		const served = servedStations([
			train({ rows: [["HKI"], ["PSL"], ["LPV"]] }),
		]);
		expect([...served].sort()).toEqual(["HKI", "LPV", "PSL"]);
	});

	it("ignores pass-throughs and technical stops", () => {
		const served = servedStations([
			train({
				rows: [
					["HKI"],
					["KIL", { trainStopping: false }],
					["ILA", { commercialStop: false }],
					["LPV"],
				],
			}),
		]);
		expect(served.has("KIL")).toBe(false);
		expect(served.has("ILA")).toBe(false);
		expect(served.has("LPV")).toBe(true);
	});

	it("ignores cancelled trains and cancelled stops", () => {
		const served = servedStations([
			train({ cancelled: true, rows: [["HKI"], ["EPO"]] }),
			train({ rows: [["HKI"], ["KNI", { cancelled: true }]] }),
		]);
		expect(served.has("EPO")).toBe(false);
		expect(served.has("KNI")).toBe(false);
		expect(served.has("HKI")).toBe(true);
	});

	it("ignores trains that are not commuter trains", () => {
		const served = servedStations([
			train({ trainCategory: "Long-distance", rows: [["HKI"], ["TPE"]] }),
		]);
		expect(served.size).toBe(0);
	});
});

describe("upcomingDates", () => {
	it("starts on today's date in Finnish time and runs forward", () => {
		// 22:30 UTC is already 01:30 the next day in Helsinki (EEST)
		const dates = upcomingDates(3, new Date("2026-09-05T22:30:00Z"));
		expect(dates).toEqual(["2026-09-06", "2026-09-07", "2026-09-08"]);
	});

	it("crosses a month boundary", () => {
		const dates = upcomingDates(2, new Date("2026-09-30T10:00:00Z"));
		expect(dates).toEqual(["2026-09-30", "2026-10-01"]);
	});
});

describe("decideExclusions", () => {
	const allStations = ["HKI", "EPO", "KEA", "TSO"];

	it("excludes stations with no trains when every day was fetched", () => {
		const excluded = decideExclusions({
			allStations,
			served: new Set(["HKI", "EPO"]),
			currentExcluded: [],
			complete: true,
		});
		expect(excluded).toEqual(["KEA", "TSO"]);
	});

	it("re-includes a station as soon as it has trains again", () => {
		const excluded = decideExclusions({
			allStations,
			served: new Set(["HKI", "EPO", "KEA"]),
			currentExcluded: ["KEA", "TSO"],
			complete: true,
		});
		expect(excluded).toEqual(["TSO"]);
	});

	it("keeps the current status of unserved stations when some days failed", () => {
		const excluded = decideExclusions({
			allStations,
			served: new Set(["HKI"]),
			currentExcluded: ["TSO"],
			complete: false,
		});
		// EPO and KEA saw no trains but only partial data: they stay included
		expect(excluded).toEqual(["TSO"]);
	});

	it("still re-includes served stations when some days failed", () => {
		const excluded = decideExclusions({
			allStations,
			served: new Set(["HKI", "TSO"]),
			currentExcluded: ["TSO", "KEA"],
			complete: false,
		});
		expect(excluded).toEqual(["KEA"]);
	});
});
