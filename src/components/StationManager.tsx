// src/components/StationManager.tsx
import { useEffect, useState } from "preact/hooks";
import type { Station } from "../types";
import { fetchTrainsLeavingFromStation } from "../utils/api";
import { calculateDistance } from "../utils/location";
import StationList from "./StationList";
import TrainList from "./TrainList";

interface Props {
	stations: Station[];
}

const getStoredValue = (key: string): string | null => {
	if (typeof window !== "undefined") {
		return localStorage.getItem(key);
	}
	return null;
};

const setStoredValue = (key: string, value: string): void => {
	if (typeof window !== "undefined") {
		localStorage.setItem(key, value);
	}
};

const isLocalStorageAvailable = () => {
	try {
		return typeof window !== "undefined" && window.localStorage !== null;
	} catch (e) {
		return false;
	}
};

export default function StationManager({ stations }: Props) {
	const [openList, setOpenList] = useState<"from" | "to" | null>(null);
	const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
	const [selectedDestination, setSelectedDestination] = useState<string | null>(
		null,
	);
	const [showHint, setShowHint] = useState<boolean | null>(null);
	const [availableDestinations, setAvailableDestinations] =
		useState<Station[]>(stations);
	const [isLocating, setIsLocating] = useState<boolean | null>(null);

	useEffect(() => {
		setIsLocating(false);
		setSelectedOrigin(getStoredValue("selectedOrigin"));
		setSelectedDestination(getStoredValue("selectedDestination"));
		if (isLocalStorageAvailable()) {
			setShowHint(localStorage.getItem("hideDestinationHint") !== "true");
		} else {
			setShowHint(true);
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const fetchDestinations = async () => {
			if (selectedOrigin) {
				const destinations =
					await fetchTrainsLeavingFromStation(selectedOrigin);
				setAvailableDestinations(destinations);

				if (
					selectedDestination &&
					!destinations.some((s) => s.shortCode === selectedDestination)
				) {
					setSelectedDestination(null);
					localStorage.removeItem("selectedDestination");
				}
			} else {
				setAvailableDestinations(stations);
			}
		};

		fetchDestinations();
	}, [selectedOrigin, stations]);

	const handleOriginSelect = (station: Station) => {
		setSelectedOrigin(station.shortCode);
		setStoredValue("selectedOrigin", station.shortCode);
	};

	const handleDestinationSelect = (station: Station) => {
		setSelectedDestination(station.shortCode);
		setStoredValue("selectedDestination", station.shortCode);
	};

	const handleSwapStations = () => {
		if (!selectedOrigin || !selectedDestination) {
			return;
		}

		const tempOrigin = selectedOrigin;
		setSelectedOrigin(selectedDestination);
		setSelectedDestination(tempOrigin);

		if (selectedOrigin) {
			setStoredValue("selectedDestination", selectedOrigin);
		}
		if (selectedDestination) {
			setStoredValue("selectedOrigin", selectedDestination);
		}
	};

	const handleLocationRequest = async () => {
		if (!navigator.geolocation) {
			console.log("Geolocation not supported");
			alert("Paikannus ei ole tuettu selaimessasi");
			return;
		}

		// Check permission status first
		if (navigator.permissions) {
			try {
				const result = await navigator.permissions.query({
					name: "geolocation",
				});
				console.log("Geolocation permission status:", result.state);

				if (result.state === "prompt") {
					// Request permission by calling getCurrentPosition
					await new Promise<void>((resolve, reject) => {
						navigator.geolocation.getCurrentPosition(
							() => resolve(),
							(error) => reject(error),
						);
					});
				} else if (result.state === "denied") {
					alert(
						"Paikannus on estetty. Ole hyvä ja salli paikannus selaimen asetuksista.",
					);
					return;
				}
			} catch (error) {
				console.error("Permission check failed:", error);
			}
		}

		setIsLocating(true);
		try {
			console.log("Requesting location...");
			const position = await new Promise<GeolocationPosition>(
				(resolve, reject) => {
					if (!navigator?.geolocation?.getCurrentPosition) {
						reject(new Error("Geolocation not available"));
						return;
					}
					navigator.geolocation.getCurrentPosition(resolve, reject, {
						// Add options to ensure we get fresh position
						maximumAge: 0,
						timeout: 5000,
						enableHighAccuracy: true,
					});
				},
			);

			console.log("Got position:", {
				lat: position.coords.latitude,
				lng: position.coords.longitude,
			});

			const userLocation = {
				latitude: position.coords.latitude,
				longitude: position.coords.longitude,
			};
			// Find the nearest station
			const nearestStation = stations
				.filter(
					(station) => station.location.latitude && station.location.longitude,
				)
				.reduce(
					(nearest, station) => {
						const distance = calculateDistance(userLocation, {
							latitude: station.location.latitude,
							longitude: station.location.longitude,
						});
						return !nearest || distance < nearest.distance
							? { station, distance }
							: nearest;
					},
					null as { station: Station; distance: number } | null,
				);

			console.log("Nearest station:", nearestStation);

			if (nearestStation) {
				if (!selectedOrigin) {
					// Simply select the nearest station if no origin is selected
					handleOriginSelect(nearestStation.station);
				} else if (nearestStation.station.shortCode === selectedDestination) {
					handleSwapStations();
				} else if (nearestStation.station.shortCode !== selectedOrigin) {
					handleOriginSelect(nearestStation.station);
				} else {
					console.log("No nearest station found or already selected");
				}
			}
		} catch (error) {
			console.error("Location error:", error);
			// Improve the error message to guide users
			if (
				error instanceof Error &&
				error.message.includes("PERMISSION_DENIED")
			) {
				alert(
					"Paikannus on estetty. Ole hyvä ja salli paikannus selaimen asetuksista.",
				);
			} else {
				alert(
					error instanceof Error
						? error.message
						: "Paikannusta ei voitu suorittaa",
				);
			}
		} finally {
			setIsLocating(false);
		}
	};

	return (
		<div className="w-full max-w-2xl mx-auto p-2 sm:p-4">
			<h1 className="text-2xl font-bold mb-4 text-center">
				Lähijunien aikataulut
			</h1>
			<div className="space-y-6">
				<div className="space-y-2">
					<h3 className="text-lg font-medium text-gray-900">Mistä</h3>
					<div className="flex gap-2 mb-2">
						<button
							type="button"
							onClick={handleLocationRequest}
							disabled={isLocating === null || isLocating}
							className="flex-1 py-2.5 px-4 bg-blue-50 hover:bg-blue-100 disabled:opacity-50
								disabled:cursor-not-allowed transition-colors duration-200 rounded-full
								text-blue-700 font-medium flex items-center justify-center gap-2.5
								border border-blue-200 shadow-sm hover:shadow-md"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<title>Käytä sijaintia</title>
								<path d="M12 2L19 21l-7-4-7 4L12 2z" />
							</svg>
							{isLocating === null
								? "Käytä sijaintia"
								: isLocating
									? "Paikannetaan..."
									: "Käytä sijaintia"}
						</button>
						<button
							type="button"
							onClick={handleSwapStations}
							disabled={!selectedOrigin || !selectedDestination}
							className="py-2.5 px-4 bg-blue-50 hover:bg-blue-100 disabled:opacity-50
								disabled:cursor-not-allowed transition-colors duration-200 rounded-full
								text-blue-700 font-medium flex items-center justify-center gap-2.5
								border border-blue-200 shadow-sm hover:shadow-md"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="rotate-90"
								aria-labelledby="swapDirectionIcon"
							>
								<title id="swapDirectionIcon">Vaihda suuntaa</title>
								<polyline points="17 1 21 5 17 9" />
								<path d="M3 11V9a4 4 0 0 1 4-4h14" />
								<polyline points="7 23 3 19 7 15" />
								<path d="M21 13v2a4 4 0 0 1-4 4H3" />
							</svg>
						</button>
					</div>
					<StationList
						stations={stations}
						onStationSelect={handleOriginSelect}
						selectedValue={selectedOrigin}
						isOpen={openList === "from"}
						onOpenChange={(isOpen) => setOpenList(isOpen ? "from" : null)}
					/>
				</div>

				<div className="space-y-2">
					<h3 className="text-lg font-medium text-gray-900">Minne</h3>
					<StationList
						stations={availableDestinations}
						onStationSelect={handleDestinationSelect}
						selectedValue={selectedDestination}
						isOpen={openList === "to"}
						onOpenChange={(isOpen) => setOpenList(isOpen ? "to" : null)}
					/>
					{showHint !== null && showHint && isLocalStorageAvailable() && (
						<div className="flex items-center justify-between text-sm text-gray-500 mt-1">
							<p>
								Määränpäät on suodatettu näyttämään vain asemat, joihin on
								suoria junayhteyksiä valitulta lähtöasemalta.
							</p>
							<button
								type="button"
								onClick={() => {
									setShowHint(false);
									if (isLocalStorageAvailable()) {
										localStorage.setItem("hideDestinationHint", "true");
									}
								}}
								className="ml-2 p-1 hover:bg-gray-100 rounded"
								aria-label="Sulje vihje"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<title>Sulje vihje</title>
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</button>
						</div>
					)}
				</div>

				{selectedOrigin && selectedDestination && (
					<TrainList
						stationCode={selectedOrigin}
						destinationCode={selectedDestination}
					/>
				)}
			</div>
		</div>
	);
}
