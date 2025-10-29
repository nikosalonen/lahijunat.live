/** @format */

import { memo } from "preact/compat";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station, Train } from "../types";
import { fetchTrains } from "../utils/api";
import { hapticLight } from "../utils/haptics";
import { getDepartureDate } from "../utils/trainUtils";
import { t } from "../utils/translations";
import ErrorState from "./ErrorState";
import LinearProgress from "./LinearProgress";
import ProgressCircle from "./ProgressCircle";
import TrainCard from "./TrainCard";
import TrainListSkeleton from "./TrainListSkeleton";

interface Props {
	stationCode: string;
	destinationCode: string;
	stations: Station[];
}

const MemoizedTrainCard = memo(TrainCard);
const INITIAL_TRAIN_COUNT = 15;
const FADE_DURATION = 300; // Align with card opacity transition
const DEPARTED_GRACE_MINUTES = -2; // How long to keep showing a train after departure
const TIME_UPDATE_INTERVAL = 1000; // Update current time every 1 seconds when visible

// Adaptive refresh intervals
const REFRESH_INTERVALS = {
	URGENT: 15000, // 15 seconds - trains departing within 5 minutes
	HIGH: 30000, // 30 seconds - trains departing within 15 minutes or late trains
	MEDIUM: 45000, // 45 seconds - normal operations
	LOW: 90000, // 90 seconds - no immediate trains
} as const;

// Urgency thresholds (in minutes)
const URGENCY_THRESHOLDS = {
	URGENT: 5, // Trains departing within 5 minutes
	IMMINENT: 15, // Trains departing within 15 minutes
	NEARBY: 30, // Trains departing within 30 minutes
} as const;

// Calculate appropriate refresh interval based on train data
function getAdaptiveRefreshInterval(
	trains: Train[],
	currentTime: Date,
): number {
	if (!trains || !trains.length) return REFRESH_INTERVALS.LOW;

	const now = currentTime.getTime();
	let hasUrgentTrains = false;
	let hasImminentTrains = false;
	let hasLateTrains = false;

	for (const train of trains) {
		const departureRow = train.timeTableRows.find(
			(row) => row.type === "DEPARTURE",
		);

		if (!departureRow) continue;

		const departureTime = getDepartureDate(departureRow).getTime();
		const minutesToDeparture = Math.round((departureTime - now) / (1000 * 60));

		// Check if train is late
		const isLate = (departureRow.differenceInMinutes ?? 0) > 1;

		if (
			minutesToDeparture > 0 &&
			minutesToDeparture <= URGENCY_THRESHOLDS.URGENT
		) {
			hasUrgentTrains = true;
		} else if (
			minutesToDeparture > 0 &&
			minutesToDeparture <= URGENCY_THRESHOLDS.IMMINENT
		) {
			hasImminentTrains = true;
		}

		if (
			isLate &&
			minutesToDeparture > 0 &&
			minutesToDeparture <= URGENCY_THRESHOLDS.NEARBY
		) {
			hasLateTrains = true;
		}
	}

	if (hasUrgentTrains) return REFRESH_INTERVALS.URGENT;
	if (hasImminentTrains || hasLateTrains) return REFRESH_INTERVALS.HIGH;

	// Check if we have any trains in the next 30 minutes
	const hasNearbyTrains = trains.some((train) => {
		const departureRow = train.timeTableRows.find(
			(row) => row.type === "DEPARTURE",
		);
		if (!departureRow) return false;
		const departureTime = getDepartureDate(departureRow).getTime();
		const minutesToDeparture = Math.round((departureTime - now) / (1000 * 60));
		return (
			minutesToDeparture > 0 && minutesToDeparture <= URGENCY_THRESHOLDS.NEARBY
		);
	});

	return hasNearbyTrains ? REFRESH_INTERVALS.MEDIUM : REFRESH_INTERVALS.LOW;
}

