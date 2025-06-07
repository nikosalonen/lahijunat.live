import { useEffect, useMemo, useState } from "preact/hooks";
import type { Train } from "../types";
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
	const [lastTapTime, setLastTapTime] = useState(0);
	const [hasDeparted, setHasDeparted] = useState(false);
	const [opacity, setOpacity] = useState(1);

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
		const trackMemory = JSON.parse(localStorage.getItem("trackMemory") || "{}");
		const departureRow = train.timeTableRows.find(
			(row) => row.stationShortCode === stationCode && row.type === "DEPARTURE",
		);
		if (!departureRow) return;

		const currentTrack = departureRow.commercialTrack;
		const storedTrack = trackMemory[train.trainNumber];

		// Cleanup old entries
		const now = Date.now();
		const MAX_AGE_MS = 1 * 60 * 60 * 1000; // 1 hours
		const MAX_ENTRIES = 1000;

		// Remove entries older than 1 hours
		Object.keys(trackMemory).forEach((trainNumber) => {
			const entry = trackMemory[trainNumber];
			if (now - entry.timestamp > MAX_AGE_MS) {
				delete trackMemory[trainNumber];
			}
		});

		// If we have too many entries, remove oldest ones
		const entries = Object.entries(trackMemory);
		if (entries.length >= MAX_ENTRIES) {
			entries
				.sort(
					([, a], [, b]) =>
						(a as { timestamp: number }).timestamp -
						(b as { timestamp: number }).timestamp,
				)
				.slice(0, entries.length - MAX_ENTRIES + 1)
				.forEach(([trainNumber]) => {
					delete trackMemory[trainNumber];
				});
		}

		if (!storedTrack) {
			// Store the first seen track with timestamp
			trackMemory[train.trainNumber] = {
				track: currentTrack,
				timestamp: now,
			};
			localStorage.setItem("trackMemory", JSON.stringify(trackMemory));
		}
	}, [train.trainNumber, train.timeTableRows, stationCode]);

	// Memoized track change check
	const isTrackChanged = useMemo(() => {
		const trackMemory = JSON.parse(localStorage.getItem("trackMemory") || "{}");
		const departureRow = train.timeTableRows.find(
			(row) => row.stationShortCode === stationCode && row.type === "DEPARTURE",
		);
		if (!departureRow) return false;
		const currentTrack = departureRow.commercialTrack;
		const storedTrack = trackMemory[train.trainNumber]?.track;
		return storedTrack && currentTrack && storedTrack !== currentTrack;
	}, [train.trainNumber, train.timeTableRows, stationCode]);

	useEffect(() => {
		const handleLanguageChange = () => {
			setLanguageChange((prev) => prev + 1);
		};

		window.addEventListener("languagechange", handleLanguageChange);
		return () =>
			window.removeEventListener("languagechange", handleLanguageChange);
	}, []);

	const handleDoubleTap = () => {
		const now = Date.now();
		if (now - lastTapTime < 300) {
			// 300ms threshold for double tap
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
					const removeAfter = new Date(
						departureTime.getTime() + 10 * 60 * 1000,
					); // 10 minutes after departure

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
		}
		setLastTapTime(now);
	};

	// Debug function to simulate track changes
	const simulateTrackChange = () => {
		const highlightedTrains = JSON.parse(
			localStorage.getItem("highlightedTrains") || "{}",
		);
		const trainData = highlightedTrains[train.trainNumber];

		if (trainData) {
			// Simulate track change by storing a different track
			highlightedTrains[train.trainNumber] = {
				...trainData,
				track: trainData.track === "1" ? "2" : "1",
				trackChanged: true,
			};
			localStorage.setItem(
				"highlightedTrains",
				JSON.stringify(highlightedTrains),
			);
			// Force re-render
			setIsHighlighted((prev) => !prev);
			setIsHighlighted((prev) => !prev);
		}
	};

	if (!departureRow) return null;

	return (
		<button
			class={`p-2 sm:p-4 ${cardStyle} w-full text-left`}
			style={{ opacity: hasDeparted ? opacity : 1 }}
			aria-label={`${t("train")} ${train.commuterLineID || ""} ${train.cancelled ? t("cancelled") : ""} ${isHighlighted ? t("highlighted") : ""}`}
			onClick={handleDoubleTap}
			onKeyDown={(e) => e.key === "Enter" && handleDoubleTap()}
			type="button"
		>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4 flex-1 min-w-0">
					{/* Train identifier */}
					{train.commuterLineID && (
						<div
							class={`flex-shrink-0 h-12 w-12 ${
								train.cancelled
									? "bg-[#d4004d] text-white"
									: "bg-[#6b2c75] text-white"
							} rounded-full flex items-center justify-center text-xl font-bold`}
						>
							{train.commuterLineID}
						</div>
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
					{/* Debug button - only visible in development */}
					{process.env.NODE_ENV === "development" && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								simulateTrackChange();
							}}
							class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						>
							Debug: Simulate Track Change
						</button>
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
			{isHighlighted && (
				<div class="absolute top-2 right-2">
					<svg
						class="w-4 h-4 text-[#8c4799] dark:text-[#b388ff]"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<title>Star icon</title>
						<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
					</svg>
				</div>
			)}
			{process.env.NODE_ENV === "development" && (
				<div class="mt-4 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-xs font-mono space-y-1">
					<div class="font-bold text-blue-600 dark:text-blue-400">
						Debug Info:
					</div>
					<div class="text-gray-800 dark:text-gray-200">
						Train:{" "}
						<span class="text-blue-600 dark:text-blue-400">
							{train.commuterLineID} ({train.trainNumber})
						</span>
					</div>
					<div class="text-gray-800 dark:text-gray-200">
						Current time:{" "}
						<span class="text-blue-600 dark:text-blue-400">
							{currentTime.toLocaleTimeString()}
						</span>
					</div>
					<div class="text-gray-800 dark:text-gray-200">
						Scheduled:{" "}
						<span class="text-blue-600 dark:text-blue-400">
							{new Date(departureRow?.scheduledTime || "").toLocaleTimeString()}
						</span>
					</div>
					<div class="text-gray-800 dark:text-gray-200">
						Live estimate:{" "}
						<span class="text-blue-600 dark:text-blue-400">
							{departureRow?.liveEstimateTime
								? new Date(departureRow.liveEstimateTime).toLocaleTimeString()
								: "none"}
						</span>
					</div>
					<div class="text-gray-800 dark:text-gray-200">
						Minutes to departure:{" "}
						<span class="text-blue-600 dark:text-blue-400">
							{minutesToDeparture}
						</span>
					</div>
					<div class="text-gray-800 dark:text-gray-200">
						Departing soon:{" "}
						<span
							class={`${departingSoon ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
						>
							{departingSoon ? "yes" : "no"}
						</span>
					</div>
					<div class="text-gray-800 dark:text-gray-200">
						Card style:{" "}
						<span class="text-purple-600 dark:text-purple-400">
							{cardStyle
								.split(" ")
								.filter((c) => c.startsWith("bg-") || c.includes("blink"))
								.join(" ")}
						</span>
					</div>
				</div>
			)}
		</button>
	);
}
