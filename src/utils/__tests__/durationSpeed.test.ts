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
		// Helsinki–Tikkurila: the direct lines take a median 20 minutes, P goes
		// the long way round the ring in 43
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
		// 20 against a lone 11 would be "slow" if the guard were dropped, so
		// this pins the guard rather than restating the thresholds
		expect(classifyDuration(20, [11])).toBe("normal");
		expect(classifyDuration(20, [])).toBe("normal");
	});

	it("pins both bars at the exact minute they start to bite", () => {
		// Median 11, so slow needs max(12.65, 14) = 14 and fast needs
		// min(9.35, 8) = 8. One minute either side has to stay normal.
		const durations = sorted(...Array(27).fill(11), 14, 8);

		expect(classifyDuration(14, durations)).toBe("slow");
		expect(classifyDuration(13, durations)).toBe("normal");
		expect(classifyDuration(8, durations)).toBe("fast");
		expect(classifyDuration(9, durations)).toBe("normal");
	});

	it("pins the percentage bar on a route long enough for it to lead", () => {
		// Median 40, where 15% (6 min) outruns the 3-minute floor: slow starts
		// at exactly 46 and fast at exactly 34. This is what holds
		// SPEED_MARGIN in place — a smaller margin would flag 45 as slow.
		const durations = sorted(...Array(20).fill(40), ...Array(6).fill(46));

		expect(classifyDuration(46, durations)).toBe("slow");
		expect(classifyDuration(45, durations)).toBe("normal");
		expect(classifyDuration(34, durations)).toBe("fast");
		expect(classifyDuration(35, durations)).toBe("normal");
	});

	it("does not care what order the durations arrive in", () => {
		// TrainList sorts before calling, but nothing forces it to. An
		// unsorted array used to make the median an arbitrary element.
		// The 43 sitting on the middle index is the point: unsorted this reads
		// a median of 43, sorted it reads 20
		const unsorted = [43, 43, 20, 20, 20, 43, 20, 20, 20, 20];
		const ascending = sorted(...unsorted);

		for (const duration of [20, 43, 25]) {
			expect(classifyDuration(duration, unsorted)).toBe(
				classifyDuration(duration, ascending),
			);
		}
		expect(classifyDuration(43, unsorted)).toBe("slow");
	});

	it("survives one unparseable journey time", () => {
		// A NaN cannot be sorted, so it stays where it landed. On the middle
		// index it became the median, every threshold turned NaN, and every
		// train on the route read "normal".
		const durations = [20, 20, 20, Number.NaN, 20, 43];

		expect(classifyDuration(43, durations)).toBe("slow");
		expect(classifyDuration(20, durations)).toBe("normal");
	});

	it("leaves the caller's array alone", () => {
		const durations = [43, 20, 20];
		classifyDuration(20, durations);
		expect(durations).toEqual([43, 20, 20]);
	});
});
