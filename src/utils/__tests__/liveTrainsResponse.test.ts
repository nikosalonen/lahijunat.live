import { describe, expect, it } from "vitest";
import { parseLiveTrainsResponse } from "@/utils/liveTrainsResponse";

describe("parseLiveTrainsResponse", () => {
	it("returns the array Digitraffic sends when trains exist", () => {
		const trains = [{ trainNumber: 1 }, { trainNumber: 2 }];
		expect(parseLiveTrainsResponse(trains)).toBe(trains);
	});

	it("treats Digitraffic's 'no trains found' object as an empty list", () => {
		const body = {
			errorMessage:
				"No trains found for route from HNK to EPO between 2026-09-05T09:16Z and 2026-09-06T10:16Z, limit 100",
			code: "TRAIN_NOT_FOUND",
			queryString: "limit=100",
		};
		expect(parseLiveTrainsResponse(body)).toEqual([]);
	});

	it("still rejects any other unexpected shape", () => {
		expect(() => parseLiveTrainsResponse({ code: "SOMETHING_ELSE" })).toThrow(
			"expected an array",
		);
		expect(() => parseLiveTrainsResponse(null)).toThrow("expected an array");
		expect(() => parseLiveTrainsResponse("oops")).toThrow("expected an array");
	});
});
