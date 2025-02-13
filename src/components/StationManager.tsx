// src/components/StationManager.tsx
import { useEffect, useState } from "preact/hooks";
import type { Station } from "../types";
import { fetchTrainsLeavingFromStation } from "../utils/api";
import StationList from "./StationList";
import TrainList from "./TrainList";

interface Props {
	stations: Station[];
}

const getStoredValue = (key: string): string | null => {
	if (typeof window !== "undefined") {
		return localStorage.getItem(key);
	}
	return null;
};

const setStoredValue = (key: string, value: string): void => {
	if (typeof window !== "undefined") {
		localStorage.setItem(key, value);
	}
};

export default function StationManager({ stations }: Props) {
	const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
	const [selectedDestination, setSelectedDestination] = useState<string | null>(
		null,
	);
	const [availableDestinations, setAvailableDestinations] =
		useState<Station[]>(stations);

	useEffect(() => {
		setSelectedOrigin(getStoredValue("selectedOrigin"));
		setSelectedDestination(getStoredValue("selectedDestination"));
	}, []);

	useEffect(() => {
		const fetchDestinations = async () => {
			if (selectedOrigin) {
				const destinations =
					await fetchTrainsLeavingFromStation(selectedOrigin);
				setAvailableDestinations(destinations);

				if (
					selectedDestination &&
					!destinations.some((s) => s.shortCode === selectedDestination)
				) {
					setSelectedDestination(null);
					localStorage.removeItem("selectedDestination");
				}
			} else {
				setAvailableDestinations(stations);
			}
		};

		fetchDestinations();
	}, [selectedOrigin, stations]);

	const handleOriginSelect = (station: Station) => {
		setSelectedOrigin(station.shortCode);
		setStoredValue("selectedOrigin", station.shortCode);
	};

	const handleDestinationSelect = (station: Station) => {
		setSelectedDestination(station.shortCode);
		setStoredValue("selectedDestination", station.shortCode);
	};

	const handleSwapStations = () => {
		const tempOrigin = selectedOrigin;
		setSelectedOrigin(selectedDestination);
		setSelectedDestination(tempOrigin);

		if (selectedOrigin) {
			setStoredValue("selectedDestination", selectedOrigin);
		}
		if (selectedDestination) {
			setStoredValue("selectedOrigin", selectedDestination);
		}
	};

	return (
		<div className="w-full max-w-2xl mx-auto p-2 sm:p-4">
			<div className="space-y-6">
				<div className="space-y-2">
					<h3 className="text-lg font-medium text-gray-900">Mistä</h3>
					<StationList
						stations={stations}
						onStationSelect={handleOriginSelect}
						selectedValue={selectedOrigin}
					/>
				</div>

				<button
					type="button"
					onClick={handleSwapStations}
					disabled={!selectedOrigin || !selectedDestination}
					className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50
            disabled:cursor-not-allowed transition-colors duration-200 rounded-lg
            text-gray-700 font-medium flex items-center justify-center gap-2"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="rotate-90"
						aria-labelledby="swapDirectionIcon"
					>
						<title id="swapDirectionIcon">Vaihda suuntaa</title>
						<polyline points="17 1 21 5 17 9" />
						<path d="M3 11V9a4 4 0 0 1 4-4h14" />
						<polyline points="7 23 3 19 7 15" />
						<path d="M21 13v2a4 4 0 0 1-4 4H3" />
					</svg>
					Käännä menosuunta
				</button>

				<div className="space-y-2">
					<h3 className="text-lg font-medium text-gray-900">Minne</h3>
					<StationList
						stations={availableDestinations}
						onStationSelect={handleDestinationSelect}
						selectedValue={selectedDestination}
					/>
				</div>

				{selectedOrigin && selectedDestination && (
					<TrainList
						stationCode={selectedOrigin}
						destinationCode={selectedDestination}
					/>
				)}
			</div>
		</div>
	);
}
