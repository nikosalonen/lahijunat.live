/** @format */

import type { Route } from "../data/popularRoutes";
import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station } from "../types";
import { getLocalizedStationName } from "../utils/stationNames";
import { buildRoutePath } from "../utils/stationRoute";
import { t } from "../utils/translations";

interface Props {
	stations: Station[];
	routes: readonly Route[];
	/** Translation key for the heading, e.g. "popularRoutes". */
	titleKey: string;
}

/**
 * The site-wide list of links to popular routes, rendered in the footer.
 *
 * These are the site's only internal links to the generated route pages. They
 * are plain anchors present in the HTML, which is what makes them navigation
 * rather than a crawler-only trick: Google's sitelinks guidance asks for "a
 * logical site structure that is easy for users to navigate" and anchor text
 * "concise and relevant to the page they're pointing to".
 * https://developers.google.com/search/docs/appearance/sitelinks
 */
export default function RouteLinks({ stations, routes, titleKey }: Props) {
	useLanguageChange();

	const stationName = (shortCode: string): string | null => {
		const station = stations.find((s) => s.shortCode === shortCode);
		return station
			? getLocalizedStationName(station.name, station.shortCode)
			: null;
	};

	const links = routes
		.map((route) => {
			const from = stationName(route.from);
			const to = stationName(route.to);
			// Skip routes whose stations are no longer in the network
			if (!from || !to) return null;
			return {
				href: buildRoutePath(route.from, route.to),
				label: `${from} → ${to}`,
			};
		})
		.filter((link): link is { href: string; label: string } => link !== null);

	if (links.length === 0) return null;

	const title = t(titleKey);

	return (
		<nav aria-label={title} class="px-4 pb-2 text-sm">
			<h2 class="font-semibold mb-1">{title}</h2>
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
