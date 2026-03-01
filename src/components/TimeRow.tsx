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
		<span class="text-base-content/70 text-sm sm:text-xl whitespace-nowrap">
			{useLiveEstimate && <span aria-hidden="true">~</span>}
			<time datetime={displayedTime}>{formatTime(displayedTime)}</time>
			{arrivalRow && (
				<svg
					class="inline-block w-3 h-3 sm:w-4 sm:h-4 mx-1 sm:mx-2"
					fill="currentColor"
					viewBox="0 0 448 512"
					aria-hidden="true"
				>
					<path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h306.7L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z" />
				</svg>
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
