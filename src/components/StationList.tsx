import { useEffect, useState } from "preact/hooks";
import type { Station } from "../types";

interface Props {
	stations: Station[];
	onStationSelect: (station: Station) => void;
	selectedValue?: string | null;
}

export default function StationList({
	stations,
	onStationSelect,
	selectedValue,
}: Props) {
	const [searchTerm, setSearchTerm] = useState("");
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest(".station-list-container")) {
				setIsOpen(false);
				setSearchTerm("");
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const filteredStations = stations.filter((station) => {
		const search = searchTerm.toLowerCase();
		return (
			station.name.toLowerCase().includes(search) ||
			station.shortCode.toLowerCase().includes(search)
		);
	});

	const selectedStation = stations.find((s) => s.shortCode === selectedValue);

	return (
		<div class="w-full max-w-xs mx-auto p-4">
			<div class="relative station-list-container">
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
						setIsOpen(true);
						setSearchTerm("");
					}}
					onInput={(e) => setSearchTerm(e.currentTarget.value)}
					placeholder="Valitse asema..."
					class="w-full p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				{isOpen && (
					<div
						class="absolute w-full mt-1 max-h-60 overflow-auto border rounded-lg bg-white shadow-lg z-50"
						onTouchMove={(e) => e.stopPropagation()}
					>
						{filteredStations.map((station) => (
							<option
								key={station.shortCode}
								onClick={() => {
									onStationSelect(station);
									setIsOpen(false);
									setSearchTerm("");
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										onStationSelect(station);
										setIsOpen(false);
										setSearchTerm("");
									}
								}}
								tabIndex={0}
								class="p-2 hover:bg-gray-100 cursor-pointer"
							>
								{station.name} ({station.shortCode})
							</option>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
