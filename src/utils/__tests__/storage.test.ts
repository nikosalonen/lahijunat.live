import { beforeEach, describe, expect, it, vi } from "vitest";

const alertTarget = {
	trainNumber: 9638,
	departureDate: "2026-10-27",
	from: "RI",
	to: "HKI",
	fromName: "Riihimäki",
	toName: "Helsinki",
	title: "R 08:25 Riihimäki → Helsinki",
	cancelled: false,
};

describe("storage on the localStorage fallback", () => {
	beforeEach(() => {
		window.localStorage.clear();
		// storage.ts keeps its cache in module state; load a fresh copy per test.
		vi.resetModules();
	});

	it("keeps alertTarget when favorites are reloaded", async () => {
		window.localStorage.setItem(
			"highlightedTrains",
			JSON.stringify({
				"9638": {
					highlighted: true,
					removeAfter: "2099-01-01T00:00:00.000Z",
					journeyKey: "9638",
					alertTarget,
				},
			}),
		);

		const storage = await import("../storage");
		await storage.initStorage();

		// jsdom has no IndexedDB, so this exercises the fallback path.
		expect(storage.getStorageType()).toBe("localstorage");
		expect(storage.getFavoritesSync()["9638"]?.alertTarget).toEqual(
			alertTarget,
		);
	});
});
