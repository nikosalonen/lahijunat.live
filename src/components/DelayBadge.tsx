import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Train } from "../types";
import { t } from "../utils/translations";

const DelayBadge = ({
	departureRow,
	timeDifferenceMinutes,
	isCancelled,
}: {
	departureRow: Train["timeTableRows"][0];
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

	// Always rendered, so a screen reader notices when a train turns late.
	// It takes no space until there is a delay.
	return (
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
			class={`badge badge-warning badge-sm font-semibold shrink-0 whitespace-nowrap ${!showUnknownDelay && !showSpecificDelay ? "hidden" : ""}`}
		>
			{showUnknownDelay
				? t("unknownDelay")
				: `+${timeDifferenceMinutes || 0} ${t("minutesShort")}`}
		</output>
	);
};

export default DelayBadge;
