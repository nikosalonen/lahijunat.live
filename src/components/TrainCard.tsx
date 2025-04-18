import { useEffect, useMemo, useState } from "preact/hooks";
import type { Train } from "../types";
import { t } from "../utils/translations";
import TimeDisplay from "./TimeDisplay";

interface Props {
	train: Train;
	stationCode: string;
	destinationCode: string;
	currentTime: Date;
}

const calculateDuration = (start: string, end: string) => {
	const durationMinutes = Math.round(
		(new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60),
	);
	return {
		hours: Math.floor(durationMinutes / 60),
		minutes: durationMinutes % 60,
	};
};

const formatMinutesToDeparture = (scheduledTime: string, currentTime: Date) => {
	const departure = new Date(scheduledTime);
	const diffMinutes = Math.round(
		(departure.getTime() - currentTime.getTime()) / (1000 * 60),
	);
	return diffMinutes;
};

const isDepartingSoon = (scheduledTime: string) => {
	const departure = new Date(scheduledTime);
	const now = new Date();
	const diffMinutes = (departure.getTime() - now.getTime()) / (1000 * 60);
	return diffMinutes >= 0 && diffMinutes <= 5;
};

const getCardStyle = (
	isCancelled: boolean,
	minutesToDeparture: number | null,
	isDepartingSoon: boolean,
) => {
	const baseStyles =
		"border rounded-lg shadow-sm transition-all hover:shadow-md relative";

	if (isCancelled)
		return `${baseStyles} bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800`;
	if (minutesToDeparture !== null && minutesToDeparture < -1)
		return `${baseStyles} bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-50`;
	if (isDepartingSoon && !isCancelled)
		return `${baseStyles} border-gray-300 dark:border-gray-600 dark:bg-gray-950 ${
			isDepartingSoon ? "animate-soft-blink dark:animate-soft-blink-dark" : ""
		}`;
	return `${baseStyles} bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600`;
};

export default function TrainCard({
	train,
	stationCode,
	destinationCode,
	currentTime,
}: Props) {
	// Add state to force re-render on language change
	const [, setLanguageChange] = useState(0);

	useEffect(() => {
		const handleLanguageChange = () => {
			setLanguageChange(prev => prev + 1);
		};

		window.addEventListener('languagechange', handleLanguageChange);
		return () => window.removeEventListener('languagechange', handleLanguageChange);
	}, []);

	// Memoize row lookups since they're used multiple times
	const departureRow = useMemo(
		() =>
			train.timeTableRows.find(
				(row) =>
					row.stationShortCode === stationCode && row.type === "DEPARTURE",
			),
		[train.timeTableRows, stationCode],
	);

	const arrivalRow = useMemo(
		() =>
			train.timeTableRows.find(
				(row) =>
					row.stationShortCode === destinationCode && row.type === "ARRIVAL",
			),
		[train.timeTableRows, destinationCode],
	);

	if (!departureRow) return null;

	const minutesToDeparture = formatMinutesToDeparture(
		departureRow.liveEstimateTime ?? departureRow.scheduledTime,
		currentTime,
	);

	const departingSoon = isDepartingSoon(
		departureRow.liveEstimateTime ?? departureRow.scheduledTime,
	);

	const timeDifferenceMinutes = departureRow.differenceInMinutes ?? 0;

	const arrivalTime = arrivalRow?.liveEstimateTime ?? arrivalRow?.scheduledTime;
	const duration = arrivalTime
		? calculateDuration(
				departureRow.actualTime ?? departureRow.scheduledTime,
				arrivalTime,
			)
		: null;

	return (
		<article
			class={`p-2 sm:p-4 ${getCardStyle(train.cancelled, minutesToDeparture, departingSoon)}`}
			aria-label={`${t('train')} ${train.commuterLineID || ""} ${train.cancelled ? t('cancelled') : ""}`}
		>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4 flex-1 min-w-0">
					{/* Train identifier */}
					{train.commuterLineID && (
						<div
							class={`flex-shrink-0 h-12 w-12 ${
								train.cancelled
									? "bg-[#d4004d] text-white"
									: "bg-[#6b2c75] text-white"
							} rounded-full flex items-center justify-center text-xl font-bold`}
						>
							{train.commuterLineID}
						</div>
					)}

					{/* Main train info */}
					<div class="space-y-2 min-w-0 flex-1">
						<div class="flex flex-col gap-1">
							<div class="flex flex-col gap-2">
								<TimeDisplay
									departureRow={departureRow}
									arrivalRow={arrivalRow}
									timeDifferenceMinutes={timeDifferenceMinutes}
								/>
								{duration && (
									<span
										class="text-sm text-gray-500 dark:text-gray-400"
										aria-label={`${t('duration')} ${duration.hours} ${t('hours')} ${duration.minutes} ${t('minutes')}`}
									>
										<svg class="w-4 h-4 inline-block mr-1 -mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										{duration.hours}h {duration.minutes}m
									</span>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Track info and departure countdown */}
				<div class="flex items-end flex-col text-sm text-gray-600 dark:text-gray-400 ml-4 flex-shrink-0">
					{train.cancelled ? (
						<span class="px-3 py-1 bg-[#d4004d] text-white rounded-md text-sm font-medium shadow-sm">
							{t('cancelled')}
						</span>
					) : (
						<>
							<output
								aria-label={`${t('track')} ${departureRow.commercialTrack}`}
								class="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium shadow-sm"
							>
								{t('track')} {departureRow.commercialTrack}
							</output>
							{minutesToDeparture !== null &&
								minutesToDeparture <= 30 &&
								minutesToDeparture >= 0 && (
									<span
										class={`font-medium text-lg mt-2 ${
											minutesToDeparture >= 0
												? "text-[#007549] dark:text-[#00e38f]"
												: "text-gray-600 dark:text-gray-400"
										}`}
									>
										<svg class="w-5 h-5 inline-block mr-1 -mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l2 2" />
											<circle cx="12" cy="12" r="9" stroke-width="2" fill="none" />
										</svg>
										{minutesToDeparture} min
									</span>
								)}
						</>
					)}
				</div>
			</div>
			<div aria-live="polite" class="sr-only">
				{train.cancelled
					? t('cancelled')
					: departingSoon
						? t('departingSoon')
						: ""}
			</div>
		</article>
	);
}
