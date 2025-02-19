import { useMemo } from "preact/hooks";
import type { Train } from "../types";

interface Props {
	train: Train;
	stationCode: string;
	destinationCode: string;
	currentTime: Date;
}

// Utility functions
const formatTime = (date: string) => {
	return new Date(date).toLocaleTimeString("fi-FI", {
		hour: "2-digit",
		minute: "2-digit",
	});
};

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
		return `${baseStyles} bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800`;
	if (minutesToDeparture !== null && minutesToDeparture < -1)
		return `${baseStyles} bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-30`;
	if (isDepartingSoon && !isCancelled)
		return `${baseStyles} border-gray-200 dark:border-gray-700 dark:bg-gray-950 ${
			isDepartingSoon ? "animate-soft-blink dark:animate-soft-blink-dark" : ""
		}`;
	return `${baseStyles} bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700`;
};

export default function TrainCard({
	train,
	stationCode,
	destinationCode,
	currentTime,
}: Props) {
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
		departureRow.scheduledTime,
		currentTime,
	);

	const departingSoon = isDepartingSoon(
		departureRow.liveEstimateTime ?? departureRow.scheduledTime,
	);

	const timeDifferenceMinutes = departureRow.differenceInMinutes ?? 0;

	const duration = arrivalRow?.scheduledTime
		? calculateDuration(departureRow.scheduledTime, arrivalRow.scheduledTime)
		: null;

	// Extract components for better readability
	const TimeDisplay = () => (
		<span class="text-lg font-medium text-gray-800 dark:text-gray-200 break-words min-w-0">
			{departureRow.liveEstimateTime && timeDifferenceMinutes > 0 ? (
				<span class="flex flex-col">
					<span class="mb-1 px-2 py-0.5 bg-[#fed100] text-black rounded text-sm self-start">
						+{timeDifferenceMinutes} min
					</span>
					<TimeRow />
				</span>
			) : (
				<TimeRow />
			)}
		</span>
	);

	const TimeRow = () => (
		<span class="whitespace-nowrap text-gray-600 dark:text-gray-500">
			{formatTime(departureRow.liveEstimateTime ?? departureRow.scheduledTime)}
			<span class="mx-2">→</span>
			{arrivalRow && formatTime(arrivalRow.scheduledTime)}
		</span>
	);

	return (
		<div
			class={`p-2 sm:p-4 ${getCardStyle(train.cancelled, minutesToDeparture, departingSoon)}`}
		>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4 flex-1">
					{/* Train identifier */}
					{train.commuterLineID && (
						<div
							class={`h-12 w-12 ${
								train.cancelled
									? "bg-[#dc0451] text-white"
									: "bg-[#8c4799] text-white"
							} rounded-full flex items-center justify-center text-lg font-medium`}
						>
							{train.commuterLineID}
						</div>
					)}

					{/* Warning triangle for cancelled trains */}
					{train.cancelled && (
						<div class="text-red-600" title="Juna peruttu">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="w-6 h-6"
								aria-label="Juna peruttu"
							>
								<title>Juna peruttu</title>
								<path
									fill-rule="evenodd"
									d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
					)}

					{/* Main train info */}
					<div class="space-y-1">
						<div class="flex flex-col gap-1">
							<div class="flex flex-col gap-2">
								<TimeDisplay />
								{duration && (
									<span class="text-sm text-gray-500 dark:text-gray-400 -mt-1">
										({duration.hours}h {duration.minutes}m)
									</span>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Track info and departure countdown */}
				<div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-w-[90px] text-right">
					<div class="top-4 right-4 flex flex-col items-end gap-1">
						{train.cancelled ? (
							<span class="px-2 py-0.5 bg-[#dc0451] text-white rounded text-sm">
								Peruttu
							</span>
						) : (
							<>
								<span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-sm">
									Raide {departureRow.commercialTrack}
								</span>
								{minutesToDeparture !== null &&
									minutesToDeparture <= 30 &&
									minutesToDeparture >= 0 && (
										<span
											class={`font-medium text-lg ${minutesToDeparture >= 0 ? "text-[#00985f] dark:text-[#00c77d]" : "text-gray-500 dark:text-gray-400"}`}
										>
											{minutesToDeparture} min
										</span>
									)}
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