export default function TrainList({
	stationCode,
	destinationCode,
	stations,
}: Props) {
	useLanguageChange();
	const [state, setState] = useState({
		trains: [] as Train[],
		loading: true,
		initialLoad: true,
		error: null as {
			type: "network" | "api" | "notFound" | "rateLimit" | "generic";
			message?: string;
		} | null,
	});
	const [currentTime, setCurrentTime] = useState(new Date());
	const [displayedTrainCount, setDisplayedTrainCount] =
		useState(INITIAL_TRAIN_COUNT);
	const [departedTrains, setDepartedTrains] = useState<Set<string>>(new Set());
	const [currentRefreshInterval, setCurrentRefreshInterval] = useState<number>(
		REFRESH_INTERVALS.MEDIUM,
	);
	const currentRefreshIntervalRef = useRef<number>(REFRESH_INTERVALS.MEDIUM);
	const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now());
	const [isPageVisible, setIsPageVisible] = useState(() => {
		if (typeof document === "undefined") {
			return true;
		}
		return document.visibilityState === "visible";
	});

	useEffect(() => {
		if (typeof document === "undefined") {
			return;
		}
		const handleVisibilityChange = () => {
			setIsPageVisible(document.visibilityState === "visible");
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

	const loadTrains = useCallback(async () => {
		const startedAt = Date.now();
		setLastRefreshAt(startedAt);
		try {
			if (state.initialLoad) {
				setState((prev) => ({ ...prev, loading: true }));
			}

			const trainData = await fetchTrains(stationCode, destinationCode);
			const now = new Date();
			setCurrentTime(now);

			// Update refresh interval based on train data
			const newRefreshInterval = getAdaptiveRefreshInterval(trainData, now);
			if (newRefreshInterval !== currentRefreshIntervalRef.current) {
				console.log(
					`[TrainList] Adaptive refresh: ${newRefreshInterval}ms (${
						newRefreshInterval / 1000
					}s)`,
				);
				setCurrentRefreshInterval(newRefreshInterval);
				currentRefreshIntervalRef.current = newRefreshInterval;
			}

			setState((prev) => ({
				...prev,
				trains: trainData,
				error: null,
				loading: false,
				initialLoad: false,
			}));
		} catch (err) {
			console.error("Error loading trains:", err);

			// Only show errors during initial load or user-triggered refreshes
			// For background updates, silently continue with existing data
			if (state.initialLoad) {
				// Determine error type based on error message or properties
				let errorType:
					| "network"
					| "api"
					| "notFound"
					| "rateLimit"
					| "generic" = "generic";
				let errorMessage: string | undefined;

				if (err instanceof Error) {
					const message = err.message.toLowerCase();
					if (message.includes("network") || message.includes("fetch")) {
						errorType = "network";
					} else if (
						message.includes("rate limit") ||
						message.includes("too many")
					) {
						errorType = "rateLimit";
					} else if (message.includes("not found") || message.includes("404")) {
						errorType = "notFound";
					} else if (message.includes("api") || message.includes("server")) {
						errorType = "api";
					}
					errorMessage = err.message;
				}

				setState((prev) => ({
					...prev,
					error: { type: errorType, message: errorMessage },
					loading: false,
					initialLoad: false,
				}));
			} else {
				// Background update failed - just clear loading state and continue with existing data
				console.log("Background update failed, continuing with existing data");
				setState((prev) => ({
					...prev,
					loading: false,
				}));
			}
		}
	}, [stationCode, destinationCode, state.initialLoad]);

	// Reset displayed count and departed trains when stations change
	useEffect(() => {
		setDisplayedTrainCount(INITIAL_TRAIN_COUNT);
		setDepartedTrains(new Set());
	}, [stationCode, destinationCode]);

	// Keep ref in sync with state
	useEffect(() => {
		currentRefreshIntervalRef.current = currentRefreshInterval;
	}, [currentRefreshInterval]);

	const handleTrainDeparted = useCallback((trainNumber: string) => {
		setTimeout(() => {
			setDepartedTrains((prev) => new Set([...prev, trainNumber]));
		}, FADE_DURATION);
	}, []);

	const handleTrainReappear = useCallback((trainNumber: string) => {
		setDepartedTrains((prev) => {
			const next = new Set(prev);
			next.delete(trainNumber);
			return next;
		});
	}, []);

	useEffect(() => {
		let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
		let cancelled = false;
		const getTimeUntilNextUpdate = () => {
			const now = new Date();
			const seconds = now.getSeconds();
			const milliseconds = now.getMilliseconds();
			return (30 - (seconds % 30)) * 1000 - milliseconds;
		};

		const scheduleRefresh = (delay: number) => {
			refreshTimeout = setTimeout(async () => {
				if (cancelled) {
					return;
				}
				try {
					await loadTrains();
				} finally {
					if (!cancelled) {
						scheduleRefresh(currentRefreshIntervalRef.current);
					}
				}
			}, delay);
		};

		if (isPageVisible) {
			loadTrains();
			scheduleRefresh(getTimeUntilNextUpdate());
		}

		return () => {
			cancelled = true;
			if (refreshTimeout) {
				clearTimeout(refreshTimeout);
			}
		};
	}, [loadTrains, currentRefreshInterval, isPageVisible]);

	useEffect(() => {
		if (!isPageVisible) {
			return;
		}
		setCurrentTime(new Date());
		const interval = setInterval(() => {
			setCurrentTime(new Date());
		}, TIME_UPDATE_INTERVAL);
		return () => {
			clearInterval(interval);
		};
	}, [isPageVisible]);

	if (state.loading && state.initialLoad) {
		return <TrainListSkeleton />;
	}

	if (state.error) {
		return (
			<div className="max-w-4xl mx-auto">
				<ErrorState
					type={state.error.type}
					message={state.error.message}
					onRetry={loadTrains}
					className="min-h-[300px] flex items-center justify-center"
				/>
			</div>
		);
	}

	const fromStation = stations.find((s) => s.shortCode === stationCode);
	const toStation = stations.find((s) => s.shortCode === destinationCode);

	// Calculate duration comparison for color coding
	const allTrainDurations = useMemo(() => {
		return (state.trains || [])
			.map((train) => {
				const departureRow = train.timeTableRows.find(
					(row) =>
						row.stationShortCode === stationCode && row.type === "DEPARTURE",
				);
				const arrivalRow = train.timeTableRows.find(
					(row) =>
						row.stationShortCode === destinationCode && row.type === "ARRIVAL",
				);

				if (!departureRow || !arrivalRow) return null;

				const arrivalTime =
					arrivalRow.liveEstimateTime ?? arrivalRow.scheduledTime;
				const departureTime =
					departureRow.actualTime ?? departureRow.scheduledTime;

				return Math.round(
					(new Date(arrivalTime).getTime() -
						new Date(departureTime).getTime()) /
						(1000 * 60),
				);
			})
			.filter((duration): duration is number => duration !== null)
			.sort((a, b) => a - b);
	}, [state.trains, stationCode, destinationCode]);

	const getDurationSpeedType = useCallback(
		(durationMinutes: number) => {
			if (allTrainDurations.length < 2) return "normal";

			const median =
				allTrainDurations[Math.floor(allTrainDurations.length / 2)];
			const fastThreshold = median * 0.85; // 15% faster than median
			const slowThreshold = median * 1.15; // 15% slower than median

			if (durationMinutes <= fastThreshold) return "fast";
			if (durationMinutes >= slowThreshold) return "slow";
			return "normal";
		},
		[allTrainDurations],
	);

	const displayedTrains = (state.trains || [])
		.filter((train) => {
			// Filter out trains that have been manually marked as departed (post-fade)
			if (departedTrains.has(train.trainNumber)) return false;

			// Filter out trains that have actually departed (departed more than 2 minutes ago)
			const departureRow = train.timeTableRows.find(
				(row) =>
					row.stationShortCode === stationCode && row.type === "DEPARTURE",
			);

			if (departureRow) {
				const departureTime = getDepartureDate(departureRow);
				const minutesToDeparture =
					(departureTime.getTime() - currentTime.getTime()) / (1000 * 60);

				// Don't show trains that departed more than the grace period ago (inclusive)
				const graceMinutes = Math.abs(DEPARTED_GRACE_MINUTES);
				return minutesToDeparture >= -graceMinutes;
			}

			return true;
		})
		.slice(0, displayedTrainCount);
	const hasMoreTrains = (state.trains || []).length > displayedTrainCount;

	const refreshProgress = useMemo(() => {
		const interval = Math.max(currentRefreshInterval, 1);
		const elapsed = currentTime.getTime() - lastRefreshAt;
		const remaining = 100 - (elapsed / interval) * 100;
		return Math.max(0, Math.min(100, remaining));
	}, [currentTime, lastRefreshAt, currentRefreshInterval]);

	return (
		<div>
			<div class="max-w-4xl mx-auto space-y-6 px-2 sm:px-4">
				{/* Desktop header with h2 and progress */}
				<div class="hidden sm:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
					<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 order-2 sm:order-1">
						<span class="sm:hidden inline-flex items-center gap-2">
							<span>{stationCode}</span>
							<i class="fa-solid fa-arrow-right" aria-hidden="true" />
							<span>{destinationCode}</span>
						</span>
						<span class="hidden sm:inline-flex sm:items-center sm:gap-2">
							<span>{fromStation?.name}</span>
							<i class="fa-solid fa-arrow-right" aria-hidden="true" />
							<span>{toStation?.name}</span>
						</span>
					</h2>
					<div class="self-end sm:self-auto order-1 sm:order-2">
						<ProgressCircle progress={refreshProgress} size="w-8 h-8" />
					</div>
				</div>

				{/* Mobile horizontal progress bar (left → right) */}
				<div class="sm:hidden w-full mb-4">
					<LinearProgress
						progress={refreshProgress}
						heightClass="h-1.5"
						widthClass="w-full"
						direction="rtl"
					/>
				</div>
				<div
					class="grid auto-rows-fr gap-4 transition-[grid-row,transform] duration-700 ease-in-out"
					style={{
						"grid-template-rows": `repeat(${displayedTrains.length}, minmax(0, 1fr))`,
					}}
				>
					{displayedTrains.map((train, index) => (
						<div
							key={train.trainNumber}
							class={
								departedTrains.has(train.trainNumber) ? "" : "animate-scale-in"
							}
							style={{
								"grid-row": `${index + 1}`,
								animationDelay: `${index * 0.05}s`,
							}}
						>
							<MemoizedTrainCard
								train={train}
								stationCode={stationCode}
								destinationCode={destinationCode}
								currentTime={currentTime}
								onDepart={() => handleTrainDeparted(train.trainNumber)}
								onReappear={() => handleTrainReappear(train.trainNumber)}
								getDurationSpeedType={getDurationSpeedType}
							/>
						</div>
					))}
				</div>
				{hasMoreTrains && (
					<div class="flex justify-center mt-6">
						<button
							type="button"
							onClick={() => {
								hapticLight();
								setDisplayedTrainCount((prev) => prev + INITIAL_TRAIN_COUNT);
							}}
							class="btn bg-white dark:bg-base-100 border-2 border-gray-200 dark:border-gray-700 hover:border-[#8c4799] dark:hover:border-[#b388ff] hover:bg-[#8c4799] dark:hover:bg-[#b388ff] hover:text-white transition-all duration-200 touch-manipulation select-none rounded-2xl px-8 py-3 shadow-md hover:shadow-lg font-medium text-gray-700 dark:text-gray-200 hover:scale-105 active:scale-95"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="w-5 h-5"
								aria-hidden="true"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
							{t("showMore")}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
