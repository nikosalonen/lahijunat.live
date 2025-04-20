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

	useEffect(() => {
		loadTrains();

		const updateInterval = 30000; // 30 seconds
		const progressSteps = 30;

		// Function to calculate time until next even second (:00 or :30)
		const getTimeUntilNextUpdate = () => {
			const now = new Date();
			const seconds = now.getSeconds();
			const milliseconds = now.getMilliseconds();
			const timeUntilNextHalfMinute = (30 - (seconds % 30)) * 1000 - milliseconds;
			return timeUntilNextHalfMinute;
		};

		// Initial timeout to align with next even second
		const initialTimeout = setTimeout(() => {
			loadTrains();
			// Then set up regular interval
			const intervalId = setInterval(() => {
				loadTrains();
			}, updateInterval);

			return () => clearInterval(intervalId);
		}, getTimeUntilNextUpdate());

		const progressInterval = setInterval(() => {
			setState((prev) => ({
				...prev,
				progress: Math.max(0, prev.progress - 100 / progressSteps),
			}));
		}, updateInterval / progressSteps);

		return () => {
			clearTimeout(initialTimeout);
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
				<div class="grid gap-4 px-2">
					{state.trains.map((train) => (
						<MemoizedTrainCard
							key={`${train.trainNumber}`}
							train={train}
							stationCode={stationCode}
							destinationCode={destinationCode}
							currentTime={currentTime}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
