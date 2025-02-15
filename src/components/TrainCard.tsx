import type { Train } from "../types";

interface Props {
	train: Train;
	stationCode: string;
	destinationCode: string;
	currentTime: Date;
}

// Utility functions
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
	const minutesToDeparture = departureRow
		? formatMinutesToDeparture(departureRow.scheduledTime, currentTime)
		: null;
	const departingSoon =
		departureRow && isDepartingSoon(departureRow.scheduledTime);
	return (
		<div
			class={`p-2 sm:p-4 border rounded-lg shadow-sm transition-all hover:shadow-md relative
            ${
							train.cancelled
								? "bg-red-50 border-red-200"
								: minutesToDeparture !== null && minutesToDeparture < -1
									? "bg-gray-100 border-gray-300 opacity-60"
									: departingSoon && !train.cancelled
										? "bg-white border-gray-200 animate-soft-blink"
										: "bg-white border-gray-200"
						}`}
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
						{/* Time information */}
						{train.timeTableRows.map((row) => {
							if (
								row.stationShortCode === stationCode &&
								row.type === "DEPARTURE"
							) {
								const departureTime = new Date(
									row.scheduledTime,
								).toLocaleTimeString("fi-FI", {
									hour: "2-digit",
									minute: "2-digit",
								});

								const liveTime = row.liveEstimateTime
									? new Date(row.liveEstimateTime).toLocaleTimeString("fi-FI", {
											hour: "2-digit",
											minute: "2-digit",
										})
									: null;

								const timeDifferenceMinutes = row.liveEstimateTime
									? Math.round(
											(new Date(row.liveEstimateTime).getTime() -
												new Date(row.scheduledTime).getTime()) /
												(1000 * 60),
										)
									: 0;

								const arrivalRow = train.timeTableRows.find(
									(r) =>
										r.stationShortCode === destinationCode &&
										r.type === "ARRIVAL",
								);
								const arrivalTime = arrivalRow?.scheduledTime;
								const arrivalLiveTime = arrivalRow?.liveEstimateTime;
								const arrivalTimeDifferenceMinutes = arrivalLiveTime
									? Math.round(
											(new Date(arrivalLiveTime).getTime() -
												new Date(arrivalRow.scheduledTime).getTime()) /
												(1000 * 60),
										)
									: 0;
								const duration = arrivalTime
									? Math.round(
											(new Date(arrivalTime).getTime() -
												new Date(row.scheduledTime).getTime()) /
												(1000 * 60),
										)
									: null;

								return (
									<div class="flex flex-col gap-1" key={row.scheduledTime}>
										<div class="flex flex-col sm:flex-row sm:items-center gap-2">
											<span class="text-lg font-medium text-gray-800 break-words min-w-0">
												{liveTime && timeDifferenceMinutes > 0 ? (
													<span class="inline-flex flex-wrap items-center">
														<span>{departureTime}</span>
														<span class="ml-1 px-1.5 py-0.5 bg-[#fed100] text-black text-sm rounded">
															+{timeDifferenceMinutes} min
														</span>
													</span>
												) : (
													departureTime
												)}
												<span class="mx-2 text-gray-400">→</span>
												{arrivalTime &&
													(arrivalLiveTime &&
													arrivalTimeDifferenceMinutes > 1 ? (
														<span class="inline-flex flex-wrap items-center">
															<span class="line-through">
																{new Date(arrivalTime).toLocaleTimeString(
																	"fi-FI",
																	{
																		hour: "2-digit",
																		minute: "2-digit",
																	},
																)}
															</span>
															<span class="text-orange-500 ml-1">
																(
																{new Date(arrivalLiveTime).toLocaleTimeString(
																	"fi-FI",
																	{
																		hour: "2-digit",
																		minute: "2-digit",
																	},
																)}
																)
															</span>
														</span>
													) : (
														new Date(arrivalTime).toLocaleTimeString("fi-FI", {
															hour: "2-digit",
															minute: "2-digit",
														})
													))}
											</span>
											{duration && (
												<span class="text-sm text-gray-500 -mt-1 sm:mt-0">
													({Math.floor(duration / 60)}h {duration % 60}
													m)
												</span>
											)}
										</div>
									</div>
								);
							}
							return null;
						})}
					</div>
				</div>

				<div class="flex items-center gap-2 text-sm text-gray-600 min-w-[90px] text-right">
					{/* Track info or Cancelled status */}
					{train.timeTableRows.map((row) => {
						if (
							row.stationShortCode === stationCode &&
							row.type === "DEPARTURE"
						) {
							return (
								<div
									key={row.scheduledTime}
									class="top-4 right-4 flex flex-col items-end gap-1"
								>
									{train.cancelled ? (
										<span class="px-2 py-0.5 bg-[#dc0451] text-white rounded text-sm">
											Peruttu
										</span>
									) : (
										<>
											<span class="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-sm">
												Raide {row.commercialTrack}
											</span>
											{/* Departure countdown */}
											{departureRow &&
												formatMinutesToDeparture(
													departureRow.scheduledTime,
													currentTime,
												) <= 30 &&
												formatMinutesToDeparture(
													departureRow.scheduledTime,
													currentTime,
												) >= 0 && (
													<span
														class={`font-medium text-lg ${
															formatMinutesToDeparture(
																departureRow.scheduledTime,
																currentTime,
															) >= 0
																? "text-[#00985f]"
																: "text-gray-500"
														}`}
													>
														{formatMinutesToDeparture(
															departureRow.scheduledTime,
															currentTime,
														)}{" "}
														min
													</span>
												)}
										</>
									)}
								</div>
							);
						}
						return null;
					})}
				</div>
			</div>
		</div>
	);
}
