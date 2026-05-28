/** @format */

import { useState } from "preact/hooks";
import type { ActiveMessage } from "../utils/passengerInfo";
import { t } from "../utils/translations";
import PassengerInfoCarousel from "./PassengerInfoCarousel";

interface Props {
	messages: ActiveMessage[];
}

/**
 * Banner above the train list that surfaces general passenger-information
 * announcements (messages with `trainNumber === null`). Collapsed by default;
 * expands to reveal the message text (or a carousel when multiple are active).
 */
export default function PassengerInfoBanner({ messages }: Props) {
	const [expanded, setExpanded] = useState(false);

	if (messages.length === 0) return null;

	const count = messages.length;

	return (
		<section
			class="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/60 shadow-sm"
			aria-label={t("passengerInfoBannerTitle")}
		>
			<button
				type="button"
				class="w-full flex items-center gap-3 px-4 py-3 text-left"
				aria-expanded={expanded}
				onClick={() => setExpanded((v) => !v)}
			>
				<svg
					class="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				<span class="flex-1 font-medium text-gray-800 dark:text-gray-100">
					{t("passengerInfoBannerTitle")}
					<span class="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-200 dark:bg-amber-800 text-xs text-amber-900 dark:text-amber-100">
						{count}
					</span>
				</span>
				<svg
					class={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
				<span class="sr-only">
					{expanded ? t("passengerInfoCollapse") : t("passengerInfoExpand")}
				</span>
			</button>
			{expanded && (
				<div class="px-4 pb-4 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
					<PassengerInfoCarousel messages={messages} />
				</div>
			)}
		</section>
	);
}
