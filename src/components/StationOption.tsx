/** @format */

import type { Station } from "../types";
import { hapticSelection } from "../utils/haptics";
import { getLocalizedStationName } from "../utils/stationNames";

function StationOption({
	station,
	index,
	isSelected,
	isHighlighted,
	onSelect,
}: {
	station: Station;
	index: number;
	isSelected: boolean;
	isHighlighted: boolean;
	onSelect: (station: Station) => void;
}) {
	// Rely on native keyboard activation for <button> elements

	return (
		<button
			type="button"
			id={`option-${index}`}
			onClick={() => {
				hapticSelection();
				onSelect(station);
			}}
			tabIndex={0}
			role="option"
			aria-selected={isSelected}
			class={`btn btn-ghost justify-start normal-case btn-block text-left text-lg sm:text-base min-h-[48px] station-option transition-colors duration-200 touch-manipulation select-none focus-ring ${
				isHighlighted ? "bg-blue-100 animate-scale-in" : ""
			}`}
		>
			{getLocalizedStationName(station.name, station.shortCode)} (
			{station.shortCode})
		</button>
	);
}

export default StationOption;
