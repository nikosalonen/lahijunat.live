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
	return (
		<span
			class={`text-xl sm:text-2xl font-medium ${rowIsCancelled ? "line-through text-gray-500 dark:text-gray-300" : "text-gray-800 dark:text-gray-100"} min-w-0 relative pt-8 sm:pt-6`}
		>
			{departureRow.liveEstimateTime &&
			timeDifferenceMinutes > 0 &&
			!rowIsCancelled ? (
				<>
					<output
						aria-label={`${t("late")} ${timeDifferenceMinutes} ${t("minutes")}`}
						class="absolute top-0 left-0 px-2 py-0.5 sm:px-2 sm:py-0.5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black rounded-lg text-sm sm:text-base font-semibold shadow-lg"
					>
						{`+${timeDifferenceMinutes} min`}
					</output>
					{/* Spacer to add air between the delay tag and time row */}
					<div class="h-2 sm:h-1" />
					<TimeRow
						departureRow={departureRow}
						arrivalRow={arrivalRow}
						isCancelled={rowIsCancelled}
					/>
				</>
			) : (
				<TimeRow
					departureRow={departureRow}
					arrivalRow={arrivalRow}
					isCancelled={rowIsCancelled}
				/>
			)}
		</span>
	);
};

export default TimeDisplay;
