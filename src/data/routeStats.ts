/** @format */

import type { LineStats, RouteStats, Station, StationStats } from "../types";
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
 * Short codes of the stations currently in service.
 *
 * The station list comes from the live API on every build and a daily workflow
 * drops stations that lose their commuter traffic, so it is up to a month
 * fresher than route-stats.json. Everything derived from the snapshot is
 * filtered through it, which is what keeps a station closed for renovation
 * from lingering on line pages until the next refresh.
 */
const openStations = (stations: Station[]): Set<string> =>
	new Set(stations.map((station) => station.shortCode));

/** A line needs this many open stations left to still describe a route. */
const MIN_LINE_STATIONS = 4;

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
	stations: Station[],
): StationStats | null => {
	if (!shortCode) return null;

	const open = openStations(stations);
	if (!open.has(shortCode)) return null;

	const routes = routeStatsData.routes as Record<string, RouteStats>;
	const prefix = `${shortCode}-`;
	const destinations = new Set<string>();
	const lines = new Set<string>();
	const departures: string[] = [];

	for (const [key, stats] of Object.entries(routes)) {
		if (!key.startsWith(prefix)) continue;
		const destination = key.slice(prefix.length);
		// A station closed for renovation leaves the station list days before
		// this snapshot is refreshed; do not count journeys to it
		if (!open.has(destination)) continue;
		destinations.add(destination);
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

const lineStats = routeStatsData.lines as Record<string, LineStats>;

/**
 * Rewrites a line around the stations still in service.
 *
 * Closed stations drop out of the list, the count and the label, and a line
 * left with almost nothing to serve is dropped altogether rather than
 * described by its remnants.
 */
const withOpenStations = (
	stats: LineStats,
	open: Set<string>,
): LineStats | null => {
	const stations = stats.stations.filter((code) => open.has(code));
	if (stations.length < MIN_LINE_STATIONS) return null;

	// A ring keeps its identity only while the station at both ends is open
	const isRing =
		stats.endpoints[0] === stats.endpoints[1] && open.has(stats.endpoints[0]);
	const via = stats.via && open.has(stats.via) ? stats.via : null;

	return {
		...stats,
		stations,
		endpoints: isRing
			? [stats.endpoints[0], stats.endpoints[0]]
			: [stations[0], stations[stations.length - 1]],
		via: isRing ? (via ?? stations[Math.floor(stations.length / 2)]) : null,
		returnStops: isRing
			? stats.returnStops.filter((code) => open.has(code))
			: [],
	};
};

/** Commuter lines that run on a weekday, in alphabetical order. */
export const getLines = (
	stations: Station[],
): { line: string; stats: LineStats }[] => {
	const open = openStations(stations);
	return Object.entries(lineStats)
		.map(([line, stats]) => ({ line, stats: withOpenStations(stats, open) }))
		.filter(
			(entry): entry is { line: string; stats: LineStats } =>
				entry.stats !== null,
		)
		.sort((a, b) => a.line.localeCompare(b.line));
};

/** One line's facts, or null if it no longer runs. Case-insensitive. */
export const getLineStats = (
	line: string | null,
	stations: Station[],
): LineStats | null => {
	if (!line) return null;
	const stats = lineStats[line.toUpperCase()];
	if (!stats) return null;
	return withOpenStations(stats, openStations(stations));
};
