import type { Train } from "../types";
import { formatTime } from "../utils/trainUtils";

const TimeRow = ({
	departureRow,
	arrivalRow,
}: {
	departureRow: Train["timeTableRows"][0];
	arrivalRow?: Train["timeTableRows"][0];
}) => (
	<span class="whitespace-nowrap text-gray-600 dark:text-gray-500">
		{departureRow.liveEstimateTime &&
		departureRow.differenceInMinutes &&
		departureRow.differenceInMinutes > 0
			? "~"
			: " "}
		<time
			datetime={departureRow.scheduledTime}
			aria-label={`Lähtöaika ${formatTime(departureRow.scheduledTime)}`}
		>
			{formatTime(departureRow.scheduledTime)}
		</time>
		<span class="mx-2">→</span>
		{arrivalRow && formatTime(arrivalRow.scheduledTime)}
	</span>
);

export default TimeRow;
