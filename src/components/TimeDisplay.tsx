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
			class={`text-xl sm:text-2xl font-medium ${rowIsCancelled ? "line-through text-gray-500 dark:text-gray-300" : "text-gray-800 dark:text-gray-100"} min-w-0 flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 sm:flex-wrap`}
		>
			<TimeRow
				departureRow={departureRow}
				arrivalRow={arrivalRow}
				isCancelled={rowIsCancelled}
			/>
			{/* Always reserve space for delay badge to maintain consistent card height */}
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
				class={`badge badge-warning badge-sm font-semibold ${!showUnknownDelay && !showSpecificDelay ? "invisible" : ""}`}
			>
				{showUnknownDelay
					? t("unknownDelay")
					: `+${timeDifferenceMinutes || 0} ${t("minutesShort")}`}
			</output>
		</span>
	);
};

export default TimeDisplay;
