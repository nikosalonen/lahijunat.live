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
			class={`text-xl sm:text-2xl font-medium ${rowIsCancelled ? "line-through text-gray-500 dark:text-gray-300" : "text-gray-800 dark:text-gray-100"} min-w-0 flex items-center gap-2 flex-wrap`}
		>
			<TimeRow
				departureRow={departureRow}
				arrivalRow={arrivalRow}
				isCancelled={rowIsCancelled}
			/>
			{showUnknownDelay && (
				<output
					aria-label={t("unknownDelay")}
					aria-live="polite"
					class="badge badge-warning badge-sm font-semibold"
				>
					{t("unknownDelay")}
				</output>
			)}
			{showSpecificDelay && (
				<output
					aria-label={`${t("late")} ${timeDifferenceMinutes} ${t("minutes")}`}
					aria-live="polite"
					class="badge badge-warning badge-sm font-semibold"
				>
					{`+${timeDifferenceMinutes} ${t("minutesShort")}`}
				</output>
			)}
		</span>
	);
};

export default TimeDisplay;
