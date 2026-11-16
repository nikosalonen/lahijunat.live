/** @format */

import type { OriginRouteInfo, RouteInfoData } from "../types";

// One request per departure station per session. The files change only with
// a new build.
const files = new Map<string, Promise<OriginRouteInfo | null>>();

const loadFile = async (origin: string): Promise<OriginRouteInfo | null> => {
	try {
		const response = await fetch(`/route-info/${origin.toLowerCase()}.json`);
		if (!response.ok) return null;
		return (await response.json()) as OriginRouteInfo;
	} catch {
		return null;
	}
};

/**
 * The info row's facts for a route, or for a single station when
 * `destination` is null, read from the departure station's build-time file
 * (see src/pages/route-info/[station].json.ts).
 *
 * Returns null when the route has no direct train or the file fails to load.
 * The row is extra information, so a failure only leaves it out.
 */
export const fetchRouteInfo = async (
	origin: string,
	destination: string | null,
): Promise<RouteInfoData | null> => {
	let file = files.get(origin);
	if (!file) {
		file = loadFile(origin);
		files.set(origin, file);
	}
	const info = await file;
	if (!info) {
		// Forget the failure so the next pick tries again
		if (files.get(origin) === file) files.delete(origin);
		return null;
	}
	return destination ? (info.routes[destination] ?? null) : info.station;
};
