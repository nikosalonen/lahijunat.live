/** @format */

import { describe, expect, it } from "vitest";
import { classifyDuration } from "../trainUtils";

/** Sorted ascending, the way TrainList collects the route's journey times. */
const sorted = (...durations: number[]) => [...durations].sort((a, b) => a - b);

describe("classifyDuration", () => {
	it("does not call a train slow over a couple of timetable minutes", () => {
		// Ainola–Jokela: every train is the same R service, 27 take 11 minutes
		// and 3 take 13. A 2-minute difference is not a slower train.
		const durations = sorted(...Array(27).fill(11), 13, 13, 13);

		expect(classifyDuration(13, durations)).toBe("normal");
		expect(classifyDuration(11, durations)).toBe("normal");
	});

	it("still flags the slower way round the ring rail", () => {
		// Helsinki–airport: the I line takes 28 minutes, the P line 33 the
		// other way round. That is the difference the label is for.
		const durations = sorted(...Array(20).fill(28), ...Array(13).fill(33));

		expect(classifyDuration(33, durations)).toBe("slow");
		expect(classifyDuration(28, durations)).toBe("normal");
	});

	it("flags a train that takes a genuinely longer route", () => {
		// Helsinki–Tikkurila: R goes direct in 14 minutes, P the long way in 43
		const durations = sorted(...Array(20).fill(20), ...Array(6).fill(43));

		expect(classifyDuration(43, durations)).toBe("slow");
	});

	it("keeps the proportional rule on long routes", () => {
		// Helsinki–Riihimäki: a 55-minute median, so 64 minutes is still slow
		// even though the absolute margin is long past
		const durations = sorted(...Array(30).fill(55), 64, 89, 105);

		expect(classifyDuration(64, durations)).toBe("slow");
		expect(classifyDuration(55, durations)).toBe("normal");
	});

	it("needs real minutes before calling a train fast, too", () => {
		// The mirror of the Ainola–Jokela case: 15% of 11 minutes is 1.65, so a
		// percentage alone would paint a 9-minute train green
		const durations = sorted(...Array(27).fill(11), 9, 9, 9);

		expect(classifyDuration(9, durations)).toBe("normal");
		expect(classifyDuration(7, durations)).toBe("fast");
	});

	it("says nothing when there is not enough to compare", () => {
		expect(classifyDuration(13, [])).toBe("normal");
		expect(classifyDuration(13, [11])).toBe("normal");
	});
});
