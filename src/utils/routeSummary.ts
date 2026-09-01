/** @format */

import type { RouteStats } from "../types";
import { tf } from "./translations";

/**
 * One sentence of route-specific facts, in the active language.
 *
 * Every route page otherwise carries the same text with only the station names
 * swapped, which is the "content repetition" Google's sitelinks guidance warns
 * about.
 */
export const formatRouteSummary = (stats: RouteStats): string =>
	[
		tf("routeSummaryTrains", { count: stats.trainsPerDay }),
		tf("routeSummaryDuration", { minutes: stats.medianDuration }),
		tf(stats.lines.length === 1 ? "routeSummaryLine" : "routeSummaryLines", {
			lines: stats.lines.join(", "),
		}),
		tf("routeSummaryFirstLast", {
			first: stats.firstDeparture,
			last: stats.lastDeparture,
		}),
	].join(" ");
