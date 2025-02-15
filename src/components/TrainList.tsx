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

	useEffect(() => {
		async function loadTrains() {
			try {
				// Only show loading spinner on initial load
				if (initialLoad) {
					setLoading(true);
				}

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
		// Refresh data every minute
		const interval = setInterval(loadTrains, 60000);

		// Update current time every 10 seconds
		const timeInterval = setInterval(() => {
			setCurrentTime(new Date());
		}, 10000);

		return () => {
			clearInterval(interval);
			clearInterval(timeInterval);
		};
	}, [stationCode, destinationCode, initialLoad]);

	// Only show loading spinner on initial load
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
			<h2 class="text-2xl font-bold text-gray-800 mb-6 px-2">
				Lähtevät junat {stationCode} → {destinationCode}
			</h2>
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
