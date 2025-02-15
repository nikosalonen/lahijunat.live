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
	return diffMinutes >= -1 && diffMinutes <= 5;
};

export default function TrainCard({
	train,
	stationCode,
	destinationCode,
	currentTime,
}: Props) {
	const departureRow = train.timeTableRows.find(
		(row) => row.stationShortCode === stationCode && row.type === "DEPARTURE",
	);
	const arrivalRow = train.timeTableRows.find(
		(row) => row.stationShortCode === destinationCode && row.type === "ARRIVAL",
	);

	const minutesToDeparture = departureRow
		? formatMinutesToDeparture(departureRow.scheduledTime, currentTime)
		: null;
	const departingSoon =
		departureRow && isDepartingSoon(departureRow.scheduledTime);

	const getCardStyle = () => {
		if (train.cancelled) return "bg-red-50 border-red-200";
		if (minutesToDeparture !== null && minutesToDeparture < -1)
			return "bg-gray-100 border-gray-300 opacity-60";
		if (departingSoon && !train.cancelled)
			return "bg-white border-gray-200 animate-soft-blink";
		return "bg-white border-gray-200";
	};

	if (!departureRow) return null;

	const timeDifferenceMinutes = departureRow.liveEstimateTime
		? Math.round(
				(new Date(departureRow.liveEstimateTime).getTime() -
					new Date(departureRow.scheduledTime).getTime()) /
					(1000 * 60),
			)
		: 0;

	const duration = arrivalRow?.scheduledTime
		? calculateDuration(departureRow.scheduledTime, arrivalRow.scheduledTime)
		: null;

	return (
		<div
			class={`p-2 sm:p-4 border rounded-lg shadow-sm transition-all hover:shadow-md relative ${getCardStyle()}`}
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
							<div class="flex flex-col sm:flex-row sm:items-center gap-2">
								<span class="text-lg font-medium text-gray-800 break-words min-w-0">
									{departureRow.liveEstimateTime &&
									timeDifferenceMinutes > 0 ? (
										<span class="inline-flex flex-wrap items-center">
											<span>{formatTime(departureRow.scheduledTime)}</span>
											<span class="ml-1 px-1.5 py-0.5 bg-[#fed100] text-black text-sm rounded">
												+{timeDifferenceMinutes} min
											</span>
										</span>
									) : (
										formatTime(departureRow.scheduledTime)
									)}
									<span class="mx-2 text-gray-400">→</span>
									{arrivalRow &&
										formatTime(
											arrivalRow.liveEstimateTime || arrivalRow.scheduledTime,
										)}
								</span>
								{duration && (
									<span class="text-sm text-gray-500 -mt-1 sm:mt-0">
										({duration.hours}h {duration.minutes}m)
									</span>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Track info and departure countdown */}
				<div class="flex items-center gap-2 text-sm text-gray-600 min-w-[90px] text-right">
					<div class="top-4 right-4 flex flex-col items-end gap-1">
						{train.cancelled ? (
							<span class="px-2 py-0.5 bg-[#dc0451] text-white rounded text-sm">
								Peruttu
							</span>
						) : (
							<>
								<span class="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-sm">
									Raide {departureRow.commercialTrack}
								</span>
								{minutesToDeparture !== null &&
									minutesToDeparture <= 30 &&
									minutesToDeparture >= 0 && (
										<span
											class={`font-medium text-lg ${minutesToDeparture >= 0 ? "text-[#00985f]" : "text-gray-500"}`}
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
