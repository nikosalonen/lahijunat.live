import { useValueChanged } from "../hooks/useValueChanged";
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

	const departureTimeChanged = useValueChanged(displayedTime);
	const arrivalTimeChanged = useValueChanged(arrivalDisplayedTime);

	// Size and color come from the parent. Each time stays on one line, but
	// the arrival may wrap below the departure instead of being cut off.
	return (
		<span class="inline-flex flex-wrap items-center">
			<span class="whitespace-nowrap">
				{useLiveEstimate && <span aria-hidden="true">~</span>}
				<time
					key={displayedTime}
					datetime={displayedTime}
					class={departureTimeChanged ? "animate-time-update" : undefined}
				>
					{formatTime(displayedTime)}
				</time>
				{arrivalRow && (
					<svg
						class="inline-block w-3.5 h-3.5 sm:w-4 sm:h-4 mx-1.5 sm:mx-2 opacity-60 align-[-0.05em]"
						fill="currentColor"
						viewBox="0 0 448 512"
						aria-hidden="true"
					>
						<path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h306.7L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z" />
					</svg>
				)}
			</span>
			{arrivalRow && arrivalDisplayedTime && (
				<span class="whitespace-nowrap">
					{useArrivalLiveEstimate && <span aria-hidden="true">~</span>}
					<time
						key={arrivalDisplayedTime}
						datetime={arrivalDisplayedTime}
						class={arrivalTimeChanged ? "animate-time-update" : undefined}
					>
						{formatTime(arrivalDisplayedTime)}
					</time>
				</span>
			)}
		</span>
	);
};

export default TimeRow;
