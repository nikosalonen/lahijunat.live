/** @format */

// src/components/StationManager.tsx
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station } from "../types";
import { fetchTrainsLeavingFromStation } from "../utils/api";
import {
	hapticLight,
	hapticMedium,
	hapticNotification,
} from "../utils/haptics";
import { calculateDistance, isInFinland } from "../utils/location";
import { t } from "../utils/translations";
import ErrorState from "./ErrorState";
import StationList from "./StationList";
import TrainList from "./TrainList";

interface Props {
	stations: Station[];
	initialFromStation?: string | null;
	initialToStation?: string | null;
	// For testing only:
	openList?: "from" | "to" | null;
	setOpenList?: (v: "from" | "to" | null) => void;
}

export type { Props };

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
	} catch {
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

export default function StationManager({
	stations,
	initialFromStation,
	initialToStation,
	openList: openListProp,
	setOpenList: setOpenListProp,
}: Props) {
	const [internalOpenList, internalSetOpenList] = useState<
		"from" | "to" | null
	>(null);
	const openList = openListProp !== undefined ? openListProp : internalOpenList;
	const setOpenList =
		setOpenListProp !== undefined ? setOpenListProp : internalSetOpenList;
	const [selectedOrigin, setSelectedOrigin] = useState<string | null>(
		initialFromStation || null,
	);
	const [selectedDestination, setSelectedDestination] = useState<string | null>(
		initialToStation || null,
	);
	const [showHint, setShowHint] = useState<boolean | null>(null);
	const [availableDestinations, setAvailableDestinations] =
		useState<Station[]>(stations);
	const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
	const [isLocating, setIsLocating] = useState<boolean | null>(null);
	const [locationError, setLocationError] = useState<{
		type: "location" | "generic";
		message?: string;
	} | null>(null);
	const [isSwapping, setIsSwapping] = useState(false);
	const isSwappingRef = useRef(false);
	const lastSwapTimeRef = useRef(0);

// Mobile accordion state
// Expanded by default if either origin or destination is missing
// On mobile: accordion auto-closes only when "to" station is selected
// On desktop: accordion is always open via sm:collapse-open
	const [isStationSelectorExpanded, setIsStationSelectorExpanded] = useState(
		!initialFromStation || !initialToStation,
	);

	const hasMounted = useHasMounted();
	const [, forceUpdate] = useState({});
	const toInputRef = useRef<HTMLInputElement>(null);

	useLanguageChange();

	// Smart accordion toggle logic
  useEffect(() => {
	// Ignore transient swaps to avoid flicker
	if (isSwapping) return;
		// On mobile: only auto-collapse when TO station is selected (not when FROM is selected)
		// On desktop: accordion is always open, so this doesn't matter
		if (selectedDestination) {
			setIsStationSelectorExpanded(false);
		}
		// Auto-expand if no stations are selected
		else if (!selectedOrigin && !selectedDestination) {
			setIsStationSelectorExpanded(true);
		}
	}, [selectedOrigin, selectedDestination, isSwapping]);

	// Auto-focus "to" input when "from" is selected and "to" is empty
	useEffect(() => {
		if (selectedOrigin && !selectedDestination) {
			setOpenList("to");
			// Ensure accordion is expanded when user needs to select destination
			setIsStationSelectorExpanded(true);
			// Use setTimeout to ensure the input is rendered before focusing
			setTimeout(() => {
				toInputRef.current?.focus();
			}, 0);
		}
	}, [selectedOrigin, selectedDestination]);

	// Ensure dropdown opens when input is focused
	const handleInputFocus = useCallback(
		(type: "from" | "to") => {
			setOpenList(type);
		},
		[setOpenList],
	);

	useEffect(() => {
		setIsLocating(false);

		// Check if launched from PWA
		const urlParams = new URLSearchParams(window.location.search);
		const isPwaLaunch =
			urlParams.get("source") === "pwa" ||
			urlParams.get("source") === "shortcut";

		if (isPwaLaunch) {
			// If launched from PWA, restore last used route from localStorage
			const savedOrigin = getStoredValue("selectedOrigin");
			const savedDestination = getStoredValue("selectedDestination");

			if (savedOrigin) {
				setSelectedOrigin(savedOrigin);
				if (savedDestination) {
					setSelectedDestination(savedDestination);
					// Update URL to match the restored route
					window.history.replaceState(
						{},
						"",
						`/${savedOrigin}/${savedDestination}`,
					);
				} else {
					window.history.replaceState({}, "", `/${savedOrigin}`);
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
		} else {
			setShowHint(true);
		}
	}, [initialFromStation, initialToStation]);

	useEffect(() => {
		const handleLanguageChange = () => forceUpdate({});
		window.addEventListener("languagechange", handleLanguageChange);
		return () =>
			window.removeEventListener("languagechange", handleLanguageChange);
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

	useEffect(() => {
		// Skip if we're currently swapping stations or if we just swapped recently
		const timeSinceLastSwap = Date.now() - lastSwapTimeRef.current;
		if (isSwappingRef.current || timeSinceLastSwap < 600) {
			return;
		}

		const fetchDestinations = async () => {
			if (selectedOrigin) {
				setIsLoadingDestinations(true);
				try {
					const destinations =
						await fetchTrainsLeavingFromStation(selectedOrigin);
					setAvailableDestinations(destinations);

					// Only clear and focus if the current destination is not available in the new list
					if (
						selectedDestination &&
						!destinations.some((s) => s.shortCode === selectedDestination)
					) {
						setSelectedDestination(null);
						localStorage.removeItem("selectedDestination");
						setOpenList("to");
						setTimeout(() => {
							toInputRef.current?.focus();
						}, 0);
					}
				} catch (error) {
					console.error("Error fetching destinations:", error);
					setAvailableDestinations(stations);
					// Also check availability against all stations if fetch fails
					if (
						selectedDestination &&
						!stations.some((s) => s.shortCode === selectedDestination)
					) {
						setSelectedDestination(null);
						localStorage.removeItem("selectedDestination");
						setOpenList("to");
						setTimeout(() => {
							toInputRef.current?.focus();
						}, 0);
					}
				} finally {
					setIsLoadingDestinations(false);
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
		// Close the dropdown after selection
		setOpenList(null);
	};

	const handleLocationRequest = async () => {
		// Prevent multiple requests while locating
		if (isLocating) return;

		hapticLight();
		setLocationError(null); // Clear any previous errors

		if (!navigator.geolocation) {
			console.log("Geolocation not supported");
			hapticNotification();
			setLocationError({
				type: "location",
				message: "Paikannus ei ole tuettu selaimessasi",
			});
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
				setLocationError({
					type: "location",
					message: "Paikannus toimii vain Suomessa",
				});
				return;
			}

			// Find the nearest station
			const nearestStation = findNearestStation(userLocation);

			console.log("Nearest station:", nearestStation);

			if (nearestStation) {
				handleNearestStation(nearestStation);
				setLocationError(null); // Clear error on success
			}
		} catch (error) {
			console.error("Location error:", error);
			hapticNotification();

			let errorMessage = "Paikannusta ei voitu suorittaa";

			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === 1 // PERMISSION_DENIED
			) {
				errorMessage =
					"Paikannus on estetty. Ole hyvä ja salli paikannus selaimen asetuksista.";
			} else if (
				error &&
				typeof error === "object" &&
				"message" in error &&
				typeof error.message === "string"
			) {
				errorMessage = error.message;
			}

			setLocationError({
				type: "location",
				message: errorMessage,
			});
		} finally {
			setIsLocating(false);
		}
	};

	// Persist selections to localStorage on change
	useEffect(() => {
		if (selectedOrigin) {
			localStorage.setItem("selectedOrigin", selectedOrigin);
		} else {
			localStorage.removeItem("selectedOrigin");
		}
	}, [selectedOrigin]);

	useEffect(() => {
		if (selectedDestination) {
			localStorage.setItem("selectedDestination", selectedDestination);
		} else {
			localStorage.removeItem("selectedDestination");
		}
	}, [selectedDestination]);

	// Update URL when stations change
	useEffect(() => {
		if (typeof window === "undefined") return;

		const urlParams = new URLSearchParams(window.location.search);
		const isPwaLaunch =
			urlParams.get("source") === "pwa" ||
			urlParams.get("source") === "shortcut";

		// Only update URL if not a PWA launch or if it's not the initial load
		if (!isPwaLaunch || document.visibilityState === "visible") {
			const newPath =
				selectedOrigin && selectedDestination
					? `/${selectedOrigin}/${selectedDestination}`
					: selectedOrigin
						? `/${selectedOrigin}`
						: "/";

			// Only update if the URL is different
			if (window.location.pathname !== newPath) {
				window.history.pushState({}, "", newPath);
			}
		}
	}, [selectedOrigin, selectedDestination]);

	// Handle browser back/forward buttons
	useEffect(() => {
		if (typeof window === "undefined") return;

		const handlePopState = () => {
			const pathParts = window.location.pathname.split("/").filter(Boolean);
			const [fromStation, toStation] = pathParts;

			if (fromStation && stations.some((s) => s.shortCode === fromStation)) {
				setSelectedOrigin(fromStation);
				setStoredValue("selectedOrigin", fromStation);
			} else {
				setSelectedOrigin(null);
				localStorage.removeItem("selectedOrigin");
			}

			if (toStation && stations.some((s) => s.shortCode === toStation)) {
				setSelectedDestination(toStation);
				setStoredValue("selectedDestination", toStation);
			} else {
				setSelectedDestination(null);
				localStorage.removeItem("selectedDestination");
			}
		};

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, [stations]);

	const fetchDestinations = async (originCode: string) => {
		try {
			setIsLoadingDestinations(true);
			const destinations = await fetchTrainsLeavingFromStation(originCode);
			setAvailableDestinations(destinations);
		} catch (error) {
			console.error("Error fetching destinations:", error);
			setAvailableDestinations(stations);
		} finally {
			setIsLoadingDestinations(false);
		}
	};

	const handleOriginSelect = useCallback(
		(station: Station) => {
			setSelectedOrigin(station.shortCode);
			setStoredValue("selectedOrigin", station.shortCode);
			setOpenList("to");
			setIsLoadingDestinations(true);
			fetchDestinations(station.shortCode);
		},
		[fetchDestinations],
	);

	const handleSwap = useCallback(async () => {
		if (!selectedOrigin || !selectedDestination) return;

		hapticMedium();
		// Set swapping flags and timestamp to prevent dropdown from showing
		setIsSwapping(true);
		isSwappingRef.current = true;
		lastSwapTimeRef.current = Date.now();
		setOpenList(null);

		// Use a short delay to allow UI to update before swapping
		setTimeout(() => {
			const temp = selectedOrigin;

			setSelectedOrigin(selectedDestination);
			setSelectedDestination(temp);
			// Keep storage in sync for PWA restores
			if (selectedDestination) {
				localStorage.setItem("selectedOrigin", selectedDestination);
			} else {
				localStorage.removeItem("selectedOrigin");
			}
			if (temp) {
				localStorage.setItem("selectedDestination", temp);
			} else {
				localStorage.removeItem("selectedDestination");
			}

			// Update the URL state immediately after setting local state
			if (typeof window !== "undefined") {
				const newPath =
					selectedDestination && temp
						? `/${selectedDestination}/${temp}`
						: selectedDestination
							? `/${selectedDestination}`
							: "/";
				window.history.pushState({}, "", newPath);
			}

			// If we had a selected destination, reset destinations to all stations
			if (selectedDestination) {
				setAvailableDestinations(stations);
			}
		}, 50);

		// After the swap, load destinations for the new origin
		setTimeout(async () => {
			if (selectedDestination) {
				setIsLoadingDestinations(true);
				try {
					const newDestinations =
						await fetchTrainsLeavingFromStation(selectedDestination);
					setAvailableDestinations(newDestinations);
				} catch (error) {
					console.error("Error loading destinations:", error);
					setAvailableDestinations(stations);
				} finally {
					setIsLoadingDestinations(false);
				}
			}
		}, 100);

		// Reset swapping flags after everything is complete
		setTimeout(() => {
			setIsSwapping(false);
			isSwappingRef.current = false;
		}, 150);
	}, [selectedOrigin, selectedDestination, stations]);

	// Find selected stations for summary
	const selectedOriginStation = stations.find(
		(s) => s.shortCode === selectedOrigin,
	);
	const selectedDestinationStation = stations.find(
		(s) => s.shortCode === selectedDestination,
	);

	return (
		<div className="w-full max-w-3xl mx-auto px-2 sm:px-6 md:px-8 lg:px-12 py-2 sm:py-6 md:py-8">
			<h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center dark:text-white">
				{t("h1title")}
			</h1>

			{/* Mobile compact header with toggle and action buttons */}
			<div className="sm:hidden mb-4">
				<div className="flex items-center gap-2 min-w-0">
					<button
						type="button"
						onClick={() =>
							setIsStationSelectorExpanded(!isStationSelectorExpanded)
						}
						className="flex-grow btn btn-ghost normal-case justify-between p-3 h-auto min-h-0 min-w-0"
						aria-expanded={isStationSelectorExpanded}
						aria-controls="station-selector"
					>
						<div className="text-left flex-grow min-w-0 overflow-hidden">
							{selectedOrigin && selectedDestination ? (
								<div className="flex items-center gap-3 min-w-0">
									<div className="flex-grow min-w-0">
										<div className="font-medium text-base leading-tight truncate">
											{selectedOriginStation?.name}
										</div>
										<div className="text-xs opacity-60 font-mono">
											{selectedOrigin}
										</div>
									</div>
									<svg
										className="w-4 h-4 flex-shrink-0 opacity-60"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<title>Route direction</title>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M17 8l4 4m0 0l-4 4m4-4H3"
										/>
									</svg>
									<div className="flex-grow text-right min-w-0">
										<div className="font-medium text-base leading-tight truncate">
											{selectedDestinationStation?.name}
										</div>
										<div className="text-xs opacity-60 font-mono">
											{selectedDestination}
										</div>
									</div>
								</div>
							) : (
								<div className="font-medium text-base">
									{t("selectStations")}
								</div>
							)}
						</div>
						<svg
							className={`w-5 h-5 ml-3 transition-transform ${isStationSelectorExpanded ? "rotate-180" : ""}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<title>Toggle station selector</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>

					{/* Swap button on the same row */}
					{selectedOrigin && selectedDestination && (
						<button
							type="button"
							onClick={handleSwap}
							disabled={!selectedOrigin || !selectedDestination || isSwapping}
							className="btn w-12 h-12 p-1 flex-shrink-0 bg-[#8c4799] hover:bg-[#7a3f86] text-white border-[#8c4799] hover:border-[#7a3f86]
						disabled:opacity-50 disabled:cursor-not-allowed
						touch-manipulation select-none tooltip tooltip-top
						shadow-lg hover:shadow-xl transition-[background-color,box-shadow] duration-200"
							data-tip={t("swapDirection")}
							aria-label={t("swapDirection")}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="28"
								height="28"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="block mx-auto"
								aria-hidden="true"
							>
								{/* Rotation/refresh icon for swapping */}
								<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
								<path d="M21 3v5h-5" />
								<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
								<path d="M3 21v-5h5" />
							</svg>
						</button>
					)}
				</div>
			</div>

			{/* Station selector - collapsible on mobile */}
			<div
				className={`collapse ${isStationSelectorExpanded ? "collapse-open" : "collapse-close"} sm:collapse-open`}
			>
				<div id="station-selector" className="collapse-content px-0">
					<div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6">
						<div className="space-y-2">
							<h3 className="text-lg sm:text-xl font-medium text-gray-900 dark:text-gray-100">
								{t("from")}
							</h3>
							<div className="flex flex-row-reverse items-center gap-2">
								<div className="flex">
									<button
										type="button"
										onClick={handleLocationRequest}
										className={`btn w-12 h-12 p-1 bg-[#8c4799] hover:bg-[#7a3f86] text-white border-[#8c4799] hover:border-[#7a3f86]
							disabled:opacity-50 disabled:cursor-not-allowed
							touch-manipulation select-none tooltip tooltip-bottom sm:tooltip-top
							shadow-lg hover:shadow-xl transition-[background-color,box-shadow] duration-200 rounded-r-none
							${isLocating ? "animate-pulse" : ""}`}
										aria-label={t("locate")}
										data-tip={t("locate")}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 24 24"
											width="36"
											height="36"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<title>{t("locate")}</title>
											{/* Modern GPS/Location Pin Icon */}
											<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
											<circle cx="12" cy="9" r="2.5" fill="currentColor" />
											{/* Remove pulse animation - was causing strange effects */}
										</svg>
									</button>
									{/* Divider */}
									<div className="hidden sm:block w-px h-12 bg-white/20" />
									{/* Swap button hidden on mobile since it's available inline above */}
									<button
										type="button"
										onClick={handleSwap}
										disabled={
											!selectedOrigin || !selectedDestination || isSwapping
										}
										className="hidden sm:block btn w-12 h-12 p-1 bg-[#8c4799] hover:bg-[#7a3f86] text-white border-[#8c4799] hover:border-[#7a3f86]
								disabled:opacity-50 disabled:cursor-not-allowed
								touch-manipulation select-none tooltip tooltip-bottom sm:tooltip-top
								shadow-lg hover:shadow-xl transition-[background-color,box-shadow] duration-200 rounded-l-none"
										data-tip={t("swapDirection")}
										aria-label={t("swapDirection")}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="28"
											height="28"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2.5"
											strokeLinecap="round"
											strokeLinejoin="round"
											className="block mx-auto"
											aria-hidden="true"
										>
											{/* Rotation/refresh icon for swapping */}
											<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
											<path d="M21 3v5h-5" />
											<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
											<path d="M3 21v-5h5" />
										</svg>
									</button>
								</div>
								<div className="flex-grow">
									<div className="h-full">
										<StationList
											stations={stations}
											onStationSelect={handleOriginSelect}
											selectedValue={selectedOrigin}
											isOpen={openList === "from"}
											onOpenChange={(isOpen) => {
												setOpenList(isOpen ? "from" : null);
											}}
											onFocus={() => handleInputFocus("from")}
										/>
									</div>
								</div>
							</div>
						</div>

						<div className="space-y-2">
							<h3 className="text-lg sm:text-xl font-medium text-gray-900 dark:text-gray-100">
								{t("to")}
							</h3>
							<div className="flex items-center gap-2">
								<div className="flex-grow">
									<div className="h-full">
										<StationList
											stations={availableDestinations}
											onStationSelect={handleDestinationSelect}
											selectedValue={selectedDestination}
											isOpen={openList === "to" && !isSwapping}
											onOpenChange={(isOpen) => {
												setOpenList(isOpen ? "to" : null);
											}}
											inputRef={toInputRef}
											onFocus={() => handleInputFocus("to")}
											isLoading={isLoadingDestinations && !isSwapping}
										/>
									</div>
								</div>
							</div>
							{hasMounted &&
								showHint !== null &&
								showHint &&
								isLocalStorageAvailable() && (
									<div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-300 mt-1">
										<p>{t("hint")}</p>
										<button
											type="button"
											onClick={() => {
												hapticLight();
												setShowHint(false);
												if (isLocalStorageAvailable()) {
													localStorage.setItem("hideDestinationHint", "true");
												}
											}}
											className="btn btn-ghost btn-sm ml-2 p-2 hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600 rounded-lg transition-all duration-150 touch-manipulation select-none active:scale-95"
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
												<title>{t("closeHint")}</title>
												<line x1="18" y1="6" x2="6" y2="18" />
												<line x1="6" y1="6" x2="18" y2="18" />
											</svg>
										</button>
									</div>
								)}
						</div>

						{locationError && (
							<div className="sm:col-span-2 mt-4">
								<ErrorState
									type={locationError.type}
									message={locationError.message}
									onRetry={() => {
										setLocationError(null);
										handleLocationRequest();
									}}
									onDismiss={() => {
										setLocationError(null);
									}}
									showDismiss={true}
									className="bg-red-50 dark:bg-red-900/20 rounded-lg"
								/>
							</div>
						)}
					</div>
				</div>
			</div>

			{selectedOrigin && selectedDestination && (
				<div className="mt-6">
					<TrainList
						stationCode={selectedOrigin}
						destinationCode={selectedDestination}
						stations={stations}
						key={`${selectedOrigin}-${selectedDestination}`}
					/>
				</div>
			)}
		</div>
	);
}
