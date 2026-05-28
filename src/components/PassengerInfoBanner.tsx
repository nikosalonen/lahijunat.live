/** @format */

import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { ActiveMessage } from "../utils/passengerInfo";
import { t } from "../utils/translations";
import PassengerInfoCarousel from "./PassengerInfoCarousel";

interface Props {
	messages: ActiveMessage[];
}

const DISMISSED_STORAGE_KEY = "passengerInfoDismissed";

function readDismissedIds(): Set<string> {
	if (typeof window === "undefined") return new Set();
	try {
		const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return new Set();
		return new Set(parsed.filter((v): v is string => typeof v === "string"));
	} catch {
		return new Set();
	}
}

function writeDismissedIds(ids: Set<string>): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			DISMISSED_STORAGE_KEY,
			JSON.stringify(Array.from(ids)),
		);
	} catch {
		// localStorage may be unavailable (private mode, quota); dismissal is
		// best-effort and not worth surfacing an error.
	}
}

/**
 * Banner above the train list that surfaces general passenger-information
 * announcements (messages with `trainNumber === null`). Collapsed by default;
 * expands to reveal the message text (or a carousel when multiple are active).
 *
 * Dismissal: a small × button on the header marks the currently-visible
 * message IDs as dismissed in localStorage, so they stay hidden across page
 * reloads. Messages with new IDs that the user has not seen will still appear.
 */
export default function PassengerInfoBanner({ messages }: Props) {
	const [expanded, setExpanded] = useState(false);
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
		readDismissedIds(),
	);

	const visibleMessages = useMemo(
		() => messages.filter((m) => !dismissedIds.has(m.id)),
		[messages, dismissedIds],
	);

	const dismissCurrent = useCallback(() => {
		const next = new Set(dismissedIds);
		for (const m of visibleMessages) next.add(m.id);
		writeDismissedIds(next);
		setDismissedIds(next);
		setExpanded(false);
	}, [dismissedIds, visibleMessages]);

	// Collapse if all messages disappear (e.g. delivery window closes or every
	// remaining message gets dismissed).
	useEffect(() => {
		if (visibleMessages.length === 0 && expanded) setExpanded(false);
	}, [visibleMessages.length, expanded]);

	if (visibleMessages.length === 0) return null;

	const count = visibleMessages.length;

	return (
		<section
			class="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/60 shadow-sm"
			aria-label={t("passengerInfoBannerTitle")}
		>
			<div class="w-full flex items-center gap-2 pr-2">
				<button
					type="button"
					class="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
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
					<span class="flex-1 font-medium text-gray-800 dark:text-gray-100 truncate">
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
				<button
					type="button"
					class="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full text-gray-500 dark:text-gray-400 hover:bg-amber-200/70 dark:hover:bg-amber-900/60 transition-colors"
					aria-label={t("passengerInfoDismiss")}
					onClick={(event) => {
						event.stopPropagation();
						dismissCurrent();
					}}
				>
					<svg
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
			{expanded && (
				<div class="px-4 pb-4 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
					<PassengerInfoCarousel messages={visibleMessages} />
				</div>
			)}
		</section>
	);
}
