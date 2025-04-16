import { useMemo } from "preact/hooks";
import { useLanguageChange } from '../hooks/useLanguageChange';
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
			<span class={`text-lg font-medium ${isCancelled ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'} break-words min-w-0`}>
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
		[departureRow, arrivalRow, timeDifferenceMinutes, isCancelled],
	);
};

export default TimeDisplay;
