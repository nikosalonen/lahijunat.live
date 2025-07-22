import { useMemo } from "preact/hooks";
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
	return useMemo(
		() => (
			<span
				class={`text-xl sm:text-2xl font-medium ${isCancelled ? "line-through text-gray-500 dark:text-gray-300" : "text-gray-800 dark:text-gray-100"} break-words min-w-0 relative pt-8 sm:pt-6 max-w-full overflow-hidden`}
			>
				{departureRow.liveEstimateTime &&
				timeDifferenceMinutes > 0 &&
				!isCancelled ? (
					<>
						<output
							aria-label={`${t("late")} ${timeDifferenceMinutes} ${t("minutes")}`}
							class="absolute top-0 left-0 px-3 py-1 sm:px-2 sm:py-0.5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black rounded-lg text-base sm:text-base font-semibold shadow-lg"
						>
							{`+${timeDifferenceMinutes} min`}
						</output>
						<TimeRow departureRow={departureRow} arrivalRow={arrivalRow} />
					</>
				) : (
					<TimeRow departureRow={departureRow} arrivalRow={arrivalRow} />
				)}
			</span>
		),
		[departureRow, arrivalRow, timeDifferenceMinutes, isCancelled],
	);
};

export default TimeDisplay;
