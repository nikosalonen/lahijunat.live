/** @format */

import { useEffect, useState } from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station } from "../types";
import { getLocalizedStationName } from "../utils/stationNames";
import { t } from "../utils/translations";

interface Props {
	/** The same journey the other way, when a direct train runs it. */
	reverse?: { href: string; from: Station; to: Station };
	/** The departure station — where the reader has to get to. The maps link
	 * points here, not at the destination. */
	origin?: Station;
}

/**
 * Whether a station has coordinates worth putting in a link.
 *
 * The API hands back `location` as a positional pair (see api.ts), so a
 * station can arrive with nulls in it. Without this the page would prerender
 * a crawlable `destination=null,null` that looks fine and lands the reader on
 * a broken map. StationManager guards the same way before measuring distance.
 */
const hasCoordinates = (station: Station): boolean =>
	Number.isFinite(station.location?.latitude) &&
	Number.isFinite(station.location?.longitude);

/**
 * A maps link every platform understands.
 *
 * Used for the server-rendered href and as the fallback on desktop. Crawlers
 * and readers without JavaScript get this one, which works everywhere.
 */
const webMapsHref = (station: Station): string =>
	`https://www.google.com/maps/dir/?api=1&destination=${station.location.latitude},${station.location.longitude}`;

/**
 * The href that hands the station to whatever app the reader navigates with.
 *
 * No single URI does this everywhere: `geo:` is the open standard (RFC 5870)
 * and Android passes it to the default maps app, but iOS ignores it. The
 * `?q=…(label)` tail is Google's own extension rather than part of the RFC,
 * and is what puts a name on the pin. Apple is handed an https link that
 * opens Apple Maps on its own devices and stays a working web page
 * elsewhere, so a reader who has deleted Maps.app still gets somewhere.
 */
const nativeMapsHref = (station: Station): string | null => {
	if (typeof navigator === "undefined") return null;

	const { latitude, longitude } = station.location;
	const agent = navigator.userAgent;
	// An iPad reports itself as a Mac, and only its touch points give it away
	const isApple =
		/iPhone|iPad|iPod/.test(agent) ||
		(/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);

	if (isApple) return `https://maps.apple.com/?daddr=${latitude},${longitude}`;
	if (/Android/.test(agent)) {
		const label = encodeURIComponent(station.name);
		return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
	}
	return null;
};

/**
 * The journey back and a way to get to the station.
 *
 * Rendered inside RouteInfo's panel, which StationManager prerenders, so
 * crawlers still see the links; the labels follow the language switcher.
 */
export default function RouteLinks({ reverse, origin }: Props) {
	useLanguageChange();

	// A station with no usable coordinates gets no link at all rather than one
	// pointing at null,null
	const mapsOrigin = origin && hasCoordinates(origin) ? origin : undefined;

	// Starts as the web link so the server and the first client render agree,
	// then becomes the platform's own scheme once the browser is known
	const [mapsHref, setMapsHref] = useState(() =>
		mapsOrigin ? webMapsHref(mapsOrigin) : "",
	);

	useEffect(() => {
		if (!mapsOrigin) return;
		const native = nativeMapsHref(mapsOrigin);
		if (native) setMapsHref(native);
	}, [mapsOrigin]);

	if (!reverse && !mapsOrigin) return null;

	const stationName = (station: Station): string =>
		getLocalizedStationName(station.name, station.shortCode);

	return (
		<div class="flex flex-col gap-2 text-sm dark:text-white">
			{mapsOrigin && (
				<p>
					<svg
						aria-hidden="true"
						class="inline-block w-4 h-4 mr-1.5 -mt-0.5 align-middle"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
						<circle cx="12" cy="10" r="3" />
					</svg>
					<a href={mapsHref} class="text-link">
						{t("navigateToStation")}: {stationName(mapsOrigin)}
					</a>
				</p>
			)}

			{reverse && (
				<p>
					<svg
						aria-hidden="true"
						class="inline-block w-4 h-4 mr-1.5 -mt-0.5 align-middle"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
					</svg>
					<a href={reverse.href} class="text-link">
						{t("reverseDirection")}: {stationName(reverse.from)} &rarr;{" "}
						{stationName(reverse.to)}
					</a>
				</p>
			)}
		</div>
	);
}
