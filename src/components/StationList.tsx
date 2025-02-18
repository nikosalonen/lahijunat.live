import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import type { Station } from "../types";
import StationOption from "./StationOption";

interface Props {
	stations: Station[];
	onStationSelect: (station: Station) => void;
	selectedValue?: string | null;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}

const CONTAINER_CLASS = "station-list-container";

export default function StationList({
	stations,
	onStationSelect,
	selectedValue,
	isOpen,
	onOpenChange,
}: Props) {
	const [searchTerm, setSearchTerm] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const handleStationSelect = useCallback(
		(station: Station) => {
			onStationSelect(station);
			onOpenChange(false);
			setSearchTerm("");
			inputRef.current?.blur();
		},
		[onStationSelect, onOpenChange],
	);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest(`.${CONTAINER_CLASS}`)) {
				onOpenChange(false);
				setSearchTerm("");
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [onOpenChange]);

	const filteredStations = useMemo(() => {
		const search = searchTerm.toLowerCase();
		return stations.filter(
			(station) =>
				station.name.toLowerCase().includes(search) ||
				station.shortCode.toLowerCase().includes(search),
		);
	}, [stations, searchTerm]);

	const selectedStation = useMemo(
		() => stations.find((s) => s.shortCode === selectedValue),
		[stations, selectedValue],
	);

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && filteredStations.length === 1) {
			handleStationSelect(filteredStations[0]);
		}
	};

	return (
		<div className="relative station-list-container">
			<input
				ref={inputRef}
				type="text"
				value={
					isOpen
						? searchTerm
						: selectedStation
							? `${selectedStation.name} (${selectedStation.shortCode})`
							: ""
				}
				onFocus={() => {
					onOpenChange(true);
					setSearchTerm("");
				}}
				onInput={(e) => setSearchTerm(e.currentTarget.value)}
				onKeyDown={handleKeyDown}
				placeholder="Valitse asema..."
				className="w-full p-3 border border-gray-700 dark:text-white dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
			/>
			{isOpen && (
				<div class="absolute w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
					{filteredStations.map((station) => (
						<StationOption
							key={station.shortCode}
							station={station}
							isSelected={selectedStation?.shortCode === station.shortCode}
							onSelect={handleStationSelect}
						/>
					))}
				</div>
			)}
		</div>
	);
}
