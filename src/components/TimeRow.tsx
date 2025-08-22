import type { Train } from "../types";
import { formatTime } from "../utils/trainUtils";

const TimeRow = ({
	departureRow,
	arrivalRow,
	isCancelled,
}: {
	departureRow: Train["timeTableRows"][0];
	arrivalRow?: Train["timeTableRows"][0];
	isCancelled?: boolean;
}) => (
	<span class="text-gray-600 dark:text-gray-300 text-lg sm:text-lg whitespace-nowrap overflow-hidden text-ellipsis">
		{departureRow.liveEstimateTime &&
		!isCancelled &&
		departureRow.differenceInMinutes !== undefined &&
		departureRow.differenceInMinutes > 2
			? "~"
			: " "}
		<time datetime={(departureRow.liveEstimateTime && departureRow.differenceInMinutes !== undefined && departureRow.differenceInMinutes > 2) ? departureRow.liveEstimateTime : departureRow.scheduledTime}>
			{formatTime((departureRow.liveEstimateTime && departureRow.differenceInMinutes !== undefined && departureRow.differenceInMinutes > 2) ? departureRow.liveEstimateTime : departureRow.scheduledTime)}
		</time>
		<span class="mx-2">→</span>
		{arrivalRow && formatTime(arrivalRow.scheduledTime)}
	</span>
);

export default TimeRow;
