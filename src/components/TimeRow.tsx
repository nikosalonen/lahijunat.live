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
}) => {
	const rowIsCancelled = Boolean(isCancelled ?? departureRow.cancelled);
	const useLiveEstimate = Boolean(
		departureRow.liveEstimateTime &&
			!rowIsCancelled &&
			departureRow.differenceInMinutes !== undefined &&
			departureRow.differenceInMinutes > 1,
	);

	const useArrivalLiveEstimate = Boolean(
		arrivalRow?.liveEstimateTime &&
			!rowIsCancelled &&
			!arrivalRow?.cancelled &&
			arrivalRow?.differenceInMinutes !== undefined &&
			arrivalRow.differenceInMinutes > 1,
	);

	const displayedTime = useLiveEstimate
		? (departureRow.liveEstimateTime as string)
		: departureRow.scheduledTime;

	const arrivalDisplayedTime = useArrivalLiveEstimate
		? (arrivalRow?.liveEstimateTime as string)
		: arrivalRow?.scheduledTime;

	return (
		<span class="block w-full text-base-content/70 text-base sm:text-lg">
			{useLiveEstimate && <span aria-hidden="true">~</span>}
			<time datetime={displayedTime}>{formatTime(displayedTime)}</time>
			{arrivalRow && (
				<i class="fa-solid fa-arrow-right mx-1 sm:mx-2" aria-hidden="true" />
			)}
			{arrivalRow && arrivalDisplayedTime && (
				<>
					{useArrivalLiveEstimate && <span aria-hidden="true">~</span>}
					<time datetime={arrivalDisplayedTime}>
						{formatTime(arrivalDisplayedTime)}
					</time>
				</>
			)}
		</span>
	);
};

export default TimeRow;
