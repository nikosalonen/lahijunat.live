/** @format */

import type { RouteStats } from "../types";
import routeStatsData from "./route-stats.json";

/**
 * Server-only lookup into the committed route statistics.
 *
 * Import this from Astro page frontmatter, never from a component: the JSON is
 * ~300 kB and must not reach the browser. Pass the single route's stats to the
 * island as a prop instead.
 */
export const getRouteStats = (
	from: string | null,
	to: string | null,
): RouteStats | null => {
	if (!from || !to) return null;
	const routes = routeStatsData.routes as Record<string, RouteStats>;
	return routes[`${from}-${to}`] ?? null;
};

/** The timetable date the statistics were derived from, "YYYY-MM-DD". */
export const routeStatsSourceDate: string = routeStatsData.sourceDate;
