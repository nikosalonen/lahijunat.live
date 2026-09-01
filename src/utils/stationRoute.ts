/** @format */

import type { Station } from "../types";

/**
 * Builds the URL path for a station pair.
 *
 * Netlify redirects every request to a lowercase path with a trailing slash,
 * so that spelling is the canonical one. Writing the same form client-side
 * keeps history URLs, the canonical tag and analytics on a single spelling
 * instead of splitting each route between `/KE/HKI` and `/ke/hki/`.
 */
export const buildRoutePath = (
	origin: string | null | undefined,
	destination: string | null | undefined,
): string => {
	if (!origin) return "/";
	const codes = destination ? [origin, destination] : [origin];
	return `/${codes.join("/").toLowerCase()}/`;
};

/**
 * Decodes a URL path so it can be compared with the paths we build. Station
 * codes such as KÄP are percent-encoded in `location.pathname`. Malformed
 * escape sequences are returned untouched instead of throwing.
 */
export const decodePath = (pathname: string): string => {
	try {
		return decodeURIComponent(pathname);
	} catch {
		return pathname;
	}
};

/**
 * Finds a station by short code, ignoring case, so that both the lowercase
 * URLs we generate and older uppercase links resolve to the same station.
 */
const findStationByCode = (
	stations: Station[],
	code: string | null | undefined,
): Station | undefined => {
	if (!code) return undefined;
	const needle = code.toLowerCase();
	return stations.find((station) => station.shortCode.toLowerCase() === needle);
};

/** The station's canonical (uppercase) short code, or null if unknown. */
export const resolveShortCode = (
	stations: Station[],
	code: string | null | undefined,
): string | null => findStationByCode(stations, code)?.shortCode ?? null;
