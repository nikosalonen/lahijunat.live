/** @format */

import type { MutableRef } from "preact/hooks";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station } from "../types";
import { hapticSelection } from "../utils/haptics";
import { t } from "../utils/translations";
import StationListSkeleton from "./StationListSkeleton";
import StationOption from "./StationOption";

interface Props {
	stations: Station[];
	onStationSelect: (station: Station) => void;
	selectedValue?: string | null;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	inputRef?: MutableRef<HTMLInputElement | null>;
	isLoading?: boolean;
	onFocus?: () => void;
}

const CONTAINER_CLASS = "station-list-container";

export default function StationList({
	stations,
	onStationSelect,
	selectedValue,
	isOpen,
	onOpenChange,
	inputRef,
	isLoading = false,
	onFocus,
}: Props) {
	const [searchTerm, setSearchTerm] = useState("");
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const localInputRef = useRef<HTMLInputElement>(null);
	const finalInputRef = inputRef || localInputRef;
	const listboxRef = useRef<HTMLDivElement>(null);

	useLanguageChange();

	const handleStationSelect = useCallback(
		(station: Station) => {
			hapticSelection();
			onStationSelect(station);
			onOpenChange(false);
			setSearchTerm("");
			setHighlightedIndex(-1);
			finalInputRef.current?.blur();
		},
		[onStationSelect, onOpenChange, finalInputRef],
	);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			const container = target.closest(`.${CONTAINER_CLASS}`);
			const isInput = target.tagName === "INPUT";

			// Only close if clicking outside and not on the input
			if (!container && !isInput) {
				onOpenChange(false);
				setSearchTerm("");
				setHighlightedIndex(-1);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [onOpenChange]);

	const handleInputClick = (e: MouseEvent) => {
		// Prevent the click outside handler from immediately closing
		e.stopPropagation();
		onOpenChange(true);
		setSearchTerm("");
		setHighlightedIndex(-1);
		onFocus?.();
	};

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

	// Reset highlighted index when filtering changes
	useEffect(() => {
		setHighlightedIndex(-1);
	}, [filteredStations]);

	const handleKeyDown = (e: KeyboardEvent) => {
		if (!isOpen) {
			if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
				e.preventDefault();
				onOpenChange(true);
				setSearchTerm("");
				setHighlightedIndex(-1);
				onFocus?.();
			}
			return;
		}

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setHighlightedIndex((prev) =>
					prev < filteredStations.length - 1 ? prev + 1 : 0,
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setHighlightedIndex((prev) =>
					prev > 0 ? prev - 1 : filteredStations.length - 1,
				);
				break;
			case "Enter":
				e.preventDefault();
				if (highlightedIndex >= 0 && filteredStations[highlightedIndex]) {
					handleStationSelect(filteredStations[highlightedIndex]);
				} else if (filteredStations.length === 1 && highlightedIndex === -1) {
					handleStationSelect(filteredStations[0]);
				}
				break;
			case "Escape":
				e.preventDefault();
				onOpenChange(false);
				setSearchTerm("");
				setHighlightedIndex(-1);
				break;
			case "Tab":
				onOpenChange(false);
				setSearchTerm("");
				setHighlightedIndex(-1);
				break;
		}
	};

	const highlightedStation =
		highlightedIndex >= 0 && filteredStations[highlightedIndex]
			? filteredStations[highlightedIndex]
			: null;

	return (
		<div className="relative station-list-container">
			<input
				ref={finalInputRef}
				type="text"
				role="combobox"
				aria-expanded={isOpen}
				aria-autocomplete="list"
				aria-activedescendant={
					highlightedStation ? `option-${highlightedIndex}` : undefined
				}
				aria-controls={isOpen ? "station-listbox" : undefined}
				value={
					isOpen
						? searchTerm
						: selectedStation
							? `${selectedStation.name} (${selectedStation.shortCode})`
							: ""
				}
				onClick={handleInputClick}
				onFocus={() => {
					onOpenChange(true);
					setSearchTerm("");
					setHighlightedIndex(-1);
					onFocus?.();
				}}
				onInput={(e) => {
					setSearchTerm(e.currentTarget.value);
					if (!isOpen) {
						onOpenChange(true);
					}
				}}
				onKeyDown={handleKeyDown}
				placeholder={t("placeholder")}
				className="w-full h-12 px-4 glass-card dark:text-white focus-ring rounded-xl transition-all duration-300 touch-manipulation text-lg sm:text-base hover-lift shadow-lg border-gray-300 dark:border-gray-700"
			/>
			{(isOpen || isLoading) && (
				<div
					ref={listboxRef}
					id="station-listbox"
					data-testid="station-listbox"
					class="absolute w-full mt-2 glass-card border border-gray-300 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 animate-slide-down backdrop-blur-md"
					style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
				>
					{isLoading ? (
						<StationListSkeleton />
					) : (
						filteredStations.map((station, index) => (
							<StationOption
								key={station.shortCode}
								station={station}
								index={index}
								isSelected={selectedStation?.shortCode === station.shortCode}
								isHighlighted={index === highlightedIndex}
								onSelect={handleStationSelect}
							/>
						))
					)}
				</div>
			)}
		</div>
	);
}
