import { useMemo } from "preact/hooks";
import type { Train } from "../types";
import { t } from "../utils/translations";
import TimeRow from "./TimeRow";
// Memoize TimeDisplay
const TimeDisplay = ({
	departureRow,
	arrivalRow,
	timeDifferenceMinutes,
}: {
	departureRow: Train["timeTableRows"][0];
	arrivalRow?: Train["timeTableRows"][0];
	timeDifferenceMinutes: number;
}) => {
	return useMemo(
		() => (
			<span class="text-lg font-medium text-gray-800 dark:text-gray-200 break-words min-w-0">
				{departureRow.liveEstimateTime && timeDifferenceMinutes > 0 ? (
					<span class="flex flex-col">
						<output
							aria-label={`${t('late')} ${timeDifferenceMinutes} ${t('minutes')}`}
							class="mb-1 px-2 py-0.5 bg-[#fed100] text-black rounded text-sm self-start"
						>
							{`+${timeDifferenceMinutes} min`}
						</output>
						<TimeRow departureRow={departureRow} arrivalRow={arrivalRow} />
					</span>
				) : (
					<TimeRow departureRow={departureRow} arrivalRow={arrivalRow} />
				)}
			</span>
		),
		[departureRow, arrivalRow, timeDifferenceMinutes],
	);
};

export default TimeDisplay;
