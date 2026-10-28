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
	// It takes no space until there is a delay. Below 400 px it shows "+27"
	// without the unit, so a long trip's duration beside it is not cut off.
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
			{showUnknownDelay ? (
				t("unknownDelay")
			) : (
				// One wrapper, so the unit stays inline text instead of becoming its
				// own item in the badge's flex box (which drops the space)
				<span>
					{`+${timeDifferenceMinutes || 0}`}
					<span class="hidden min-[400px]:inline">{` ${t("minutesShort")}`}</span>
				</span>
			)}
		</output>
	);
};

export default DelayBadge;
