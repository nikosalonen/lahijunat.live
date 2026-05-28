/** @format */

import type { ActiveMessage } from "../utils/passengerInfo";
import { t } from "../utils/translations";
import PassengerInfoCarousel from "./PassengerInfoCarousel";

interface Props {
	messages: ActiveMessage[];
	panelId: string;
}

/**
 * Inline panel rendered beneath the TrainCard row when the train's message
 * icon-button is open. Inline (not popover) because TrainCard's outer
 * container uses `overflow-hidden` for swipe-gesture overlays, which would
 * clip a floating popover. Reuses PassengerInfoCarousel for the rare case of
 * multiple active messages on the same train.
 */
export default function TrainMessagePanel({ messages, panelId }: Props) {
	if (messages.length === 0) return null;
	return (
		<section
			id={panelId}
			class="mt-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/60 p-3"
			aria-label={t("passengerInfoBannerTitle")}
		>
			<PassengerInfoCarousel messages={messages} compact showValidity />
		</section>
	);
}
