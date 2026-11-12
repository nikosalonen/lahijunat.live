/** @format */

import { useLanguageChange } from "../hooks/useLanguageChange";
import type { RouteStats, Station, StationStats } from "../types";
import { getLocalizedStationName } from "../utils/stationNames";
import { t, tf } from "../utils/translations";

interface Props {
	/**
	 * The station this page is about: a route page's departure station, or the
	 * single station of a station page.
	 */
	from: Station;
	/** The destination, on a route page. */
	to?: Station;
	/** Facts about the pair, when a direct train runs it. */
	route?: RouteStats | null;
	/** Facts about departures from `from`, on a station page. */
	station?: StationStats | null;
}

/** "D, K, R, T ja Z" — the last pair joined by the language's own word. */
const formatLines = (lines: string[]): string => {
	if (lines.length < 2) return lines.join("");
	const head = lines.slice(0, -1).join(", ");
	return `${head} ${t("listConjunction")} ${lines[lines.length - 1]}`;
};

/**
 * What a crawler can read about this route without running any JavaScript.
 *
 * The live train list is fetched client-side, so before this a route page
 * offered a crawler 63 words of which 44 were identical on every other page —
 * a station name and nothing else. Google's answer was "discovered, currently
 * not indexed": it never spent a crawl on them. These sentences come from the
 * per-route figures already committed in route-stats.json, so every page says
 * something only true of itself.
 *
 * Rendered inside RouteInfo's panel, which StationManager prerenders. The
 * panel is closed by default but stays in the HTML, so a crawler still reads
 * the text, and the prose follows the client-side language switcher.
 */
export default function RouteSummary({ from, to, route, station }: Props) {
	useLanguageChange();

	const fromName = getLocalizedStationName(from.name, from.shortCode);

	// A route page describes the pair; a station page describes the station.
	// An unserved pair has no figures of its own and gets nothing.
	const content =
		to && route
			? {
					heading: tf("routeSummaryHeading", {
						from: fromName,
						to: getLocalizedStationName(to.name, to.shortCode),
					}),
					sentences: [
						tf("routeSummaryTrains", {
							from: fromName,
							to: getLocalizedStationName(to.name, to.shortCode),
							trains: route.trainsPerDay,
						}),
						tf("summaryHours", {
							first: route.firstDeparture,
							last: route.lastDeparture,
						}),
						tf("routeSummaryDuration", { duration: route.medianDuration }),
						route.lines.length > 0
							? tf(
									route.lines.length === 1
										? "routeSummaryLinesOne"
										: "routeSummaryLinesMany",
									{ lines: formatLines(route.lines) },
								)
							: null,
					],
				}
			: station
				? {
						heading: tf("stationSummaryHeading", { station: fromName }),
						sentences: [
							tf("stationSummaryDestinations", {
								station: fromName,
								count: station.destinations,
							}),
							tf("summaryHours", {
								first: station.firstDeparture,
								last: station.lastDeparture,
							}),
							station.lines.length > 0
								? tf(
										station.lines.length === 1
											? "stationSummaryLinesOne"
											: "stationSummaryLinesMany",
										{ lines: formatLines(station.lines) },
									)
								: null,
						],
					}
				: null;

	if (!content) return null;

	const sentences = content.sentences.filter(
		(sentence): sentence is string => sentence !== null,
	);

	return (
		<div>
			<h2 class="text-sm font-semibold mb-1 dark:text-white">
				{content.heading}
			</h2>
			<p class="text-sm leading-relaxed opacity-80 dark:text-white">
				{sentences.join(" ")}
			</p>
		</div>
	);
}
