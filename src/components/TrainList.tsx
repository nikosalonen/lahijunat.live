import { memo } from "preact/compat";
import { useCallback, useEffect, useState } from "preact/hooks";
import type { Train } from "../types";
import { fetchTrains } from "../utils/api";
import ProgressCircle from "./ProgressCircle";
import TrainCard from "./TrainCard";

interface Props {
	stationCode: string;
	destinationCode: string;
}

const MemoizedTrainCard = memo(TrainCard);

export default function TrainList({ stationCode, destinationCode }: Props) {
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
				error: "Failed to load train data",
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

		const intervalId = setInterval(() => {
			loadTrains();
			setCurrentTime(new Date());
		}, updateInterval);

		const progressInterval = setInterval(() => {
			setState((prev) => ({
				...prev,
				progress: Math.max(0, prev.progress - 100 / progressSteps),
			}));
		}, updateInterval / progressSteps);

		return () => {
			clearInterval(intervalId);
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

	return (
		<div>
			<div class="max-w-4xl mx-auto space-y-6 px-0 sm:px-4">
				<div class="flex items-center justify-between px-2">
					<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
						Lähtevät junat {stationCode} → {destinationCode}
					</h2>
					<ProgressCircle progress={state.progress} />
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
