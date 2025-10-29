/** @format */

import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Train } from "../types";
import { getRelevantTrackInfo } from "../utils/api";
import { hapticImpact } from "../utils/haptics";
import { calculateDuration, getDepartureDate } from "../utils/trainUtils";
import { t } from "../utils/translations";
import TimeDisplay from "./TimeDisplay";

interface Props {
	train: Train;
	stationCode: string;
	destinationCode: string;
	currentTime: Date;
	onDepart?: () => void;
	/**
	 * Called when a train that had been considered departed becomes non-departed again
	 * due to its estimate moving back to now or the future (minutesToDeparture >= 0).
	 */
	onReappear?: () => void;
	getDurationSpeedType?: (
		durationMinutes: number,
	) => "fast" | "slow" | "normal";
}

type HighlightedTrainData = {
	highlighted?: boolean;
	removeAfter?: string;
	track?: string;
	trackChanged?: boolean;
};

// Safe storage helpers to avoid iOS Safari private mode/localStorage quota issues
const HIGHLIGHT_STORAGE_KEY = "highlightedTrains";
let inMemoryHighlightStore: Record<string, HighlightedTrainData> = {};

function safeReadHighlights(): Record<string, HighlightedTrainData> {
	try {
		const raw = localStorage.getItem(HIGHLIGHT_STORAGE_KEY);
		if (!raw) return inMemoryHighlightStore;
		const parsed = JSON.parse(raw);
		// Ensure object shape
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return inMemoryHighlightStore;
	}
}

function safeWriteHighlights(
	value: Record<string, HighlightedTrainData>,
): void {
	try {
		localStorage.setItem(HIGHLIGHT_STORAGE_KEY, JSON.stringify(value));
		inMemoryHighlightStore = value;
	} catch {
		// Fallback to in-memory store when localStorage is unavailable or throws
		inMemoryHighlightStore = value;
	}
}

const formatMinutesToDeparture = (departure: Date, currentTime: Date) => {
	const diffMs = departure.getTime() - currentTime.getTime();
	const diffMinutes = diffMs / (1000 * 60);
	// For negative times (past departure), use floor to show how many minutes ago
	// For positive times (future departure), use floor to show complete minutes until departure
	return Math.floor(diffMinutes);
};

const isDepartingSoon = (departure: Date, currentTime: Date) => {
	const diffMinutes =
		(departure.getTime() - currentTime.getTime()) / (1000 * 60);
	return diffMinutes >= 0 && diffMinutes <= 5;
};

const getCardStyle = (
	isCancelled: boolean,
	minutesToDeparture: number | null,
	isDepartingSoon: boolean,
	isHighlighted: boolean,
) => {
	const baseStyles =
		"card bg-base-100 shadow-xl border border-base-300 rounded-xl relative transform-gpu -translate-y-0.5";

	// Priority 1: Cancelled trains
	if (isCancelled)
		return `${baseStyles} bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-300 dark:border-red-800`;

	// Priority 2: Departed trains
	if (minutesToDeparture !== null && minutesToDeparture < 0)
		return `${baseStyles} bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 border-gray-300 dark:border-gray-600 opacity-0`;

	// Priority 3: Highlighted + Departing soon (< 5 min) - Purple highlight with blinking
	if (
		isHighlighted &&
		isDepartingSoon &&
		minutesToDeparture !== null &&
		minutesToDeparture >= 0
	) {
		return `${baseStyles} !border-4 !border-[#8c4799] dark:!border-[#b388ff] ring ring-[#8c4799]/30 dark:ring-[#b388ff]/30 animate-soft-blink-highlight dark:animate-soft-blink-highlight-dark`;
	}

	// Priority 4: Highlighted (not departing soon) - Static purple highlight
	if (isHighlighted)
		return `${baseStyles} bg-primary/5 dark:bg-primary/10 !border-4 !border-[#8c4799] dark:!border-[#b388ff] ring ring-[#8c4799]/30 dark:ring-[#b388ff]/30`;

	// Priority 5: Departing soon (not highlighted) - Regular blinking
	if (
		isDepartingSoon &&
		minutesToDeparture !== null &&
		minutesToDeparture >= 0
	) {
		return `${baseStyles} border-base-300 dark:border-base-300/40 dark:bg-base-200 animate-soft-blink dark:animate-soft-blink-dark`;
	}

	// Default case
	return `${baseStyles}`;
};

