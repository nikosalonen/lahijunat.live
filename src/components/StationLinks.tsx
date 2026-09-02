/** @format */

import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station } from "../types";
import { getLocalizedStationName } from "../utils/stationNames";
import { buildRoutePath } from "../utils/stationRoute";
import { t } from "../utils/translations";

interface Props {
	stations: Station[];
	/**
	 * Short codes to link, in the order they should appear. A ring line's
	 * route repeats its first stops at the end, so a code may appear twice.
	 */
	codes: readonly string[];
	/** Translation key for the heading and the nav's accessible name. */
	titleKey: string;
	/**
	 * "footer" inherits the footer's white text, "sequence" draws the stations
	 * as a route diagram, top to bottom.
	 */
	variant?: "footer" | "sequence";
	/** Off where the page's own h1 already names the list. */
	showHeading?: boolean;
}

/**
 * The site-wide list of station links, rendered in the footer.
 *
 * These are the site's only internal links to the generated pages. They are
 * plain anchors present in the HTML, which is what makes them navigation
 * rather than a crawler-only trick: Google's sitelinks guidance asks for "a
 * logical site structure that is easy for users to navigate" and anchor text
 * "concise and relevant to the page they're pointing to".
 * https://developers.google.com/search/docs/appearance/sitelinks
 */
export default function StationLinks({
	stations,
	codes,
	titleKey,
	variant = "footer",
	showHeading = true,
}: Props) {
	useLanguageChange();

	const links = codes
		.map((code) => {
			const station = stations.find((s) => s.shortCode === code);
			// Skip stations that have left the commuter network
			if (!station) return null;
			return {
				href: buildRoutePath(code, null),
				label: getLocalizedStationName(station.name, station.shortCode),
			};
		})
		.filter((link): link is { href: string; label: string } => link !== null);

	if (links.length === 0) return null;

	const title = t(titleKey);

	if (variant === "sequence") {
		return (
			<nav aria-label={title} class="text-base dark:text-white w-fit mx-auto">
				{showHeading && <h2 class="font-semibold mb-2">{title}</h2>}
				<RouteDiagram links={links} />
			</nav>
		);
	}

	return (
		<nav aria-label={title} class="px-4 pb-2 text-sm">
			{showHeading && <h2 class="font-semibold mb-1">{title}</h2>}
			<ul class="flex flex-wrap justify-center gap-x-3 gap-y-1">
				{links.map((link) => (
					<li key={link.href}>
						<a
							href={link.href}
							class="hover:text-blue-100 hover:underline underline-offset-2 transition-colors"
						>
							{link.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}

/** Horizontal centre of the stop markers, in px; the rail runs through it. */
const RAIL_X = "left-[9px]";

/**
 * A line's stations drawn as a route diagram: one rail in the brand colour,
 * a hollow stop at each station and a filled, larger marker at either end.
 *
 * The rail is two half-height segments per row (above and below the stop)
 * rather than one long line, so it still meets each marker exactly when a
 * long name wraps and makes its row taller.
 */
function RouteDiagram({ links }: { links: { href: string; label: string }[] }) {
	const lastIndex = links.length - 1;
	return (
		<ul class="flex flex-col">
			{links.map((link, index) => {
				const isTerminus = index === 0 || index === lastIndex;
				return (
					<li
						// A ring passes its first stops twice, so the href is not unique
						key={`${index}-${link.href}`}
						data-terminus={isTerminus ? "" : undefined}
						class="relative flex items-center gap-4 py-2"
					>
						{index > 0 && (
							<span
								aria-hidden="true"
								class={`absolute ${RAIL_X} top-0 h-1/2 w-[3px] -translate-x-1/2 bg-primary`}
							/>
						)}
						{index < lastIndex && (
							<span
								aria-hidden="true"
								class={`absolute ${RAIL_X} bottom-0 h-1/2 w-[3px] -translate-x-1/2 bg-primary`}
							/>
						)}
						<span
							aria-hidden="true"
							class={
								isTerminus
									? "relative z-10 shrink-0 w-[18px] h-[18px] rounded-full bg-primary ring-4 ring-primary/20"
									: "relative z-10 shrink-0 w-[14px] h-[14px] mx-0.5 rounded-full bg-base-100 border-[3px] border-primary"
							}
						/>
						<a
							href={link.href}
							class={`link link-hover underline-offset-2 leading-snug ${
								isTerminus ? "font-semibold" : ""
							}`}
						>
							{link.label}
						</a>
					</li>
				);
			})}
		</ul>
	);
}
