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
	stations: Station[],
): RouteStats | null => {
	if (!from || !to) return null;
	const routes = routeStatsData.routes as Record<string, RouteStats>;
	const stats = routes[`${from}-${to}`];
	if (!stats) return null;
	// A route summary keeps every line ever seen running it, including lines
	// too quiet to get a page of their own. Chips pointing at those 404, so
	// only the lines a reader can actually open are worth handing back.
	const pageable = linesWithPages(stations);
	return { ...stats, lines: stats.lines.filter((line) => pageable.has(line)) };
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

/**
 * Trains a route needs on a normal day to be listed in the sitemap.
 *
 * Every served route stays indexable; this only decides what the sitemap asks
 * Google to crawl. Listing all ~2,090 of them meant handing a small site two
 * thousand pages that differ by a station name, and Google answered by
 * marking most of them "discovered, currently not indexed" instead of
 * crawling them. Advertising the routes people actually travel spends the
 * crawl budget on the pages worth having.
 *
 * Be clear about the cost: the dropped pages keep `index, follow`, but no
 * page links to them. Station and line pages link only to single-station
 * pages, so of the 567 routes this threshold drops, 30 are reachable via a
 * reverse link on a kept route's page and 537 have no inbound link at all —
 * they are reachable only through the client-side station picker. Expect
 * Google to find few of them. Raise the threshold knowing that; lower it, or
 * link the routes from somewhere, if that trade stops being worth it.
 */
const MIN_SITEMAP_TRAINS_PER_DAY = 6;

/**
 * The route pages worth asking Google to crawl, as "FROM-TO" keys.
 *
 * Read at build time by the sitemap filter in astro.config.mjs. A route with
 * no summary of its own — weekend-only, or down to a single train on the
 * reference day — has no facts to show either, so `?? 0` leaves it out along
 * with the quiet ones.
 */
export const getSitemapRouteKeys = (): string[] => {
	const routes = routeStatsData.routes as Record<string, RouteStats>;
	return [...servedRoutes].filter(
		(key) => (routes[key]?.trainsPerDay ?? 0) >= MIN_SITEMAP_TRAINS_PER_DAY,
	);
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
	const pageable = linesWithPages(stations);
	return {
		destinations: destinations.size,
		lines: [...lines].filter((line) => pageable.has(line)).sort(),
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

/**
 * Line letters that have a page of their own, so a chip can safely link out.
 *
 * route-stats.json records lines in two places that disagree: a route summary
 * keeps every `commuterLineID` seen on it, while the `lines` object holds only
 * lines busy enough to describe. Line V, for one, runs in 92 route summaries
 * and has no entry — and `src/pages/linja/[line].astro` builds its paths from
 * that object, so `/linja/v/` is never emitted. Filtering through getLines
 * also drops a line left with too few open stations to keep its page.
 */
const linesWithPages = (stations: Station[]): Set<string> =>
	new Set(getLines(stations).map((entry) => entry.line));

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
