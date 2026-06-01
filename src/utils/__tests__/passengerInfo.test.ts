/** @format */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	__resetPassengerInfoCacheForTests,
	fetchActivePassengerMessages,
} from "@/utils/api";
import {
	isWithinRules,
	type PassengerInformationMessage,
	partitionActiveMessages,
	pickDisplay,
	trainMessageKey,
	type VideoDeliveryRules,
} from "@/utils/passengerInfo";

function makeMessage(
	overrides: Partial<PassengerInformationMessage> & { id: string },
): PassengerInformationMessage {
	return {
		startValidity: "2026-01-01T00:00:00Z",
		endValidity: "2027-01-01T00:00:00Z",
		trainNumber: null,
		trainDepartureDate: null,
		stations: [],
		...overrides,
	};
}

describe("pickDisplay (video-only)", () => {
	it("returns video text in the requested language", () => {
		const msg = makeMessage({
			id: "1",
			video: { text: { fi: "FI", sv: "SV", en: "EN" } },
		});
		expect(pickDisplay(msg, "fi")).toEqual({ text: "FI", rules: undefined });
	});

	it("falls back en → fi → sv when the requested language is null", () => {
		const enOnly = makeMessage({
			id: "1",
			video: { text: { fi: null, sv: null, en: "EN" } },
		});
		expect(pickDisplay(enOnly, "fi")?.text).toBe("EN");

		const fiOnly = makeMessage({
			id: "2",
			video: { text: { fi: "FI", sv: null, en: null } },
		});
		expect(pickDisplay(fiOnly, "sv")?.text).toBe("FI");

		const svOnly = makeMessage({
			id: "3",
			video: { text: { fi: null, sv: "SV", en: null } },
		});
		expect(pickDisplay(svOnly, "en")?.text).toBe("SV");
	});

	it("returns null when video is missing", () => {
		expect(pickDisplay(makeMessage({ id: "1" }), "fi")).toBeNull();
	});

	it("returns null when no language has video text (no audio fallback)", () => {
		const msg = makeMessage({
			id: "1",
			video: { text: { fi: null, sv: null, en: null } },
		});
		expect(pickDisplay(msg, "fi")).toBeNull();
	});
});

describe("isWithinRules — CONTINUOS_VISUALIZATION", () => {
	const baseRules: VideoDeliveryRules = {
		deliveryType: "CONTINUOS_VISUALIZATION",
		startDateTime: "2026-06-01T00:00:00Z",
		endDateTime: "2026-06-08T00:00:00Z",
		startTime: "14:10",
		endTime: "04:30",
		weekDays: [
			"MONDAY",
			"TUESDAY",
			"WEDNESDAY",
			"THURSDAY",
			"FRIDAY",
			"SATURDAY",
			"SUNDAY",
		],
	};

	it("is active mid-window", () => {
		expect(isWithinRules(baseRules, new Date("2026-06-04T12:00:00Z"))).toBe(
			true,
		);
	});

	it("is inactive before the start time on the first day", () => {
		// startDateTime 2026-06-01T00:00Z = 2026-06-01 03:00 Helsinki (DST).
		// startTime 14:10 Helsinki => effective start is 2026-06-01 14:10 Helsinki
		// = 11:10Z. So 10:00Z on 2026-06-01 is BEFORE the effective start.
		expect(isWithinRules(baseRules, new Date("2026-06-01T10:00:00Z"))).toBe(
			false,
		);
	});

	it("is inactive entirely before the outer window", () => {
		expect(isWithinRules(baseRules, new Date("2026-05-30T12:00:00Z"))).toBe(
			false,
		);
	});

	it("is inactive after the end-time on the last day", () => {
		// endDateTime 2026-06-08T00:00Z = 2026-06-08 03:00 Helsinki.
		// endTime 04:30 Helsinki => effective end is 2026-06-08 04:30 Helsinki
		// = 01:30Z. 01:30Z on 2026-06-08 is the boundary; 01:31Z is past it.
		expect(isWithinRules(baseRules, new Date("2026-06-08T01:31:00Z"))).toBe(
			false,
		);
	});

	it("honours weekDays gating", () => {
		const noSaturday: VideoDeliveryRules = {
			...baseRules,
			weekDays: [
				"MONDAY",
				"TUESDAY",
				"WEDNESDAY",
				"THURSDAY",
				"FRIDAY",
				"SUNDAY",
			],
		};
		// Saturday 2026-06-06 12:00Z → 15:00 Helsinki, inside outer window
		expect(isWithinRules(noSaturday, new Date("2026-06-06T12:00:00Z"))).toBe(
			false,
		);
		// Sunday 2026-06-07 12:00Z → active
		expect(isWithinRules(noSaturday, new Date("2026-06-07T12:00:00Z"))).toBe(
			true,
		);
	});

	it("falls back to startDateTime/endDateTime when start/endTime are missing", () => {
		const rules: VideoDeliveryRules = {
			...baseRules,
			startTime: undefined,
			endTime: undefined,
		};
		expect(isWithinRules(rules, new Date("2026-06-01T00:00:01Z"))).toBe(true);
		expect(isWithinRules(rules, new Date("2026-05-31T23:59:59Z"))).toBe(false);
	});

	it("treats no rules as 'always active'", () => {
		expect(isWithinRules(undefined, new Date())).toBe(true);
	});
});

