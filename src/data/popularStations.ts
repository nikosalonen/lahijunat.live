/** @format */

/**
 * Stations linked from the footer on every page.
 *
 * These are the site's only internal links, so they are the pages Google can
 * reach without the sitemap. Station pages are the ones worth linking: there
 * are 93 of them rather than 8,650 route pairs, and they match how people
 * search — "lähijunat helsinki" rather than a station pair.
 *
 * Ordered by real usage; check the top pages in counter.dev or Search Console
 * and edit this list when the order changes.
 */
export const POPULAR_STATIONS: readonly string[] = [
	"HKI",
	"PSL",
	"TKL",
	"LEN",
	"KE",
	"LPV",
];
