/** @format */

import type { APIRoute, GetStaticPaths } from "astro";
import { buildOriginRouteInfo } from "../../data/routeInfo";
import type { Station } from "../../types";
import { fetchStations } from "../../utils/api";

// One file per departure station, e.g. /route-info/hki.json. StationManager
// fetches it when the reader picks a route without loading that route's page.
export const getStaticPaths = (async () => {
	const stations = await fetchStations();
	return stations.map((station) => ({
		params: { station: station.shortCode.toLowerCase() },
		props: { shortCode: station.shortCode, stations },
	}));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ shortCode: string; stations: Station[] }> = ({
	props,
}) =>
	new Response(
		JSON.stringify(buildOriginRouteInfo(props.shortCode, props.stations)),
		{ headers: { "Content-Type": "application/json" } },
	);
