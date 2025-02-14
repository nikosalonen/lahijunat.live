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
	return (
		<div class="w-full max-w-xs mx-auto p-4">
			<select
				value={selectedValue || ""}
				onChange={(e) => {
					const station = stations.find(
						(s) => s.shortCode === e.currentTarget.value,
					);
					if (station) onStationSelect(station);
				}}
				class="w-full p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="">Select a station...</option>
				{stations.map((station) => (
					<option key={station.shortCode} value={station.shortCode}>
						{station.name} ({station.shortCode})
					</option>
				))}
			</select>
		</div>
	);
}
