/** @format */

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import {
	getFavoritesSync,
	initStorage,
	removeFavorite,
	setFavorite,
	updateFavorite,
} from "@/utils/storage";
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

// Swipe gesture constants
const SWIPE_THRESHOLD = 60; // px required to trigger action
const SWIPE_RESISTANCE = 0.4; // Resistance factor for visual feedback

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
	// Do not set opacity via class; fade is driven by inline style and transitionend

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

	// Swipe gesture state
	const [swipeOffset, setSwipeOffset] = useState(0);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const touchStartRef = useRef<{ x: number; y: number } | null>(null);
	const isSwipingRef = useRef(false);
	const hasTriggeredRef = useRef(false);

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

	// Track depart/undepart transitions
	useEffect(() => {
		const departed = Boolean(train.isDeparted);
		if (departed && !hasDeparted) {
			setHasDeparted(true);
		} else if (!departed && hasDeparted) {
			setHasDeparted(false);
			onReappear?.();
		}
	}, [train.isDeparted, hasDeparted, onReappear]);

	// Drive fade animation based on hasDeparted state
	useEffect(() => {
		if (!hasDeparted) {
			if (fadeRafRef.current !== null) {
				cancelAnimationFrame(fadeRafRef.current);
				fadeRafRef.current = null;
			}
			setOpacity(1);
			return;
		}

		setOpacity(1);
		const rafId = requestAnimationFrame(() => {
			setOpacity(0);
		});
		fadeRafRef.current = rafId;

		return () => {
			cancelAnimationFrame(rafId);
			if (fadeRafRef.current === rafId) {
				fadeRafRef.current = null;
			}
		};
	}, [hasDeparted]);

	// Initialize storage on mount
	useEffect(() => {
		initStorage();
	}, []);

	useEffect(() => {
		// Load highlighted state from storage (sync read from cache)
		const favorites = getFavoritesSync();
		const trainData = favorites[train.trainNumber];

		if (trainData) {
			// Check if the highlight has expired
			if (
				trainData.removeAfter &&
				new Date(trainData.removeAfter) < currentTime
			) {
				// Remove expired highlight
				removeFavorite(train.trainNumber);
				setIsHighlighted(false);
			} else {
				setIsHighlighted(trainData.highlighted);

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
						updateFavorite(train.trainNumber, {
							removeAfter: desiredRemoveAfter.toISOString(),
						});
					}
				}

				if (
					departureRow &&
					trainData.track &&
					departureRow.commercialTrack !== trainData.track
				) {
					// Track has changed, update the stored track
					updateFavorite(train.trainNumber, {
						track: departureRow.commercialTrack,
						trackChanged: true,
					});
				} else if (departureRow && !trainData.track) {
					// First time storing track
					updateFavorite(train.trainNumber, {
						track: departureRow.commercialTrack,
					});
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
	const handleTrackKeyDown = (e: globalThis.KeyboardEvent) => {
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

	const handleFavorite = useCallback(() => {
		const newHighlighted = !isHighlighted;
		hapticImpact();
		setIsHighlighted(newHighlighted);

		if (newHighlighted) {
			// When highlighting, set removal time to 10 minutes after departure
			const departureRow = train.timeTableRows.find(
				(row) =>
					row.stationShortCode === stationCode && row.type === "DEPARTURE",
			);

			if (departureRow) {
				const departureTime = getDepartureDate(departureRow);
				const removeAfter = new Date(departureTime.getTime() + 10 * 60 * 1000); // 10 minutes after departure
				const journeyKey = `${train.trainNumber}-${stationCode}-${destinationCode}`;

				setFavorite(train.trainNumber, {
					highlighted: true,
					removeAfter: removeAfter.toISOString(),
					journeyKey,
					track: departureRow.commercialTrack,
				});
			}
		} else {
			removeFavorite(train.trainNumber);
		}
	}, [isHighlighted, train, stationCode, destinationCode]);

	// Swipe gesture handlers (touch-only)
	const handleTouchStart = useCallback((e: TouchEvent) => {
		if (e.touches.length !== 1) return;
		const touch = e.touches[0];
		touchStartRef.current = { x: touch.clientX, y: touch.clientY };
		isSwipingRef.current = false;
		hasTriggeredRef.current = false;
		setIsTransitioning(false);
	}, []);

	const handleTouchMove = useCallback((e: TouchEvent) => {
		if (!touchStartRef.current || e.touches.length !== 1) return;

		const touch = e.touches[0];
		const deltaX = touch.clientX - touchStartRef.current.x;
		const deltaY = touch.clientY - touchStartRef.current.y;

		// If vertical movement is dominant at the start, don't start a swipe
		if (!isSwipingRef.current) {
			if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
				// Vertical scroll - don't interfere
				touchStartRef.current = null;
				return;
			}
			if (Math.abs(deltaX) > 10) {
				isSwipingRef.current = true;
			}
		}

		if (isSwipingRef.current) {
			// Prevent vertical scroll while swiping horizontally
			e.preventDefault();
			setSwipeOffset(deltaX);
		}
	}, []);

	const handleTouchEnd = useCallback(() => {
		if (!touchStartRef.current) return;

		const triggered =
			Math.abs(swipeOffset) >= SWIPE_THRESHOLD && !hasTriggeredRef.current;

		if (triggered) {
			hasTriggeredRef.current = true;
			// Trigger haptic feedback
			if (navigator.vibrate) {
				navigator.vibrate(10);
			}
			hapticImpact();
			// Toggle favorite
			handleFavorite();
		}

		// Animate back to center
		setIsTransitioning(true);
		setSwipeOffset(0);

		// Reset state after transition
		setTimeout(() => {
			setIsTransitioning(false);
		}, 300);

		touchStartRef.current = null;
		isSwipingRef.current = false;
	}, [swipeOffset, handleFavorite]);

	if (!departureRow) return null;

	const hasDerivedActualDeparture = Boolean(
		departureRow.actualTime ?? train.departedAt,
	);
	const showDebugInfo = import.meta.env.DEV;
	const debugState = showDebugInfo
		? {
				trainIsDeparted: Boolean(train.isDeparted),
				hasDeparted,
				isDepartingSoon: departingSoon,
				minutesToDeparture,
				opacity,
				departureActual: departureRow.actualTime ?? null,
				derivedDepartedAt: train.departedAt ?? null,
				departureEstimate: departureRow.liveEstimateTime ?? null,
				departureScheduled: departureRow.scheduledTime ?? null,
			}
		: null;
	const formatDebugValue = (value: unknown) => {
		if (value === null || value === undefined) return "null";
		if (typeof value === "boolean") return value ? "true" : "false";
		if (typeof value === "number") {
			if (Number.isNaN(value)) return "NaN";
			if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
			return value.toString();
		}
		return String(value);
	};

	// Calculate visual offset with resistance
	const visualOffset = swipeOffset * SWIPE_RESISTANCE;
	const isSwipeActive = Math.abs(swipeOffset) > 0;

	return (
		<div
			class="relative overflow-hidden rounded-2xl"
			style={{
				opacity: hasDeparted ? opacity : 1,
			}}
			onTransitionEnd={(e) => {
				if (e.target !== e.currentTarget) return;
				if (e.propertyName === "opacity" && hasDeparted && opacity === 0) {
					onDepart?.();
				}
			}}
		>
			{/* Left reveal - shown when swiping right */}
			<div
				class={`absolute inset-y-0 left-0 w-16 flex items-center justify-center transition-opacity duration-150 ${
					isHighlighted
						? "bg-gray-400 dark:bg-gray-600"
						: "bg-pink-500 dark:bg-pink-600"
				} ${swipeOffset > 20 ? "opacity-100" : "opacity-0"}`}
				aria-hidden="true"
			>
				<svg
					class="w-6 h-6 text-white"
					fill={isHighlighted ? "none" : "currentColor"}
					stroke="currentColor"
					strokeWidth={isHighlighted ? 2 : 0}
					viewBox="0 0 20 20"
					role="img"
					aria-label="Heart"
				>
					<path
						fillRule="evenodd"
						d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
						clipRule="evenodd"
					/>
				</svg>
			</div>

			{/* Right reveal - shown when swiping left */}
			<div
				class={`absolute inset-y-0 right-0 w-16 flex items-center justify-center transition-opacity duration-150 ${
					isHighlighted
						? "bg-gray-400 dark:bg-gray-600"
						: "bg-pink-500 dark:bg-pink-600"
				} ${swipeOffset < -20 ? "opacity-100" : "opacity-0"}`}
				aria-hidden="true"
			>
				<svg
					class="w-6 h-6 text-white"
					fill={isHighlighted ? "none" : "currentColor"}
					stroke="currentColor"
					strokeWidth={isHighlighted ? 2 : 0}
					viewBox="0 0 20 20"
					role="img"
					aria-label="Heart"
				>
					<path
						fillRule="evenodd"
						d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
						clipRule="evenodd"
					/>
				</svg>
			</div>

			{/* Card content with transform */}
			<div
				class={`${cardStyle} w-full max-w-full text-left relative select-none transition-opacity duration-700 ease-in-out ${
					isTransitioning ? "transition-transform duration-300 ease-out" : ""
				}`}
				style={{
					transform:
						isSwipeActive || isTransitioning
							? `translateX(${visualOffset}px)`
							: undefined,
					WebkitTouchCallout: "none",
					WebkitTapHighlightColor: "transparent",
				}}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
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
										<div class="absolute -top-0.5 -right-0.5 bg-error rounded-full p-1 shadow">
											<svg
												class="w-2.5 h-2.5 text-white"
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
												<i class="fa-solid fa-clock mr-1" aria-hidden="true" />
												<span>
													{duration.hours}h {duration.minutes}m
												</span>
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
											class="group cursor-pointer focus-ring bg-transparent border-0 p-0"
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
														class={`badge badge-lg font-semibold transition-all duration-200 ${
															trackChangeInfo.changedSide === "departure" &&
															isTrackChanged
																? "badge-error badge-outline group-hover:bg-error/20 dark:group-hover:bg-error/30 group-hover:scale-105"
																: "badge-ghost group-hover:bg-base-200 dark:group-hover:bg-base-300 group-hover:scale-105"
														} whitespace-nowrap`}
														style={{
															backfaceVisibility: "hidden",
															WebkitBackfaceVisibility: "hidden",
														}}
													>
														{t("track")} {departureRow.commercialTrack}
														{arrivalRow && (
															<i
																class="fa-solid fa-arrow-rotate-left ml-1.5 text-xs opacity-60"
																aria-hidden="true"
															/>
														)}
													</div>
													{/* Back face - Arrival Track */}
													<div
														class={`badge badge-lg font-semibold transition-all duration-200 ${
															trackChangeInfo.changedSide === "arrival" &&
															isTrackChanged
																? "badge-error badge-outline group-hover:bg-error/20 dark:group-hover:bg-error/30 group-hover:scale-105"
																: "badge-ghost group-hover:bg-base-200 dark:group-hover:bg-base-300 group-hover:scale-105"
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
																<i
																	class="fa-solid fa-arrow-right mr-1"
																	aria-hidden="true"
																/>
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

									{!hasDerivedActualDeparture &&
										minutesToDeparture !== null &&
										minutesToDeparture <= 30 &&
										minutesToDeparture >= 0 && (
											<div
												class={
													"badge badge-success badge-lg gap-2 font-semibold sm:h-8 sm:px-4"
												}
											>
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
					{showDebugInfo && debugState && (
						<div class="mt-3 w-full overflow-hidden rounded border border-dashed border-base-300 bg-base-200/40 p-2 text-xs font-mono text-base-content/70">
							{Object.entries(debugState).map(([label, value]) => (
								<div
									key={label}
									class="flex items-center justify-between gap-3"
								>
									<span class="font-semibold uppercase tracking-wide">
										{label}
									</span>
									<span class="text-right">{formatDebugValue(value)}</span>
								</div>
							))}
						</div>
					)}
					<div aria-live="polite" class="sr-only">
						{train.cancelled
							? t("cancelled")
							: departingSoon
								? t("departingSoon")
								: ""}
					</div>
				</div>
			</div>
		</div>
	);
}
