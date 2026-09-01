/** @format */

import { useLanguageChange } from "../hooks/useLanguageChange";
import type { RouteStats, StationStats } from "../types";
import {
	formatRouteSummary,
	formatStationSummary,
} from "../utils/routeSummary";

interface Props {
	routeStats: RouteStats | null;
	stationStats: StationStats | null;
	/** The route the stats describe, i.e. the one in the URL. */
	statsFrom: string | null;
	statsTo: string | null;
	/** The route currently selected in the app. */
	activeFrom: string | null;
	activeTo: string | null;
}

/**
 * Route or station facts under the heading.
 *
 * The stats come from the page's own URL and the app changes routes without
 * reloading, so nothing is shown once the visitor selects something else —
 * the alternative is describing the wrong journey.
 */
export default function RouteSummary({
	routeStats,
	stationStats,
	statsFrom,
	statsTo,
	activeFrom,
	activeTo,
}: Props) {
	useLanguageChange();

	if (activeFrom !== statsFrom || activeTo !== statsTo) return null;

	const summary = statsTo
		? routeStats && formatRouteSummary(routeStats)
		: stationStats && formatStationSummary(stationStats);
	if (!summary) return null;

	return (
		<p class="text-sm text-center opacity-70 mb-6 dark:text-white">{summary}</p>
	);
}
