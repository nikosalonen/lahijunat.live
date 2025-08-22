import type { Train } from "../types";
import { formatTime } from "../utils/trainUtils";

const TimeRow = ({
	departureRow,
	arrivalRow,
	isCancelled,
}:	{
	departureRow: Train["timeTableRows"][0];
	arrivalRow?: Train["timeTableRows"][0];
	isCancelled?: boolean;
}) => {
	const useLiveEstimate = Boolean(
		departureRow.liveEstimateTime &&
		!isCancelled &&
		departureRow.differenceInMinutes !== undefined &&
		departureRow.differenceInMinutes > 2,
	);

	const displayedTime = useLiveEstimate
		? (departureRow.liveEstimateTime as string)
		: departureRow.scheduledTime;

	return (
			<span class="text-gray-600 dark:text-gray-300 text-lg sm:text-lg whitespace-nowrap overflow-hidden text-ellipsis">
				{useLiveEstimate ? "~" : " "}
				<time datetime={displayedTime}>
					{formatTime(displayedTime)}
				</time>
				<span class="mx-2">→</span>
				{arrivalRow && formatTime(arrivalRow.scheduledTime)}
			</span>
	);
};

export default TimeRow;
