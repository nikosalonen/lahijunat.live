/** @format */

import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { useState } from "preact/hooks";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockedFunction,
	vi,
} from "vitest";
import type { Station } from "../../types";
import { fetchTrainsLeavingFromStation } from "../../utils/api";
import type { Props } from "../StationManager";
import StationManager from "../StationManager";

// Mock translations
vi.mock("../../utils/translations", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			from: "Mistä",
			to: "Mihin",
			h1title: "Lähijunien aikataulut reaaliaikaisesti",
			hint: "Valitse ensin lähtöasema",
			closeHint: "Sulje vihje",
			locate: "Paikanna",
			swapDirection: "Vaihda suuntaa",
			loading: "Ladataan...",
			placeholder: "placeholder",
		};
		return translations[key] || key;
	},
}));

// Mock useLanguageChange hook
vi.mock("../hooks/useLanguageChange", () => ({
	useLanguageChange: vi.fn(),
}));

// Mock fetchTrainsLeavingFromStation
vi.mock("../../utils/api", () => ({
	fetchTrainsLeavingFromStation: vi.fn(),
	fetchTrains: vi.fn(),
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

describe("StationManager", () => {
	const mockStations: Station[] = [
		{
			name: "Helsinki",
			shortCode: "HKI",
			location: {
				latitude: 60.1699,
				longitude: 24.9384,
			},
		},
		{
			name: "Tampere",
			shortCode: "TPE",
			location: {
				latitude: 61.4978,
				longitude: 23.7609,
			},
		},
		{
			name: "Turku",
			shortCode: "TKU",
			location: {
				latitude: 60.4518,
				longitude: 22.2666,
			},
		},
	];

	const mockDestinations: Station[] = [
		{
			name: "Tampere",
			shortCode: "TPE",
			location: {
				latitude: 61.4978,
				longitude: 23.7609,
			},
		},
	];

	beforeEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
		(
			fetchTrainsLeavingFromStation as MockedFunction<
				typeof fetchTrainsLeavingFromStation
			>
		).mockResolvedValue(mockDestinations);
	});

	it("shows loading state when fetching destinations", async () => {
		const { getByText, findByText, container } = render(
			<StationManagerTestWrapper stations={mockStations} />,
		);

		// Select a station
		const fromInput =
			getByText("Mistä").nextElementSibling?.querySelector("input");
		if (fromInput) {
			fireEvent.focus(fromInput);
			fireEvent.input(fromInput, { target: { value: "Helsinki" } });

			// Wait for the dropdown to appear
			await waitFor(() => {
				const dropdown = container.querySelector(
					".station-list-container .dropdown-content",
				);
				expect(dropdown).toBeInTheDocument();
			});

			// Find and click the station option
			const stationOption = await findByText("Helsinki (HKI)");
			fireEvent.click(stationOption);
		}

		// Check if loading state is shown (skeleton animation)
		expect(container.querySelector(".skeleton")).toBeInTheDocument();

		// Wait for destinations to load
		await waitFor(() => {
			expect(container.querySelector(".skeleton")).not.toBeInTheDocument();
		});
	});

	it("updates available destinations when origin station is selected", async () => {
		const { getByText, findByText, container } = render(
			<StationManagerTestWrapper stations={mockStations} />,
		);

		// Select origin station
		const fromInput =
			getByText("Mistä").nextElementSibling?.querySelector("input");
		if (fromInput) {
			fireEvent.focus(fromInput);
			fireEvent.input(fromInput, { target: { value: "Helsinki" } });

			// Wait for the dropdown to appear
			await waitFor(() => {
				const dropdown = container.querySelector(
					".station-list-container .dropdown-content",
				);
				expect(dropdown).toBeInTheDocument();
			});

			// Find and click the station option
			const stationOption = await findByText("Helsinki (HKI)");
			fireEvent.click(stationOption);
		}

		// Wait for destinations to load
		await waitFor(() => {
			expect(fetchTrainsLeavingFromStation).toHaveBeenCalledWith("HKI");
		});

		// Check if destination list is updated
		const toInput =
			getByText("Mihin").nextElementSibling?.querySelector("input");
		if (toInput) {
			fireEvent.focus(toInput);
			fireEvent.input(toInput, { target: { value: "" } });

			// Wait for the dropdown to appear
			await waitFor(() => {
				const dropdown = container.querySelector(
					".station-list-container .dropdown-content",
				);
				expect(dropdown).toBeInTheDocument();
			});

			// Find and verify the destination option
			const destinationOption = await findByText("Tampere (TPE)");
			expect(destinationOption).toBeInTheDocument();
		}
	});

	it("handles error when fetching destinations", async () => {
		(
			fetchTrainsLeavingFromStation as MockedFunction<
				typeof fetchTrainsLeavingFromStation
			>
		).mockRejectedValue(new Error("Failed to fetch"));

		// Suppress error log for this test
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const { getByText, findByText, container } = render(
			<StationManagerTestWrapper stations={mockStations} />,
		);

		// Select origin station
		const fromInput =
			getByText("Mistä").nextElementSibling?.querySelector("input");
		if (fromInput) {
			fireEvent.focus(fromInput);
			fireEvent.input(fromInput, { target: { value: "Helsinki" } });

			// Wait for the dropdown to appear
			await waitFor(() => {
				const dropdown = container.querySelector(
					".station-list-container .dropdown-content",
				);
				expect(dropdown).toBeInTheDocument();
			});

			// Find and click the station option
			const stationOption = await findByText("Helsinki (HKI)");
			fireEvent.click(stationOption);
		}

		// Wait for error to occur and fallback to all stations
		await waitFor(() => {
			expect(fetchTrainsLeavingFromStation).toHaveBeenCalledWith("HKI");
		});

		// Check if all stations are available in destination list
		const toInput =
			getByText("Mihin").nextElementSibling?.querySelector("input");
		if (toInput) {
			fireEvent.focus(toInput);
			fireEvent.input(toInput, { target: { value: "" } });

			// Wait for the dropdown to appear
			await waitFor(() => {
				const dropdown = container.querySelector(
					".station-list-container .dropdown-content",
				);
				expect(dropdown).toBeInTheDocument();
			});

			// Find and verify both stations are available
			const tampereOption = await findByText("Tampere (TPE)");
			const turkuOption = await findByText("Turku (TKU)");
			expect(tampereOption).toBeInTheDocument();
			expect(turkuOption).toBeInTheDocument();
		}

		errorSpy.mockRestore();
	});

	it("clears destination if it becomes unavailable", async () => {
		// Set initial destination
		localStorageMock.setItem("selectedDestination", "TKU");

		render(
			<StationManager
				stations={mockStations}
				initialFromStation="HKI"
				initialToStation="TKU"
			/>,
		);

		// Wait for destinations to load and verify destination is cleared
		await waitFor(() => {
			expect(localStorageMock.removeItem).toHaveBeenCalledWith(
				"selectedDestination",
			);
		});
	});

	describe("geolocation functionality", () => {
		let mockGeolocation: {
			getCurrentPosition: ReturnType<typeof vi.fn>;
		};

		beforeEach(() => {
			// Mock geolocation
			mockGeolocation = {
				getCurrentPosition: vi.fn(),
			};
			Object.defineProperty(global.navigator, "geolocation", {
				value: mockGeolocation,
				writable: true,
			});

			// Mock window.alert
			vi.spyOn(window, "alert").mockImplementation(() => {});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("finds nearest station when geolocation is successful", async () => {
			// Mock successful geolocation (Helsinki coordinates)
			const mockPosition = {
				coords: {
					latitude: 60.1699,
					longitude: 24.9384,
				},
			};

			mockGeolocation.getCurrentPosition.mockImplementation((success) => {
				success(mockPosition);
			});

			render(<StationManager stations={mockStations} />);

			const locationButton = screen.getByRole("button", { name: "Paikanna" });
			fireEvent.click(locationButton);

			await waitFor(() => {
				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"selectedOrigin",
					"HKI",
				);
			});
		});

		it("shows error when geolocation is not supported", async () => {
			// Remove geolocation support
			Object.defineProperty(global.navigator, "geolocation", {
				value: undefined,
				writable: true,
			});

			render(<StationManager stations={mockStations} />);

			const locationButton = screen.getByRole("button", { name: "Paikanna" });
			fireEvent.click(locationButton);

			expect(
				screen.getByText("Paikannus ei ole tuettu selaimessasi"),
			).toBeInTheDocument();
		});

		it("shows error when geolocation permission is denied", async () => {
			const mockError = {
				code: 1, // PERMISSION_DENIED
				message: "User denied the request for Geolocation.",
			};

			mockGeolocation.getCurrentPosition.mockImplementation(
				(_success, error) => {
					error(mockError);
				},
			);

			render(<StationManager stations={mockStations} />);

			const locationButton = screen.getByRole("button", { name: "Paikanna" });
			fireEvent.click(locationButton);

			await waitFor(() => {
				expect(
					screen.getByText(
						"Paikannus on estetty. Ole hyvä ja salli paikannus selaimen asetuksista.",
					),
				).toBeInTheDocument();
			});
		});

		it("shows error when location is outside Finland", async () => {
			// Mock location outside Finland (London coordinates)
			const mockPosition = {
				coords: {
					latitude: 51.5074,
					longitude: -0.1278,
				},
			};

			mockGeolocation.getCurrentPosition.mockImplementation((success) => {
				success(mockPosition);
			});

			render(<StationManager stations={mockStations} />);

			const locationButton = screen.getByRole("button", { name: "Paikanna" });
			fireEvent.click(locationButton);

			await waitFor(() => {
				expect(
					screen.getByText("Paikannus toimii vain Suomessa"),
				).toBeInTheDocument();
			});
		});

		it("swaps stations when nearest station is same as destination", async () => {
			// Set initial state with HKI as destination
			localStorageMock.setItem("selectedOrigin", "TPE");
			localStorageMock.setItem("selectedDestination", "HKI");

			// Mock geolocation to Helsinki (which is the destination)
			const mockPosition = {
				coords: {
					latitude: 60.1699,
					longitude: 24.9384,
				},
			};

			mockGeolocation.getCurrentPosition.mockImplementation((success) => {
				success(mockPosition);
			});

			render(
				<StationManager
					stations={mockStations}
					initialFromStation="TPE"
					initialToStation="HKI"
				/>,
			);

			const locationButton = screen.getByRole("button", { name: "Paikanna" });
			fireEvent.click(locationButton);

			await waitFor(() => {
				// Should swap: origin becomes HKI, destination becomes TPE
				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"selectedOrigin",
					"HKI",
				);
				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"selectedDestination",
					"TPE",
				);
			});
		});

		it("shows loading state while getting location", async () => {
			let resolveGeolocation: (position: GeolocationPosition) => void =
				() => {};
			const geolocationPromise = new Promise<GeolocationPosition>((resolve) => {
				resolveGeolocation = resolve;
			});

			mockGeolocation.getCurrentPosition.mockImplementation((success) => {
				geolocationPromise.then(success);
			});

			render(<StationManager stations={mockStations} />);

			const locationButton = screen.getByRole("button", { name: "Paikanna" });
			fireEvent.click(locationButton);

			// Button should show loading state
			expect(locationButton.className).toContain("animate-pulse");

			// Resolve geolocation
			resolveGeolocation?.({
				coords: {
					latitude: 60.1699,
					longitude: 24.9384,
					accuracy: 10,
					altitude: null,
					altitudeAccuracy: null,
					heading: null,
					speed: null,
				},
				timestamp: Date.now(),
			} as GeolocationPosition);

			await waitFor(() => {
				expect(locationButton.className).not.toContain("animate-bounce-subtle");
			});
		});

		it("prevents multiple simultaneous geolocation requests", async () => {
			let callCount = 0;
			mockGeolocation.getCurrentPosition.mockImplementation(() => {
				callCount++;
				// Don't resolve to simulate ongoing request
			});

			render(<StationManager stations={mockStations} />);

			const locationButton = screen.getByRole("button", { name: "Paikanna" });

			// Click multiple times rapidly
			fireEvent.click(locationButton);
			fireEvent.click(locationButton);
			fireEvent.click(locationButton);

			// Should only make one geolocation call
			expect(callCount).toBe(1);
		});

		it("handles geolocation timeout error", async () => {
			const mockError = {
				code: 3, // TIMEOUT
				message: "Timeout expired",
			};

			mockGeolocation.getCurrentPosition.mockImplementation(
				(_success, error) => {
					error(mockError);
				},
			);

			render(<StationManager stations={mockStations} />);

			const locationButton = screen.getByRole("button", { name: "Paikanna" });
			fireEvent.click(locationButton);

			await waitFor(() => {
				expect(screen.getByText("Timeout expired")).toBeInTheDocument();
			});
		});

		it("calculates nearest station correctly", async () => {
			// Mock position closer to Tampere than Helsinki
			const mockPosition = {
				coords: {
					latitude: 61.4978, // Tampere coordinates
					longitude: 23.7609,
				},
			};

			mockGeolocation.getCurrentPosition.mockImplementation((success) => {
				success(mockPosition);
			});

			render(<StationManager stations={mockStations} />);

			const locationButton = screen.getByRole("button", { name: "Paikanna" });
			fireEvent.click(locationButton);

			await waitFor(() => {
				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"selectedOrigin",
					"TPE", // Should select Tampere as it's closer
				);
			});
		});
	});

	describe("PWA and URL handling", () => {
		let originalLocation: Location;
		let originalVisibilityState: string;

		beforeEach(() => {
			originalLocation = window.location;
			originalVisibilityState = document.visibilityState;

			// Mock window.location
			Object.defineProperty(window, "location", {
				value: {
					...originalLocation,
					search: "",
					pathname: "/",
					reload: vi.fn(),
				} as Location,
				writable: true,
				configurable: true,
			});

			// Mock document.visibilityState
			Object.defineProperty(document, "visibilityState", {
				value: "visible",
				writable: true,
			});

			// Mock history API
			const mockHistory = {
				pushState: vi.fn(),
				replaceState: vi.fn(),
			};
			Object.defineProperty(window, "history", {
				value: mockHistory,
				writable: true,
				configurable: true,
			});
		});

		afterEach(() => {
			Object.defineProperty(window, "location", {
				value: originalLocation,
				writable: true,
				configurable: true,
			});
			Object.defineProperty(document, "visibilityState", {
				value: originalVisibilityState,
				writable: true,
			});
			vi.restoreAllMocks();
		});

		it("restores route from localStorage on PWA launch", async () => {
			// Set PWA launch parameters
			window.location.search = "?source=pwa";
			localStorageMock.setItem("selectedOrigin", "HKI");
			localStorageMock.setItem("selectedDestination", "TPE");

			render(<StationManager stations={mockStations} />);

			await waitFor(() => {
				expect(window.history.replaceState).toHaveBeenCalledWith(
					{},
					"",
					"/HKI/TPE",
				);
			});
		});

		it("updates URL when stations change", async () => {
			const { getByText, findByText, container } = render(
				<StationManager stations={mockStations} />,
			);

			// Select a station to trigger URL update
			const fromInput =
				getByText("Mistä").nextElementSibling?.querySelector("input");
			if (fromInput) {
				fireEvent.focus(fromInput);
				fireEvent.input(fromInput, { target: { value: "Helsinki" } });

				// Wait for the dropdown to appear
				await waitFor(() => {
					const dropdown = container.querySelector(
						".station-list-container .dropdown-content",
					);
					expect(dropdown).toBeInTheDocument();
				});

				// Find and click the station option
				const stationOption = await findByText("Helsinki (HKI)");
				fireEvent.click(stationOption);
			}

			// Wait for URL to be updated
			await waitFor(() => {
				expect(window.history.pushState).toHaveBeenCalledWith({}, "", "/HKI");
			});
		});

		it("updates URL when both stations are selected", async () => {
			const { getByText, findByText, container } = render(
				<StationManager stations={mockStations} />,
			);

			// Select origin station
			const fromInput =
				getByText("Mistä").nextElementSibling?.querySelector("input");
			if (fromInput) {
				fireEvent.focus(fromInput);
				fireEvent.input(fromInput, { target: { value: "Helsinki" } });

				await waitFor(() => {
					const dropdown = container.querySelector(
						".station-list-container .dropdown-content",
					);
					expect(dropdown).toBeInTheDocument();
				});

				const stationOption = await findByText("Helsinki (HKI)");
				fireEvent.click(stationOption);
			}

			// Wait for destinations to load
			await waitFor(() => {
				expect(fetchTrainsLeavingFromStation).toHaveBeenCalledWith("HKI");
			});

			// Select destination station
			const toInput =
				getByText("Mihin").nextElementSibling?.querySelector("input");
			if (toInput) {
				fireEvent.focus(toInput);
				fireEvent.input(toInput, { target: { value: "Tampere" } });

				await waitFor(() => {
					const dropdown = container.querySelector(
						".station-list-container .dropdown-content",
					);
					expect(dropdown).toBeInTheDocument();
				});

				const destinationOption = await findByText("Tampere (TPE)");
				fireEvent.click(destinationOption);
			}

			// Wait for URL to be updated with both stations
			await waitFor(() => {
				expect(window.history.pushState).toHaveBeenCalledWith(
					{},
					"",
					"/HKI/TPE",
				);
			});
		});

		it("handles browser back button", async () => {
			render(<StationManager stations={mockStations} />);

			// Simulate back button (popstate event)
			window.location.pathname = "/HKI/TPE";
			fireEvent(window, new PopStateEvent("popstate"));

			await waitFor(() => {
				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"selectedOrigin",
					"HKI",
				);
				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"selectedDestination",
					"TPE",
				);
			});
		});

		it("does not update URL during PWA launch", async () => {
			// Set PWA launch parameters
			window.location.search = "?source=pwa";

			// Mock document as hidden during PWA launch
			Object.defineProperty(document, "visibilityState", {
				value: "hidden",
				writable: true,
			});

			const { getByText, findByText, container } = render(
				<StationManager stations={mockStations} />,
			);

			// Select a station
			const fromInput =
				getByText("Mistä").nextElementSibling?.querySelector("input");
			if (fromInput) {
				fireEvent.focus(fromInput);
				fireEvent.input(fromInput, { target: { value: "Helsinki" } });

				await waitFor(() => {
					const dropdown = container.querySelector(
						".station-list-container .dropdown-content",
					);
					expect(dropdown).toBeInTheDocument();
				});

				const stationOption = await findByText("Helsinki (HKI)");
				fireEvent.click(stationOption);
			}

			// URL should not be updated during PWA launch when document is hidden
			await waitFor(() => {
				expect(window.history.pushState).not.toHaveBeenCalled();
			});
		});
	});
});

// Custom test wrapper to force openList to 'from'
function StationManagerTestWrapper(props: Props) {
	const [openList, setOpenList] = useState<"from" | "to" | null>("from");
	return (
		<StationManager {...props} openList={openList} setOpenList={setOpenList} />
	);
}
