import { afterEach, describe, expect, it } from "vitest";
import stations from "../../data/stations-snapshot.json";
import { switchLanguage } from "../language";
import { getLocalizedStationName } from "../stationNames";

describe("getLocalizedStationName", () => {
	afterEach(() => {
		window.localStorage.removeItem("lang");
	});

	it("keeps the Finnish name outside Swedish", () => {
		switchLanguage("en");
		expect(getLocalizedStationName("Helsinki", "HKI")).toBe("Helsinki");
	});

	it("names every commuter station with a distinct Swedish name", () => {
		switchLanguage("sv");
		const expected: Record<string, string> = {
			HKI: "Helsingfors",
			VMO: "Gjuteriet",
			VEH: "Veckal",
			LNÄ: "Lejle",
			RKL: "Räckhals",
		};
		for (const [code, swedish] of Object.entries(expected)) {
			const station = stations.find((s) => s.shortCode === code);
			expect(station, code).toBeDefined();
			expect(getLocalizedStationName(station?.name ?? "", code)).toBe(swedish);
		}
	});
});
