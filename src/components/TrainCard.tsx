/** @format */

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
		"card bg-base-100 shadow-xl border border-base-300 rounded-xl relative hover-lift transition-[background,box-shadow,transform,opacity,border,border-color] duration-300";

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
		// Load highlighted state from localStorage (safe parse)
		let highlightedTrains: Record<string, HighlightedTrainData>;
		try {
			highlightedTrains = JSON.parse(
				localStorage.getItem("highlightedTrains") || "{}",
			);
		} catch {
			highlightedTrains = {};
		}
		const trainData = highlightedTrains[train.trainNumber];

		if (trainData) {
			// Check if the highlight has expired
			if (
				trainData.removeAfter &&
				new Date(trainData.removeAfter) < currentTime
			) {
				// Remove expired highlight
				delete highlightedTrains[train.trainNumber];
				localStorage.setItem(
					"highlightedTrains",
					JSON.stringify(highlightedTrains),
				);
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
						localStorage.setItem(
							"highlightedTrains",
							JSON.stringify(highlightedTrains),
						);
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
					localStorage.setItem(
						"highlightedTrains",
						JSON.stringify(highlightedTrains),
					);
				} else if (departureRow && !trainData.track) {
					// First time storing track
					highlightedTrains[train.trainNumber] = {
						...trainData,
						track: departureRow.commercialTrack,
					};
					localStorage.setItem(
						"highlightedTrains",
						JSON.stringify(highlightedTrains),
					);
				}
			}
		} else {
			setIsHighlighted(false);
		}
	}, [train.trainNumber, currentTime, train.timeTableRows, stationCode]);

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

	// Memoized track change check
	const isTrackChanged = useMemo(() => {
		const trackInfo = getRelevantTrackInfo(train, stationCode, destinationCode);
		if (!trackInfo) return false;
		const currentTrack = trackInfo.track;
		const storedTrack = trackMemory[trackInfo.journeyKey]?.track;
		return storedTrack && currentTrack && storedTrack !== currentTrack;
		// // TEMPORARY: Force track change indicator for testing
		// return true;
	}, [
		train.trainNumber,
		train.timeTableRows,
		stationCode,
		destinationCode,
		trackMemory,
	]);

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

		// Update localStorage (safe parse)
		let highlightedTrains: Record<string, HighlightedTrainData>;
		try {
			highlightedTrains = JSON.parse(
				localStorage.getItem("highlightedTrains") || "{}",
			);
		} catch {
			highlightedTrains = {};
		}

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

		localStorage.setItem(
			"highlightedTrains",
			JSON.stringify(highlightedTrains),
		);
	};

	if (!departureRow) return null;

	return (
		<div
			class={`${cardStyle} w-full max-w-full text-left relative overflow-hidden`}
			style={{ opacity: hasDeparted ? opacity : 1 }}
			data-train-number={train.trainNumber}
			data-train-cancelled={train.cancelled}
			data-train-line={train.commuterLineID}
			data-train-unknown-delay={departureRow?.unknownDelay || false}
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
											<svg
												class="w-4 h-4 inline-block mr-1 -mt-1"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												aria-hidden="true"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth="2"
													d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
												/>
											</svg>
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
								<div class="indicator">
									<output
										aria-label={`${t("track")} ${departureRow.commercialTrack}${isTrackChanged ? ` (${t("changed")})` : ""}`}
										class={`badge badge-lg font-semibold transition-all duration-300 ${
											isTrackChanged
												? "badge-error badge-outline"
												: "badge-ghost"
										}`}
									>
										{t("track")} {departureRow.commercialTrack}
									</output>
									{isTrackChanged && (
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
											<svg
												class="w-5 h-5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												aria-hidden="true"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth="2"
													d="M12 8v4l2 2"
												/>
												<circle
													cx="12"
													cy="12"
													r="9"
													strokeWidth="2"
													fill="none"
												/>
											</svg>
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