describe("isWithinRules — WHEN", () => {
	const weekdayWindow: VideoDeliveryRules = {
		deliveryType: "WHEN",
		startDateTime: "2026-01-01T00:00:00Z",
		endDateTime: "2030-01-01T00:00:00Z",
		startTime: "08:25",
		endTime: "21:00",
		weekDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
	};

	it("is active on a weekday inside the daily window", () => {
		// Wed 2026-06-03 12:00 Helsinki = 09:00Z (DST)
		expect(isWithinRules(weekdayWindow, new Date("2026-06-03T09:00:00Z"))).toBe(
			true,
		);
	});

	it("is inactive on a weekday outside the daily window", () => {
		// Wed 2026-06-03 22:00 Helsinki = 19:00Z
		expect(isWithinRules(weekdayWindow, new Date("2026-06-03T19:00:00Z"))).toBe(
			false,
		);
	});

	it("is inactive on a weekend even within the daily window", () => {
		// Sun 2026-06-07 12:00 Helsinki = 09:00Z
		expect(isWithinRules(weekdayWindow, new Date("2026-06-07T09:00:00Z"))).toBe(
			false,
		);
	});

	const overnightWindow: VideoDeliveryRules = {
		deliveryType: "WHEN",
		startDateTime: "2026-01-01T00:00:00Z",
		endDateTime: "2030-01-01T00:00:00Z",
		startTime: "22:00",
		endTime: "06:00",
		weekDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
	};

	it("handles overnight wrap (before midnight)", () => {
		// Wed 2026-06-03 23:30 Helsinki = 20:30Z
		expect(
			isWithinRules(overnightWindow, new Date("2026-06-03T20:30:00Z")),
		).toBe(true);
	});

	it("handles overnight wrap (after midnight)", () => {
		// Thu 2026-06-04 02:00 Helsinki = Wed 2026-06-03 23:00Z
		expect(
			isWithinRules(overnightWindow, new Date("2026-06-03T23:00:00Z")),
		).toBe(true);
	});

	it("is inactive mid-day during an overnight window", () => {
		// Wed 2026-06-03 12:00 Helsinki = 09:00Z
		expect(
			isWithinRules(overnightWindow, new Date("2026-06-03T09:00:00Z")),
		).toBe(false);
	});
});

