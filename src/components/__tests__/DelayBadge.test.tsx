import { render } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import type { Train } from "../../types";
import DelayBadge from "../DelayBadge";

// Mock translations
vi.mock("../../utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			late: "Myöhässä",
			minutes: "minuuttia",
			minutesShort: "min",
		};
		return translations[key] || key;
	},
}));

// Mock useLanguageChange hook
vi.mock("../../hooks/useLanguageChange", () => ({
	useLanguageChange: vi.fn(),
}));

describe("DelayBadge", () => {
	const mockDepartureRow: Train["timeTableRows"][0] = {
		stationShortCode: "HKI",
		type: "DEPARTURE",
		scheduledTime: "2024-03-20T10:00:00.000Z",
		liveEstimateTime: "2024-03-20T10:00:00.000Z",
		actualTime: "2024-03-20T10:00:00.000Z",
		differenceInMinutes: 0,
		trainStopping: true,
		commercialStop: true,
		commercialTrack: "1",
		cancelled: false,
		station: {
			name: "Helsinki",
			shortCode: "HKI",
			location: {
				latitude: 60.1699,
				longitude: 24.9384,
			},
		},
	};

	const delayedDepartureRow = {
		...mockDepartureRow,
		liveEstimateTime: "2024-03-20T10:15:00.000Z",
		differenceInMinutes: 15,
	};

	const renderBadge = (
		departureRow: Train["timeTableRows"][0],
		timeDifferenceMinutes: number,
		isCancelled?: boolean,
	) => {
		const { container } = render(
			<DelayBadge
				departureRow={departureRow}
				timeDifferenceMinutes={timeDifferenceMinutes}
				isCancelled={isCancelled}
			/>,
		);
		return container.querySelector("output") as HTMLElement;
	};

	it("shows the delay in minutes for a late train", () => {
		const badge = renderBadge(delayedDepartureRow, 15);

		expect(badge).toHaveTextContent("+15 min");
		expect(badge).not.toHaveClass("hidden");
		expect(badge).toHaveAttribute("aria-label", "Myöhässä 15 minuuttia");
	});

	// Beside the duration on narrow phones, "+15 min" left no room for a long
	// trip's duration ("1 h 15 …"), so the unit only shows from 400 px up.
	it("shows the minutes unit only from 400 px up", () => {
		const badge = renderBadge(delayedDepartureRow, 15);
		const unit = badge.querySelector("span span");

		expect(unit).toHaveTextContent("min");
		expect(unit).toHaveClass("hidden", "min-[400px]:inline");
		// Not a direct child: the badge is a flex box, which would make the unit
		// its own item and swap the space for the badge's wider gap.
		expect(unit?.parentElement).not.toBe(badge);
	});

	it("does not show delay indicator when train is on time", () => {
		const badge = renderBadge(mockDepartureRow, 0);

		// The delay badge stays in the DOM but takes no space when not needed
		expect(badge).toHaveTextContent("+0 min");
		expect(badge).toHaveClass("hidden");
	});

	it("does not show delay indicator when train is cancelled", () => {
		const badge = renderBadge(delayedDepartureRow, 15, true);

		// The delay badge stays in the DOM but takes no space for cancelled trains
		expect(badge).toHaveTextContent("+15 min");
		expect(badge).toHaveClass("hidden");
	});

	it("should show unknown delay badge when unknownDelay is true", () => {
		const departureRow = {
			...mockDepartureRow,
			liveEstimateTime: "2024-01-01T10:05:00Z",
			differenceInMinutes: 5,
			unknownDelay: true,
		};

		const badge = renderBadge(departureRow, 5);

		expect(badge).toHaveTextContent("unknownDelay");
		expect(badge).not.toHaveTextContent("+5 min");
	});

	it("should not show unknown delay badge when unknownDelay is false", () => {
		const departureRow = {
			...mockDepartureRow,
			liveEstimateTime: "2024-01-01T10:05:00Z",
			differenceInMinutes: 5,
			unknownDelay: false,
		};

		const badge = renderBadge(departureRow, 5);

		expect(badge).not.toHaveTextContent("unknownDelay");
		expect(badge).toHaveTextContent("+5 min");
	});

	it("should not show unknown delay badge when train is cancelled", () => {
		const departureRow = {
			...mockDepartureRow,
			liveEstimateTime: "2024-01-01T10:05:00Z",
			differenceInMinutes: 5,
			cancelled: true,
			unknownDelay: true,
		};

		const badge = renderBadge(departureRow, 5);

		expect(badge).not.toHaveTextContent("unknownDelay");
		// The delay badge stays in the DOM but takes no space for cancelled trains
		expect(badge).toHaveTextContent("+5 min");
		expect(badge).toHaveClass("hidden");
	});
});
