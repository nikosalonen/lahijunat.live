// src/components/StationManager.tsx
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useLanguageChange } from '../hooks/useLanguageChange';
import type { Station } from "../types";
import { fetchTrainsLeavingFromStation } from "../utils/api";
import { calculateDistance, isInFinland } from "../utils/location";
import { t } from "../utils/translations";
import StationList from "./StationList";
import TrainList from "./TrainList";

interface Props {
	stations: Station[];
	initialFromStation?: string | null;
	initialToStation?: string | null;
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

export default function StationManager({ stations, initialFromStation, initialToStation }: Props) {
	const [openList, setOpenList] = useState<"from" | "to" | null>(null);
	const [selectedOrigin, setSelectedOrigin] = useState<string | null>(initialFromStation || null);
	const [selectedDestination, setSelectedDestination] = useState<string | null>(
		initialToStation || null,
	);
	const [showHint, setShowHint] = useState<boolean | null>(null);
	const [showLocationHint, setShowLocationHint] = useState<boolean | null>(
		null,
	);
	const [availableDestinations, setAvailableDestinations] =
		useState<Station[]>(stations);
	const [isLocating, setIsLocating] = useState<boolean | null>(null);

	const [hasGeolocationPermission, setHasGeolocationPermission] = useState<
		boolean | null
	>(null);

	const hasMounted = useHasMounted();
	const [, forceUpdate] = useState({});

	useLanguageChange();

	useEffect(() => {
		setIsLocating(false);

		// Check if launched from PWA
		const urlParams = new URLSearchParams(window.location.search);
		const isPwaLaunch = urlParams.get('source') === 'pwa' || urlParams.get('source') === 'shortcut';

		if (isPwaLaunch) {
			// If launched from PWA, restore last used route from localStorage
			const savedOrigin = getStoredValue("selectedOrigin");
			const savedDestination = getStoredValue("selectedDestination");

			if (savedOrigin) {
				setSelectedOrigin(savedOrigin);
				if (savedDestination) {
					setSelectedDestination(savedDestination);
					// Update URL to match the restored route
					window.history.replaceState({}, '', `/${savedOrigin}/${savedDestination}`);
				} else {
					window.history.replaceState({}, '', `/${savedOrigin}`);
				}
			}
		} else {
			// Normal web launch, use initial values or localStorage as fallback
			if (!initialFromStation) {
				setSelectedOrigin(getStoredValue("selectedOrigin"));
			}
			if (!initialToStation) {
				setSelectedDestination(getStoredValue("selectedDestination"));
			}
		}

		if (isLocalStorageAvailable()) {
			setShowHint(localStorage.getItem("hideDestinationHint") !== "true");
			setShowLocationHint(localStorage.getItem("hideLocationHint") !== "true");
		} else {
			setShowHint(true);
			setShowLocationHint(true);
		}
	}, [initialFromStation, initialToStation]);

	// Check geolocation permission on mount
	useEffect(() => {
		if (navigator?.permissions) {
			navigator.permissions
				.query({ name: "geolocation" })
				.then((permissionStatus) => {
					setHasGeolocationPermission(permissionStatus.state === "granted");
					// Listen for permission changes
					permissionStatus.addEventListener("change", () => {
						setHasGeolocationPermission(permissionStatus.state === "granted");
					});
				})
				.catch(() => setHasGeolocationPermission(false));
		}
	}, []);

	useEffect(() => {
		const handleLanguageChange = () => forceUpdate({});
		window.addEventListener('languagechange', handleLanguageChange);
		return () => window.removeEventListener('languagechange', handleLanguageChange);
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
			} else if (nearestStation.station.shortCode !== selectedOrigin) {
				setSelectedOrigin(nearestStation.station.shortCode);
				setStoredValue("selectedOrigin", nearestStation.station.shortCode);
			}
		},
		[selectedOrigin, selectedDestination],
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

			if (!isInFinland(userLocation)) {
				return;
			}

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
				}
			},
			{
				enableHighAccuracy: true,
				timeout: 5000,
			},
		);

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
			if (watchId) {
				navigator.geolocation.clearWatch(watchId);
			}
		};
	}, [updateLocation]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: not needed
	useEffect(() => {
		const fetchDestinations = async () => {
			if (selectedOrigin) {
				const destinations =
					await fetchTrainsLeavingFromStation(selectedOrigin);
				setAvailableDestinations(destinations);

				// Clear destination if it's not in the available destinations
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
		// Prevent multiple requests while locating
		if (isLocating) return;

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

			if (!isInFinland(userLocation)) {
				alert("Paikannus toimii vain Suomessa");
				return;
			}

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

	// Update URL when stations change
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const urlParams = new URLSearchParams(window.location.search);
		const isPwaLaunch = urlParams.get('source') === 'pwa' || urlParams.get('source') === 'shortcut';

		// Only update URL if not a PWA launch or if it's not the initial load
		if (!isPwaLaunch || document.visibilityState === 'visible') {
			const newPath = selectedOrigin && selectedDestination
				? `/${selectedOrigin}/${selectedDestination}`
				: selectedOrigin
					? `/${selectedOrigin}`
					: '/';

			// Only update if the URL is different
			if (window.location.pathname !== newPath) {
				window.history.pushState({}, '', newPath);
			}
		}
	}, [selectedOrigin, selectedDestination]);

	// Handle browser back/forward buttons
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const handlePopState = () => {
			const pathParts = window.location.pathname.split('/').filter(Boolean);
			const [fromStation, toStation] = pathParts;

			if (fromStation && stations.some(s => s.shortCode === fromStation)) {
				setSelectedOrigin(fromStation);
				setStoredValue("selectedOrigin", fromStation);
			} else {
				setSelectedOrigin(null);
				localStorage.removeItem("selectedOrigin");
			}

			if (toStation && stations.some(s => s.shortCode === toStation)) {
				setSelectedDestination(toStation);
				setStoredValue("selectedDestination", toStation);
			} else {
				setSelectedDestination(null);
				localStorage.removeItem("selectedDestination");
			}
		};

		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, [stations]);

	return (
		<div className="w-full max-w-4xl mx-auto p-2 sm:p-6">
			<h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center dark:text-white">
				{t('h1title')}
			</h1>
			<div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6">
				<div className="space-y-2">
					<h3 className="text-lg sm:text-xl font-medium text-gray-900 dark:text-gray-100">
						{t('from')}
					</h3>
					<div className="flex flex-row-reverse items-center gap-2">
						<button
							type="button"
							onClick={handleLocationRequest}
							className={`flex-shrink-0 w-16 sm:w-12 h-12 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800
								disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 rounded-lg
								text-blue-700 dark:text-blue-100 font-medium flex items-center justify-center
								border border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md
								${isLocating ? "animate-pulse" : ""}`}
							aria-label="Paikanna"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 100 100"
								width="28"
								height="28"
								fill="none"
								stroke="currentColor"
								strokeWidth="4"
							>
								<title>{t('locate')}</title>
								{/* Outer Circle */}
								<circle cx="50" cy="50" r="40" />
								{/* Inner Circle with smaller radius */}
								<circle cx="50" cy="50" r="8" />
								{/* Shorter Crosshair Lines for cleaner look */}
								<line x1="50" y1="10" x2="50" y2="35" />
								<line x1="50" y1="65" x2="50" y2="90" />
								<line x1="10" y1="50" x2="35" y2="50" />
								<line x1="65" y1="50" x2="90" y2="50" />
								{/* Slightly smaller center dot */}
								<circle cx="50" cy="50" r="2" fill="currentColor" />
							</svg>
						</button>
						<div className="flex-grow">
							<div className="h-full">
								<StationList
									stations={stations}
									onStationSelect={(station) =>
										handleNearestStation({ station })
									}
									selectedValue={selectedOrigin}
									isOpen={openList === "from"}
									onOpenChange={(isOpen) => setOpenList(isOpen ? "from" : null)}
								/>
							</div>
						</div>
					</div>

				</div>

				<div className="space-y-2">
					<h3 className="text-lg sm:text-xl font-medium text-gray-900 dark:text-gray-100">
						{t('to')}
					</h3>
					<div className="flex flex-row-reverse items-center gap-2">
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
							className="flex-shrink-0 w-16 sm:w-12 h-12 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800
								disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 rounded-lg
								text-blue-700 dark:text-blue-100 font-medium flex items-center justify-center
								border border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="28"
								height="28"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="rotate-90"
								aria-labelledby="swapDirectionIcon"
							>
								<title id="swapDirectionIcon">{t('swapDirection')}</title>
								<polyline points="17 1 21 5 17 9" />
								<path d="M3 11V9a4 4 0 0 1 4-4h14" />
								<polyline points="7 23 3 19 7 15" />
								<path d="M21 13v2a4 4 0 0 1-4 4H3" />
							</svg>
						</button>
						<div className="flex-grow">
							<div className="h-full">
								<StationList
									stations={availableDestinations}
									onStationSelect={handleDestinationSelect}
									selectedValue={selectedDestination}
									isOpen={openList === "to"}
									onOpenChange={(isOpen) => setOpenList(isOpen ? "to" : null)}
								/>
							</div>
						</div>
					</div>
					{hasMounted &&
						showHint !== null &&
						showHint &&
						isLocalStorageAvailable() && (
							<div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mt-1">
								<p>
									{t('hint')}
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
										<title>{t('closeHint')}</title>
										<line x1="18" y1="6" x2="6" y2="18" />
										<line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</button>
							</div>
						)}
				</div>

				{selectedOrigin && selectedDestination && (
					<div className="sm:col-span-2 mt-6">
						<TrainList
							stationCode={selectedOrigin}
							destinationCode={selectedDestination}
							stations={stations}
							key={`${selectedOrigin}-${selectedDestination}`}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
