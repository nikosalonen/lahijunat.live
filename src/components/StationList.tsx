import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import type { MutableRef } from "preact/hooks";
import { useLanguageChange } from '../hooks/useLanguageChange';
import type { Station } from "../types";
import { t } from "../utils/translations";
import StationOption from "./StationOption";

interface Props {
	stations: Station[];
	onStationSelect: (station: Station) => void;
	selectedValue?: string | null;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	inputRef?: MutableRef<HTMLInputElement | null>;
	isLoading?: boolean;
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
}: Props) {
	const [searchTerm, setSearchTerm] = useState("");
	const localInputRef = useRef<HTMLInputElement>(null);
	const finalInputRef = inputRef || localInputRef;

	useLanguageChange();

	const handleStationSelect = useCallback(
		(station: Station) => {
			onStationSelect(station);
			onOpenChange(false);
			setSearchTerm("");
			finalInputRef.current?.blur();
		},
		[onStationSelect, onOpenChange, finalInputRef],
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
				ref={finalInputRef}
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
				placeholder={t('placeholder')}
				className="w-full p-3 border border-gray-700 dark:text-white dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
			/>
			{isOpen && (
				<div class="absolute w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
					{isLoading ? (
						<div class="p-4 text-center text-gray-500 dark:text-gray-400">
							<div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400"></div>
							<p class="mt-2">{t('loading')}</p>
						</div>
					) : (
						filteredStations.map((station) => (
							<StationOption
								key={station.shortCode}
								station={station}
								isSelected={selectedStation?.shortCode === station.shortCode}
								onSelect={handleStationSelect}
							/>
						))
					)}
				</div>
			)}
		</div>
	);
}
