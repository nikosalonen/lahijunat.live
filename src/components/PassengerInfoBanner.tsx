/** @format */

import { useCallback, useEffect, useId, useState } from "preact/hooks";
import type { ActiveMessage } from "../utils/passengerInfo";
import { t } from "../utils/translations";
import PassengerInfoCarousel from "./PassengerInfoCarousel";

interface Props {
	messages: ActiveMessage[];
}

const PREF_STORAGE_KEY = "passengerInfoPref";

function endOfLocalDay(now: number): number {
	const d = new Date(now);
	d.setHours(24, 0, 0, 0);
	return d.getTime();
}

type PassengerInfoPref =
	| { mode: "never" }
	| { mode: "daily"; snoozedUntil: number };

function readPref(): PassengerInfoPref | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(PREF_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PassengerInfoPref | null;
		if (!parsed || typeof parsed !== "object") return null;
		if (parsed.mode === "never") return parsed;
		if (
			parsed.mode === "daily" &&
			typeof (parsed as { snoozedUntil?: unknown }).snoozedUntil === "number"
		) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}

function writePref(p: PassengerInfoPref): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(p));
	} catch {
		// localStorage may be unavailable; preference is best-effort.
	}
}

function isSnoozed(pref: PassengerInfoPref | null, now: number): boolean {
	if (!pref) return false;
	if (pref.mode === "never") return true;
	return now < pref.snoozedUntil;
}

/**
 * Banner above the train list that surfaces general passenger-information
 * announcements. Collapsed by default; expands to reveal the message text
 * (or a carousel when multiple are active).
 *
 * Dismissal flow:
 * - First time the user clicks ×, an inline confirm row asks whether to
 *   show announcements again later. "Never" hides them permanently; "Hide
 *   for today" snoozes them until the next local midnight.
 * - On subsequent closes the previous choice is applied silently — for the
 *   "daily" mode, that means re-arming the until-midnight snooze without
 *   re-prompting. For "never" the banner never reappears in the first
 *   place, so there is nothing more to click.
 *
 * Choice persists in localStorage under `passengerInfoPref`.
 */
export default function PassengerInfoBanner({ messages }: Props) {
	const [expanded, setExpanded] = useState(false);
	const [pref, setPref] = useState<PassengerInfoPref | null>(() => readPref());
	const [promptOpen, setPromptOpen] = useState(false);
	const panelId = useId();

	const snoozed = isSnoozed(pref, Date.now());

	// Re-arm a render once the daily snooze expires while the page is open.
	useEffect(() => {
		if (pref?.mode !== "daily") return;
		const remaining = pref.snoozedUntil - Date.now();
		if (remaining <= 0) return;
		const handle = window.setTimeout(() => {
			setPref(readPref());
		}, remaining + 100);
		return () => window.clearTimeout(handle);
	}, [pref]);

	// Auto-collapse if message list empties.
	useEffect(() => {
		if (messages.length === 0 && expanded) setExpanded(false);
	}, [messages.length, expanded]);

	const onCloseClick = useCallback(() => {
		// No prior choice → ask once.
		if (!pref) {
			setPromptOpen(true);
			return;
		}
		// Returning user already chose. If they chose "daily" before, just
		// re-arm the 24h snooze silently. ("never" can't reach this branch
		// because the banner would not be visible.)
		if (pref.mode === "daily") {
			const next: PassengerInfoPref = {
				mode: "daily",
				snoozedUntil: endOfLocalDay(Date.now()),
			};
			writePref(next);
			setPref(next);
			setExpanded(false);
		}
	}, [pref]);

	const chooseNever = useCallback(() => {
		const next: PassengerInfoPref = { mode: "never" };
		writePref(next);
		setPref(next);
		setPromptOpen(false);
		setExpanded(false);
	}, []);

	const chooseDaily = useCallback(() => {
		const next: PassengerInfoPref = {
			mode: "daily",
			snoozedUntil: endOfLocalDay(Date.now()),
		};
		writePref(next);
		setPref(next);
		setPromptOpen(false);
		setExpanded(false);
	}, []);

	if (messages.length === 0) return null;
	if (snoozed && !promptOpen) return null;

	const count = messages.length;

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
					aria-controls={panelId}
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
						onCloseClick();
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
			{promptOpen && (
				<div
					class="px-4 py-3 border-t border-amber-200/60 dark:border-amber-900/40 bg-amber-100/40 dark:bg-amber-950/60"
					role="dialog"
					aria-label={t("passengerInfoConfirmPrompt")}
				>
					<p class="text-sm text-gray-800 dark:text-gray-100 mb-3">
						{t("passengerInfoConfirmPrompt")}
					</p>
					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							class="btn btn-sm bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 border-0 text-amber-900 dark:text-amber-100"
							onClick={chooseDaily}
						>
							{t("passengerInfoConfirmDaily")}
						</button>
						<button
							type="button"
							class="btn btn-sm btn-ghost text-gray-700 dark:text-gray-200"
							onClick={chooseNever}
						>
							{t("passengerInfoConfirmNever")}
						</button>
						<button
							type="button"
							class="btn btn-sm btn-ghost text-gray-500 dark:text-gray-400 ml-auto"
							onClick={() => setPromptOpen(false)}
						>
							{t("passengerInfoConfirmCancel")}
						</button>
					</div>
				</div>
			)}
			{expanded && !promptOpen && (
				<div
					id={panelId}
					class="px-4 pb-4 pt-1 border-t border-amber-200/60 dark:border-amber-900/40"
				>
					<PassengerInfoCarousel messages={messages} showStations />
				</div>
			)}
		</section>
	);
}
