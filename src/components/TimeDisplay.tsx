import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Train } from "../types";
import { t } from "../utils/translations";
import TimeRow from "./TimeRow";

// Memoize TimeDisplay
const TimeDisplay = ({
	departureRow,
	arrivalRow,
	timeDifferenceMinutes,
	isCancelled,
}: {
	departureRow: Train["timeTableRows"][0];
	arrivalRow?: Train["timeTableRows"][0];
	timeDifferenceMinutes: number;
	isCancelled?: boolean;
}) => {
	useLanguageChange();
	const rowIsCancelled = Boolean(isCancelled ?? departureRow.cancelled);
	const hasUnknownDelay = Boolean(departureRow.unknownDelay);

	// Show delay badge conditions
	const showUnknownDelay = hasUnknownDelay && !rowIsCancelled;
	const showSpecificDelay =
		departureRow.liveEstimateTime &&
		timeDifferenceMinutes > 0 &&
		!rowIsCancelled &&
		!hasUnknownDelay;

	return (
		<span
			class={`text-base min-[360px]:text-lg sm:text-xl font-semibold tabular-nums ${rowIsCancelled ? "line-through text-gray-500 dark:text-gray-300" : "text-gray-900 dark:text-gray-50"} min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1`}
		>
			<TimeRow
				departureRow={departureRow}
				arrivalRow={arrivalRow}
				isCancelled={rowIsCancelled}
			/>
			{/* Takes no space until there is a delay, so on-time cards have no
			    empty row. On narrow phones a delay badge wraps under the times. */}
			<output
				aria-label={
					showUnknownDelay
						? t("unknownDelay")
						: showSpecificDelay
							? `${t("late")} ${timeDifferenceMinutes} ${t("minutes")}`
							: undefined
				}
				aria-live="polite"
				aria-hidden={!showUnknownDelay && !showSpecificDelay}
				class={`badge badge-warning badge-sm font-semibold ${!showUnknownDelay && !showSpecificDelay ? "hidden" : ""}`}
			>
				{showUnknownDelay
					? t("unknownDelay")
					: `+${timeDifferenceMinutes || 0} ${t("minutesShort")}`}
			</output>
		</span>
	);
};

export default TimeDisplay;
