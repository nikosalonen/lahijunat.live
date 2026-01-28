import { fireEvent, render, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Train } from "../../types";
import TrainCard from "../TrainCard";

// Mock translations
vi.mock("../../utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			late: "Myöhässä",
			minutes: "minuuttia",
			minutesShort: "min",
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
		removeItem: vi.fn((key: string) => {
			delete store[key];
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
		// Mock requestAnimationFrame to execute immediately
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn((cb) => {
				cb(0);
				return 0;
			}),
		);
	});

	it("renders train information correctly", () => {
		const { getByText, getByLabelText } = render(
			<TrainCard {...defaultProps} />,
		);

		expect(getByLabelText("favorite")).toBeInTheDocument();
		expect(getByText("5 min")).toBeInTheDocument();
	});

	it("fades out departed train", async () => {
		const futureTime = new Date("2024-03-20T10:01:00.000Z");
		const departedTrain = {
			...mockTrain,
			isDeparted: true,
			timeTableRows: [
				{
					...mockTrain.timeTableRows[0],
					actualTime: "2024-03-20T10:00:00.000Z",
				},
				mockTrain.timeTableRows[1],
			],
		};
		const { container } = render(
			<TrainCard
				{...defaultProps}
				train={departedTrain}
				currentTime={futureTime}
			/>,
		);

		// RAF executes immediately in tests, so opacity should transition to 0
		const card = container.firstChild as HTMLElement;
		await waitFor(() => {
			expect(card.style.opacity).toBe("0");
		});

		// Transition end events are unreliable in the current test environment,
		// so we only verify that the opacity transition completes.
	});

	it("handles cancelled trains correctly", () => {
		const cancelledTrain = { ...mockTrain, cancelled: true };
		const { container } = render(
			<TrainCard {...defaultProps} train={cancelledTrain} />,
		);

		// The card content is now inside a wrapper div with swipe functionality
		const cardElement = container.querySelector(
			"[data-train-number]",
		) as HTMLElement;
		expect(cardElement).toHaveClass("from-red-50");
	});

	it("handles favorite button click to highlight train", () => {
		const { container, getByLabelText, rerender } = render(
			<TrainCard {...defaultProps} />,
		);
		const favoriteButton = getByLabelText("favorite");

		// Click the favorite button
		fireEvent.click(favoriteButton);

		// Re-render to apply the highlight state change
		rerender(<TrainCard {...defaultProps} />);

		// The card content is now inside a wrapper div with swipe functionality
		const cardElement = container.querySelector(
			"[data-train-number]",
		) as HTMLElement;
		// Check that it has highlighting styles (either for departing soon or general highlight)
		expect(cardElement).toHaveClass("animate-soft-blink-highlight");
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
					journeyKey: "123-HKI-TPE",
				},
			}),
		);

		const { container, rerender } = render(
			<TrainCard {...defaultProps} train={highlightedTrain} />,
		);

		// The card content is now inside a wrapper div with swipe functionality
		const cardElement = container.querySelector(
			"[data-train-number]",
		) as HTMLElement;

		// Initial state should be highlighted
		expect(cardElement).toHaveClass("animate-soft-blink-highlight");

		// Move time forward past the removal time
		rerender(
			<TrainCard
				{...defaultProps}
				train={highlightedTrain}
				currentTime={new Date("2024-03-20T10:11:00.000Z")}
			/>,
		);

		// Highlight should be removed (need to requery after rerender)
		const cardElementAfter = container.querySelector(
			"[data-train-number]",
		) as HTMLElement;
		expect(cardElementAfter).not.toHaveClass("animate-soft-blink-highlight");
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
		const departedTrain = {
			...mockTrain,
			isDeparted: true,
			timeTableRows: [
				{
					...mockTrain.timeTableRows[0],
					actualTime: "2024-03-20T10:00:00.000Z",
				},
				mockTrain.timeTableRows[1],
			],
		};
		const { rerender, container } = render(
			<TrainCard
				{...defaultProps}
				train={departedTrain}
				currentTime={pastTime}
			/>,
		);

		// RAF executes immediately in tests, so opacity should be 0
		const card = container.firstChild as HTMLElement;
		expect(card.style.opacity).toBe("0");

		// Estimate jumps forward: train is no longer departed
		const notDepartedTrain = {
			...mockTrain,
			isDeparted: false,
		};
		rerender(
			<TrainCard
				{...defaultProps}
				train={notDepartedTrain}
				currentTime={new Date("2024-03-20T09:59:00.000Z")}
			/>,
		);

		// Card should be visible again
		expect(container.firstChild).toHaveStyle("opacity: 1");
	});

	describe("snapshots", () => {
		it("matches snapshot for normal train", () => {
			const { container } = render(<TrainCard {...defaultProps} />);
			expect(container.firstChild).toMatchSnapshot();
		});

		it("matches snapshot for cancelled train", () => {
			const cancelledTrain = { ...mockTrain, cancelled: true };
			const { container } = render(
				<TrainCard {...defaultProps} train={cancelledTrain} />,
			);
			expect(container.firstChild).toMatchSnapshot();
		});

		it("matches snapshot for highlighted train", () => {
			// Set up highlighted state in localStorage
			localStorageMock.setItem(
				"highlightedTrains",
				JSON.stringify({
					"123": {
						highlighted: true,
						removeAfter: new Date("2024-03-20T10:10:00.000Z").toISOString(),
						journeyKey: "123-HKI-TPE",
					},
				}),
			);

			const { container } = render(<TrainCard {...defaultProps} />);
			expect(container.firstChild).toMatchSnapshot();
		});
	});
});
