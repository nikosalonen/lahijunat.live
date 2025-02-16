import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { Station } from "../types";

interface Props {
	stations: Station[];
	onStationSelect: (station: Station) => void;
	selectedValue?: string | null;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}

const CONTAINER_CLASS = "station-list-container";

function StationOption({
	station,
	isSelected,
	onSelect,
}: {
	station: Station;
	isSelected: boolean;
	onSelect: (station: Station) => void;
}) {
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			onSelect(station);
		}
	};

	return (
		<div
			key={station.shortCode}
			onClick={() => onSelect(station)}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			// biome-ignore lint/a11y/useSemanticElements: <explanation>
			role="option"
			aria-selected={isSelected}
			class="p-2 hover:bg-gray-100 cursor-pointer"
		>
			{station.name} ({station.shortCode})
		</div>
	);
}

export default function StationList({
	stations,
	onStationSelect,
	selectedValue,
	isOpen,
	onOpenChange,
}: Props) {
	const [searchTerm, setSearchTerm] = useState("");

	const handleStationSelect = useCallback(
		(station: Station) => {
			onStationSelect(station);
			onOpenChange(false);
			setSearchTerm("");
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
		<div class="w-full max-w-xs mx-auto p-4">
			<div class={`relative ${CONTAINER_CLASS}`}>
				<input
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
					class="w-full p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				{isOpen && (
					<div class="absolute w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
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
		</div>
	);
}
