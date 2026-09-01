/** @format */

import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station } from "../types";
import { getLocalizedStationName } from "../utils/stationNames";
import { buildRoutePath } from "../utils/stationRoute";
import { t } from "../utils/translations";

interface Props {
	stations: Station[];
	/** Short codes to link, in the order they should appear. */
	codes: readonly string[];
	/** Translation key for the heading and the nav's accessible name. */
	titleKey: string;
	/**
	 * "footer" inherits the footer's white text, "page" flows a long list into
	 * columns, "sequence" keeps one column so a route reads top to bottom.
	 */
	variant?: "footer" | "page" | "sequence";
	/** Sort alphabetically instead of keeping the order of `codes`. */
	sortByName?: boolean;
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
	sortByName = false,
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

	if (sortByName) {
		links.sort((a, b) => a.label.localeCompare(b.label, "fi"));
	}

	const title = t(titleKey);
	const isFooter = variant === "footer";

	return (
		<nav
			aria-label={title}
			class={
				isFooter
					? "px-4 pb-2 text-sm"
					: variant === "sequence"
						? // As wide as its longest station name, centred under the heading
							"text-sm dark:text-white w-fit mx-auto"
						: "text-sm dark:text-white"
			}
		>
			{showHeading && <h2 class="font-semibold mb-1">{title}</h2>}
			{/* Columns rather than a grid: they fill top to bottom, so a list reads
			    down instead of across. A route stays in one column so its order
			    is unmistakable. */}
			<ul
				class={
					isFooter
						? "flex flex-wrap justify-center gap-x-3 gap-y-1"
						: variant === "sequence"
							? "flex flex-col border-l-2 border-base-300 ml-2 pl-5 py-1"
							: "columns-2 sm:columns-3 md:columns-4 gap-x-6"
				}
			>
				{links.map((link) => (
					<li
						key={link.href}
						class={isFooter ? undefined : "break-inside-avoid py-0.5"}
					>
						<a
							href={link.href}
							class={
								isFooter
									? "hover:text-blue-100 hover:underline underline-offset-2 transition-colors"
									: "link link-hover underline-offset-2"
							}
						>
							{link.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
