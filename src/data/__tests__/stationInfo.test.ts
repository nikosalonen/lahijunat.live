import { describe, expect, it } from "vitest";
import { getStationPlace, getTicket } from "../stationInfo";

// These read the committed station-info.json, so they pin zones that have
// been stable for years: Helsinki A, Pasila A, Tikkurila C, Kerava D.
describe("getStationPlace", () => {
	it("gives a station's HSL zone and street address", () => {
		expect(getStationPlace("TKL")).toEqual({
			zone: "C",
			address: "Ratatie 11",
		});
	});

	it("knows nothing of a station outside the HSL feed", () => {
		expect(getStationPlace("TPE")).toBeNull();
	});

	it("returns null without a station", () => {
		expect(getStationPlace(null)).toBeNull();
	});
});

describe("getTicket", () => {
	it("covers every zone between the two ends", () => {
		expect(getTicket("HKI", "TKL")).toEqual({ kind: "hsl", fares: ["ABC"] });
		expect(getTicket("TKL", "HKI")).toEqual({ kind: "hsl", fares: ["ABC"] });
		expect(getTicket("HKI", "KE")).toEqual({ kind: "hsl", fares: ["ABCD"] });
	});

	it("offers each cheapest ticket when a trip stays in one zone", () => {
		// HSL sells no A-only ticket, and AB is the only one covering A
		expect(getTicket("HKI", "PSL")).toEqual({ kind: "hsl", fares: ["AB"] });
	});

	it("sends a trip with an end outside the HSL area to VR", () => {
		expect(getTicket("HKI", "TPE")).toEqual({ kind: "outsideHsl" });
		expect(getTicket("TPE", "HKI")).toEqual({ kind: "outsideHsl" });
	});

	it("needs both ends", () => {
		expect(getTicket("HKI", null)).toBeNull();
	});
});
