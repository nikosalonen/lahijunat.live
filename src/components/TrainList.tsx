import { memo } from "preact/compat";
import { useCallback, useEffect, useState } from "preact/hooks";
import { useLanguageChange } from '../hooks/useLanguageChange';
import type { Station, Train } from "../types";
import { fetchTrains } from "../utils/api";
import { t } from "../utils/translations";
import ProgressCircle from "./ProgressCircle";
import TrainCard from "./TrainCard";

interface Props {
	stationCode: string;
	destinationCode: string;
	stations: Station[];
}

const MemoizedTrainCard = memo(TrainCard);
const INITIAL_TRAIN_COUNT = 15;

export default function TrainList({ stationCode, destinationCode, stations }: Props) {
	useLanguageChange();
	const [state, setState] = useState({
		trains: [] as Train[],
		loading: true,
		initialLoad: true,
		error: null as string | null,
		progress: 100,
	});
	const [currentTime, setCurrentTime] = useState(new Date());
	const [animationPhase, setAnimationPhase] = useState(0);
	const [displayedTrainCount, setDisplayedTrainCount] = useState(INITIAL_TRAIN_COUNT);

	const loadTrains = useCallback(async () => {
		try {
			if (state.initialLoad) {
				setState((prev) => ({ ...prev, loading: true }));
			}
			setState((prev) => ({ ...prev, progress: 100 }));

			const trainData = await fetchTrains(stationCode, destinationCode);
			setCurrentTime(new Date());
			setState((prev) => ({
				...prev,
				trains: trainData,
				error: null,
				loading: false,
				initialLoad: false,
			}));
		} catch (err) {
			setState((prev) => ({
				...prev,
				error: t('error'),
				loading: false,
				initialLoad: false,
			}));
			console.error(err);
		}
	}, [stationCode, destinationCode, state.initialLoad]);

	// Reset displayed count when stations change
	useEffect(() => {
		setDisplayedTrainCount(INITIAL_TRAIN_COUNT);
	}, [stationCode, destinationCode]);

	useEffect(() => {
		let startTime: number;
		let animationFrame: number;
		let updateTimeout: NodeJS.Timeout;
		let updateInterval: NodeJS.Timeout;

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
			const timeUntilNextHalfMinute = (30 - (seconds % 30)) * 1000 - milliseconds;
			return timeUntilNextHalfMinute;
		};

		// Initial data load
		loadTrains();

		// Schedule next update at the next even second
		updateTimeout = setTimeout(() => {
			loadTrains();
			// Then set up regular interval
			updateInterval = setInterval(() => {
				loadTrains();
			}, 30000); // 30 seconds
		}, getTimeUntilNextUpdate());

		// Progress bar update interval
		const progressInterval = setInterval(() => {
			setState((prev) => ({
				...prev,
				progress: Math.max(0, prev.progress - 100 / 30),
			}));
		}, 1000); // Update progress every second

		return () => {
			cancelAnimationFrame(animationFrame);
			clearTimeout(updateTimeout);
			clearInterval(updateInterval);
			clearInterval(progressInterval);
		};
	}, [loadTrains]);

	if (state.loading && state.initialLoad) {
		return (
			<div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 mx-auto" />
		);
	}

	if (state.error) {
		return (
			<div class="text-red-500 dark:text-red-400 text-center p-4">
				{state.error}
			</div>
		);
	}

	const fromStation = stations.find(s => s.shortCode === stationCode);
	const toStation = stations.find(s => s.shortCode === destinationCode);

	const displayedTrains = state.trains.slice(0, displayedTrainCount);
	const hasMoreTrains = state.trains.length > displayedTrainCount;

	return (
		<div>
			<div class="max-w-4xl mx-auto space-y-6 px-0 sm:px-4">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-2">
					<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 order-2 sm:order-1">
						{t('departingTrains')} <span class="sm:hidden">{stationCode} → {destinationCode}</span>
						<span class="hidden sm:inline">{fromStation?.name} → {toStation?.name}</span>
					</h2>
					<div class="self-end sm:self-auto order-1 sm:order-2">
						<ProgressCircle progress={state.progress} />
					</div>
				</div>
				<div class="grid gap-4 px-2" style={`--animation-phase: ${animationPhase}`}>
					{displayedTrains.map((train) => (
						<MemoizedTrainCard
							key={`${train.trainNumber}`}
							train={train}
							stationCode={stationCode}
							destinationCode={destinationCode}
							currentTime={currentTime}
						/>
					))}
				</div>
				{hasMoreTrains && (
					<div class="flex justify-center mt-4">
						<button
							onClick={() => setDisplayedTrainCount(prev => prev + INITIAL_TRAIN_COUNT)}
							class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
						>
							{t('showMore')}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
