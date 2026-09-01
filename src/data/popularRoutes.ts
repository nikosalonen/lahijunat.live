/** @format */

export interface Route {
	from: string;
	to: string;
}

/**
 * Routes linked from the footer on every page.
 *
 * These are the only station pairs the site links to internally, so they are
 * the pages Google can reach without the sitemap — and the pool it picks
 * sitelinks from. Keep the list short and ordered by real usage: check the
 * top pages in counter.dev and edit this file when the order changes.
 *
 * Codes are canonical (uppercase) station short codes; the URL is built from
 * them by buildRoutePath.
 */
export const POPULAR_ROUTES: readonly Route[] = [
	{ from: "HKI", to: "LEN" },
	{ from: "LEN", to: "HKI" },
	{ from: "HKI", to: "TKL" },
	{ from: "TKL", to: "HKI" },
	{ from: "HKI", to: "KE" },
	{ from: "KE", to: "HKI" },
];
