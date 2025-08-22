import { render } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import type { Train } from "../../types";
import TimeDisplay from "../TimeDisplay";

// Mock translations
vi.mock("../../utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			late: "Myöhässä",
			minutes: "minuuttia",
			departure: "Lähtöaika",
			cancelled: "Peruttu",
		};
		return translations[key] || key;
	},
}));

// Mock useLanguageChange hook
vi.mock("../../hooks/useLanguageChange", () => ({
	useLanguageChange: vi.fn(),
}));

describe("TimeDisplay", () => {
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

	const mockArrivalRow: Train["timeTableRows"][0] = {
		stationShortCode: "TPE",
		type: "ARRIVAL",
		scheduledTime: "2024-03-20T11:00:00.000Z",
		liveEstimateTime: "2024-03-20T11:00:00.000Z",
		actualTime: "2024-03-20T11:00:00.000Z",
		differenceInMinutes: 0,
		trainStopping: true,
		commercialStop: true,
		commercialTrack: "2",
		cancelled: false,
		station: {
			name: "Tampere",
			shortCode: "TPE",
			location: {
				latitude: 61.4978,
				longitude: 23.7609,
			},
		},
	};

	it("renders on-time train correctly", () => {
		const { getByText } = render(
			<TimeDisplay
				departureRow={mockDepartureRow}
				arrivalRow={mockArrivalRow}
				timeDifferenceMinutes={0}
			/>,
		);

		// Should show scheduled departure and arrival without tildes
		getByText("12.00");
		getByText("13.00");
	});

	it("renders delayed train correctly", () => {
		const delayedDepartureRow = {
			...mockDepartureRow,
			liveEstimateTime: "2024-03-20T10:15:00.000Z",
			differenceInMinutes: 15,
		};

		const { getByText } = render(
			<TimeDisplay
				departureRow={delayedDepartureRow}
				arrivalRow={mockArrivalRow}
				timeDifferenceMinutes={15}
			/>,
		);

		expect(getByText("+15 min")).toBeInTheDocument();
	});

	it("renders cancelled train correctly", () => {
		const { container } = render(
			<TimeDisplay
				departureRow={mockDepartureRow}
				arrivalRow={mockArrivalRow}
				timeDifferenceMinutes={0}
				isCancelled={true}
			/>,
		);

		expect(container.firstChild).toHaveClass("line-through");
		expect(container.firstChild).toHaveClass("text-gray-500");
	});

	it("renders without arrival row", () => {
		const { container } = render(
			<TimeDisplay departureRow={mockDepartureRow} timeDifferenceMinutes={0} />,
		);

		expect(container).toMatchSnapshot();
	});

	it("does not show delay indicator when train is on time", () => {
		const { queryByText } = render(
			<TimeDisplay
				departureRow={mockDepartureRow}
				arrivalRow={mockArrivalRow}
				timeDifferenceMinutes={0}
			/>,
		);

		expect(queryByText("+0 min")).not.toBeInTheDocument();
	});

	it("does not show delay indicator when train is cancelled", () => {
		const delayedDepartureRow = {
			...mockDepartureRow,
			liveEstimateTime: "2024-03-20T10:15:00.000Z",
			differenceInMinutes: 15,
		};

		const { queryByText } = render(
			<TimeDisplay
				departureRow={delayedDepartureRow}
				arrivalRow={mockArrivalRow}
				timeDifferenceMinutes={15}
				isCancelled={true}
			/>,
		);

		// The delay indicator should not be visible for cancelled trains
		const delayIndicator = queryByText("+15 min");
		expect(delayIndicator).not.toBeInTheDocument();
	});
});
