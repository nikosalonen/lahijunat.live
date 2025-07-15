import type { Station } from "../types";

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
			onClick={() => onSelect(station)}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			/* biome-ignore lint/a11y/useSemanticElements: This is a custom combobox implementation */
			role="option"
			aria-selected={isSelected}
			class={`w-full text-left p-3 hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600 cursor-pointer dark:text-white transition-all duration-150 touch-manipulation select-none ${
				isHighlighted ? "bg-blue-100 dark:bg-blue-700" : ""
			}`}
		>
			{station.name} ({station.shortCode})
		</button>
	);
}

export default StationOption;
