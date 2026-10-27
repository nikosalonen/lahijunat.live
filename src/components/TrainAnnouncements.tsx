/** @format */

import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { ActiveMessage } from "../utils/passengerInfo";
import { t } from "../utils/translations";

interface Props {
	messages: ActiveMessage[];
	listId: string;
	/** Pulse the strip because an announcement just went live. */
	justArrived?: boolean;
}

/**
 * Compact announcement strip on a train card. Closed, it shows the most
 * urgent announcement cut to two lines plus a "+N" chip for the others.
 * Opening it lists every announcement in full. Validity dates are left out
 * because a train announcement only concerns this trip.
 */
export default function TrainAnnouncements({
	messages,
	listId,
	justArrived = false,
}: Props) {
	const [open, setOpen] = useState(false);
	const [isCutOff, setIsCutOff] = useState(false);
	const firstTextRef = useRef<HTMLParagraphElement>(null);
	const firstText = messages[0]?.text;

	// line-clamp hides the overflow without telling us, so compare the full
	// and visible heights to learn whether the text needs a toggle. Runs again
	// when the text changes.
	useLayoutEffect(() => {
		const element = firstTextRef.current;
		if (open || !element) return;
		const measure = () =>
			setIsCutOff(element.scrollHeight > element.clientHeight + 1);
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [open, firstText]);

	if (messages.length === 0) return null;

	const hiddenCount = messages.length - 1;
	const canToggle = open || isCutOff || hiddenCount > 0;
	const shownMessages = open ? messages : messages.slice(0, 1);
	const toggleLabel = open
		? t("passengerInfoCollapse")
		: hiddenCount > 0
			? `${t("passengerInfoExpand")} (${messages.length})`
			: t("passengerInfoExpand");

	return (
		<div
			class={`relative flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 dark:border-amber-900/60 dark:bg-amber-950/40 ${justArrived ? "animate-announcement-arrive" : ""}`}
		>
			<svg
				class="mt-px h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
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
			{/* The toggle sits beside the text when there is room and wraps under
			    it on narrow phones, so the text never gets squeezed */}
			<div class="flex min-w-0 flex-1 flex-wrap items-end gap-x-2 gap-y-0.5">
				<ul
					id={listId}
					class="min-w-0 flex-[1_1_12rem] divide-y divide-amber-200 text-sm leading-snug text-gray-800 dark:divide-amber-900/60 dark:text-gray-100"
				>
					{shownMessages.map((message, index) => (
						<li key={message.id} class="py-1 first:pt-0 last:pb-0">
							<p
								ref={index === 0 ? firstTextRef : undefined}
								class={`wrap-anywhere ${open ? "" : "line-clamp-3 min-[360px]:line-clamp-2"}`}
							>
								{message.text}
							</p>
						</li>
					))}
				</ul>
				{canToggle && (
					<TrainAnnouncementsToggle
						open={open}
						hiddenCount={hiddenCount}
						label={toggleLabel}
						listId={listId}
						onToggle={() => setOpen((value) => !value)}
					/>
				)}
			</div>
		</div>
	);
}

interface ToggleProps {
	open: boolean;
	hiddenCount: number;
	label: string;
	listId: string;
	onToggle: () => void;
}

function TrainAnnouncementsToggle({
	open,
	hiddenCount,
	label,
	listId,
	onToggle,
}: ToggleProps) {
	return (
		// The ::after layer stretches the tap target over the whole strip
		<button
			type="button"
			class="ml-auto flex items-center gap-1 text-gray-500 outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-primary dark:text-gray-400"
			aria-expanded={open}
			aria-controls={listId}
			aria-label={label}
			onClick={(event) => {
				event.stopPropagation();
				onToggle();
			}}
		>
			{!open && hiddenCount > 0 && (
				<span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-200 px-1.5 text-xs font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-100">
					{`+${hiddenCount}`}
				</span>
			)}
			<svg
				class={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
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
		</button>
	);
}
