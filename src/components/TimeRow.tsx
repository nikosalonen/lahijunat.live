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
		departureRow.differenceInMinutes > 1,
	);

	const useArrivalLiveEstimate = Boolean(
		arrivalRow?.liveEstimateTime &&
		!isCancelled &&
		arrivalRow?.differenceInMinutes !== undefined &&
		(arrivalRow?.differenceInMinutes as number) > 1,
	);

	const displayedTime = useLiveEstimate
		? (departureRow.liveEstimateTime as string)
		: departureRow.scheduledTime;

	const arrivalDisplayedTime = useArrivalLiveEstimate
		? (arrivalRow?.liveEstimateTime as string)
		: arrivalRow?.scheduledTime;

	return (
			<span class="block w-full text-gray-600 dark:text-gray-300 text-base sm:text-lg whitespace-nowrap">
				{useLiveEstimate ? "~" : " "}
				<time datetime={displayedTime}>
					{formatTime(displayedTime)}
				</time>
				<span class="mx-1 sm:mx-2">→</span>
				{arrivalRow && (
					<>
						{useArrivalLiveEstimate && "~"}
						{arrivalDisplayedTime && formatTime(arrivalDisplayedTime)}
					</>
				)}
			</span>
	);
};

export default TimeRow;