describe("partitionActiveMessages", () => {
	const now = new Date("2026-06-03T09:00:00Z"); // Wed 12:00 Helsinki

	const general = makeMessage({
		id: "g1",
		trainNumber: null,
		video: { text: { fi: "Yleinen tiedote", sv: null, en: null } },
	});
	const matchingTrain = makeMessage({
		id: "t1",
		trainNumber: 1234,
		trainDepartureDate: "2026-06-03",
		video: { text: { fi: "Junatiedote", sv: null, en: null } },
	});
	const secondForSameTrain = makeMessage({
		id: "t2",
		trainNumber: 1234,
		trainDepartureDate: "2026-06-03",
		video: { text: { fi: "Toinen", sv: null, en: null } },
	});
	const unmatchedTrain = makeMessage({
		id: "t3",
		trainNumber: 9999,
		trainDepartureDate: "2026-06-03",
		video: { text: { fi: "Ei sovi", sv: null, en: null } },
	});

	const displayedKeys = new Set([trainMessageKey(1234, "2026-06-03")]);

	it("routes trainNumber=null messages to the general pool only", () => {
		const { general: g, perTrain } = partitionActiveMessages(
			[general],
			now,
			"fi",
			displayedKeys,
		);
		expect(g).toHaveLength(1);
		expect(g[0].id).toBe("g1");
		expect(perTrain.size).toBe(0);
	});

	it("drops per-train messages that do not match a displayed train", () => {
		const { general: g, perTrain } = partitionActiveMessages(
			[unmatchedTrain],
			now,
			"fi",
			displayedKeys,
		);
		expect(g).toHaveLength(0);
		expect(perTrain.size).toBe(0);
	});

	it("collects multiple active messages for the same train", () => {
		const { perTrain } = partitionActiveMessages(
			[matchingTrain, secondForSameTrain],
			now,
			"fi",
			displayedKeys,
		);
		const arr = perTrain.get(trainMessageKey(1234, "2026-06-03"));
		expect(arr).toHaveLength(2);
	});

	it("dedupes by id within a single partition call", () => {
		const dup: PassengerInformationMessage = { ...matchingTrain };
		const { perTrain } = partitionActiveMessages(
			[matchingTrain, dup],
			now,
			"fi",
			displayedKeys,
		);
		const arr = perTrain.get(trainMessageKey(1234, "2026-06-03"));
		expect(arr).toHaveLength(1);
	});

	it("drops messages without displayable video text", () => {
		const noText = makeMessage({
			id: "blank",
			trainNumber: null,
			video: { text: { fi: null, sv: null, en: null } },
		});
		const { general: g } = partitionActiveMessages(
			[noText],
			now,
			"fi",
			displayedKeys,
		);
		expect(g).toHaveLength(0);
	});

	it("resolves station codes to localized names when a resolver is given", () => {
		const msg = makeMessage({
			id: "s1",
			trainNumber: null,
			stations: ["PSL", "HKI"],
			video: { text: { fi: "Raide on suljettu.", sv: null, en: null } },
		});
		const resolve = (code: string) =>
			({ PSL: "Pasila", HKI: "Helsinki" })[code] ?? code;
		const { general: g } = partitionActiveMessages(
			[msg],
			now,
			"fi",
			displayedKeys,
			resolve,
		);
		expect(g[0].stationNames).toEqual(["Pasila", "Helsinki"]);
	});

	it("omits stationNames when no resolver is given", () => {
		const msg = makeMessage({
			id: "s2",
			trainNumber: null,
			stations: ["PSL"],
			video: { text: { fi: "Raide on suljettu.", sv: null, en: null } },
		});
		const { general: g } = partitionActiveMessages(
			[msg],
			now,
			"fi",
			displayedKeys,
		);
		expect(g[0].stationNames).toBeUndefined();
	});

	it("omits stationNames when the stations list is empty", () => {
		const msg = makeMessage({
			id: "s3",
			trainNumber: null,
			stations: [],
			video: { text: { fi: "Yleinen", sv: null, en: null } },
		});
		const { general: g } = partitionActiveMessages(
			[msg],
			now,
			"fi",
			displayedKeys,
			(c) => c,
		);
		expect(g[0].stationNames).toBeUndefined();
	});

	it("keeps the raw code when the resolver does not know it", () => {
		const msg = makeMessage({
			id: "s4",
			trainNumber: null,
			stations: ["ZZZ"],
			video: { text: { fi: "Yleinen", sv: null, en: null } },
		});
		const { general: g } = partitionActiveMessages(
			[msg],
			now,
			"fi",
			displayedKeys,
			(c) => ({ PSL: "Pasila" })[c] ?? c,
		);
		expect(g[0].stationNames).toEqual(["ZZZ"]);
	});
});

