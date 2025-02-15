import { useCallback, useEffect, useState } from "preact/hooks";
import type { Train } from "../types";
import { fetchTrains } from "../utils/api";
import ProgressCircle from "./ProgressCircle";
import TrainCard from "./TrainCard";

interface Props {
	stationCode: string;
	destinationCode: string;
}

export default function TrainList({ stationCode, destinationCode }: Props) {
	const [trains, setTrains] = useState<Train[]>([]);
	const [loading, setLoading] = useState(true);
	const [initialLoad, setInitialLoad] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentTime, setCurrentTime] = useState(new Date());
	const [progress, setProgress] = useState(100);

	const loadTrains = useCallback(async () => {
		try {
			if (initialLoad) {
				setLoading(true);
			}
			setProgress(100);
			const trainData = await fetchTrains(stationCode, destinationCode);
			setTrains(trainData);
			setError(null);
		} catch (err) {
			setError("Failed to load train data");
			console.error(err);
		} finally {
			setLoading(false);
			setInitialLoad(false);
		}
	}, [stationCode, destinationCode, initialLoad]);

	useEffect(() => {
		loadTrains();

		const intervalId = setInterval(() => {
			loadTrains();
			setCurrentTime(new Date());
		}, 30000);

		const progressInterval = setInterval(() => {
			setProgress((prev) => Math.max(0, prev - 100 / 60));
		}, 1000);

		return () => {
			clearInterval(intervalId);
			clearInterval(progressInterval);
		};
	}, [loadTrains]);

	if (loading && initialLoad) {
		return (
			<div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto" />
		);
	}

	if (error) {
		return <div class="text-red-500 text-center p-4">{error}</div>;
	}

	return (
		<div class="max-w-4xl mx-auto space-y-6 px-0 sm:px-4">
			<div class="flex items-center justify-between px-2">
				<h2 class="text-2xl font-bold text-gray-800">
					Lähtevät junat {stationCode} → {destinationCode}
				</h2>
				<ProgressCircle progress={progress} />
			</div>
			<div class="grid gap-4 px-2">
				{trains.map((train) => (
					<TrainCard
						key={`${train.trainNumber}`}
						train={train}
						stationCode={stationCode}
						destinationCode={destinationCode}
						currentTime={currentTime}
					/>
				))}
			</div>
		</div>
	);
}
