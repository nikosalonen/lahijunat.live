import { afterEach, describe, expect, it } from "vitest";
import {
	__resetAnnouncementArrivalsForTests,
	takeNewArrivals,
} from "../announcementArrivals";
import type { ActiveMessage } from "../passengerInfo";

const PAGE_OPENED_AT = Date.parse("2026-10-27T06:10:00Z");

const message = (id: string, startValidity: string): ActiveMessage => ({
	id,
	text: "Ajetaan poikkeuksellisesti vain yhdellä junayksiköllä.",
	trainNumber: 9638,
	trainDepartureDate: "2026-10-27",
	startValidity,
	endValidity: "2026-10-29T00:00:00Z",
});

describe("takeNewArrivals", () => {
	afterEach(() => {
		__resetAnnouncementArrivalsForTests();
	});

	it("returns announcements that went live after the page opened", () => {
		const fresh = message("fresh", "2026-10-27T06:19:00Z");

		expect(takeNewArrivals([fresh], PAGE_OPENED_AT)).toEqual([fresh]);
	});

	it("ignores announcements that were already live when the page opened", () => {
		const old = message("old", "2026-10-27T05:00:00Z");

		expect(takeNewArrivals([old], PAGE_OPENED_AT)).toEqual([]);
	});

	it("counts announcements from just before opening as new", () => {
		// The app can lag up to about two minutes behind the source
		const justBefore = message("just-before", "2026-10-27T06:09:00Z");

		expect(takeNewArrivals([justBefore], PAGE_OPENED_AT)).toEqual([justBefore]);
	});

	it("reports each announcement only once", () => {
		const fresh = message("fresh", "2026-10-27T06:19:00Z");

		takeNewArrivals([fresh], PAGE_OPENED_AT);

		expect(takeNewArrivals([fresh], PAGE_OPENED_AT)).toEqual([]);
	});

	it("ignores announcements with an unreadable start time", () => {
		const broken = message("broken", "not a date");

		expect(takeNewArrivals([broken], PAGE_OPENED_AT)).toEqual([]);
	});
});
