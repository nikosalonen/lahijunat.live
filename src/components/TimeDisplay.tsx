import type { Train } from "../types";
import TimeRow from "./TimeRow";

// The delay badge is not here but in the duration row (see DelayBadge), so a
// late train's card is as tall as an on-time one.
const TimeDisplay = ({
	departureRow,
	arrivalRow,
	isCancelled,
}: {
	departureRow: Train["timeTableRows"][0];
	arrivalRow?: Train["timeTableRows"][0];
	isCancelled?: boolean;
}) => {
	const rowIsCancelled = Boolean(isCancelled ?? departureRow.cancelled);

	return (
		<span
			class={`text-base min-[360px]:text-lg sm:text-xl font-semibold tabular-nums ${rowIsCancelled ? "line-through text-gray-500 dark:text-gray-300" : "text-gray-900 dark:text-gray-50"} min-w-0 flex items-center`}
		>
			<TimeRow
				departureRow={departureRow}
				arrivalRow={arrivalRow}
				isCancelled={rowIsCancelled}
			/>
		</span>
	);
};

export default TimeDisplay;
