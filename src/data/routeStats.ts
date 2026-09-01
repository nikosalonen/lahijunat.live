/** @format */

import type { RouteStats, StationStats } from "../types";
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

const servedRoutes = new Set(routeStatsData.served);

/**
 * Whether any direct commuter train runs this route during a normal week.
 *
 * Most of the ~8,650 generated station pairs have no direct service at all:
 * those pages show only an empty state, so they are served with noindex and
 * kept out of the sitemap. The underlying list covers a full week, so
 * weekend-only routes still count as served.
 */
export const isServedRoute = (
	from: string | null,
	to: string | null,
): boolean => {
	if (!from || !to) return false;
	return servedRoutes.has(`${from}-${to}`);
};

/** Earliest and latest times of a service day, which starts at 04:00. */
const compareServiceDay = (a: string, b: string): number => {
	const offset = (time: string) => {
		const [hour, minute] = time.split(".").map(Number);
		return (hour * 60 + minute - 4 * 60 + 1440) % 1440;
	};
	return offset(a) - offset(b);
};

/**
 * What can be said about departures from one station, summed over its routes.
 *
 * Station pages are the ones worth ranking: there are 93 of them rather than
 * 8,650, and they match how people search ("lähijunat helsinki").
 */
export const getStationStats = (
	shortCode: string | null,
): StationStats | null => {
	if (!shortCode) return null;

	const routes = routeStatsData.routes as Record<string, RouteStats>;
	const prefix = `${shortCode}-`;
	const destinations = new Set<string>();
	const lines = new Set<string>();
	const departures: string[] = [];

	for (const [key, stats] of Object.entries(routes)) {
		if (!key.startsWith(prefix)) continue;
		destinations.add(key.slice(prefix.length));
		for (const line of stats.lines) lines.add(line);
		departures.push(stats.firstDeparture, stats.lastDeparture);
	}

	if (destinations.size === 0) return null;

	departures.sort(compareServiceDay);
	return {
		destinations: destinations.size,
		lines: [...lines].sort(),
		firstDeparture: departures[0],
		lastDeparture: departures[departures.length - 1],
	};
};
