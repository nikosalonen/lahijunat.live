import { useMemo } from "preact/hooks";
import type { Train } from "../types";
import TimeDisplay from "./TimeDisplay";

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
			aria-label={`Juna ${train.commuterLineID || ""} ${train.cancelled ? "peruttu" : ""}`}
		>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4 flex-1">
					{/* Train identifier */}
					{train.commuterLineID && (
						<div
							class={`h-12 w-12 ${
								train.cancelled
									? "bg-[#d4004d] text-white"
									: "bg-[#6b2c75] text-white"
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
								<TimeDisplay
									departureRow={departureRow}
									arrivalRow={arrivalRow}
									timeDifferenceMinutes={timeDifferenceMinutes}
								/>
								{duration && (
									<span
										class="text-sm text-gray-500 dark:text-gray-400 -mt-1"
										aria-label={`Matkan kesto ${duration.hours} tuntia ${duration.minutes} minuuttia`}
									>
										({duration.hours}h {duration.minutes}m)
									</span>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Track info and departure countdown */}
				<div class="flex items-end flex-col text-sm text-gray-600 dark:text-gray-400 min-w-[90px]">
					{train.cancelled ? (
						<span class="px-2 py-0.5 bg-[#d4004d] text-white rounded text-sm">
							Peruttu
						</span>
					) : (
						<>
							<output
								aria-label={`Raide ${departureRow.commercialTrack}`}
								class="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-sm"
							>
								Raide {departureRow.commercialTrack}
							</output>
							{minutesToDeparture !== null &&
								minutesToDeparture <= 30 &&
								minutesToDeparture >= 0 && (
									<span
										class={`font-medium text-lg mt-1 ${minutesToDeparture >= 0 ? "text-[#007549] dark:text-[#00e38f]" : "text-gray-600 dark:text-gray-400"}`}
									>
										{minutesToDeparture} min
									</span>
								)}
						</>
					)}
				</div>
			</div>
			<div aria-live="polite" class="sr-only">
				{train.cancelled
					? "Juna peruttu"
					: departingSoon
						? "Juna lähtee pian"
						: ""}
			</div>
		</article>
	);
}