export default function TrainCard({
	train,
	stationCode,
	destinationCode,
	currentTime,
	onDepart,
	onReappear,
	getDurationSpeedType,
}: Props) {
	const [, setLanguageChange] = useState(0);
	const [isHighlighted, setIsHighlighted] = useState(false);
	const [hasDeparted, setHasDeparted] = useState(false);
	const [opacity, setOpacity] = useState(1);
	const [trackMemory, setTrackMemory] = useState<
		Record<string, { track: string; timestamp: number }>
	>({});
	const [isTrackFlipped, setIsTrackFlipped] = useState(false);
	const fadeRafRef = useRef<number | null>(null);

	// Memoize all time-dependent calculations
	const {
		departureRow,
		arrivalRow,
		minutesToDeparture,
		departingSoon,
		timeDifferenceMinutes,
		duration,
		durationSpeedType,
		cardStyle,
	} = useMemo(() => {
		const departureRow = train.timeTableRows.find(
			(row) => row.stationShortCode === stationCode && row.type === "DEPARTURE",
		);

		const arrivalRow = train.timeTableRows.find(
			(row) =>
				row.stationShortCode === destinationCode && row.type === "ARRIVAL",
		);

		if (!departureRow) {
			return {
				departureRow: null,
				arrivalRow: null,
				minutesToDeparture: null,
				departingSoon: false,
				timeDifferenceMinutes: 0,
				duration: null,
				cardStyle: getCardStyle(train.cancelled, null, false, isHighlighted),
			};
		}

		const minutesToDeparture = formatMinutesToDeparture(
			getDepartureDate(departureRow),
			currentTime,
		);

		const departingSoon = isDepartingSoon(
			getDepartureDate(departureRow),
			currentTime,
		);

		const timeDifferenceMinutes = departureRow.differenceInMinutes ?? 0;

		const arrivalTime =
			arrivalRow?.liveEstimateTime ?? arrivalRow?.scheduledTime;
		const duration = arrivalTime
			? calculateDuration(getDepartureDate(departureRow), arrivalTime)
			: null;

		const durationSpeedType =
			duration && getDurationSpeedType
				? getDurationSpeedType(duration.hours * 60 + duration.minutes)
				: "normal";

		const cardStyle = getCardStyle(
			train.cancelled,
			minutesToDeparture,
			departingSoon,
			isHighlighted,
		);

		return {
			departureRow,
			arrivalRow,
			minutesToDeparture,
			departingSoon,
			timeDifferenceMinutes,
			duration,
			durationSpeedType,
			cardStyle,
		};
	}, [
		train,
		stationCode,
		destinationCode,
		currentTime,
		isHighlighted,
		getDurationSpeedType,
	]);

	// Handle depart/undepart transitions when estimate jumps forward
	useEffect(() => {
		if (minutesToDeparture === null) return;
		if (minutesToDeparture < 0 && !hasDeparted) {
			setHasDeparted(true);
			setOpacity(1);
			// Cancel any previous fade RAF just before scheduling a new one
			if (fadeRafRef.current !== null) {
				cancelAnimationFrame(fadeRafRef.current);
				fadeRafRef.current = null;
			}
			fadeRafRef.current = requestAnimationFrame(() => {
				setOpacity(0);
			});
			onDepart?.();
		} else if (minutesToDeparture >= 0 && hasDeparted) {
			// Estimation jumped forward; bring card back
			setHasDeparted(false);
			setOpacity(1);
			// Ensure no stale RAF can flip opacity back to 0
			if (fadeRafRef.current !== null) {
				cancelAnimationFrame(fadeRafRef.current);
				fadeRafRef.current = null;
			}
			onReappear?.();
		}

		return () => {
			if (fadeRafRef.current !== null) {
				cancelAnimationFrame(fadeRafRef.current);
				fadeRafRef.current = null;
			}
		};
	}, [minutesToDeparture, hasDeparted, onDepart, onReappear]);

	useEffect(() => {
		// Load highlighted state safely (works even if localStorage is unavailable)
		const highlightedTrains: Record<string, HighlightedTrainData> =
			safeReadHighlights();
		const trainData = highlightedTrains[train.trainNumber];

		if (trainData) {
			// Check if the highlight has expired
			if (
				trainData.removeAfter &&
				new Date(trainData.removeAfter) < currentTime
			) {
				// Remove expired highlight
				delete highlightedTrains[train.trainNumber];
				safeWriteHighlights(highlightedTrains);
				setIsHighlighted(false);
			} else {
				setIsHighlighted(true);

				// Check for track changes
				const departureRow = train.timeTableRows.find(
					(row) =>
						row.stationShortCode === stationCode && row.type === "DEPARTURE",
				);

				// Keep removeAfter in sync if departure estimate drifts significantly (>1 min)
				if (departureRow && trainData?.removeAfter) {
					const latestDeparture = getDepartureDate(departureRow);
					const desiredRemoveAfter = new Date(
						latestDeparture.getTime() + 10 * 60 * 1000,
					);
					const currentRemoveAfter = new Date(trainData.removeAfter);
					const driftMinutes =
						Math.abs(
							desiredRemoveAfter.getTime() - currentRemoveAfter.getTime(),
						) /
						(1000 * 60);
					if (driftMinutes > 1) {
						highlightedTrains[train.trainNumber] = {
							...trainData,
							removeAfter: desiredRemoveAfter.toISOString(),
						};
						safeWriteHighlights(highlightedTrains);
					}
				}

				if (
					departureRow &&
					trainData.track &&
					departureRow.commercialTrack !== trainData.track
				) {
					// Track has changed, update the stored track
					highlightedTrains[train.trainNumber] = {
						...trainData,
						track: departureRow.commercialTrack,
						trackChanged: true,
					};
					safeWriteHighlights(highlightedTrains);
				} else if (departureRow && !trainData.track) {
					// First time storing track
					highlightedTrains[train.trainNumber] = {
						...trainData,
						track: departureRow.commercialTrack,
					};
					safeWriteHighlights(highlightedTrains);
				}
			}
		} else {
			setIsHighlighted(false);
		}
	}, [train.trainNumber, currentTime, train.timeTableRows, stationCode]);

	// Prime trackMemory from localStorage on mount to avoid stale baseline
	useEffect(() => {
		const MAX_AGE_MS = 1 * 60 * 60 * 1000; // 1 hour
		const MAX_ENTRIES = 1000;
		const now = Date.now();

		try {
			const stored = JSON.parse(localStorage.getItem("trackMemory") || "{}");
			if (!stored || typeof stored !== "object") {
				return;
			}

			// Cleanup old entries
			const cleaned: Record<string, { track: string; timestamp: number }> = {};
			for (const [journeyKey, entry] of Object.entries(stored)) {
				const entryData = entry as { track: string; timestamp: number };
				if (entryData && typeof entryData === "object" && entryData.timestamp) {
					if (now - entryData.timestamp <= MAX_AGE_MS) {
						cleaned[journeyKey] = entryData;
					}
				}
			}

			// If too many entries, remove oldest
			const entries = Object.entries(cleaned);
			if (entries.length >= MAX_ENTRIES) {
				entries
					.sort(([, a], [, b]) => a.timestamp - b.timestamp)
					.slice(0, entries.length - MAX_ENTRIES + 1)
					.forEach(([journeyKey]) => {
						delete cleaned[journeyKey];
					});
			}

			// Update localStorage with cleaned data and prime state
			if (Object.keys(cleaned).length > 0) {
				localStorage.setItem("trackMemory", JSON.stringify(cleaned));
				setTrackMemory(cleaned);
			}
		} catch {
			// Ignore parse errors, state remains empty
		}
	}, []); // Run once on mount

	// Store and check original track for all trains (not just highlighted)
	useEffect(() => {
		const trackInfo = getRelevantTrackInfo(train, stationCode, destinationCode);
		if (!trackInfo) return;

		const currentTrack = trackInfo.track;
		const now = Date.now();
		const MAX_AGE_MS = 1 * 60 * 60 * 1000; // 1 hour
		const MAX_ENTRIES = 1000;

		// Always read the latest from localStorage (safe parse)
		let latestTrackMemory: Record<string, { track: string; timestamp: number }>;
		try {
			latestTrackMemory = JSON.parse(
				localStorage.getItem("trackMemory") || "{}",
			);
		} catch {
			latestTrackMemory = {} as Record<
				string,
				{ track: string; timestamp: number }
			>;
		}

		// Cleanup old entries
		for (const journeyKey of Object.keys(latestTrackMemory)) {
			const entry = latestTrackMemory[journeyKey];
			if (now - entry.timestamp > MAX_AGE_MS) {
				delete latestTrackMemory[journeyKey];
			}
		}

		// If too many entries, remove oldest
		const entries = Object.entries(latestTrackMemory);
		if (entries.length >= MAX_ENTRIES) {
			entries
				.sort(
					([, a], [, b]) =>
						(a as { timestamp: number }).timestamp -
						(b as { timestamp: number }).timestamp,
				)
				.slice(0, entries.length - MAX_ENTRIES + 1)
				.forEach(([journeyKey]) => {
					delete latestTrackMemory[journeyKey];
				});
		}

		// Update or add this journey
		if (
			!latestTrackMemory[trackInfo.journeyKey] ||
			latestTrackMemory[trackInfo.journeyKey].track !== currentTrack
		) {
			latestTrackMemory[trackInfo.journeyKey] = {
				track: currentTrack,
				timestamp: now,
			};
			localStorage.setItem("trackMemory", JSON.stringify(latestTrackMemory));
			setTrackMemory(latestTrackMemory); // keep state in sync
		}
	}, [train.trainNumber, train.timeTableRows, stationCode, destinationCode]);

	// Memoized track change check - determines which track changed (departure or arrival)
	const trackChangeInfo = useMemo(() => {
		const trackInfo = getRelevantTrackInfo(train, stationCode, destinationCode);
		if (!trackInfo) return { changed: false, changedSide: null };

		const currentTrack = trackInfo.track;
		const storedTrack = trackMemory[trackInfo.journeyKey]?.track;
		const trackChanged =
			storedTrack && currentTrack && storedTrack !== currentTrack;

		if (!trackChanged) return { changed: false, changedSide: null };

		// Determine which side changed (departure or arrival)
		const departureRow = train.timeTableRows.find(
			(row) => row.stationShortCode === stationCode && row.type === "DEPARTURE",
		);
		const arrivalRow = train.timeTableRows.find(
			(row) =>
				row.stationShortCode === destinationCode && row.type === "ARRIVAL",
		);

		if (!departureRow) return { changed: false, changedSide: null };

		// Check if departure track changed from stored
		const departureChanged = departureRow.commercialTrack !== storedTrack;

		// Check if arrival track changed from stored (only if arrival exists and differs from departure)
		const arrivalChanged =
			arrivalRow &&
			arrivalRow.commercialTrack !== storedTrack &&
			arrivalRow.commercialTrack !== departureRow.commercialTrack;

		// Determine which side to show the indicator on
		let changedSide: "departure" | "arrival" | null = null;
		if (departureChanged) {
			changedSide = "departure";
		} else if (arrivalChanged) {
			changedSide = "arrival";
		}

		return { changed: trackChanged, changedSide };
		// // TEMPORARY: Force track change indicator for testing
		// return { changed: true, changedSide: "departure" };
	}, [
		train.trainNumber,
		train.timeTableRows,
		stationCode,
		destinationCode,
		trackMemory,
	]);

	const isTrackChanged = trackChangeInfo.changed;

	// Handler for flipping the track badge
	const handleTrackFlip = () => {
		setIsTrackFlipped((prev) => !prev);
		hapticImpact();
	};

	// Keyboard handler for accessibility
	const handleTrackKeyDown = (
		e: JSX.TargetedKeyboardEvent<HTMLButtonElement>,
	) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleTrackFlip();
		}
	};

	useEffect(() => {
		const handleLanguageChange = () => {
			setLanguageChange((prev) => prev + 1);
		};

		window.addEventListener("languagechange", handleLanguageChange);
		return () =>
			window.removeEventListener("languagechange", handleLanguageChange);
	}, []);

	const handleFavorite = () => {
		const newHighlighted = !isHighlighted;
		hapticImpact();
		setIsHighlighted(newHighlighted);

		// Update highlights using safe storage wrapper
		const highlightedTrains: Record<string, HighlightedTrainData> =
			safeReadHighlights();

		if (newHighlighted) {
			// When highlighting, set removal time to 10 minutes after departure
			const departureRow = train.timeTableRows.find(
				(row) =>
					row.stationShortCode === stationCode && row.type === "DEPARTURE",
			);

			if (departureRow) {
				const departureTime = getDepartureDate(departureRow);
				const removeAfter = new Date(departureTime.getTime() + 10 * 60 * 1000); // 10 minutes after departure

				highlightedTrains[train.trainNumber] = {
					highlighted: true,
					removeAfter: removeAfter.toISOString(),
					track: departureRow.commercialTrack,
				};
			}
		} else {
			delete highlightedTrains[train.trainNumber];
		}

		safeWriteHighlights(highlightedTrains);
	};

	if (!departureRow) return null;

	return (
		<div
			class={`${cardStyle} w-full max-w-full text-left relative overflow-hidden select-none transition-opacity duration-700 ease-in-out`}
			style={{
				opacity: hasDeparted ? opacity : 1,
				WebkitTouchCallout: "none",
				WebkitTapHighlightColor: "transparent",
			}}
			data-train-number={train.trainNumber}
			data-train-cancelled={train.cancelled}
			data-train-line={train.commuterLineID}
			data-train-unknown-delay={departureRow?.unknownDelay ? "true" : "false"}
		>
			<div class="card-body p-3 sm:p-4">
				<div class="flex items-start justify-between gap-2 sm:gap-4">
					<div class="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 overflow-hidden">
						{/* Train identifier */}
						{train.commuterLineID && (
							<button
								onClick={handleFavorite}
								aria-label={isHighlighted ? t("unfavorite") : t("favorite")}
								type="button"
								class={`flex-shrink-0 h-14 w-14 sm:h-16 sm:w-16 flex items-center justify-center text-xl font-bold rounded-2xl shadow-brand-medium transition-transform duration-300 relative group touch-manipulation select-none focus:outline-none border-none ring-0 ${
									train.cancelled
										? "bg-gradient-to-br from-red-500 to-red-600 text-white"
										: "bg-[#8c4799] text-white"
								}`}
							>
								{train.commuterLineID}
								{isHighlighted && (
									<div class="badge badge-error badge-sm absolute -top-1 -right-1 shadow">
										<svg
											class="w-3 h-3 text-white"
											fill="currentColor"
											viewBox="0 0 20 20"
											aria-hidden="true"
										>
											<title>Favorite</title>
											<path
												fillRule="evenodd"
												d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
												clipRule="evenodd"
											/>
										</svg>
									</div>
								)}
							</button>
						)}

						{/* Main train info - Using card-title semantic structure */}
						<div class="space-y-2 sm:space-y-1 min-w-0 flex-1 overflow-hidden">
							<div class="card-title p-0 flex-col items-start gap-1">
								<div class="flex flex-col gap-2 sm:gap-1 w-full">
									<TimeDisplay
										departureRow={departureRow}
										arrivalRow={arrivalRow}
										timeDifferenceMinutes={timeDifferenceMinutes}
									/>
									{duration && (
										<output
											class={`text-sm sm:text-base font-medium flex items-center truncate ${
												durationSpeedType === "fast"
													? "text-success"
													: durationSpeedType === "slow"
														? "text-warning"
														: "text-base-content/60"
											} ${train.cancelled ? "opacity-0 pointer-events-none select-none" : ""}`}
											aria-hidden={train.cancelled ? "true" : undefined}
											aria-label={
												!train.cancelled
													? `${t("duration")} ${duration.hours} ${t("hours")} ${duration.minutes} ${t("minutes")}`
													: undefined
											}
										>
											<i
												class="fa-solid fa-clock inline-block mr-1 -mt-1"
												aria-hidden="true"
											/>
											{duration.hours}h {duration.minutes}m
										</output>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Track info and departure countdown */}
					<div class="flex flex-col items-end gap-2 sm:gap-3 flex-shrink-0">
						{train.cancelled ? (
							<span class="badge badge-error badge-lg text-white">
								{t("cancelled")}
							</span>
						) : (
							<>
								{/* Interactive Flippable Track Badge */}
								<div class="indicator">
									<button
										type="button"
										onClick={handleTrackFlip}
										onKeyDown={handleTrackKeyDown}
										aria-label={
											!isTrackFlipped
												? `${t("track")} ${departureRow.commercialTrack}${trackChangeInfo.changedSide === "departure" && isTrackChanged ? ` (${t("changed")})` : ""}. ${arrivalRow ? t("clickToSeeArrivalTrack") : ""}`
												: `${arrivalRow ? `${t("arrivalTrack")} ${arrivalRow.commercialTrack}` : `${t("track")} ${departureRow.commercialTrack}`}${trackChangeInfo.changedSide === "arrival" && isTrackChanged ? ` (${t("changed")})` : ""}. ${t("clickToSeeDepartureTrack")}`
										}
										aria-pressed={isTrackFlipped}
										class="cursor-pointer focus-ring bg-transparent border-0 p-0"
									>
										<div
											class="relative inline-block"
											style={{
												perspective: "1000px",
												minHeight: "32px",
											}}
										>
											<div
												style={{
													transformStyle: "preserve-3d",
													transform: isTrackFlipped
														? "rotateY(180deg)"
														: "rotateY(0deg)",
													transition: "transform 0.4s ease-out",
													position: "relative",
													minHeight: "32px",
												}}
											>
												{/* Front face - Departure Track */}
												<div
													class={`badge badge-lg font-semibold ${
														trackChangeInfo.changedSide === "departure" &&
														isTrackChanged
															? "badge-error badge-outline"
															: "badge-ghost"
													} whitespace-nowrap`}
													style={{
														backfaceVisibility: "hidden",
														WebkitBackfaceVisibility: "hidden",
													}}
												>
													{t("track")} {departureRow.commercialTrack}
												</div>
												{/* Back face - Arrival Track */}
												<div
													class={`badge badge-lg font-semibold ${
														trackChangeInfo.changedSide === "arrival" &&
														isTrackChanged
															? "badge-error badge-outline"
															: "badge-ghost"
													} whitespace-nowrap`}
													style={{
														backfaceVisibility: "hidden",
														WebkitBackfaceVisibility: "hidden",
														transform: "rotateY(180deg)",
														position: "absolute",
														top: 0,
														left: 0,
														right: 0,
													}}
												>
													{arrivalRow ? (
														<>
															<span aria-hidden="true">&rarr;</span>{" "}
															{t("track")} {arrivalRow.commercialTrack}
														</>
													) : (
														<>
															{t("track")} {departureRow.commercialTrack}
														</>
													)}
												</div>
											</div>
										</div>
									</button>
									{/* Track change indicator - smart positioning */}
									{isTrackChanged &&
										((!isTrackFlipped &&
											trackChangeInfo.changedSide === "departure") ||
											(isTrackFlipped &&
												trackChangeInfo.changedSide === "arrival")) && (
											<span
												class="indicator-item indicator-top indicator-end badge badge-error badge-xs h-3 w-3 p-0 text-xs border-0 -translate-y-0.5 translate-x-0.5"
												aria-hidden="true"
											>
												!
											</span>
										)}
								</div>

								{minutesToDeparture !== null &&
									minutesToDeparture <= 30 &&
									minutesToDeparture >= 0 && (
										<div
											class={
												"badge badge-success badge-lg gap-2 font-semibold sm:h-8 sm:px-4"
											}
										>
											<i
												class="fa-solid fa-hourglass-half text-lg"
												aria-hidden="true"
											/>
											<span>
												{minutesToDeparture === 0
													? "0 min"
													: `${minutesToDeparture} min`}
											</span>
										</div>
									)}
							</>
						)}
					</div>
				</div>
				<div aria-live="polite" class="sr-only">
					{train.cancelled
						? t("cancelled")
						: departingSoon
							? t("departingSoon")
							: ""}
				</div>
			</div>
		</div>
	);
}
