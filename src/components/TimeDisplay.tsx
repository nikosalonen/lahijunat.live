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
			{/* Always show late badge container to maintain consistent spacing */}
			{departureRow.liveEstimateTime &&
				timeDifferenceMinutes > 0 &&
				!rowIsCancelled && (
					<output
						aria-label={`${t("late")} ${timeDifferenceMinutes} ${t("minutes")}`}
						aria-live="polite"
						class="absolute top-0 left-0 badge badge-warning badge-lg font-semibold shadow-lg"
					>
						{`+${timeDifferenceMinutes} min`}
					</output>
				)}
			<TimeRow
				departureRow={departureRow}
				arrivalRow={arrivalRow}
				isCancelled={rowIsCancelled}
			/>
		</span>
	);
};

export default TimeDisplay;
