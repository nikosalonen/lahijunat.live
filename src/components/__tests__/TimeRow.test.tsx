import { render } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import type { Train } from "../../types";
import TimeRow from "../TimeRow";

// Mock translations
vi.mock("../utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			departure: "Lähtöaika",
		};
		return translations[key] || key;
	},
}));

describe("TimeRow", () => {
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

	it("renders departure time correctly", () => {
		const { getByText } = render(<TimeRow departureRow={mockDepartureRow} />);

		expect(getByText("12.00")).toBeInTheDocument();
	});

	it("renders both departure and arrival times correctly", () => {
		const { getByText } = render(
			<TimeRow departureRow={mockDepartureRow} arrivalRow={mockArrivalRow} />,
		);

		expect(getByText("12.00")).toBeInTheDocument();
		expect(getByText("13.00")).toBeInTheDocument();
		expect(getByText("→")).toBeInTheDocument();
	});

	it("shows tilde when train is delayed", () => {
		const delayedDepartureRow = {
			...mockDepartureRow,
			liveEstimateTime: "2024-03-20T10:15:00.000Z",
			differenceInMinutes: 15,
		};

		const { getByText } = render(
			<TimeRow departureRow={delayedDepartureRow} />,
		);

		expect(getByText("~")).toBeInTheDocument();
	});

	it("does not show tilde when train is on time", () => {
		const { queryByText } = render(<TimeRow departureRow={mockDepartureRow} />);

		expect(queryByText("~")).not.toBeInTheDocument();
	});

	it("renders with correct datetime attribute", () => {
		const { container } = render(<TimeRow departureRow={mockDepartureRow} />);

		const timeElement = container.querySelector("time");
		expect(timeElement).toHaveAttribute("datetime", "2024-03-20T10:00:00.000Z");
	});
});
