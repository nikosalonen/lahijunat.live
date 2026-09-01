/** @format */

import { useLanguageChange } from "../hooks/useLanguageChange";
import type { RouteStats } from "../types";
import { formatRouteSummary } from "../utils/routeSummary";

interface Props {
	stats: RouteStats | null;
	/** The route the stats describe, i.e. the one in the URL. */
	statsFrom: string | null;
	statsTo: string | null;
	/** The route currently selected in the app. */
	activeFrom: string | null;
	activeTo: string | null;
}

/**
 * Route facts under the heading.
 *
 * Hidden once the visitor picks a different route, because the stats come from
 * the page's own URL and the app changes routes without reloading — showing
 * them then would describe the wrong journey.
 */
export default function RouteSummary({
	stats,
	statsFrom,
	statsTo,
	activeFrom,
	activeTo,
}: Props) {
	useLanguageChange();

	if (!stats) return null;
	if (activeFrom !== statsFrom || activeTo !== statsTo) return null;

	return (
		<p class="text-sm text-center opacity-70 mb-6 dark:text-white">
			{formatRouteSummary(stats)}
		</p>
	);
}
