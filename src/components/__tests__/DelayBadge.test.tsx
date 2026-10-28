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

	it("shows the delay in minutes for a late train", () => {
		const { getByText } = render(
			<DelayBadge
				departureRow={delayedDepartureRow}
				timeDifferenceMinutes={15}
			/>,
		);

		const badge = getByText("+15 min");
		expect(badge).not.toHaveClass("hidden");
		expect(badge).toHaveAttribute("aria-label", "Myöhässä 15 minuuttia");
	});

	it("does not show delay indicator when train is on time", () => {
		const { queryByText } = render(
			<DelayBadge departureRow={mockDepartureRow} timeDifferenceMinutes={0} />,
		);

		// The delay badge stays in the DOM but takes no space when not needed
		const delayBadge = queryByText("+0 min");
		expect(delayBadge).toBeInTheDocument();
		expect(delayBadge).toHaveClass("hidden");
	});

	it("does not show delay indicator when train is cancelled", () => {
		const { queryByText } = render(
			<DelayBadge
				departureRow={delayedDepartureRow}
				timeDifferenceMinutes={15}
				isCancelled={true}
			/>,
		);

		// The delay badge stays in the DOM but takes no space for cancelled trains
		const delayIndicator = queryByText("+15 min");
		expect(delayIndicator).toBeInTheDocument();
		expect(delayIndicator).toHaveClass("hidden");
	});

	it("should show unknown delay badge when unknownDelay is true", () => {
		const departureRow = {
			...mockDepartureRow,
			liveEstimateTime: "2024-01-01T10:05:00Z",
			differenceInMinutes: 5,
			unknownDelay: true,
		};

		const { getByText, queryByText } = render(
			<DelayBadge departureRow={departureRow} timeDifferenceMinutes={5} />,
		);

		expect(getByText("unknownDelay")).toBeInTheDocument();
		expect(queryByText("+5 min")).not.toBeInTheDocument();
	});

	it("should not show unknown delay badge when unknownDelay is false", () => {
		const departureRow = {
			...mockDepartureRow,
			liveEstimateTime: "2024-01-01T10:05:00Z",
			differenceInMinutes: 5,
			unknownDelay: false,
		};

		const { getByText, queryByText } = render(
			<DelayBadge departureRow={departureRow} timeDifferenceMinutes={5} />,
		);

		expect(queryByText("unknownDelay")).not.toBeInTheDocument();
		expect(getByText("+5 min")).toBeInTheDocument();
	});

	it("should not show unknown delay badge when train is cancelled", () => {
		const departureRow = {
			...mockDepartureRow,
			liveEstimateTime: "2024-01-01T10:05:00Z",
			differenceInMinutes: 5,
			cancelled: true,
			unknownDelay: true,
		};

		const { queryByText } = render(
			<DelayBadge departureRow={departureRow} timeDifferenceMinutes={5} />,
		);

		expect(queryByText("unknownDelay")).not.toBeInTheDocument();
		// The delay badge stays in the DOM but takes no space for cancelled trains
		const delayBadge = queryByText("+5 min");
		expect(delayBadge).toBeInTheDocument();
		expect(delayBadge).toHaveClass("hidden");
	});
});
