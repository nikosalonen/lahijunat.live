/** @format */

import { useEffect, useMemo, useState } from "preact/hooks";
import type { Train } from "../types";
import { getRelevantTrackInfo } from "../utils/api";
import { hapticImpact } from "../utils/haptics";
import { t } from "../utils/translations";
import TimeDisplay from "./TimeDisplay";

interface Props {
	train: Train;
	stationCode: string;
	destinationCode: string;
	currentTime: Date;
	onDepart?: () => void;
	getDurationSpeedType?: (
		durationMinutes: number,
	) => "fast" | "slow" | "normal";
}

const calculateDuration = (start: string, end: string) => {
	const durationMinutes = Math.round(
		(new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60),
	);
	return {
		hours: Math.floor(durationMinutes / 60),
		minutes: durationMinutes % 60,
	};
};

const formatMinutesToDeparture = (scheduledTime: string, currentTime: Date) => {
	const departure = new Date(scheduledTime);
	const diffMs = departure.getTime() - currentTime.getTime();
	const diffMinutes = diffMs / (1000 * 60);
	// For negative times (past departure), use floor to show how many minutes ago
	// For positive times (future departure), use floor to show complete minutes until departure
	return Math.floor(diffMinutes);
};

const isDepartingSoon = (scheduledTime: string, currentTime: Date) => {
	const departure = new Date(scheduledTime);
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
		"card-modern rounded-xl relative duration-[3000ms] hover-lift";

	if (isCancelled)
		return `${baseStyles} bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-300 dark:border-red-800 shadow-lg`;
	if (minutesToDeparture !== null && minutesToDeparture < 0)
		return `${baseStyles} bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 border-gray-300 dark:border-gray-600 opacity-0 transition-opacity`;
	if (
		isDepartingSoon &&
		!isCancelled &&
		minutesToDeparture !== null &&
		minutesToDeparture >= 0
	) {
		if (isHighlighted) {
			return "card-modern rounded-xl relative hover-lift transition-[background,box-shadow,transform,opacity] duration-[3000ms] animate-soft-blink-highlight dark:animate-soft-blink-highlight-dark";
		}
		return `${baseStyles} border-gray-300 dark:border-gray-600 dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 animate-soft-blink dark:animate-soft-blink-dark`;
	}
	if (isHighlighted)
		return "card-modern rounded-xl relative hover-lift transition-[background,box-shadow,transform,opacity] duration-[3000ms] bg-gradient-to-br from-[#f3e5f5] to-[#e8d5f0] dark:from-[#2d1a33] dark:to-[#1f0f26] !border-4 !border-[#8c4799] dark:!border-[#b388ff] ring-4 ring-[#8c4799]/30 dark:ring-[#b388ff]/30 shadow-xl";
	return `${baseStyles} surface-elevated`;
};

