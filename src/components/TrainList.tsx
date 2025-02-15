import { useEffect, useState } from "preact/hooks";
import type { Train } from "../types";
import { fetchTrains } from "../utils/api";
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

	useEffect(() => {
		async function loadTrains() {
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
		}

		loadTrains();
		const interval = setInterval(loadTrains, 30000);

		const progressInterval = setInterval(() => {
			setProgress((prev) => Math.max(0, prev - 100 / 60));
		}, 1000);

		const timeInterval = setInterval(() => {
			setCurrentTime(new Date());
		}, 10000);

		return () => {
			clearInterval(interval);
			clearInterval(timeInterval);
			clearInterval(progressInterval);
		};
	}, [stationCode, destinationCode, initialLoad]);

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
				<div class="relative h-6 w-6">
					<svg class="transform -rotate-90 w-6 h-6" title="Progress indicator">
						<circle
							class="text-gray-200"
							stroke-width="2"
							stroke="currentColor"
							fill="transparent"
							r="10"
							cx="12"
							cy="12"
						/>
						<title>Seuraava lataus</title>
						<circle
							class="text-[#8c4799] transition-all duration-1000"
							stroke-width="4"
							stroke="currentColor"
							fill="transparent"
							r="10"
							cx="12"
							cy="12"
							style={{
								strokeDasharray: `${2 * Math.PI * 10}`,
								strokeDashoffset: `${2 * Math.PI * 10 * (progress / 100)}`,
							}}
						/>
					</svg>
				</div>
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
