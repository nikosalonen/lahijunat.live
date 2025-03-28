import type { Station } from "../types";
import { t } from "../utils/translations";
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
			// biome-ignore lint/a11y/useSemanticElements: This is not inside a select element and option must be inside a select element
			role="option"
			aria-selected={isSelected}
			class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer dark:text-white"
		>
			{station.name} ({station.shortCode})
		</div>
	);
}

export default StationOption;
