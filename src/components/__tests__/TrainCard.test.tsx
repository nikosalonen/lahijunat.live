import { fireEvent, render } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Train } from "../../types";
import TrainCard from "../TrainCard";

// Mock translations
vi.mock("../../utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			late: "Myöhässä",
			minutes: "minuuttia",
			departure: "Lähtöaika",
			loading: "Ladataan...",
			duration: "Kesto",
			hours: "tuntia",
			minutes_short: "m",
			hours_short: "h",
			track: "Raide",
			departingSoon: "Lähtee pian",
			favorite: "favorite",
			unfavorite: "unfavorite",
			cancelled: "Peruttu",
		};
		return translations[key] || key;
	},
}));

// Mock useLanguageChange hook
vi.mock("../../hooks/useLanguageChange", () => ({
	useLanguageChange: vi.fn(),
}));

// Mock api functions
vi.mock("../../utils/api", () => ({
	getRelevantTrackInfo: vi.fn(() => ({
		track: "1",
		timestamp: "2024-03-20T10:00:00.000Z",
		journeyKey: "123-HKI-TPE",
	})),
}));

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		clear: () => {
			store = {};
		},
	};
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("TrainCard", () => {
	const mockTrain: Train = {
		trainNumber: "123",
		cancelled: false,
		operatorUICCode: "1234",
		trainCategory: "Commuter",
		trainType: "Commuter",
		commuterLineID: "A",
		timeTableRows: [
			{
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
			},
			{
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
			},
		],
	};

	const defaultProps = {
		train: mockTrain,
		stationCode: "HKI",
		destinationCode: "TPE",
		currentTime: new Date("2024-03-20T09:55:00.000Z"),
		onDepart: vi.fn(),
	};

	beforeEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
	});

	it("renders train information correctly", () => {
		const { getByText, getByLabelText } = render(
			<TrainCard {...defaultProps} />,
		);

		expect(getByLabelText("favorite")).toBeInTheDocument();
		expect(getByText("5 min")).toBeInTheDocument();
	});

	it("calls onDepart when train departs", () => {
		const futureTime = new Date("2024-03-20T10:01:00.000Z");
		render(<TrainCard {...defaultProps} currentTime={futureTime} />);

		expect(defaultProps.onDepart).toHaveBeenCalled();
	});

	it("handles cancelled trains correctly", () => {
		const cancelledTrain = { ...mockTrain, cancelled: true };
		const { container } = render(
			<TrainCard {...defaultProps} train={cancelledTrain} />,
		);

		expect(container.firstChild).toHaveClass("from-red-50");
	});

	it("handles favorite button click to highlight train", () => {
		const { container, getByLabelText, rerender } = render(
			<TrainCard {...defaultProps} />,
		);
		const favoriteButton = getByLabelText("favorite");

		// Click the favorite button
		fireEvent.click(favoriteButton);

		expect(localStorageMock.setItem).toHaveBeenCalled();

		// Re-render to apply the highlight state change
		rerender(<TrainCard {...defaultProps} />);

		// Check that it has highlighting styles (either for departing soon or general highlight)
		expect(container.firstChild).toHaveClass("animate-soft-blink-highlight");
	});

	it("removes highlight after departure", () => {
		const highlightedTrain = {
			...mockTrain,
			trainNumber: "123",
		};

		// Set initial highlight in localStorage
		localStorageMock.setItem(
			"highlightedTrains",
			JSON.stringify({
				"123": {
					highlighted: true,
					removeAfter: new Date("2024-03-20T10:10:00.000Z").toISOString(),
				},
			}),
		);

		const { container, rerender } = render(
			<TrainCard {...defaultProps} train={highlightedTrain} />,
		);

		// Initial state should be highlighted
		expect(container.firstChild).toHaveClass("animate-soft-blink-highlight");

		// Move time forward past the removal time
		rerender(
			<TrainCard
				{...defaultProps}
				train={highlightedTrain}
				currentTime={new Date("2024-03-20T10:11:00.000Z")}
			/>,
		);

		// Highlight should be removed
		expect(container.firstChild).not.toHaveClass(
			"animate-soft-blink-highlight",
		);
	});

	it("shows correct duration between stations", () => {
		const { getByLabelText } = render(<TrainCard {...defaultProps} />);

		// Duration should be 1 hour
		expect(getByLabelText("Kesto 1 tuntia 0 minuuttia")).toBeInTheDocument();
	});

	it("handles delayed trains correctly", () => {
		const delayedTrain = {
			...mockTrain,
			timeTableRows: [
				{
					...mockTrain.timeTableRows[0],
					differenceInMinutes: 15,
					liveEstimateTime: "2024-03-20T10:15:00.000Z",
				},
				mockTrain.timeTableRows[1],
			],
		};

		const { getByText } = render(
			<TrainCard {...defaultProps} train={delayedTrain} />,
		);

		expect(getByText("+15 min")).toBeInTheDocument();
	});

	it("restores card when estimate jumps forward after being negative", () => {
		const pastTime = new Date("2024-03-20T10:01:00.000Z");
		const { rerender, container } = render(
			<TrainCard {...defaultProps} currentTime={pastTime} />,
		);

		// Departure should have triggered
		expect(defaultProps.onDepart).toHaveBeenCalled();

		// Estimate jumps forward: set current time back to before departure
		rerender(
			<TrainCard
				{...defaultProps}
				currentTime={new Date("2024-03-20T09:59:00.000Z")}
			/>,
		);

		// Card should be visible again
		expect(container.firstChild).toHaveStyle("opacity: 1");
	});
});
