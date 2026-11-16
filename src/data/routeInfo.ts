/** @format */

import type { OriginRouteInfo, RouteInfoData, Station } from "../types";
import { getRouteStats, getStationStats, isServedRoute } from "./routeStats";
import { getStationPlace, getTicket } from "./stationInfo";

/**
 * Server-only, like routeStats.ts: the facts for the info row under the
 * station picker, for a route, or for a single station when `to` is null.
 */
export const buildRouteInfo = (
	from: string | null,
	to: string | null,
	stations: Station[],
): RouteInfoData => {
	const route = getRouteStats(from, to, stations);
	const station = to ? null : getStationStats(from, stations);
	return {
		route,
		station,
		lines: route?.lines ?? station?.lines ?? [],
		// Only offer the journey back when a direct train runs it, so the link
		// points at a route with real departures. isServedRoute covers a full
		// week (see its own note), so a weekend-only reverse can still be quiet
		// midweek.
		hasReverse: Boolean(from && to && isServedRoute(to, from)),
		place: getStationPlace(from),
		ticket: getTicket(from, to),
	};
};

/**
 * Everything the info row can show for trips from one station. The browser
 * fetches it when the reader picks a route without loading that route's page.
 * Pairs with no direct train are left out, since they get no row.
 */
export const buildOriginRouteInfo = (
	origin: string,
	stations: Station[],
): OriginRouteInfo => {
	const routes: Record<string, RouteInfoData> = {};
	for (const { shortCode } of stations) {
		if (shortCode === origin) continue;
		const info = buildRouteInfo(origin, shortCode, stations);
		if (info.route) routes[shortCode] = info;
	}
	return { station: buildRouteInfo(origin, null, stations), routes };
};
