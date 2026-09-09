/** @format */

import { useEffect, useState } from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station } from "../types";
import { getLocalizedStationName } from "../utils/stationNames";
import { t, tf } from "../utils/translations";

interface Props {
	/** Commuter line letters serving this page's route or station. */
	lines: string[];
	/** The same journey the other way, when a direct train runs it. */
	reverse?: { href: string; from: string; to: string };
	/** The station a reader travels to, i.e. where they catch the train. */
	origin?: Station;
	/** Needed to localise the reverse route's station names. */
	stations: Station[];
}

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
 * and Android passes it to the default maps app, but iOS ignores it, and
 * Apple's own `maps://` is understood only there. So each platform gets its
 * own scheme and everything else keeps the web link.
 */
const nativeMapsHref = (station: Station): string | null => {
	if (typeof navigator === "undefined") return null;

	const { latitude, longitude } = station.location;
	const agent = navigator.userAgent;
	// An iPad reports itself as a Mac, and only its touch points give it away
	const isApple =
		/iPhone|iPad|iPod/.test(agent) ||
		(/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);

	if (isApple) return `maps://?daddr=${latitude},${longitude}`;
	if (/Android/.test(agent)) {
		const label = encodeURIComponent(station.name);
		return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
	}
	return null;
};

/**
 * The lines serving a page's route, the journey back, and a way to get to the
 * station.
 *
 * A Preact island rather than Astro markup so the labels follow the language
 * switcher; Astro renders it at build time, so crawlers still see the links.
 */
export default function RouteLinks({
	lines,
	reverse,
	origin,
	stations,
}: Props) {
	useLanguageChange();

	// Starts as the web link so the server and the first client render agree,
	// then becomes the platform's own scheme once the browser is known
	const [mapsHref, setMapsHref] = useState(() =>
		origin ? webMapsHref(origin) : "",
	);

	useEffect(() => {
		if (!origin) return;
		const native = nativeMapsHref(origin);
		if (native) setMapsHref(native);
	}, [origin]);

	if (lines.length === 0 && !reverse && !origin) return null;

	const stationName = (shortCode: string): string => {
		const match = stations.find((s) => s.shortCode === shortCode);
		return match
			? getLocalizedStationName(match.name, match.shortCode)
			: shortCode;
	};

	return (
		<section class="w-full max-w-3xl mx-auto px-2 sm:px-6 md:px-8 lg:px-12 mt-10">
			<div class="rounded-2xl border border-base-300 p-4 sm:p-5 flex flex-col gap-3">
				{lines.length > 0 && (
					<div class="flex items-center gap-3">
						<span class="text-xs opacity-60 dark:text-white">
							{t("allLines")}
						</span>
						<span class="flex flex-wrap gap-1">
							{lines.map((line) => (
								<a
									key={line}
									href={`/linja/${line.toLowerCase()}/`}
									aria-label={tf("lineHeading", { line })}
									class="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md bg-primary text-primary-content text-xs font-bold hover:opacity-80 transition-opacity"
								>
									{line}
								</a>
							))}
						</span>
					</div>
				)}

				{reverse && (
					<p class="text-sm">
						<a href={reverse.href} class="link link-hover">
							{t("reverseDirection")}: {stationName(reverse.from)} &rarr;{" "}
							{stationName(reverse.to)}
						</a>
					</p>
				)}

				{origin && (
					<p class="text-sm">
						<a
							href={mapsHref}
							class="link link-hover inline-flex items-center gap-1.5"
						>
							<svg
								aria-hidden="true"
								class="w-4 h-4 shrink-0"
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
							{t("navigateToStation")}:{" "}
							{getLocalizedStationName(origin.name, origin.shortCode)}
						</a>
					</p>
				)}
			</div>
		</section>
	);
}
