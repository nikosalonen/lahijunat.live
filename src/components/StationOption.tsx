/** @format */

import type { Station } from "../types";
import { hapticSelection } from "../utils/haptics";

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
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			onSelect(station);
		}
	};

	return (
		<button
			type="button"
			id={`option-${index}`}
			onClick={() => {
				hapticSelection();
				onSelect(station);
			}}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			role="option"
			aria-selected={isSelected}
			class={`w-full text-left p-4 sm:p-3 text-lg sm:text-base min-h-[48px] station-option cursor-pointer dark:text-white transition-colors duration-200 touch-manipulation select-none focus-ring ${
				isHighlighted ? "bg-blue-100 dark:bg-blue-700 animate-scale-in" : ""
			}`}
		>
			{station.name} ({station.shortCode})
		</button>
	);
}

export default StationOption;
