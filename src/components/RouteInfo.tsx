/** @format */

import { useId, useState } from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import type { RouteStats, Station, StationStats } from "../types";
import { hapticLight } from "../utils/haptics";
import { t, tf } from "../utils/translations";
import RouteLinks from "./RouteLinks";
import RouteSummary from "./RouteSummary";

interface Props {
	/** A route page's departure station, or the single station of a station page. */
	from: Station;
	/** The destination, on a route page. */
	to?: Station;
	route?: RouteStats | null;
	station?: StationStats | null;
	/** Commuter line letters serving this route or station. */
	lines: string[];
	/** The same journey the other way, when a direct train runs it. */
	reverse?: { href: string; from: Station; to: Station };
}

/**
 * How many of `total` line badges the closed row shows when `fit` items fit:
 * all of them, or one fewer to make room for a "+N" chip. Helsinki–Pasila
 * alone has 13 lines; from the sm breakpoint up, every list fits.
 */
const shownLineCount = (total: number, fit: number): number =>
	total > fit ? fit - 1 : total;

const LineBadge = ({
	line,
	class: extraClass = "",
}: {
	line: string;
	class?: string;
}) => (
	<li class={extraClass}>
		<a
			href={`/linja/${line.toLowerCase()}/`}
			aria-label={tf("lineHeading", { line })}
			class="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md bg-primary text-primary-content text-xs font-bold hover:opacity-80 transition-opacity"
		>
			{line}
		</a>
	</li>
);

/**
 * Facts about the page's route or station, folded into one row under the
 * station picker.
 *
 * The closed row keeps what helps at a glance in view: the lines and the
 * typical trip time. The summary text and the links open below it. The panel
 * is hidden with the `hidden` attribute rather than left out, so its text is
 * still in the prerendered HTML for crawlers (see RouteSummary).
 */
export default function RouteInfo({
	from,
	to,
	route,
	station,
	lines,
	reverse,
}: Props) {
	useLanguageChange();
	const [isOpen, setIsOpen] = useState(false);
	const panelId = useId();

	// Four items fit a 360 px phone and five a 390 px one. Class names stay
	// written out in full so Tailwind finds them.
	const narrowCount = shownLineCount(lines.length, 4);
	const phoneCount = shownLineCount(lines.length, 5);
	const badgeClass = (index: number): string =>
		index < narrowCount
			? ""
			: index < phoneCount
				? "hidden min-[390px]:block"
				: "hidden sm:block";
	// The panel repeats the full list wherever the row had to fold some away
	const panelLinesClass =
		phoneCount < lines.length
			? "sm:hidden"
			: narrowCount < lines.length
				? "min-[390px]:hidden"
				: null;

	const toggle = () => {
		hapticLight();
		setIsOpen((open) => !open);
	};
	const moreChip = (count: number, chipClass: string) => (
		<li class={chipClass}>
			<button
				type="button"
				onClick={() => {
					hapticLight();
					setIsOpen(true);
				}}
				aria-label={t("showAllLines")}
				aria-controls={panelId}
				class="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md border border-primary/40 text-primary dark:text-white text-xs font-bold"
			>
				+{count}
			</button>
		</li>
	);

	return (
		<section class="rounded-2xl border border-base-300 dark:text-white">
			<div class="flex items-center gap-2 min-h-11 pl-3 pr-1 py-1">
				{lines.length > 0 && (
					<ul aria-label={t("allLines")} class="flex flex-wrap gap-1 min-w-0">
						{lines.map((line, index) => (
							<LineBadge key={line} line={line} class={badgeClass(index)} />
						))}
						{narrowCount < lines.length &&
							moreChip(lines.length - narrowCount, "min-[390px]:hidden")}
						{phoneCount < lines.length &&
							moreChip(
								lines.length - phoneCount,
								"hidden min-[390px]:block sm:hidden",
							)}
					</ul>
				)}

				{to && route && (
					<span class="flex items-center gap-1 shrink-0 text-sm text-base-content/70 dark:text-white/70">
						<svg
							class="w-3.5 h-3.5"
							fill="currentColor"
							viewBox="0 0 512 512"
							aria-hidden="true"
						>
							<path d="M256 0a256 256 0 1 1 0 512A256 256 0 0 1 256 0zm-24 120v136c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z" />
						</svg>
						<span class="sr-only">{t("duration")} </span>
						{route.medianDuration} min
					</span>
				)}

				<button
					type="button"
					onClick={toggle}
					aria-expanded={isOpen}
					aria-controls={panelId}
					class="btn btn-ghost btn-sm ml-auto shrink-0 gap-1 px-2 font-medium"
				>
					{to ? t("routeInfo") : t("stationInfo")}
					<svg
						aria-hidden="true"
						class={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</button>
			</div>

			<div
				id={panelId}
				hidden={!isOpen}
				class="border-t border-base-300 px-3 py-3 flex flex-col gap-3"
			>
				{panelLinesClass && (
					<ul
						aria-label={t("allLines")}
						class={`${panelLinesClass} flex flex-wrap gap-1`}
					>
						{lines.map((line) => (
							<LineBadge key={line} line={line} />
						))}
					</ul>
				)}
				<RouteSummary from={from} to={to} route={route} station={station} />
				<RouteLinks reverse={reverse} origin={from} />
			</div>
		</section>
	);
}
