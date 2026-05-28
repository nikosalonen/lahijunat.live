/** @format */

import { useEffect, useRef, useState } from "preact/hooks";
import { formatValidityHelsinki } from "../utils/helsinkiTime";
import type { ActiveMessage } from "../utils/passengerInfo";
import { t } from "../utils/translations";

interface Props {
	messages: ActiveMessage[];
	compact?: boolean;
	showValidity?: boolean;
}

const AUTO_ADVANCE_MS = 20000;
const TRANSITION_MS = 400;

/**
 * Render one or more active passenger-information messages. When two or more
 * messages are present the component renders carousel chrome (paging dots,
 * prev/next buttons) and auto-advances every 20 seconds. Transitions between
 * messages crossfade. Auto-advance pauses while the carousel is hovered or
 * focused.
 */
export default function PassengerInfoCarousel({
	messages,
	compact = false,
	showValidity = true,
}: Props) {
	const [index, setIndex] = useState(0);
	const [displayedIndex, setDisplayedIndex] = useState(0);
	const [fading, setFading] = useState(false);
	const [paused, setPaused] = useState(false);
	const messageCount = messages.length;
	const safeIndex = messageCount === 0 ? 0 : index % messageCount;

	useEffect(() => {
		if (safeIndex !== index) setIndex(safeIndex);
	}, [safeIndex, index]);

	// Crossfade when the target index changes: fade out, swap, fade in.
	useEffect(() => {
		if (messageCount === 0) return;
		if (displayedIndex === safeIndex) return;
		setFading(true);
		const swap = window.setTimeout(() => {
			setDisplayedIndex(safeIndex);
			setFading(false);
		}, TRANSITION_MS);
		return () => window.clearTimeout(swap);
	}, [safeIndex, displayedIndex, messageCount]);

	// Keep displayedIndex in range if the message list shrinks.
	useEffect(() => {
		if (messageCount === 0) return;
		if (displayedIndex >= messageCount) {
			setDisplayedIndex(messageCount - 1);
		}
	}, [messageCount, displayedIndex]);

	const intervalRef = useRef<number | null>(null);
	useEffect(() => {
		if (intervalRef.current != null) {
			window.clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		if (messageCount < 2 || paused) return;
		intervalRef.current = window.setInterval(() => {
			setIndex((i) => (i + 1) % messageCount);
		}, AUTO_ADVANCE_MS);
		return () => {
			if (intervalRef.current != null) {
				window.clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [messageCount, paused]);

	if (messageCount === 0) return null;

	const renderedIndex = Math.min(displayedIndex, messageCount - 1);
	const current = messages[renderedIndex];
	const single = messageCount === 1;

	const goPrev = () => setIndex((i) => (i - 1 + messageCount) % messageCount);
	const goNext = () => setIndex((i) => (i + 1) % messageCount);

	const textSize = compact ? "text-sm" : "text-sm sm:text-base";
	const validity =
		current.startValidity && current.endValidity
			? t("passengerInfoValidityRange")
					.replace("{start}", formatValidityHelsinki(current.startValidity))
					.replace("{end}", formatValidityHelsinki(current.endValidity))
			: null;

	return (
		<section
			class="relative"
			aria-roledescription="carousel"
			aria-label={t("passengerInfoBannerTitle")}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocusCapture={() => setPaused(true)}
			onBlurCapture={(event) => {
				const next = event.relatedTarget as Node | null;
				if (!next || !event.currentTarget.contains(next)) setPaused(false);
			}}
		>
			<div
				aria-live="polite"
				aria-atomic="true"
				class="transition-opacity ease-in-out"
				style={{
					transitionDuration: `${TRANSITION_MS}ms`,
					opacity: fading ? 0 : 1,
				}}
			>
				<p
					class={`${textSize} text-gray-800 dark:text-gray-100 leading-snug whitespace-pre-wrap`}
				>
					{current.text}
				</p>
				{showValidity && validity && (
					<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						{t("passengerInfoValidity")}: {validity}
					</p>
				)}
			</div>

			{!single && (
				<div class="mt-3 flex items-center justify-between gap-2">
					<button
						type="button"
						class="btn btn-ghost btn-xs px-2"
						aria-label={t("passengerInfoPrev")}
						onClick={goPrev}
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
							<polyline points="15 18 9 12 15 6" />
						</svg>
					</button>
					<div class="flex items-center gap-1.5" role="tablist">
						{messages.map((m, i) => (
							<button
								key={m.id}
								type="button"
								role="tab"
								aria-selected={i === safeIndex}
								aria-label={`${t("passengerInfoIndicator")} ${i + 1}/${messageCount}`}
								class={`h-2 w-2 rounded-full transition-colors ${
									i === safeIndex
										? "bg-[#8c4799] dark:bg-[#b388ff]"
										: "bg-gray-300 dark:bg-gray-600"
								}`}
								onClick={() => setIndex(i)}
							/>
						))}
					</div>
					<button
						type="button"
						class="btn btn-ghost btn-xs px-2"
						aria-label={t("passengerInfoNext")}
						onClick={goNext}
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
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</div>
			)}
		</section>
	);
}
