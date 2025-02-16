import type { Station } from "../types";

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

export default StationOption;
