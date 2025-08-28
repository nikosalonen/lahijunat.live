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
import ProgressCircle from "./ProgressCircle";
import ProgressVertical from "./ProgressVertical";
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
		progress: 100,
	});
	const [currentTime, setCurrentTime] = useState(new Date());
	const [animationPhase, setAnimationPhase] = useState(0);
	const [displayedTrainCount, setDisplayedTrainCount] =
		useState(INITIAL_TRAIN_COUNT);
	const [departedTrains, setDepartedTrains] = useState<Set<string>>(new Set());
	const [currentRefreshInterval, setCurrentRefreshInterval] = useState<number>(
		REFRESH_INTERVALS.MEDIUM,
	);
	const currentRefreshIntervalRef = useRef<number>(REFRESH_INTERVALS.MEDIUM);

	const loadTrains = useCallback(async () => {
		try {
			if (state.initialLoad) {
				setState((prev) => ({ ...prev, loading: true }));
			}
			setState((prev) => ({ ...prev, progress: 100 }));

			const trainData = await fetchTrains(stationCode, destinationCode);
			const now = new Date();
			setCurrentTime(now);

			// Update refresh interval based on train data
			const newRefreshInterval = getAdaptiveRefreshInterval(trainData, now);
			if (newRefreshInterval !== currentRefreshInterval) {
				console.log(
					`[TrainList] Adaptive refresh: ${newRefreshInterval}ms (${
						newRefreshInterval / 1000
					}s)`,
				);
				setCurrentRefreshInterval(newRefreshInterval);
				currentRefreshIntervalRef.current = newRefreshInterval;
				// Reset progress to 100% when interval changes so it counts down over the new duration
				setState((prev) => ({ ...prev, progress: 100 }));
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
		let startTime: number;
		let animationFrame: number;
		let updateInterval: ReturnType<typeof setInterval> | undefined;

		const animate = (timestamp: number) => {
			if (!startTime) startTime = timestamp;
			const elapsed = timestamp - startTime;
			const progress = (elapsed % 2500) / 2500; // 2.5s animation duration
			setAnimationPhase(progress);
			animationFrame = requestAnimationFrame(animate);
		};

		animationFrame = requestAnimationFrame(animate);

		// Function to calculate time until next even second (:00 or :30)
		const getTimeUntilNextUpdate = () => {
			const now = new Date();
			const seconds = now.getSeconds();
			const milliseconds = now.getMilliseconds();
			const timeUntilNextHalfMinute =
				(30 - (seconds % 30)) * 1000 - milliseconds;
			return timeUntilNextHalfMinute;
		};

		// Initial data load
		loadTrains();

		// Update current time every second
		const timeUpdateInterval = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);

		// Schedule next update at the next even second
		const updateTimeout = setTimeout(() => {
			loadTrains();
			// Then set up adaptive interval based on train urgency
			updateInterval = setInterval(() => {
				loadTrains();
			}, currentRefreshInterval);
		}, getTimeUntilNextUpdate());

		// Progress bar update interval
		const progressInterval = setInterval(() => {
			setState((prev) => ({
				...prev,
				progress: Math.max(
					0,
					prev.progress - 100 / (currentRefreshIntervalRef.current / 1000),
				),
			}));
		}, 1000); // Update progress every second

		return () => {
			cancelAnimationFrame(animationFrame);
			clearTimeout(updateTimeout);
			if (updateInterval) clearInterval(updateInterval);
			clearInterval(progressInterval);
			clearInterval(timeUpdateInterval);
		};
	}, [loadTrains, currentRefreshInterval]);

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

	return (
		<div>
			<div class="max-w-4xl mx-auto space-y-6 px-2 sm:px-4">
				{/* Desktop header with h2 and progress */}
				<div class="hidden sm:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
					<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 order-2 sm:order-1">
						<span class="sm:hidden">
							{stationCode} → {destinationCode}
						</span>
						<span class="hidden sm:inline">
							{fromStation?.name} → {toStation?.name}
						</span>
					</h2>
					<div class="self-end sm:self-auto order-1 sm:order-2">
						<ProgressCircle progress={state.progress} size="w-8 h-8" />
					</div>
				</div>

				{/* Mobile horizontal progress bar (left → right) */}
				<div class="sm:hidden w-full mb-4">
					<ProgressVertical progress={state.progress} heightClass="h-1.5" widthClass="w-full" direction="rtl" />
				</div>
				<div
					class="grid auto-rows-fr gap-4 transition-[grid-row,transform] duration-700 ease-in-out"
					style={{
						"--animation-phase": animationPhase,
						"grid-template-rows": `repeat(${displayedTrains.length}, minmax(0, 1fr))`,
					}}
				>
					{displayedTrains.map((train, index) => (
						<div
							key={train.trainNumber}
							class={`transition-[transform,opacity] duration-700 ease-in-out hover-lift ${
								departedTrains.has(train.trainNumber)
									? "animate-train-depart"
									: "animate-scale-in"
							}`}
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
					<div class="flex justify-center mt-4">
						<button
							type="button"
							onClick={() => {
								hapticLight();
								setDisplayedTrainCount((prev) => prev + INITIAL_TRAIN_COUNT);
							}}
							class="btn btn-primary btn-wide touch-manipulation select-none"
						>
							{t("showMore")}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