export default function TrainCard({
	train,
	stationCode,
	destinationCode,
	currentTime,
	onDepart,
	getDurationSpeedType,
}: Props) {
	const [, setLanguageChange] = useState(0);
	const [isHighlighted, setIsHighlighted] = useState(false);
	const [hasDeparted, setHasDeparted] = useState(false);
	const [opacity, setOpacity] = useState(1);
	const [trackMemory, setTrackMemory] = useState<
		Record<string, { track: string; timestamp: number }>
	>({});

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
			departureRow.liveEstimateTime ?? departureRow.scheduledTime,
			currentTime,
		);

		const departingSoon = isDepartingSoon(
			departureRow.liveEstimateTime ?? departureRow.scheduledTime,
			currentTime,
		);

		const timeDifferenceMinutes = departureRow.differenceInMinutes ?? 0;

		const arrivalTime =
			arrivalRow?.liveEstimateTime ?? arrivalRow?.scheduledTime;
		const duration = arrivalTime
			? calculateDuration(
					departureRow.actualTime ?? departureRow.scheduledTime,
					arrivalTime,
				)
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

	// Call onDepart when the train transitions from not departed to departed
	useEffect(() => {
		if (!minutesToDeparture) return;
		if (minutesToDeparture < 0 && !hasDeparted) {
			setHasDeparted(true);
			setOpacity(1);
			// Start fade out
			requestAnimationFrame(() => {
				setOpacity(0);
			});
			onDepart?.();
		}
	}, [minutesToDeparture, hasDeparted, onDepart]);

	useEffect(() => {
		// Load highlighted state from localStorage
		const highlightedTrains = JSON.parse(
			localStorage.getItem("highlightedTrains") || "{}",
		);
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

		// Always read the latest from localStorage
		const latestTrackMemory = JSON.parse(
			localStorage.getItem("trackMemory") || "{}",
		);

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

		// Update localStorage
		const highlightedTrains = JSON.parse(
			localStorage.getItem("highlightedTrains") || "{}",
		);

		if (newHighlighted) {
			// When highlighting, set removal time to 10 minutes after departure
			const departureRow = train.timeTableRows.find(
				(row) =>
					row.stationShortCode === stationCode && row.type === "DEPARTURE",
			);

			if (departureRow) {
				const departureTime = new Date(
					departureRow.liveEstimateTime ?? departureRow.scheduledTime,
				);
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
			class={`p-3 sm:p-4 ${cardStyle} w-full max-w-full text-left relative overflow-hidden`}
			style={{ opacity: hasDeparted ? opacity : 1 }}
		>
			<div class="flex items-start justify-between gap-2 sm:gap-4">
				<div class="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 overflow-hidden">
					{/* Train identifier */}
					{train.commuterLineID && (
						<button
							onClick={handleFavorite}
							aria-label={isHighlighted ? t("unfavorite") : t("favorite")}
							type="button"
							class="flex-shrink-0 h-14 w-14 sm:h-16 sm:w-16 flex items-center justify-center text-xl font-bold focus:outline-none transition-all duration-200 hover:scale-105 active:scale-95 relative group border-none outline-none ring-0 touch-manipulation select-none min-h-[44px] min-w-[44px]"
							style={{ outline: "none", border: "none", boxShadow: "none" }}
						>
							<div class="relative">
								<span
									class={`h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 ${
										train.cancelled
											? "bg-gradient-to-br from-red-500 to-red-600 text-white"
											: "bg-[#8c4799] text-white"
									}`}
								>
									<span class="text-lg sm:text-xl font-bold drop-shadow-lg">
										{train.commuterLineID}
									</span>
								</span>
								{isHighlighted && (
									<div class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
										<svg
											class="w-3 h-3 text-white"
											fill="currentColor"
											viewBox="0 0 20 20"
											aria-hidden="true"
										>
											<title>Favorite</title>
											<path
												fill-rule="evenodd"
												d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
								)}
							</div>
						</button>
					)}

					{/* Main train info */}
					<div class="space-y-2 sm:space-y-1 min-w-0 flex-1 overflow-hidden">
						<div class="flex flex-col gap-1">
							<div class="flex flex-col gap-2 sm:gap-1">
								<TimeDisplay
									departureRow={departureRow}
									arrivalRow={arrivalRow}
									timeDifferenceMinutes={timeDifferenceMinutes}
								/>
								{duration && (
									<output
										class={`text-sm sm:text-base font-medium flex items-center truncate ${
											durationSpeedType === "fast"
												? "text-green-600 dark:text-green-400"
												: durationSpeedType === "slow"
													? "text-orange-600 dark:text-orange-400"
													: "text-gray-500 dark:text-gray-300"
										}`}
										aria-label={`${t("duration")} ${duration.hours} ${t(
											"hours",
										)} ${duration.minutes} ${t("minutes")}`}
									>
										<svg
											class="w-4 h-4 inline-block mr-1 -mt-1"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
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
						<span class="px-4 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm sm:text-base font-semibold shadow-lg">
							{t("cancelled")}
						</span>
					) : (
						<>
							<output
								aria-label={`${t("track")} ${departureRow.commercialTrack}`}
								class={`px-4 py-2 sm:px-4 sm:py-2 rounded-xl text-sm sm:text-base font-semibold shadow-lg transition-all duration-300 ${
									isTrackChanged
										? "bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900 dark:to-red-800 text-red-700 dark:text-red-300 ring-2 ring-red-500 dark:ring-red-400"
										: "bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-300"
								}`}
							>
								{t("track")} {departureRow.commercialTrack}
							</output>
							{minutesToDeparture !== null &&
								minutesToDeparture <= 30 &&
								minutesToDeparture >= 0 && (
									<div
										class={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-lg sm:text-xl shadow-lg transition-all duration-300 ${
											minutesToDeparture >= 0
												? "bg-gradient-to-r from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-800 text-emerald-700 dark:text-emerald-300"
												: "bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-600 dark:text-gray-300"
										}`}
									>
										<svg
											class="w-5 h-5"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 8v4l2 2"
											/>
											<circle
												cx="12"
												cy="12"
												r="9"
												stroke-width="2"
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
	);
}
