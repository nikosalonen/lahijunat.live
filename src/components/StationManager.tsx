// src/components/StationManager.tsx
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
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

function useHasMounted() {
	const [hasMounted, setHasMounted] = useState(false);
	useEffect(() => {
		setHasMounted(true);
	}, []);
	return hasMounted;
}

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
	const [autoLocation, setAutoLocation] = useState<boolean>(false);

	// Add ref to store the watch position ID
	const watchIdRef = useRef<number | null>(null);

	const hasMounted = useHasMounted();

	useEffect(() => {
		setIsLocating(false);
		setSelectedOrigin(getStoredValue("selectedOrigin"));
		setSelectedDestination(getStoredValue("selectedDestination"));
		setAutoLocation(getStoredValue("autoLocation") === "true");
		if (isLocalStorageAvailable()) {
			setShowHint(localStorage.getItem("hideDestinationHint") !== "true");
		} else {
			setShowHint(true);
		}
	}, []);

	const handleNearestStation = useCallback(
		(nearestStation: { station: Station }) => {
			if (!selectedOrigin) {
				setSelectedOrigin(nearestStation.station.shortCode);
				setStoredValue("selectedOrigin", nearestStation.station.shortCode);
			} else if (nearestStation.station.shortCode === selectedDestination) {
				const tempOrigin = selectedOrigin;
				setSelectedOrigin(selectedDestination);
				setSelectedDestination(tempOrigin);
				setStoredValue("selectedDestination", selectedOrigin);
				setStoredValue("selectedOrigin", selectedDestination);
			} else if (
				nearestStation.station.shortCode !== selectedOrigin &&
				autoLocation
			) {
				const confirmed = window.confirm(
					`Olet lähellä asemaa ${nearestStation.station.name}. Haluatko vaihtaa lähtöaseman?`,
				);
				if (confirmed) {
					setSelectedOrigin(nearestStation.station.shortCode);
					setStoredValue("selectedOrigin", nearestStation.station.shortCode);
				}
			} else if (nearestStation.station.shortCode !== selectedOrigin) {
				setSelectedOrigin(nearestStation.station.shortCode);
				setStoredValue("selectedOrigin", nearestStation.station.shortCode);
			}
		},
		[selectedOrigin, selectedDestination, autoLocation],
	);

	// Memoize stations filter and reduce operations
	const findNearestStation = useCallback(
		(userLocation: { latitude: number; longitude: number }) => {
			return stations
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
		},
		[stations],
	);

	// Optimize location update logic
	const updateLocation = useCallback(
		(position: GeolocationPosition) => {
			const userLocation = {
				latitude: position.coords.latitude,
				longitude: position.coords.longitude,
			};

			const nearestStation = findNearestStation(userLocation);
			if (nearestStation) {
				handleNearestStation(nearestStation);
			}
		},
		[findNearestStation, handleNearestStation],
	);

	// Optimize location watching with better cleanup
	const startWatchingLocation = useCallback(() => {
		if (!navigator.geolocation) {
			console.warn("Geolocation not supported");
			return;
		}

		let lastUpdate = 0;
		const FIVE_MINUTES = 5 * 60 * 1000;

		const watchId = navigator.geolocation.watchPosition(
			(position) => {
				const now = Date.now();
				if (now - lastUpdate >= FIVE_MINUTES) {
					lastUpdate = now;
					updateLocation(position);
				}
			},
			(error) => {
				console.error("Position error:", error);
				if (error.code === error.PERMISSION_DENIED) {
					alert(
						"Paikannus on estetty. Ole hyvä ja salli paikannus selaimen asetuksista.",
					);
					setAutoLocation(false);
					setStoredValue("autoLocation", "false");
				}
			},
			{
				enableHighAccuracy: true,
				timeout: 5000,
			},
		);

		watchIdRef.current = watchId;

		// Add visibility change listener
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				navigator.geolocation.getCurrentPosition(
					updateLocation,
					(error) => {
						console.error("Position error:", error);
						if (error.code === error.PERMISSION_DENIED) {
							alert(
								"Paikannus on estetty. Ole hyvä ja salli paikannus selaimen asetuksista.",
							);
							setAutoLocation(false);
							setStoredValue("autoLocation", "false");
						}
					},
					{
						enableHighAccuracy: true,
						timeout: 5000,
					},
				);
			}
		});

		// Return cleanup function
		return () => {
			if (watchIdRef.current) {
				navigator.geolocation.clearWatch(watchIdRef.current);
				watchIdRef.current = null;
			}
		};
	}, [updateLocation]);

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

	const handleDestinationSelect = (station: Station) => {
		setSelectedDestination(station.shortCode);
		setStoredValue("selectedDestination", station.shortCode);
	};

	const handleLocationRequest = async () => {
		if (!navigator.geolocation) {
			console.log("Geolocation not supported");
			alert("Paikannus ei ole tuettu selaimessasi");
			return;
		}

		setIsLocating(true);
		try {
			const position = await new Promise<GeolocationPosition>(
				(resolve, reject) => {
					navigator.geolocation.getCurrentPosition(resolve, reject, {
						maximumAge: 0,
						timeout: 5000,
						enableHighAccuracy: true,
					});
				},
			);

			const userLocation = {
				latitude: position.coords.latitude,
				longitude: position.coords.longitude,
			};

			// Find the nearest station
			const nearestStation = findNearestStation(userLocation);

			console.log("Nearest station:", nearestStation);

			if (nearestStation) {
				handleNearestStation(nearestStation);
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

	const handleAutoLocationChange = (e: Event) => {
		const checked = (e.target as HTMLInputElement).checked;
		setAutoLocation(checked);
		setStoredValue("autoLocation", checked.toString());
	};

	useEffect(() => {
		if (autoLocation) {
			const cleanup = startWatchingLocation();
			return () => {
				if (watchIdRef.current) {
					navigator.geolocation.clearWatch(watchIdRef.current);
					watchIdRef.current = null;
				}
				cleanup?.();
			};
		}
	}, [autoLocation, startWatchingLocation]);

	return (
		<div className="w-full max-w-2xl mx-auto p-2 sm:p-4">
			<h1 className="text-2xl font-bold mb-4 text-center dark:text-white">
				Lähijunien aikataulut
			</h1>
			<div className="space-y-6">
				<div className="space-y-2">
					<h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
						Mistä
					</h3>
					<div className="flex items-center gap-2 mb-2">
						<StationList
							stations={stations}
							onStationSelect={(station) => handleNearestStation({ station })}
							selectedValue={selectedOrigin}
							isOpen={openList === "from"}
							onOpenChange={(isOpen) => setOpenList(isOpen ? "from" : null)}
						/>
						<div className="flex items-center">
							<button
								type="button"
								onClick={handleLocationRequest}
								disabled={isLocating === null || isLocating}
								className="w-10 h-10 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800
									disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 rounded-full
									text-blue-700 dark:text-blue-100 font-medium flex items-center justify-center
									border border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md"
								aria-label="Käytä sijaintia"
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
							</button>
						</div>
					</div>
					{hasMounted && navigator?.geolocation && (
						<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-2">
							<input
								type="checkbox"
								id="autoLocation"
								checked={autoLocation}
								onChange={handleAutoLocationChange}
								className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
							/>
							<label htmlFor="autoLocation">
								Päivitä asema automaattisesti sijainnin mukaan
							</label>
						</div>
					)}
				</div>

				<div className="space-y-2">
					<h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
						Minne
					</h3>
					<div className="flex items-center gap-2">
						<StationList
							stations={availableDestinations}
							onStationSelect={handleDestinationSelect}
							selectedValue={selectedDestination}
							isOpen={openList === "to"}
							onOpenChange={(isOpen) => setOpenList(isOpen ? "to" : null)}
						/>
						<div className="flex items-center">
							<button
								type="button"
								onClick={() => {
									const tempOrigin = selectedOrigin;
									setSelectedOrigin(selectedDestination);
									setSelectedDestination(tempOrigin);
									if (selectedOrigin && selectedDestination) {
										setSelectedDestination(tempOrigin);
										setStoredValue("selectedDestination", selectedOrigin);
										setStoredValue("selectedOrigin", selectedDestination);
									}
								}}
								disabled={!selectedOrigin || !selectedDestination}
								className="w-10 h-10 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800
									disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 rounded-full
									text-blue-700 dark:text-blue-100 font-medium flex items-center justify-center
									border border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md"
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
					</div>
					{hasMounted &&
						showHint !== null &&
						showHint &&
						isLocalStorageAvailable() && (
							<div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mt-1">
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
									className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
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