describe("fetchActivePassengerMessages URL construction", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;
	let urls: string[];

	beforeEach(() => {
		__resetPassengerInfoCacheForTests();
		urls = [];
		fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input: RequestInfo | URL) => {
				const url = typeof input === "string" ? input : input.toString();
				urls.push(url);
				return new Response("[]", {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			});
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("issues one general request per station (the API only honours the last station= param)", async () => {
		await fetchActivePassengerMessages({
			stationCodes: ["HKI", "PSL"],
			generalOnly: true,
		});
		expect(urls).toHaveLength(2);
		const stations = urls
			.map((u) => new URL(u).searchParams.get("station"))
			.sort();
		expect(stations).toEqual(["HKI", "PSL"]);
		for (const raw of urls) {
			const url = new URL(raw);
			expect(url.pathname.endsWith("/v1/passenger-information/active")).toBe(
				true,
			);
			expect(url.searchParams.getAll("station")).toHaveLength(1);
			expect(url.searchParams.get("only_general")).toBe("true");
			expect(url.searchParams.has("train_departure_date")).toBe(false);
		}
	});

	it("issues one per-train request per (station, unique date) pair", async () => {
		await fetchActivePassengerMessages({
			stationCodes: ["HKI", "PSL"],
			departureDates: ["2026-05-28", "2026-05-28", "2026-05-27"],
		});
		expect(urls).toHaveLength(4);
		const pairs = urls
			.map((raw) => {
				const url = new URL(raw);
				return `${url.searchParams.get("station")}|${url.searchParams.get("train_departure_date")}`;
			})
			.sort();
		expect(pairs).toEqual([
			"HKI|2026-05-27",
			"HKI|2026-05-28",
			"PSL|2026-05-27",
			"PSL|2026-05-28",
		]);
		for (const raw of urls) {
			const url = new URL(raw);
			expect(url.searchParams.getAll("station")).toHaveLength(1);
			expect(url.searchParams.has("only_general")).toBe(false);
		}
	});

	it("merges results across stations and dates, deduping by id", async () => {
		const sharedMessage = JSON.stringify([
			{
				id: "shared",
				startValidity: "2026-01-01T00:00:00Z",
				endValidity: "2027-01-01T00:00:00Z",
				trainNumber: 1,
				trainDepartureDate: "2026-05-28",
				stations: [],
				video: { text: { fi: "x", sv: null, en: null } },
			},
		]);
		fetchSpy.mockReset();
		fetchSpy.mockImplementation(
			async () =>
				new Response(sharedMessage, {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		);
		__resetPassengerInfoCacheForTests();
		const merged = await fetchActivePassengerMessages({
			stationCodes: ["HKI", "PSL"],
			departureDates: ["2026-05-27", "2026-05-28"],
		});
		expect(merged.map((m) => m.id)).toEqual(["shared"]);
	});

	it("treats station pair as order-independent (HKI,LH and LH,HKI yield the same URL set)", async () => {
		await fetchActivePassengerMessages({
			stationCodes: ["HKI", "LH"],
			generalOnly: true,
		});
		const firstSet = new Set(urls);
		urls.length = 0;
		__resetPassengerInfoCacheForTests();
		await fetchActivePassengerMessages({
			stationCodes: ["LH", "HKI"],
			generalOnly: true,
		});
		const secondSet = new Set(urls);
		expect(secondSet).toEqual(firstSet);
	});

	it("returns [] when stationCodes is empty", async () => {
		const result = await fetchActivePassengerMessages({
			stationCodes: [],
			generalOnly: true,
		});
		expect(result).toEqual([]);
		expect(urls).toHaveLength(0);
	});
});
