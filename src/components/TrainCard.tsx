import { useEffect, useMemo, useState } from "preact/hooks";
import type { Train } from "../types";
import { getRelevantTrackInfo } from "../utils/api";
import { t } from "../utils/translations";
import TimeDisplay from "./TimeDisplay";

interface Props {
	train: Train;
	stationCode: string;
	destinationCode: string;
	currentTime: Date;
	onDepart?: () => void;
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
		"border rounded-lg shadow-sm hover:shadow-md relative duration-[3000ms]";

	if (isCancelled)
		return `${baseStyles} bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800`;
	if (minutesToDeparture !== null && minutesToDeparture < 0)
		return `${baseStyles} bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-0 transition-opacity`;
	if (
		isDepartingSoon &&
		!isCancelled &&
		minutesToDeparture !== null &&
		minutesToDeparture >= 0
	) {
		if (isHighlighted) {
			return `${baseStyles} animate-soft-blink-highlight dark:animate-soft-blink-highlight-dark`;
		}
		return `${baseStyles} border-gray-300 dark:border-gray-600 dark:bg-gray-950 animate-soft-blink dark:animate-soft-blink-dark`;
	}
	if (isHighlighted)
		return `${baseStyles} bg-[#f3e5f5] dark:bg-[#2d1a33] border-[#8c4799] dark:border-[#b388ff] ring-2 ring-[#8c4799] dark:ring-[#b388ff]`;
	return `${baseStyles} bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600`;
};

export default function TrainCard({
	train,
	stationCode,
	destinationCode,
	currentTime,
	onDepart,
}: Props) {
	const [, setLanguageChange] = useState(0);
	const [isHighlighted, setIsHighlighted] = useState(false);
	const [hasDeparted, setHasDeparted] = useState(false);
	const [opacity, setOpacity] = useState(1);
	const [trackMemory, setTrackMemory] = useState<
		Record<string, { track: string; timestamp: number }>
	>({});
	const [showTooltip, setShowTooltip] = useState(false);

	// Memoize all time-dependent calculations
	const {
		departureRow,
		arrivalRow,
		minutesToDeparture,
		departingSoon,
		timeDifferenceMinutes,
		duration,
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
			cardStyle,
		};
	}, [train, stationCode, destinationCode, currentTime, isHighlighted]);

	// Check if user has seen the tooltip before
	useEffect(() => {
		const hasSeenTooltip = localStorage.getItem("hasSeenFavoriteTooltip");
		if (
			!hasSeenTooltip &&
			!train.cancelled &&
			minutesToDeparture !== null &&
			minutesToDeparture > 0
		) {
			setShowTooltip(true);
			localStorage.setItem("hasSeenFavoriteTooltip", "true");
		}
	}, [train.cancelled, minutesToDeparture]);

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
			class={`p-2 sm:p-4 ${cardStyle} w-full text-left relative`}
			style={{ opacity: hasDeparted ? opacity : 1 }}
		>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4 flex-1 min-w-0">
					{/* Train identifier */}
					{train.commuterLineID && (
						<button
							onClick={handleFavorite}
							aria-label={isHighlighted ? t("unfavorite") : t("favorite")}
							type="button"
							class="flex-shrink-0 h-12 w-12 flex items-center justify-center text-xl font-bold focus:outline-none transition-transform duration-150 hover:scale-110 relative group border-none outline-none ring-0"
							style={{ outline: "none", border: "none", boxShadow: "none" }}
						>
							{showTooltip && (
								<button
									type="button"
									class="absolute -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full bg-[#6b2c75] text-white text-sm px-3 py-2 rounded-lg shadow-lg border-2 border-white whitespace-normal break-words max-w-xs max-w-[90vw] text-center z-50 cursor-pointer"
									onClick={(e) => {
										e.stopPropagation();
										setShowTooltip(false);
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.stopPropagation();
											setShowTooltip(false);
										}
									}}
									tabIndex={0}
									aria-label={t("closeTooltip")}
								>
									<div class="flex items-center gap-2">
										<span>{t("favoriteTooltip")}</span>
									</div>
									{/* Arrow */}
									<div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-3 h-3 z-10">
										<svg width="100%" height="100%" viewBox="0 0 12 12">
											<title>Tooltip arrow</title>
											<rect
												x="2"
												y="2"
												width="8"
												height="8"
												rx="2"
												fill="#6b2c75"
												stroke="white"
												strokeWidth="2"
												transform="rotate(45 6 6)"
											/>
										</svg>
									</div>
								</button>
							)}
							{isHighlighted ? (
								<span
									class={`h-12 w-12 rounded-full flex items-center justify-center relative border-2 ${train.cancelled ? "border-[#d4004d]" : "border-[#8c4799]"} bg-transparent`}
								>
									<svg
										viewBox="0 0 48 48"
										class="w-11 h-11"
										fill={train.cancelled ? "#d4004d" : "#8c4799"}
										stroke={train.cancelled ? "#d4004d" : "#8c4799"}
									>
										<title>
											{isHighlighted ? t("favorite") : t("unfavorite")}
										</title>
										<polygon points="24,3 30.9,17.8 47,18.6 34,29.7 38.2,45 24,36.6 9.8,45 14,29.7 1,18.6 17.1,17.8" />
									</svg>
									<span class="absolute inset-0 flex items-center justify-center text-white text-xl font-bold pointer-events-none">
										{train.commuterLineID}
									</span>
								</span>
							) : (
								<span
									class={`h-12 w-12 rounded-full flex items-center justify-center ${train.cancelled ? "bg-[#d4004d] text-white" : "bg-[#6b2c75] text-white"}`}
								>
									{train.commuterLineID}
								</span>
							)}
						</button>
					)}

					{/* Main train info */}
					<div class="space-y-2 min-w-0 flex-1">
						<div class="flex flex-col gap-1">
							<div class="flex flex-col gap-2">
								<TimeDisplay
									departureRow={departureRow}
									arrivalRow={arrivalRow}
									timeDifferenceMinutes={timeDifferenceMinutes}
								/>
								{duration && (
									<output
										class="text-sm text-gray-500 dark:text-gray-400"
										aria-label={`${t("duration")} ${duration.hours} ${t("hours")} ${duration.minutes} ${t("minutes")}`}
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
				<div class="flex flex-col items-end gap-2">
					{train.cancelled ? (
						<span class="px-3 py-1 bg-[#d4004d] text-white rounded-md text-sm font-medium shadow-sm">
							{t("cancelled")}
						</span>
					) : (
						<>
							<output
								aria-label={`${t("track")} ${departureRow.commercialTrack}`}
								class={`px-3 py-1 ${
									isTrackChanged
										? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
										: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
								} rounded-md text-sm font-medium shadow-sm`}
							>
								{t("track")} {departureRow.commercialTrack}
							</output>
							{minutesToDeparture !== null &&
								minutesToDeparture <= 30 &&
								minutesToDeparture >= 0 && (
									<span
										class={`font-medium text-lg mt-2 ${
											minutesToDeparture >= 0
												? "text-[#007549] dark:text-[#00e38f]"
												: "text-gray-600 dark:text-gray-400"
										}`}
									>
										<svg
											class="w-5 h-5 inline-block mr-1 -mt-1"
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
										{minutesToDeparture === 0
											? "0 min"
											: `${minutesToDeparture} min`}
									</span>
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
